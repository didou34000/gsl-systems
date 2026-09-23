import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FORGE — Sourcing industriel B2B",
  description: "Explorez les fabricants, comparez les capacités industrielles et préparez vos demandes de devis. Prototype de marketplace B2B.",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
