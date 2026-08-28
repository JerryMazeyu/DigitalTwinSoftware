import { describe, expect, it } from "vitest";

import {
  COATING_SUBSTATE_VIDEOS,
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
  activeCoatingPowers,
  classifyMachinePhase,
  coatingSignature,
  parseCoatingPowerSet,
  parseMachinePhaseOverride,
  phaseDisplayLabel,
  selectPhaseVideo,
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

// 便捷构造：按电源编号（1..6）构造「这些电源在满功率工作」的 values。
function coatingValues(powers: readonly number[]): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  for (const p of powers) values[PHASE_COATING_SYMBOLS[p - 1]] = 80;
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

  it("pump / pump+winding 各映射一个 /videos/*.mp4（镀膜已细分为子状态视频）", () => {
    expect(PHASE_VIDEO.pump).toMatch(/^\/videos\/[a-z0-9_]+\.mp4$/);
    expect(PHASE_VIDEO["pump+winding"]).toMatch(/^\/videos\/[a-z0-9_]+\.mp4$/);
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
    // 通用镀膜素材已删除、coating 细分为子状态视频——防死引用复活。
    expect(keys).not.toContain("pump+winding+coating");
  });
});

describe("镀膜子状态视频配置", () => {
  // 用户给定的映射表：01→{6}、02→{1}…06→{5}、07→{1,4}、08→{2,3}。
  const EXPECTED: ReadonlyArray<readonly [string, readonly number[]]> = [
    ["01", [6]],
    ["02", [1]],
    ["03", [2]],
    ["04", [3]],
    ["05", [4]],
    ["06", [5]],
    ["07", [1, 4]],
    ["08", [2, 3]]
  ];

  it("恰 8 条且与映射表逐条一致", () => {
    expect(COATING_SUBSTATE_VIDEOS).toHaveLength(8);
    COATING_SUBSTATE_VIDEOS.forEach((entry, i) => {
      expect(entry.src).toBe(`/videos/pumping_winding_coating_${EXPECTED[i][0]}.mp4`);
      expect(entry.powers).toEqual(EXPECTED[i][1]);
    });
  });

  it("powers 非空升序、编号在 1..6，签名与 src 两两互异", () => {
    const signatures = new Set<string>();
    const srcs = new Set<string>();
    for (const entry of COATING_SUBSTATE_VIDEOS) {
      expect(entry.powers.length).toBeGreaterThan(0);
      expect([...entry.powers].sort((a, b) => a - b)).toEqual(entry.powers);
      for (const p of entry.powers) {
        expect(p).toBeGreaterThanOrEqual(1);
        expect(p).toBeLessThanOrEqual(PHASE_COATING_SYMBOLS.length);
      }
      const sig = coatingSignature(entry.powers);
      expect(signatures.has(sig)).toBe(false);
      signatures.add(sig);
      expect(srcs.has(entry.src)).toBe(false);
      srcs.add(entry.src);
    }
  });
});

describe("coatingSignature 规范化", () => {
  it("去重 + 升序 + + 连接；空集为空串", () => {
    expect(coatingSignature([1, 4])).toBe("1+4");
    expect(coatingSignature([4, 1, 4])).toBe("1+4");
    expect(coatingSignature([6])).toBe("6");
    expect(coatingSignature([])).toBe("");
  });
});

describe("activeCoatingPowers 活跃集推导", () => {
  it("空 values → 空集", () => {
    expect(activeCoatingPowers({})).toEqual([]);
  });

  it("阈值边界：>50 活跃，=50 与 49.9 不活跃", () => {
    const values: Record<string, unknown> = {};
    values[PHASE_COATING_SYMBOLS[0]] = 50;
    values[PHASE_COATING_SYMBOLS[1]] = 50.01;
    values[PHASE_COATING_SYMBOLS[2]] = 49.9;
    expect(activeCoatingPowers(values)).toEqual([2]);
  });

  it("多路活跃按编号升序；字符串数字可解析；boolean true(=1) 不活跃", () => {
    const values: Record<string, unknown> = {};
    values[PHASE_COATING_SYMBOLS[5]] = 80;
    values[PHASE_COATING_SYMBOLS[1]] = "80";
    values[PHASE_COATING_SYMBOLS[3]] = true;
    expect(activeCoatingPowers(values)).toEqual([2, 6]);
  });
});

describe("parseCoatingPowerSet 电源集解析", () => {
  it("合法：单值 / 多种分隔符 / 去重升序", () => {
    expect(parseCoatingPowerSet("6")).toEqual([6]);
    expect(parseCoatingPowerSet("1+4")).toEqual([1, 4]);
    expect(parseCoatingPowerSet("1,4")).toEqual([1, 4]);
    expect(parseCoatingPowerSet("1 4")).toEqual([1, 4]);
    expect(parseCoatingPowerSet("1、4")).toEqual([1, 4]);
    expect(parseCoatingPowerSet("1+1+4")).toEqual([1, 4]);
    expect(parseCoatingPowerSet("4+1")).toEqual([1, 4]);
  });

  it("空串 / 纯空白 → null（等价未设置）", () => {
    expect(parseCoatingPowerSet("")).toBeNull();
    expect(parseCoatingPowerSet("   ")).toBeNull();
  });

  it("全有或全无：任一编号非法 → 整体 null", () => {
    expect(parseCoatingPowerSet("0")).toBeNull();
    expect(parseCoatingPowerSet("7")).toBeNull();
    expect(parseCoatingPowerSet("-1")).toBeNull();
    expect(parseCoatingPowerSet("1.5")).toBeNull();
    expect(parseCoatingPowerSet("abc")).toBeNull();
    expect(parseCoatingPowerSet("1+a")).toBeNull();
    expect(parseCoatingPowerSet(42)).toBeNull();
  });
});

