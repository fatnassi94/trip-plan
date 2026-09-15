import type { Metadata } from "next";
import { Inter, Plus_Jakarta_Sans } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

// Editorial Voyage type: Plus Jakarta Sans for headlines and labels,
// Inter for body copy and dense itinerary data. The design system uses
// Jakarta for its small uppercase labels, so `font-mono` maps to it too.
const display = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "600", "700"],
});
const sans = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const metadata: Metadata = {
  title: "RoamAI — your AI travel companion",
  description:
    "An AI that knows how you travel, builds your trip, and travels with you.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body
        className={`${display.variable} ${sans.variable} font-sans antialiased`}
        style={{ ["--font-mono" as string]: "var(--font-display)" }}
      >
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}
