/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: { port: 5173, strictPort: true },
  build: {
    sourcemap: false,
    chunkSizeWarningLimit: 600,
    // Sin scripts inline: compatible con la CSP `script-src 'self'` de CloudFront (CA-NF11.2).
    modulePreload: { polyfill: false },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    css: false,
  },
});
