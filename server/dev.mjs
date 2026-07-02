import { spawn } from "node:child_process";
import { createMonitorServer } from "./monitor.mjs";

const apiHost = process.env.COATING_API_HOST || "127.0.0.1";
const apiPort = Number(process.env.COATING_API_PORT || 8787);
const viteHost = process.env.VITE_HOST || "127.0.0.1";
const vitePort = Number(process.env.VITE_PORT || 5173);

const monitor = createMonitorServer({
  dataRoot: process.env.COATING_DATA_ROOT || "P:\\",
  host: apiHost,
  port: apiPort,
  scanIntervalMs: Number(process.env.COATING_SCAN_INTERVAL_MS || 1500),
  maxJobs: Number(process.env.COATING_MAX_JOBS || 120)
});

const { close } = await monitor.start();
console.log(`[monitor] API ready at http://${apiHost}:${apiPort}`);

const viteBin = process.platform === "win32" ? "vite.cmd" : "vite";
const vite = spawn(viteBin, ["--host", viteHost, "--port", String(vitePort)], {
  stdio: "inherit",
  shell: process.platform === "win32",
  env: {
    ...process.env,
    VITE_API_BASE: process.env.VITE_API_BASE || `http://${apiHost}:${apiPort}`
  }
});

const shutdown = (code = 0) => {
  close();
  if (!vite.killed) vite.kill();
  process.exit(code);
};

vite.on("exit", (code) => shutdown(code ?? 0));
process.on("SIGINT", () => shutdown(0));
process.on("SIGTERM", () => shutdown(0));
