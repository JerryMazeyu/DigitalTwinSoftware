export const coaterModelLayers = [
  { id: "___01", label: "图层 01" },
  { id: "___02", label: "图层 02" }
] as const;

export type CoaterModelLayerId = (typeof coaterModelLayers)[number]["id"];

export const createAllLayerSelection = (): CoaterModelLayerId[] => coaterModelLayers.map((layer) => layer.id);

export const toggleLayerSelection = (
  selectedLayers: CoaterModelLayerId[],
  layerId: CoaterModelLayerId
): CoaterModelLayerId[] => {
  if (selectedLayers.includes(layerId)) {
    return selectedLayers.length === 1 ? selectedLayers : selectedLayers.filter((item) => item !== layerId);
  }

  return coaterModelLayers
    .map((layer) => layer.id)
    .filter((id) => id === layerId || selectedLayers.includes(id));
};
