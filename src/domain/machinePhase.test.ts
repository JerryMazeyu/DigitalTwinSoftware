import { describe, expect, it } from "vitest";

import {
  MACHINE_PHASE_OVERRIDE,
  PHASE_ALL_SYMBOLS,
  PHASE_AUTOPUMP_SYMBOLS,
  PHASE_COATING_SYMBOLS,
  PHASE_HIVAC_SYMBOLS,
  PHASE_VIDEO,
  PHASE_VIDEO_FRAMING,
  PHASE_VIDEO_FRAMING_DEFAULT,
  PHASE_VACUUM_SYMBOLS,
  PHASE_WINDING_SYMBOLS,
  classifyMachinePhase,
  toBool,
  toNumber,
  valuesFromSymbolMaps,
  type MachinePhase
} from "./machinePhase";

const empty: Record<string, unknown> = {};

// 便捷构造：把 phase 需要的符号集合装成一个 values 平铺表。
function valuesFor(
  vac: "none" | "pump" | "hivac" = "none",
  winding: number[] = [],
  coating: number[] = []
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (vac === "pump") values.dbVacOpStatus_nAutoPumpStatus = 1;
  if (vac === "hivac") values.dbVacOpStatus_bChbHiVac1 = true;
  winding.forEach((v, i) => {
    values[PHASE_WINDING_SYMBOLS[i]] = v;
  });
  coating.forEach((v, i) => {
    values[PHASE_COATING_SYMBOLS[i]] = v;
  });
  return values;
}

describe("classifyMachinePhase 四态判定", () => {
  it("空数据 / 全 undefined 判定为 idle", () => {
    expect(classifyMachinePhase(empty)).toBe("idle");
    expect(classifyMachinePhase({ [PHASE_WINDING_SYMBOLS[0]]: undefined })).toBe("idle");
  });

  it("仅抽气流程码非 0 → pump", () => {
    expect(classifyMachinePhase(valuesFor("pump"))).toBe("pump");
  });

  it("仅高真空位为真 → pump（Boolean / 1 / string 皆可）", () => {
    expect(classifyMachinePhase(valuesFor("hivac"))).toBe("pump");
    expect(
      classifyMachinePhase({ dbVacOpStatus_bChbHiVac2: 1 })
    ).toBe("pump");
    expect(
      classifyMachinePhase({ dbVacOpStatus_bChbHiVac3: "true" })
    ).toBe("pump");
  });

  it("真空 + 任一轴速度超阈值 → pump+winding", () => {
    expect(classifyMachinePhase(valuesFor("pump", [0, 0.06, 0, 0, 0]))).toBe("pump+winding");
    // 反向速度同样触发
    expect(classifyMachinePhase(valuesFor("pump", [0, -0.2, 0, 0, 0]))).toBe("pump+winding");
  });

  it("轴速度不超阈值（0.05 为例外）不算卷绕", () => {
    expect(classifyMachinePhase(valuesFor("pump", [0, 0.05, 0, 0, 0]))).toBe("pump");
    expect(classifyMachinePhase(valuesFor("pump", [0, 0.04, 0, 0, 0]))).toBe("pump");
  });

  it("真空 + 卷绕 + 镀膜功率超阈值 → pump+winding+coating", () => {
    expect(classifyMachinePhase(valuesFor("pump", [0.5], [0, 60, 0, 0, 0, 0]))).toBe(
      "pump+winding+coating"
    );
  });

  it("镀膜功率恰为 50 不触发（阈值为严格大于）", () => {
    expect(classifyMachinePhase(valuesFor("pump", [0.5], [50]))).toBe("pump+winding");
  });

  it("卷绕或镀膜单独存在（无真空）不构成运行态 → idle", () => {
    expect(classifyMachinePhase(valuesFor("none", [0.8]))).toBe("idle");
    expect(classifyMachinePhase(valuesFor("none", [0.8], [100]))).toBe("idle");
  });
});

