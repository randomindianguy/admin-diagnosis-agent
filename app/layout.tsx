import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

// tokens.font.sans names "Inter" as the intended face (Polysans substitute);
// next/font self-hosts it (no layout shift). Glean's 400-everywhere weight is
// the default load.
const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cleared — workspace access triage",
  description: "Diagnose workspace access issues and show the reasoning.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${inter.className} min-h-screen bg-background-primary text-text-primary text-body leading-body antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
