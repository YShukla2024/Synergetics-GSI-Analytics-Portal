"use client";

import { useState, useRef, useEffect } from "react";
import { useSession, signOut } from "next-auth/react";
import { ChevronDown, LogOut, Settings as SettingsIcon, User } from "lucide-react";
import Link from "next/link";
import { canAccess, accessLabel } from "@/lib/access";

/** "Yash Shukla" -> "YS", "Aditya" -> "A", "" -> "?". */
function getInitials(name?: string | null): string {
  if (!name) return "?";
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export default function ProfileMenu() {
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const user = session?.user;
  const displayName = user?.name ?? "";
  const email = user?.email ?? user?.preferredUsername ?? "";
  const photo = user?.image; // base64 data URL captured by the Entra provider at sign-in
  const initials = getInitials(displayName || email);
  const roles = user?.roles ?? [];
  const showSettings = canAccess(user?.accessLevel, "admin");

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label="Account menu"
        className="flex items-center gap-2 pl-1.5 pr-2 h-9 rounded-md hover:bg-surface-hover transition-colors"
      >
        {photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photo}
            alt=""
            className="h-7 w-7 rounded-full object-cover"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="h-7 w-7 rounded-full bg-primary-dark text-white text-xs font-semibold flex items-center justify-center">
            {status === "loading" ? "…" : initials}
          </div>
        )}
        <span className="text-sm text-ink hidden md:block">{displayName}</span>
        <ChevronDown size={14} className="text-ink-subtle" />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-card border border-surface-border shadow-flyout overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-border">
            <p className="text-sm font-semibold text-ink truncate">{displayName || "Signed in"}</p>
            {email && <p className="text-xs text-ink-subtle truncate mt-0.5">{email}</p>}
            {roles.length > 0 && (
              <p className="text-[11px] text-primary-dark font-medium mt-0.5">
                {roles.join(" · ")}
              </p>
            )}
            {user?.accessLevel && roles.length === 0 && (
              <p className="text-[11px] text-primary-dark font-medium mt-0.5">
                {accessLabel(user.accessLevel)}
              </p>
            )}
          </div>
          {showSettings && (
            <nav className="py-1">
              <MenuLink href="/settings" icon={<User size={15} />} label="My Profile" />
              <MenuLink href="/settings" icon={<SettingsIcon size={15} />} label="Settings" />
            </nav>
          )}
          <div className="border-t border-surface-border py-1">
            <button
              type="button"
              onClick={() => signOut({ callbackUrl: "/login" })}
              className="w-full flex items-center gap-2.5 px-4 py-2 text-sm text-status-danger hover:bg-surface-hover text-left"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink hover:bg-surface-hover">
      {icon}
      {label}
    </Link>
  );
}
