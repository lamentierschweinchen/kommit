import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // Suppress workspace-root warning — repo has lockfiles at multiple levels
  // (~/package-lock.json, app/yarn.lock, app/web/package-lock.json) so Next
  // can't infer cleanly. Anchor the workspace at app/.
  turbopack: {
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;
