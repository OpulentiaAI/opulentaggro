import type { Metadata } from "next";
import "./globals.css";

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "OpulentAggro";

export const metadata: Metadata = {
  title: {
    default: `${appName} — Intercompany ERP`,
    template: `%s · ${appName}`,
  },
  description:
    "Full OpulentAggro desk UI on Vercel — STO workflows, document lists, forms, and IC billing. ERPNext API backend on Railway.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-theme="light">
      <body>{children}</body>
    </html>
  );
}
