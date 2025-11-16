// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import RegisterSW from "./register-sw";

export const metadata: Metadata = {
  title: "Anonymous Chat",
  manifest: "/manifest.webmanifest",
  description: "Simple Next.js PWA chat demo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-slate-950 text-slate-50">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