describe("parseMachinePhaseOverride 解析", () => {
  it("4 个旧值向后兼容（无后缀 → coatingPowers=null）", () => {
    const phases: MachinePhase[] = ["idle", "pump", "pump+winding", "pump+winding+coating"];
    for (const phase of phases) {
      expect(parseMachinePhaseOverride(phase)).toEqual({ phase, coatingPowers: null });
    }
  });

  it(":电源集 后缀钉住镀膜子状态", () => {
    expect(parseMachinePhaseOverride("pump+winding+coating:1+4")).toEqual({
      phase: "pump+winding+coating",
      coatingPowers: [1, 4]
    });
    expect(parseMachinePhaseOverride("pump+winding+coating:3+5")).toEqual({
      phase: "pump+winding+coating",
      coatingPowers: [3, 5]
    });
    expect(parseMachinePhaseOverride("pump+winding+coating:6")).toEqual({
      phase: "pump+winding+coating",
      coatingPowers: [6]
    });
  });

  it("电源段非法 / 为空 → 相位仍生效、电源忽略（coatingPowers=null）", () => {
    expect(parseMachinePhaseOverride("pump+winding+coating:abc")).toEqual({
      phase: "pump+winding+coating",
      coatingPowers: null
    });
    expect(parseMachinePhaseOverride("pump+winding+coating:")).toEqual({
      phase: "pump+winding+coating",
      coatingPowers: null
    });
  });

  it("相位段非法 / 非字符串 → null（整体忽略）；电源段含非法字符 → 电源忽略", () => {
    expect(parseMachinePhaseOverride("coating")).toBeNull();
    // 只按第一个 : 切分，"1+2:extra" 是非法电源段 → coatingPowers=null。
    expect(parseMachinePhaseOverride("pump:1+2:extra")).toEqual({ phase: "pump", coatingPowers: null });
    expect(parseMachinePhaseOverride("")).toBeNull();
    expect(parseMachinePhaseOverride(undefined)).toBeNull();
  });
});

describe("selectPhaseVideo 视频选择", () => {
  it("idle → null；pump / pump+winding 透传 PHASE_VIDEO", () => {
    expect(selectPhaseVideo("idle", {})).toBeNull();
    expect(selectPhaseVideo("pump", {})).toEqual({ phase: "pump", src: "/videos/pumping.mp4" });
    expect(selectPhaseVideo("pump+winding", {})).toEqual({
      phase: "pump+winding",
      src: "/videos/pumping_winding.mp4"
    });
  });

  it("8 个已知电源组合各返回正确视频（精确集合匹配）", () => {
    const cases: ReadonlyArray<readonly [readonly number[], string]> = [
      [[6], "01"],
      [[1], "02"],
      [[2], "03"],
      [[3], "04"],
      [[4], "05"],
      [[5], "06"],
      [[1, 4], "07"],
      [[2, 3], "08"]
    ];
    for (const [powers, num] of cases) {
      expect(selectPhaseVideo("pump+winding+coating", coatingValues(powers))).toEqual({
        phase: "pump+winding+coating",
        src: `/videos/pumping_winding_coating_${num}.mp4`
      });
    }
  });

  it("未知组合 → null（不播视频露出 3D 模型）", () => {
    for (const powers of [[3, 5], [1, 2, 4], [1, 2, 3, 4, 5, 6]] as const) {
      expect(selectPhaseVideo("pump+winding+coating", coatingValues(powers))).toBeNull();
    }
  });

  it("coating 但无电源活跃（功率全缺失 / 全 ≤50）→ null", () => {
    expect(selectPhaseVideo("pump+winding+coating", {})).toBeNull();
    expect(selectPhaseVideo("pump+winding+coating", coatingValues([]))).toBeNull();
  });
});

describe("phaseDisplayLabel 徽章文案", () => {
  it("已知组合显示 镀膜·电源集", () => {
    expect(phaseDisplayLabel("pump+winding+coating", coatingValues([1, 4]))).toBe("镀膜·1+4");
    expect(phaseDisplayLabel("pump+winding+coating", coatingValues([6]))).toBe("镀膜·6");
  });

  it("未知组合同样显示真实状态（状态显示覆盖全部组合）", () => {
    expect(phaseDisplayLabel("pump+winding+coating", coatingValues([3, 5]))).toBe("镀膜·3+5");
    expect(phaseDisplayLabel("pump+winding+coating", coatingValues([1, 2, 4]))).toBe("镀膜·1+2+4");
  });

  it("空集回退纯 镀膜；其他相位透传 PHASE_LABEL", () => {
    expect(phaseDisplayLabel("pump+winding+coating", {})).toBe("镀膜");
    expect(phaseDisplayLabel("idle", {})).toBe("闲置");
    expect(phaseDisplayLabel("pump", {})).toBe("抽真空");
    expect(phaseDisplayLabel("pump+winding", {})).toBe("卷绕");
  });
});

describe("调试覆盖 MACHINE_PHASE_OVERRIDE", () => {
  it("测试环境强制清空 VITE_MACHINE_PHASE（vite.config test.env）→ 为 null，走真实数据驱动", () => {
    expect(MACHINE_PHASE_OVERRIDE).toBeNull();
    expect(classifyMachinePhase({})).toBe("idle");
  });
});