import { describe, expect, it } from "vitest";

import { CHAMBER_MASK_CONFIG } from "./chamberMaskConfig";
import { CHAMBERS } from "./chambers";

describe("chamberMaskConfig", () => {
  it("每个腔室都有蒙版配置", () => {
    const chamberIds = CHAMBERS.map((c) => c.id);
    for (const id of chamberIds) {
      expect(CHAMBER_MASK_CONFIG[id], `缺少腔室 ${id} 的蒙版配置`).toBeDefined();
    }
  });

  it("所有蒙版都是四个角点 + 合法颜色十六进制", () => {
    for (const def of Object.values(CHAMBER_MASK_CONFIG)) {
      expect(def.corners).toHaveLength(4);
      expect(def.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(Number.isFinite(def.z)).toBe(true);
    }
  });

  it("镀膜室使用 stadium（长方形 + 半圆），且底边宽度 > 0", () => {
    const coating = CHAMBER_MASK_CONFIG.coating;
    expect(coating.kind).toBe("stadium");
    if (coating.kind === "stadium") {
      const [, , c2, c3] = coating.corners;
      expect(Math.abs(c2[0] - c3[0])).toBeGreaterThan(0);
    }
  });
});