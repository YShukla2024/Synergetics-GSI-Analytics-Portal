"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import { Menu, LayoutDashboard, BarChart3, Settings, User, LogOut, ChevronDown } from "lucide-react";
import { navItems } from "@/data/dummyData";
import type { NavItem } from "@/lib/types";
import { canAccess } from "@/lib/access";

const ICONS: Record<NavItem["icon"], React.ComponentType<{ size?: number; strokeWidth?: number }>> = {
  dashboard: LayoutDashboard,
  analytics: BarChart3,
  settings: Settings,
};

export default function HeaderMenu() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const { data: session } = useSession();
  const level = session?.user?.accessLevel;

  // Local accounts are gated by access level; Entra accounts (no level) see all.
  const visibleItems = navItems.filter((item) => {
    if (item.href.startsWith("/analytics")) return canAccess(level, "analyst");
    if (item.href.startsWith("/settings")) return canAccess(level, "admin");
    return true;
  });
  const showSettings = canAccess(level, "admin");

  // Close on outside click or Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        setAccountOpen(false);
      }
    }
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setAccountOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClickOutside);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Close the menu whenever the route changes.
  useEffect(() => {
    setOpen(false);
    setAccountOpen(false);
  }, [pathname]);

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Open navigation menu"
        aria-expanded={open}
        className="h-9 w-9 rounded-md flex items-center justify-center text-ink-subtle hover:bg-surface-hover hover:text-ink transition-colors"
      >
        <Menu size={18} />
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-card border border-surface-border shadow-flyout overflow-hidden z-50">
          <p className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-disabled">
            Navigation
          </p>
          <nav className="px-2 pb-1">
            {visibleItems.map((item) => {
              const Icon = ICONS[item.icon];
              const active = pathname === item.href || pathname.startsWith(item.href + "/");
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm transition-colors ${
                    active
                      ? "bg-primary-tint text-primary font-semibold"
                      : "text-ink hover:bg-surface-hover"
                  }`}
                >
                  <Icon size={16} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Account submenu */}
          <div className="border-t border-surface-border p-2">
            <button
              type="button"
              onClick={() => setAccountOpen((v) => !v)}
              aria-expanded={accountOpen}
              className="flex w-full items-center justify-between px-2 py-2 rounded-md text-sm text-ink hover:bg-surface-hover transition-colors"
            >
              <span className="flex items-center gap-2.5">
                <User size={16} />
                Account
              </span>
              <ChevronDown
                size={15}
                className={`text-ink-subtle transition-transform ${accountOpen ? "rotate-180" : ""}`}
              />
            </button>
            {accountOpen && (
              <div className="ml-6 mt-0.5 space-y-0.5">
                {showSettings && (
                  <Link
                    href="/settings"
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-ink-subtle hover:bg-surface-hover hover:text-ink transition-colors"
                  >
                    <Settings size={15} />
                    My Profile
                  </Link>
                )}
                <button
                  type="button"
                  onClick={() => signOut({ callbackUrl: "/login" })}
                  className="flex w-full items-center gap-2.5 px-2 py-1.5 rounded-md text-sm text-status-danger hover:bg-surface-hover transition-colors"
                >
                  <LogOut size={15} />
                  Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
