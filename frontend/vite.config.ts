import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";

import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/react/" : "/", // Set base path only for production
  server: {
    // https: {
    //   key: fs.readFileSync(HTTPS_KEY),
    //   cert: fs.readFileSync(HTTPS_CERT),
    // },
    // host: "0.0.0.0", // So Windows browser can access
    port: 5173,
    proxy: {
      "/api": "http://localhost:8000",
      "/social": "http://localhost:8000",
    },
  },
  build: {
    outDir: "../Backend/wwwroot/react",
    emptyOutDir: true,
    chunkSizeWarningLimit: 3000, // Increase limit to reduce warnings
    manifest: true, // Generate manifest.json for asset mapping
    rollupOptions: {
      maxParallelFileOps: 1, // reduce parallel operations
      // no manual chunking: let Vite handle it automatically
      // so we don't have to worry about circular dependency issues
    },
  },
  optimizeDeps: {
    // Don't pre-bundle ArcGIS to avoid circular dependency issues
    //exclude: ["@arcgis/core"],
  },
  resolve: {
    // Help Vite find ArcGIS modules and prevent circular deps
    alias: {
      // Don't alias @arcgis/core - let it resolve naturally
    },
  },
  define: {
    // Fix for ArcGIS global issues
    global: "globalThis",
  },
  assetsInclude: ["**/*.wasm", "**/*.woff", "**/*.woff2"],
  plugins: [
    tanstackRouter({
      target: "react",
      autoCodeSplitting: mode !== "development",
    }),
    react(),
    tsconfigPaths(),
  ],
}));
