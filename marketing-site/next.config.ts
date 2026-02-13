import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  output: "standalone",
  // turbopack.root is required because this app lives inside the parent
  // Reservekit repo. Without it, Next.js infers the parent directory as
  // the workspace root and applies the parent app's middleware to this app.
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
