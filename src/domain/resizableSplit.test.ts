import { describe, expect, it } from "vitest";

import {
  DESKTOP_SPLIT_BOUNDS,
  clampSplitRatio,
  ratioFromDrag,
  splitGridTemplateRows
} from "./resizableSplit";

describe("resizable split helpers", () => {
  it("clamps the desktop split ratio inside usable bounds", () => {
    expect(clampSplitRatio(0.1)).toBe(DESKTOP_SPLIT_BOUNDS.min);
    expect(clampSplitRatio(0.9)).toBe(DESKTOP_SPLIT_BOUNDS.max);
    expect(clampSplitRatio(0.5)).toBe(0.5);
  });

  it("converts vertical drag distance into a top-pane ratio", () => {
    expect(ratioFromDrag({ startRatio: 0.5, deltaY: 120, containerHeight: 600 })).toBe(0.7);
    expect(ratioFromDrag({ startRatio: 0.5, deltaY: -120, containerHeight: 600 })).toBe(0.3);
  });

  it("keeps the current ratio when the container height is not measurable", () => {
    expect(ratioFromDrag({ startRatio: 0.62, deltaY: 100, containerHeight: 0 })).toBe(0.62);
  });

  it("produces a stable three-row grid template for the split panes", () => {
    expect(splitGridTemplateRows(0.6, 12)).toBe("0.6fr 12px 0.4fr");
  });
});
