/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// `base: "./"` makes every asset and data path relative, so the built site works
// unchanged whether it's served from a domain root, a GitHub Pages project subpath
// (`/dotcompass/`), or opened from a file share on a locked-down machine. Paired
// with HashRouter, there are no server rewrites to configure and no refresh-404s.
export default defineConfig({
  base: "./",
  plugins: [react()],
  // transformers.js and its ONNX runtime are loaded lazily and self-hosted (public/models,
  // public/ort). Excluding them from dep pre-bundling stops Vite from also emitting the
  // ~21 MB WebGPU WASM variant we never use — we force the single-threaded WASM backend.
  optimizeDeps: { exclude: ["@huggingface/transformers"] },
  build: {
    // The data and models live in public/ and are fetched at runtime, not bundled — so
    // the JS bundle stays small and everything heavy loads on demand.
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      // Don't emit the WebGPU runtime as a bundled asset; the WASM backend is served from
      // public/ort at runtime.
      external: [/onnxruntime-web.*\.jsep\.wasm$/],
    },
  },
  test: {
    // Pure-logic tests default to node; component tests opt into jsdom with a
    // `// @vitest-environment jsdom` docblock, so the fast tests stay fast.
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
    setupFiles: ["src/test-setup.ts"],
  },
});
