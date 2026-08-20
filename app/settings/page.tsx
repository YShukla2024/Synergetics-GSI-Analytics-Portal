import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import Breadcrumb from "@/components/ui/Breadcrumb";
import { auth } from "@/auth";
import { canAccess } from "@/lib/access";

export default async function SettingsPage() {
  const session = await auth();
  // Settings is admin-only (local accounts); Entra users (no access level)
  // keep full access.
  if (!canAccess(session?.user?.accessLevel, "admin")) redirect("/dashboard");
  const user = session?.user;

  return (
    <AppShell>
      <Breadcrumb items={[{ label: "GSI Analytics Portal", href: "/dashboard" }, { label: "Settings" }]} />

      <div className="mb-5">
        <h2 className="font-display uppercase tracking-wide text-xl font-semibold text-ink">Settings</h2>
        <p className="text-sm text-ink-subtle mt-0.5">Manage your profile and portal preferences.</p>
      </div>

      <div className="bg-white rounded-card border border-surface-border shadow-card p-5 max-w-xl space-y-4">
        <div>
          <label className="text-xs font-medium text-ink-subtle">Full name</label>
          <input
            defaultValue={user?.name ?? ""}
            className="mt-1 w-full h-10 px-3 rounded-md border border-surface-border text-sm focus:border-primary"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-subtle">Work email</label>
          <input
            defaultValue={user?.email ?? user?.preferredUsername ?? ""}
            disabled
            className="mt-1 w-full h-10 px-3 rounded-md border border-surface-border text-sm bg-surface-hover text-ink-disabled"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-ink-subtle">Role</label>
          <input
            defaultValue={(user?.roles ?? ["Viewer"]).join(", ")}
            disabled
            className="mt-1 w-full h-10 px-3 rounded-md border border-surface-border text-sm bg-surface-hover text-ink-disabled"
          />
        </div>
        <button className="h-9 px-4 rounded-md bg-primary text-white text-sm font-medium hover:bg-primary-dark">
          Save changes
        </button>
      </div>
    </AppShell>
  );
}
