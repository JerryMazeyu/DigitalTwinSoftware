// 从 GLB 里按节点名摘除 mesh（外科手术式：只改 JSON chunk，二进制块原样
// 保留）。被摘除的节点成为孤儿节点——glTF 2.0 规范允许，three.js
// GLTFLoader 只从场景根构建对象树，孤儿节点不会实例化，等于不可见。
//
// 为什么不用 Blender 重导出：models-source/ 下的 .blend 源不一定随仓库提供，
// 而本脚零依赖、确定性、可复用。导出前的网格清理（如 export-coater-glb.mjs
// 里的 IndustrialFloor 过滤）适合在源头做；源头缺失时用本脚本兜底。
//
// 用法：node scripts/remove-glb-meshes.mjs <glb路径> <节点名1> [节点名2 ...]
// 节点名精确匹配（区分大小写）；可先用 scripts/compare-glbs.mjs 或直接
// 解析 JSON chunk 查看全部节点名。
import { readFileSync, writeFileSync } from "node:fs";

const [, , glbPath, ...names] = process.argv;
if (!glbPath || names.length === 0) {
  console.error("用法: node scripts/remove-glb-meshes.mjs <glb路径> <节点名1> [节点名2 ...]");
  process.exit(1);
}

const buf = readFileSync(glbPath);

// ---- 解析 GLB 容器：12 字节头 + JSON chunk + BIN chunk ----
const magic = buf.readUInt32LE(0);
if (magic !== 0x46546c67) { // 'glTF'
  console.error("不是 GLB 文件（magic 不符）");
  process.exit(1);
}
if (buf.readUInt32LE(4) !== 2) {
  console.error("仅支持 glTF 2.0");
  process.exit(1);
}
const jsonChunkLen = buf.readUInt32LE(12);
if (buf.readUInt32LE(16) !== 0x4e4f534a) { // 'JSON'
  console.error("第一个 chunk 不是 JSON");
  process.exit(1);
}
const json = JSON.parse(buf.subarray(20, 20 + jsonChunkLen).toString("utf8"));
const binStart = 20 + jsonChunkLen;
const binChunkLen = binStart <= buf.length - 8 ? buf.readUInt32LE(binStart) : 0;
const binChunkType = binStart <= buf.length - 8 ? buf.readUInt32LE(binStart + 4) : 0;
const binData = binChunkType === 0x004e4942 ? buf.subarray(binStart + 8, binStart + 8 + binChunkLen) : null; // 'BIN'

// ---- 递归收集「以 name 命名的节点」的索引集合 ----
const targets = new Set(names);
const byName = new Map();
(json.nodes ?? []).forEach((n, i) => {
  if (targets.has(n.name)) byName.set(i, n.name);
});
if (byName.size === 0) {
  console.error(`未找到任何目标节点: ${[...targets].join(", ")}`);
  process.exit(1);
}

// ---- 从场景根与所有父节点的 children 里摘除（节点本体保留在 nodes 数组，成为孤儿）----
let removed = 0;
const removeFromList = (list, where) => {
  if (!Array.isArray(list)) return;
  const before = list.length;
  const next = list.filter((i) => !byName.has(i));
  if (next.length !== before) {
    console.log(`  从 ${where} 摘除 ${before - next.length} 个节点`);
    removed += before - next.length;
    list.length = 0;
    list.push(...next);
  }
};

for (const scene of json.scenes ?? []) removeFromList(scene.nodes, `scene:${scene.name ?? "?"}`);
for (const [i, node] of (json.nodes ?? []).entries()) {
  if (Array.isArray(node.children)) removeFromList(node.children, `node:${node.name || i}`);
}

const foundNames = new Set(byName.values());
const missing = [...targets].filter((n) => !foundNames.has(n));
if (missing.length > 0) console.warn(`  警告: 未匹配到节点 ${missing.join(", ")}`);
console.log(`共摘除 ${removed} 处引用（节点 ${foundNames.size} 个: ${[...foundNames].join(", ")}）`);

// ---- 重新打包：JSON chunk 按 4 字节对齐（空格填充），BIN 原样 ----
let jsonText = JSON.stringify(json);
const jsonPad = (4 - (jsonText.length % 4)) % 4;
jsonText += " ".repeat(jsonPad);
const jsonBuf = Buffer.from(jsonText, "utf8");

const header = Buffer.alloc(12);
header.writeUInt32LE(0x46546c67, 0); // 'glTF'
header.writeUInt32LE(2, 4);
const totalLen = 12 + 8 + jsonBuf.length + (binData ? 8 + binData.length : 0);
header.writeUInt32LE(totalLen, 8);

const jsonHeader = Buffer.alloc(8);
jsonHeader.writeUInt32LE(jsonBuf.length, 0);
jsonHeader.writeUInt32LE(0x4e4f534a, 4);

const parts = [header, jsonHeader, jsonBuf];
if (binData) {
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(binData.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);
  parts.push(binHeader, Buffer.from(binData)); // copy 出 subarray 视图
}

writeFileSync(glbPath, Buffer.concat(parts));
console.log(`已写回 ${glbPath}（${totalLen} 字节）`);
