// One-off smoke test: verify our integration with the live Beckhoff reader.
//   node tools/smoke_plc_api.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const BASE = process.env.PLC_BASE || "http://127.0.0.1:8000";

const metaSymbols = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "tools/.meta_symbols.json"), "utf8")
);

const norm = (s) => s.replace(/^\./, "").toLowerCase();

const fetchJson = async (url) => {
  const t0 = Date.now();
  const r = await fetch(url);
  const j = await r.json();
  return { j, ms: Date.now() - t0 };
};

const fetchStatus = await fetchJson(`${BASE}/api/status`);
console.log(`status: connected=${fetchStatus.j.connected} symbols=${fetchStatus.j.symbol_count} (${fetchStatus.ms}ms)`);

const fetchSymbols = await fetchJson(`${BASE}/api/symbols`);
console.log(`symbols: ${fetchSymbols.j.symbols.length} (${fetchSymbols.ms}ms)`);

const byNorm = new Map();
for (const s of fetchSymbols.j.symbols) byNorm.set(norm(s.name), s.name);

const hit = [];
const miss = [];
for (const m of metaSymbols) {
  const actual = byNorm.get(norm(m));
  if (actual !== undefined) hit.push({ meta: m, actual });
  else miss.push(m);
}
console.log(`lookup: ${hit.length}/${metaSymbols.length} matched, ${miss.length} missing on PLC`);

const sample = hit.slice(0, 12);
console.log("\n=== parallel /api/vars/{name} sample (12 symbols) ===");
const t0 = Date.now();
const reads = await Promise.all(
  sample.map(async ({ actual }) => {
    const t = Date.now();
    const r = await fetch(`${BASE}/api/vars/${encodeURIComponent(actual)}`);
    const j = await r.json();
    return { name: actual, value: j.value, type: j.type, ms: Date.now() - t, status: r.status };
  })
);
const totalMs = Date.now() - t0;
for (const r of reads) {
  console.log(`  ${String(r.value).padEnd(8)} ${r.type.padEnd(8)} ${r.name.padEnd(45)} (${r.ms}ms)`);
}
console.log(`\ntotal: ${totalMs}ms for ${sample.length} parallel reads (avg ${(totalMs / sample.length).toFixed(1)}ms each)`);

const fullCycleEstimate = (hit.length / 16) * 15;
console.log(`estimated full poll of all ${hit.length} resolvable symbols @ concurrency 16: ~${fullCycleEstimate.toFixed(0)}ms`);