import type { Metadata } from "next";
import "./globals.css";
import { SessionProvider } from "../lib/session";

export const metadata: Metadata = {
  title: "Team Cowork",
  description: "팀 협업을 위한 작업 공간",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col"><SessionProvider>{children}</SessionProvider></body>
    </html>
  );
}
