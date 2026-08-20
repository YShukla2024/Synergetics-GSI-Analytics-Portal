import type { Metadata } from "next";
import "./globals.css";
import Providers from "@/components/providers";
import { auth } from "@/auth";

export const metadata: Metadata = {
  title: "GSI Analytics Portal | Synergetics Information Technology Services India Pvt Ltd",
  description:
    "Executive analytics portal for GSI delivery programs — dashboards, delivery tracking, and drill-through reporting.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <head>
        {/* Synergetics brand fonts (synergetics-india.com): Oswald display + PT Sans body */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;500;600&family=PT+Sans:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="font-sans bg-surface-bg text-ink antialiased">
        <Providers session={session}>{children}</Providers>
      </body>
    </html>
  );
}
