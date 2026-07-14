/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `base: "./"` makes every asset and data path relative, so the built site works
// unchanged whether it's served from a domain root, a GitHub Pages project subpath
// (`/wsdot-spec-tool/`), or opened from a file share on a locked-down machine. Paired
// with HashRouter, there are no server rewrites to configure and no refresh-404s.
export default defineConfig({
  base: "./",
  plugins: [react()],
  build: {
    // The data lives in public/data and is fetched at runtime, not bundled — so the
    // JS bundle stays small and each division loads on demand.
    chunkSizeWarningLimit: 700,
  },
  test: {
    // Pure-logic tests default to node; component tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock, so the fast tests stay fast.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
