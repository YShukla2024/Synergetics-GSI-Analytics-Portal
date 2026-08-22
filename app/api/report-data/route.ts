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
 * Live numbers from the Power BI semantic model, queried as the signed-in user.
 */

function rowsOf(response: unknown): Record<string, unknown>[] {
  return (
    (response as { results?: { tables?: { rows?: Record<string, unknown>[] }[] }[] })?.results?.[0]?.tables?.[0]?.rows ?? []
  );
}

function summarizeSchema(columnsRaw: unknown, measuresRaw: unknown) {
  const columns = rowsOf(columnsRaw);
  const measures = rowsOf(measuresRaw);
  const tables = [...new Set(columns.map((c) => String(c.TableName ?? "").trim()).filter(Boolean))].sort();
  const columnList = columns
    .map((c) => ({ table: String(c.TableName ?? ""), name: String(c.Name ?? ""), type: String(c.DataType ?? "") }))
    .sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name));
  const measureList = measures
    .map((m) => ({ table: String(m.TableName ?? ""), name: String(m.Name ?? ""), expression: String(m.Expression ?? "").slice(0, 300) }))
    .sort((a, b) => a.table.localeCompare(b.table) || a.name.localeCompare(b.name));
  return { tables, columnCount: columnList.length, columns: columnList, measures: measureList };
}

export async function GET(request: Request) {
  console.log("[report-data] Request received");

  const jwt = await getToken({
    req: request as any,
    secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET,
    secureCookie: true,
  });

  if (!jwt) {
    console.log("[report-data] No session found via getToken()");
    return NextResponse.json({ error: "Unauthorized — sign in to continue." }, { status: 401 });
  }

  console.log("[report-data] User:", jwt.email);
  const url = new URL(request.url);

  try {
    if (url.searchParams.has("schema")) {
      if (!canAccess(jwt.accessLevel as string, "analyst")) {
        return NextResponse.json({ error: "Forbidden — your access level cannot view analytics." }, { status: 403 });
      }
      const [columnsRaw, measuresRaw] = await Promise.all([
        executeDaxQuery(jwt as any, SCHEMA_QUERIES.columns.dax).catch((err: unknown) => {
          console.error("[report-data] columns query failed:", err);
          return null;
        }),
        executeDaxQuery(jwt as any, SCHEMA_QUERIES.measures.dax).catch((err: unknown) => {
          console.error("[report-data] measures query failed:", err);
          return null;
        }),
      ]);
      const schema = summarizeSchema(columnsRaw ?? [], measuresRaw ?? []);
      console.log(`[report-data] schema: ${schema.tables.length} tables, ${schema.columnCount} columns, ${schema.measures.length} measures`);
      return NextResponse.json({ live: true, schema });
    }

    const values: Record<string, number> = {};
    for (const [key, def] of Object.entries(KPI_QUERIES)) {
      if (!VERIFIED_KPI_KEYS.includes(key)) continue;
      try {
        const data = await executeDaxQuery(jwt as any, def.dax);
        const value = firstScalar(data);
        if (value != null) values[key] = value;
      } catch (err) {
        console.error(`[report-data] KPI '${key}' query failed:`, err);
      }
    }

    return NextResponse.json({ live: true, values });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error querying report data.";
    return NextResponse.json({ live: false, error: message }, { status: 502 });
  }
}
