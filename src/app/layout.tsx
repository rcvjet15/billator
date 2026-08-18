import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import { PageShell } from "@/components/layout/PageShell";
import { ToastProvider } from "@/components/ui/Toast";
import { PwaRegister } from "@/components/pwa/PwaRegister";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Billator",
  description:
    "Split the Croatian HEP electricity bill between two floors, tracking the rolling 6-month, 3,000 kWh semi-annual tariff.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "Billator",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#166534",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        <link rel="icon" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </head>
      <body className="min-h-full flex flex-col">
        <PwaRegister />
        <ToastProvider>
          <PageShell>{children}</PageShell>
        </ToastProvider>
      </body>
    </html>
  );
}
