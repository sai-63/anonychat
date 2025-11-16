// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PWA Chat",
  description: "Simple Next.js PWA chat demo",
  themeColor: "#020617",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="min-h-screen flex items-center justify-center">
        {children}
      </body>
    </html>
  );
}
