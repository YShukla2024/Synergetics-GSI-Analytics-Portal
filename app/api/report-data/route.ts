import { NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
import { canAccess } from "@/lib/access";
import {
  executeDaxQuery,
  firstScalar,
  KPI_QUERIES,
  SCHEMA_QUERIES,
  VERIFIED_KPI_KEYS,
} from "@/lib/powerbi-user";

/**
 * GET /api/report-data
 * ---------------------------------------------------------------------------
 * Live numbers straight from the "MS-GSI-Report" semantic model, queried as
 * the signed-in user (Power BI enforces RLS automatically — owners see all,
 * RLS-role members see only their rows).
 *
 * Query params:
 *   ?kpi=all   → real value per dashboard KPI (missing ones fall back to
 *                sample data on the client)
 *   ?schema=1  → model catalog: tables, columns, and — crucially — the
 *                report's MEASURES (names + expressions), for refining KPI
 *                semantics to the exact figures behind the dashboard
 *
 * Protected by middleware (401 without a session). Also self-checks the JWT.
 * Failures (e.g. Dataset.Read.All not yet consented) return a readable error
 * and the dashboard keeps its sample data until consent is granted.
 */

function rowsOf(response: unknown): Record<string, unknown>[] {
  return (
    (response as { results?: { tables?: { rows?: Record<string, unknown>[] }[] }[] })
      ?.results?.[0]?.tables?.[0]?.rows ?? []
  );
}

/** Condenses raw INFO.COLUMNS() / INFO.MEASURES() responses to a readable shape. */
function summarizeSchema(columnsRaw: unknown, measuresRaw: unknown) {
  const columns = rowsOf(columnsRaw);
  const measures = rowsOf(measuresRaw);
  const tables = [
    ...new Set(columns.map((c) => String(c.TableName ?? "").trim()).filter(Boolean)),
  ].sort();
  const columnList = columns
    .map((c) => ({
      table: String(c.TableName ?? ""),
      name: String(c.Name ?? ""),
      type: String(c.DataType ?? ""),
    }))
    .sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name));
  const measureList = measures
    .map((m) => ({
      table: String(m.TableName ?? ""),
      name: String(m.Name ?? ""),
      expression: String(m.Expression ?? "").slice(0, 300),
    }))
    .sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name));
  return { tables, columnCount: columnList.length, columns: columnList, measures: measureList };
}

export async function GET(request: Request) {
  const jwt = await getToken({
    req: request,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
  });
  if (!jwt) {
    return NextResponse.json({ error: "Unauthorized — sign in to continue." }, { status: 401 });
  }

  const url = new URL(request.url);

  try {
    // Schema catalog — handy for mapping exact report measures to the UI.
    // Expose it only to analyst+ accounts (it reveals model internals).
    if (url.searchParams.has("schema")) {
      if (!canAccess(jwt.accessLevel, "analyst")) {
        return NextResponse.json(
          { error: "Forbidden — your access level cannot view analytics." },
          { status: 403 }
        );
      }
      const [columnsRaw, measuresRaw] = await Promise.all([
        executeDaxQuery(jwt, SCHEMA_QUERIES.columns.dax).catch((err) => {
          console.error("[report-data] columns query failed:", err);
          return null;
        }),
        executeDaxQuery(jwt, SCHEMA_QUERIES.measures.dax).catch((err) => {
          console.error("[report-data] measures query failed:", err);
          return null;
        }),
      ]);
      const schema = summarizeSchema(columnsRaw ?? [], measuresRaw ?? []);
      // Land the catalog in the dev log so the KPI DAX can be finalized from
      // the log alone (no need to paste the JSON back).
      console.log(
        `[report-data] schema: ${schema.tables.length} tables, ${schema.columnCount} columns, ${schema.measures.length} measures`
      );
      console.log(
        "[report-data] measures:",
        schema.measures.map((m) => `${m.table}::${m.name}`).join(" | ")
      );
      return NextResponse.json({ live: true, schema });
    }

    // Live KPI values. Only VERIFIED queries override the sample/report
    // values (the v1 row-count DAX is not the report's measures and must not
    // replace the exact executive numbers). Each query is independent: one
    // failure only drops that KPI, the rest still resolve.
    const values: Record<string, number> = {};
    for (const [key, def] of Object.entries(KPI_QUERIES)) {
      if (!VERIFIED_KPI_KEYS.includes(key)) continue;
      try {
        const data = await executeDaxQuery(jwt, def.dax);
        const value = firstScalar(data);
        if (value != null) values[key] = value;
      } catch (err) {
        // Keep the key out of `values` → client falls back to sample data.
        // Logged (not hidden) so KPI/table-name mismatches are debuggable.
        console.error(`[report-data] KPI '${key}' query failed:`, err);
      }
    }

    return NextResponse.json({ live: true, values });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error querying report data.";
    return NextResponse.json({ live: false, error: message }, { status: 502 });
  }
}
