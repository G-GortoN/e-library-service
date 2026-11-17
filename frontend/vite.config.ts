import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": process.env.VITE_API_PROXY || "http://localhost:8080",
      "/media": process.env.VITE_API_PROXY || "http://localhost:8080",
      "/swagger-ui": process.env.VITE_API_PROXY || "http://localhost:8080",
      "/v3/api-docs": process.env.VITE_API_PROXY || "http://localhost:8080",
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id))
            return "react-vendor";
          if (id.includes("node_modules/@tanstack")) return "query";
        },
      },
    },
  },
});
