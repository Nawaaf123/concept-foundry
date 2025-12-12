import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React libraries - always needed
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // Core Radix primitives used on auth page
          'vendor-radix-core': [
            '@radix-ui/react-slot',
            '@radix-ui/react-label',
          ],
          // Heavy libraries - loaded on demand
          'vendor-charts': ['recharts'],
          'vendor-excel': ['xlsx'],
          // Data fetching
          'vendor-query': ['@tanstack/react-query'],
          // Note: Supabase and other Radix components are NOT in manualChunks
          // so they get code-split per page, reducing initial bundle size
        },
      },
    },
  },
}));
