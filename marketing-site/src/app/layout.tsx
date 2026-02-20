import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";

export const metadata: Metadata = {
  metadataBase: new URL("https://reservesit.com"),
  title: {
    default: "ReserveSit - Restaurant Reservation Software You Own",
    template: "%s | ReserveSit",
  },
  description: "The restaurant reservation platform you buy once and own. No per-cover fees. No monthly lock-in. Starting at $2,199.",
  keywords: [
    "restaurant reservation software",
    "reservation system",
    "OpenTable alternative",
    "restaurant booking",
    "one-time license",
    "reservation platform",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://reservesit.com",
    siteName: "ReserveSit",
    title: "ReserveSit - Restaurant Reservation Software You Own",
    description: "The restaurant reservation platform you buy once and own. No per-cover fees. Starting at $2,199.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ReserveSit - Restaurant Reservation Software You Own",
    description: "The restaurant reservation platform you buy once and own. No per-cover fees. Starting at $2,199.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen bg-slate-50">
          <Header />
          <main>{children}</main>
          <Footer />
        </div>
      </body>
    </html>
  );
}
