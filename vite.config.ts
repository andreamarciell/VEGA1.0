import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// IMPORTANT: avoid pre-bundling and SSR'ing html-to-docx/docx.
// esbuild can corrupt their ESM shape causing "Class extends value undefined".
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react()],
  // Do NOT prebundle these with esbuild; use their native ESM in the browser.
  optimizeDeps: { exclude: ["html-to-docx", "docx"] },
  // Keep default SSR externals; we are a SPA (no SSR), so nothing special here.
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
}));
