import type { Metadata } from "next";
import Script from "next/script";
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
      <head>
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=AW-17968745635"
          strategy="afterInteractive"
        />
        <Script id="google-tag" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'AW-17968745635');
            gtag('config', 'G-LMM63HCG67');
          `}
        </Script>
      </head>
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
