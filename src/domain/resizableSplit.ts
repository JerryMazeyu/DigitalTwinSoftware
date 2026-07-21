export const DESKTOP_SPLIT_BOUNDS = {
  defaultRatio: 0.52,
  min: 0.3,
  max: 0.72
} as const;

export type DragRatioInput = {
  startRatio: number;
  deltaY: number;
  containerHeight: number;
};

const roundRatio = (value: number) => Math.round(value * 1000) / 1000;

export const clampSplitRatio = (
  ratio: number,
  min = DESKTOP_SPLIT_BOUNDS.min,
  max = DESKTOP_SPLIT_BOUNDS.max
) => {
  if (!Number.isFinite(ratio)) return DESKTOP_SPLIT_BOUNDS.defaultRatio;
  return roundRatio(Math.min(max, Math.max(min, ratio)));
};

export const ratioFromDrag = ({ startRatio, deltaY, containerHeight }: DragRatioInput) => {
  if (!Number.isFinite(containerHeight) || containerHeight <= 0) return clampSplitRatio(startRatio);
  return clampSplitRatio(startRatio + (deltaY / containerHeight));
};

export const splitGridTemplateRows = (ratio: number, handleSizePx = 12) => {
  const topRatio = clampSplitRatio(ratio);
  const bottomRatio = roundRatio(1 - topRatio);
  return `${topRatio}fr ${handleSizePx}px ${bottomRatio}fr`;
};
