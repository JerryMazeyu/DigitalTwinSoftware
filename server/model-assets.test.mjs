import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

const modelDir = resolve(process.cwd(), "public/models/coater-20260721");
const glbPath = resolve(modelDir, "coater.glb");

test("coater GLB asset is available from the public model directory", () => {
  assert.equal(existsSync(glbPath), true);
  assert.ok(readFileSync(glbPath).length > 0);
});
