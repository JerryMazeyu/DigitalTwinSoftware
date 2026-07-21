import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";
import { coaterModelLayerMeshes } from "../src/domain/generatedModelLayers.ts";

const modelDir = resolve(process.cwd(), "public/models/coater-20260702");
const objPath = resolve(modelDir, "coater.obj");
const mtlPath = resolve(modelDir, "coater.mtl");

test("coater OBJ and MTL assets are available from the public model directory", () => {
  assert.equal(existsSync(objPath), true);
  assert.equal(existsSync(mtlPath), true);
});

test("coater OBJ uses an ASCII material library reference", () => {
  const obj = readFileSync(objPath, "utf8");
  const materialLibraryLine = obj.split(/\r?\n/).find((line) => line.startsWith("mtllib "));

  assert.equal(materialLibraryLine, "mtllib coater.mtl");
  assert.match(obj, /^usemtl /m);
});

test("generated coater layer mesh map matches OBJ group sections", () => {
  const obj = readFileSync(objPath, "utf8");
  const layers = { ___01: [], ___02: [] };
  let currentLayer = null;

  for (const line of obj.split(/\r?\n/)) {
    if (line.startsWith("g ")) {
      const name = line.slice(2).trim();
      currentLayer = Object.prototype.hasOwnProperty.call(layers, name) ? name : null;
    } else if (currentLayer && line.startsWith("o ")) {
      const name = line.slice(2).trim();
      if (name && !layers[currentLayer].includes(name)) layers[currentLayer].push(name);
    }
  }

  const normalizedLayers = Object.fromEntries(Object.keys(layers).map((layer) => [layer, []]));
  const assignedMeshes = new Set();

  // The OBJ repeats a few object names under multiple top-level groups; runtime name lookup uses the later layer.
  for (const layer of Object.keys(layers).reverse()) {
    for (const name of [...layers[layer]].reverse()) {
      if (assignedMeshes.has(name)) continue;
      normalizedLayers[layer].unshift(name);
      assignedMeshes.add(name);
    }
  }

  assert.deepEqual(coaterModelLayerMeshes, normalizedLayers);
});
