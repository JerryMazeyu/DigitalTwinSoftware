import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          charts: ["echarts", "echarts-for-react"],
          three: ["three", "@react-three/fiber"],
          react: ["react", "react-dom"]
        }
      }
    }
  },
  test: {
    environment: "node",
    globals: true
  }
});
