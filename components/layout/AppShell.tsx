"use client";

import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-surface-bg">
      <Header />
      <div className="pt-14 min-w-[1024px] lg:min-w-0">
        <main className="px-6 py-6">{children}</main>
        <Footer />
      </div>
    </div>
  );
}
