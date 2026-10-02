import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import AppChrome from "./AppChrome";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "JPMS Dashboard",
  description: "Poultry farm management dashboard and customer portal",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html suppressHydrationWarning lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body suppressHydrationWarning className="min-h-full flex flex-col bg-slate-50">
        <Script id="jpms-console-signature" strategy="afterInteractive">
          {`console.log("JPMS - Developed by Manan Malik");`}
        </Script>
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}
