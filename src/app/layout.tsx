import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReserveSit",
  description: "Restaurant reservation system",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <body className="bg-white text-gray-900">{children}</body>
    </html>
  );
}
