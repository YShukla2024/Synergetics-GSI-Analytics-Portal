"use client";

import HeaderMenu from "@/components/ui/HeaderMenu";
import ProfileMenu from "@/components/ui/ProfileMenu";

export default function Header() {
  return (
    <header className="fixed top-0 left-0 right-0 z-40 h-14 bg-white border-b border-surface-border">
      <div className="h-full flex items-center justify-between px-4">
        {/* Left: nav menu + brand */}
        <div className="flex items-center gap-1 min-w-[220px]">
          <HeaderMenu />
          <img
            src="/synergetics-logo.png"
            alt="Synergetics Information Technology Services India Pvt Ltd"
            className="h-10 w-auto object-contain shrink-0"
          />
          <span className="hidden sm:block text-[13px] font-semibold leading-tight tracking-tight text-ink">
            Synergetics Information Technology Services India Pvt Ltd
          </span>
        </div>

        {/* Center: portal title */}
        <div className="flex-1 flex justify-center">
          <h1 className="text-[15px] font-semibold text-ink tracking-tight">
            GSI Analytics Portal
          </h1>
        </div>

        {/* Right: profile */}
        <div className="flex items-center min-w-[220px] justify-end">
          <ProfileMenu />
        </div>
      </div>
    </header>
  );
}
