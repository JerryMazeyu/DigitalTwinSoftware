import type { CoaterModelLayerId } from "./modelLayers";

export const normalizeModelObjectName = (name: string): string =>
  name.trim().toLowerCase().replace(/(?:\.\d+)?$/, "").replace(/[^a-z0-9]+/g, "");

export const buildLayerMeshLookup = (layerMeshes: Record<CoaterModelLayerId, string[]>) => {
  const lookup = new Map<string, CoaterModelLayerId>();

  for (const [layerId, meshNames] of Object.entries(layerMeshes) as [CoaterModelLayerId, string[]][]) {
    for (const meshName of meshNames) {
      lookup.set(normalizeModelObjectName(meshName), layerId);
    }
  }

  return lookup;
};

export const dedupeNormalizedNames = (names: string[]) => {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const name of names) {
    const canonical = normalizeModelObjectName(name);
    if (!canonical || seen.has(canonical)) continue;
    seen.add(canonical);
    normalized.push(canonical);
  }

  return normalized;
};
