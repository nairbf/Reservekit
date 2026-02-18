import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/menu", "/events", "/reserve"],
        disallow: ["/dashboard", "/api", "/login", "/reservation/manage"],
      },
    ],
  };
}
