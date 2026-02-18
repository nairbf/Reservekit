import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/pricing", "/about", "/faq", "/demo", "/privacy", "/terms"],
        disallow: ["/api", "/login", "/portal"],
      },
    ],
    sitemap: "https://reservesit.com/sitemap.xml",
  };
}
