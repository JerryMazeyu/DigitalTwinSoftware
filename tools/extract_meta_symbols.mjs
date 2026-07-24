// One-off helper: extract plcSymbol names from plcSensorMap.ts and check
// which ones the live PLC actually has. Run with:
//   node tools/extract_meta_symbols.mjs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const metaSrc = fs.readFileSync(path.join(repoRoot, "src/data/plcSensorMap.ts"), "utf8");

const matches = [...metaSrc.matchAll(/plcSymbol:\s*"([^"]+)"/g)];
const symbols = matches.map((m) => m[1]);
console.log("meta total:", symbols.length);
console.log("first 5:", symbols.slice(0, 5));

// Save for downstream tools
fs.writeFileSync(path.join(repoRoot, "tools/.meta_symbols.json"), JSON.stringify(symbols, null, 2));
console.log("wrote tools/.meta_symbols.json");