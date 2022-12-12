import { fileURLToPath, URL } from "node:url";

import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// https://vitejs.dev/config/
export default defineConfig({
  css: {
    devSourcemap: true,
  },
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // https://github.com/jonathanpmartins/v-money3/issues/70#issuecomment-1284503693
  optimizeDeps: {
    esbuildOptions: {
      target: ["es2020", "safari14"],
    },
  },
  build: {
    target: ["es2020", "safari14"],
  },
  define: {
    // https://github.com/permafrost-dev/vue-ray/issues/3#issuecomment-1055944939
    global: {},
    process: {},
  },
});