describe("toNumber / toBool 解析", () => {
  it("toNumber 覆盖 number/boolean/string/undefined", () => {
    expect(toNumber(3.7)).toBe(3.7);
    expect(toNumber(true)).toBe(1);
    expect(toNumber(false)).toBe(0);
    expect(toNumber("12.5")).toBe(12.5);
    expect(toNumber("0")).toBe(0);
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber("not-a-number")).toBe(0);
    expect(toNumber(NaN)).toBe(0);
  });

  it("toBool 覆盖 boolean/number/string/undefined", () => {
    expect(toBool(true)).toBe(true);
    expect(toBool(false)).toBe(false);
    expect(toBool(1)).toBe(true);
    expect(toBool(0)).toBe(false);
    expect(toBool("true")).toBe(true);
    expect(toBool("1")).toBe(true);
    expect(toBool("false")).toBe(false);
    expect(toBool("0")).toBe(false);
    expect(toBool(undefined)).toBe(false);
    expect(toBool(null)).toBe(false);
  });
});

describe("valuesFromSymbolMaps 摊平", () => {
  it("把多个 bySymbol 摊平成 {symbol: value}", () => {
    const flat = valuesFromSymbolMaps(
      { a: { value: 1 }, b: { value: "x" } },
      { c: { value: true } }
    );
    expect(flat).toEqual({ a: 1, b: "x", c: true });
  });

  it("后出现的 map 覆盖同名符号", () => {
    expect(valuesFromSymbolMaps({ a: { value: 1 } }, { a: { value: 9 } })).toEqual({ a: 9 });
  });
});

describe("符号集 & 视频映射", () => {
  it("真空、卷绕、镀膜三类符号合并为固定订阅集且无重名", () => {
    expect(PHASE_VACUUM_SYMBOLS).toHaveLength(6);
    expect(PHASE_HIVAC_SYMBOLS).toHaveLength(3);
    expect(PHASE_AUTOPUMP_SYMBOLS).toHaveLength(3);
    expect(PHASE_WINDING_SYMBOLS).toHaveLength(5);
    expect(PHASE_COATING_SYMBOLS).toHaveLength(6);
    expect(new Set(PHASE_ALL_SYMBOLS).size).toBe(PHASE_ALL_SYMBOLS.length);
  });

  it("3 个运行态各映射一个 /videos/*.mp4", () => {
    const running: Exclude<MachinePhase, "idle">[] = [
      "pump",
      "pump+winding",
      "pump+winding+coating"
    ];
    for (const phase of running) {
      expect(PHASE_VIDEO[phase]).toMatch(/^\/videos\/[a-z_]+\.mp4$/);
    }
  });

  it("3 个运行态都有取景配置：zoom≥1、focus 在 [0,1]，默认值居中", () => {
    const running: Exclude<MachinePhase, "idle">[] = [
      "pump",
      "pump+winding",
      "pump+winding+coating"
    ];
    for (const phase of running) {
      const framing = PHASE_VIDEO_FRAMING[phase];
      expect(framing.zoom).toBeGreaterThanOrEqual(1);
      expect(framing.focusX).toBeGreaterThanOrEqual(0);
      expect(framing.focusX).toBeLessThanOrEqual(1);
      expect(framing.focusY).toBeGreaterThanOrEqual(0);
      expect(framing.focusY).toBeLessThanOrEqual(1);
    }
    // 默认取景：沿画面中心放大（focus 0.5/0.5）。
    expect(PHASE_VIDEO_FRAMING_DEFAULT).toEqual({ zoom: 1.35, focusX: 0.5, focusY: 0.5 });
  });

  it("idle 不在视频映射中（闲置不播视频）", () => {
    const keys = Object.keys(PHASE_VIDEO);
    expect(keys).not.toContain("idle");
  });
});

describe("调试覆盖 MACHINE_PHASE_OVERRIDE", () => {
  it("默认（无 .env.local 设置）时为 null，走真实数据驱动", () => {
    expect(MACHINE_PHASE_OVERRIDE).toBeNull();
    expect(classifyMachinePhase({})).toBe("idle");
  });
});