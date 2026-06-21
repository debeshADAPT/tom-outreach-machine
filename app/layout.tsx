import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import Sidebar from "@/components/Sidebar";
import { NavigationProgress } from "@/components/NavigationProgress";

export const metadata: Metadata = {
  title: "SIGNAL",
  description: "Delegate Acquisition outreach platform by ADAPT",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="flex h-screen overflow-hidden" style={{ backgroundColor: "#F8F8F8" }}>
        <Suspense>
          <NavigationProgress />
        </Suspense>
        <Sidebar />
        <main className="flex-1 overflow-auto">{children}</main>
      </body>
    </html>
  );
}
