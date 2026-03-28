import type { Metadata } from "next";
import "@/styles/globals.css";

export const metadata: Metadata = {
  title: "Finance Analyst — AI Financial Intelligence",
  description: "AI-powered financial document analysis, real-time market data, and portfolio insights",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
