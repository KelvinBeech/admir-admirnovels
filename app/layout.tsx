import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AdmirNovels",
  description: "A specialist novel-creation app branching from Mission Control.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#09090f] text-white">{children}</body>
    </html>
  );
}
