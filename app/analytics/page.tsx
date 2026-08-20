import { redirect } from "next/navigation";
import AppShell from "@/components/layout/AppShell";
import Breadcrumb from "@/components/ui/Breadcrumb";
import PowerBIContainer from "@/components/ui/PowerBIContainer";
import { auth } from "@/auth";
import { canAccess } from "@/lib/access";

export default async function AnalyticsPage() {
  // Analytics requires analyst or higher (local accounts). Entra users (no
  // access level) keep full access.
  const session = await auth();
  if (!canAccess(session?.user?.accessLevel, "analyst")) redirect("/dashboard");

  return (
    <AppShell>
      <Breadcrumb items={[{ label: "GSI Analytics Portal", href: "/dashboard" }, { label: "Analytics" }]} />

      <div className="mb-5">
        <h2 className="font-display uppercase tracking-wide text-xl font-semibold text-ink">Analytics</h2>
        <p className="text-sm text-ink-subtle mt-0.5">
          Live GSI delivery analytics across programs, partners, and delivery teams.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_300px] gap-5">
        <div className="min-w-0">
          <PowerBIContainer title="GSI Analytics" height={620} />
        </div>

        {/* Side photo rail — fills the empty space beside the report */}
        <aside className="hidden xl:flex flex-col gap-4">
          <div className="relative overflow-hidden rounded-card border border-surface-border shadow-card">
            <img
              src="/login-team.jpg"
              alt="Team collaborating on delivery work"
              className="h-36 w-full object-cover"
            />
          </div>
          <div className="relative overflow-hidden rounded-card border border-surface-border shadow-card rotate-[0.6deg]">
            <img
              src="/login-training.jpg"
              alt="Instructor-led training session"
              className="h-36 w-full object-cover"
            />
          </div>
          <div className="relative overflow-hidden rounded-card border border-surface-border shadow-card rotate-[-0.4deg]">
            <img
              src="/login-office.jpg"
              alt="Modern office workspace"
              className="h-36 w-full object-cover"
            />
          </div>
          <div className="rounded-card bg-gradient-to-br from-primary-dark via-primary to-[#C94A7B] p-4 text-white shadow-card">
            <p className="font-display uppercase tracking-wide text-sm font-semibold">GSI Delivery</p>
            <p className="text-xs text-white/80 mt-1 leading-relaxed">
              Programs delivered by Synergetics across Microsoft GSI — analytics, training, and
              support in one live view.
            </p>
          </div>
        </aside>
      </div>
    </AppShell>
  );
}
