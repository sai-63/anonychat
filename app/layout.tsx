// app/layout.tsx
import type { Metadata } from "next";
import "./globals.css";
import RegisterSW from "./register-sw";

export const metadata: Metadata = {
  title: "Anonymous Chat",
  description: "Simple Next.js PWA chat demo",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#020617" />
      </head>
      <body className="min-h-screen flex items-center justify-center">
        <RegisterSW />
        {children}
      </body>
    </html>
  );
}
