import type { Metadata } from "next";
import { Inter, Newsreader, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// SID-67 register: a three-family system on distinct axes (skill pairing rule).
//   Inter        — body sans, no character of its own (carries labels/data/prose).
//   Newsreader   — display serif, reserved for wordmark + verdict text + eyebrows.
//                  Italic loaded for the lowercase-italic eyebrows.
//   IBM Plex Mono— audit-label mono: evidence labels, identifiers, paths, scores.
// All self-hosted by next/font (no layout shift), exposed as CSS variables so the
// Tailwind fontFamily tokens resolve to them.
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  style: ["normal", "italic"],
  variable: "--font-display",
});
const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
});

export const metadata: Metadata = {
  title: "Cleared — workspace access triage",
  description: "Diagnose workspace access issues and show the reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`dark ${inter.variable} ${newsreader.variable} ${plexMono.variable}`}
    >
      <body
        className="min-h-screen bg-background-primary font-sans text-text-primary text-body leading-body antialiased"
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
