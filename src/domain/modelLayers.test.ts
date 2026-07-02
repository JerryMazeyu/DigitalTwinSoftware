import { describe, expect, it } from "vitest";

import {
  coaterModelLayers,
  createAllLayerSelection,
  toggleLayerSelection
} from "./modelLayers";
import { coaterModelLayerMeshes } from "./generatedModelLayers";

describe("coater model layers", () => {
  it("defines the OBJ top-level model layers in display order", () => {
    expect(coaterModelLayers.map((layer) => layer.id)).toEqual(["___01", "___02"]);
    expect(coaterModelLayers.map((layer) => layer.label)).toEqual(["图层 01", "图层 02"]);
  });

  it("supports single, multiple, and all-layer visibility selection", () => {
    const allLayers = createAllLayerSelection();
    expect(allLayers).toEqual(["___01", "___02"]);

    const oneLayer = toggleLayerSelection(allLayers, "___02");
    expect(oneLayer).toEqual(["___01"]);

    const multipleLayers = toggleLayerSelection(oneLayer, "___02");
    expect(multipleLayers).toEqual(["___01", "___02"]);

    const cannotHideLastLayer = toggleLayerSelection(["___01"], "___01");
    expect(cannotHideLastLayer).toEqual(["___01"]);
  });

  it("maps generated mesh names to the current OBJ layers", () => {
    expect(coaterModelLayerMeshes.___01.length).toBeGreaterThan(100);
    expect(coaterModelLayerMeshes.___02.length).toBeGreaterThan(0);
    expect(new Set([...coaterModelLayerMeshes.___01, ...coaterModelLayerMeshes.___02]).size).toBe(
      coaterModelLayerMeshes.___01.length + coaterModelLayerMeshes.___02.length
    );
  });
});
