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
    globals: true,
    // 测试进程强制清空调试覆盖变量：machinePhase 读 override 时优先取
    // process.env（浏览器里不存在、自然回落 import.meta.env 的 .env.local
    // 调试通道），这里的空串等价「未设置」，保证单测不受开发者本机
    // .env.local 影响。只作用于 vitest；npm run dev 不受影响。
    env: {
      VITE_MACHINE_PHASE: ""
    }
  }
});
