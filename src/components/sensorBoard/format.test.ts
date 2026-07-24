import { describe, expect, it } from "vitest";

import {
  buildPlcSymbolLookup,
  normalizePlcName,
  type PlcSymbolInfo
} from "../../api/plcApi";
import { PLC_SENSOR_META } from "../../data/plcSensorMap";
import type { PlcSensorMeta } from "../../data/plcSensorMap";
import { compareBySensorNo, formatPlcValue, matchesQuery } from "./format";

const baseMeta = (overrides: Partial<PlcSensorMeta> = {}): PlcSensorMeta => ({
  no: 1,
  categoryCn: "真空系统操作状态",
  categoryEn: "VacuumOperationStatus",
  cnName: "腔体1高真空状态",
  enName: "dbVacOpStatus bChb1HiVac",
  plcSymbol: "dbVacOpStatus_bChbHiVac1",
  opcAddress: ".dbVacOpStatus_bChbHiVac1",
  dataType: "Boolean",
  scanPeriodMs: 100,
  unit: "布尔量",
  valueMeaning: "True=条件成立/正常/动作有效",
  remark: "按 bChb1HiVac 原变量名推断",
  ...overrides
});

describe("formatPlcValue", () => {
  it("renders `—` for null and undefined without a tone", () => {
    expect(formatPlcValue(null, baseMeta())).toEqual({ display: "—", tone: "muted" });
    expect(formatPlcValue(undefined, baseMeta())).toEqual({ display: "—", tone: "muted" });
  });

  it("renders Boolean true as ✓ 正常 and false as ✗ 异常", () => {
    const meta = baseMeta({ dataType: "Boolean", unit: "布尔量" });
    expect(formatPlcValue(true, meta)).toEqual({ display: "✓ 正常", tone: "ok" });
    expect(formatPlcValue(false, meta)).toEqual({ display: "✗ 异常", tone: "err" });
  });

  it("treats raw boolean values as status even when dataType is missing", () => {
    const meta = baseMeta({ dataType: "Short" });
    expect(formatPlcValue(true, meta)).toEqual({ display: "✓ 正常", tone: "ok" });
  });

  it("formats floats with magnitude-aware precision and appends the unit", () => {
    const meta = baseMeta({ dataType: "Float", unit: "V" });
    // precision scales with magnitude so that numbers in the same row stay column-aligned:
    // |v|>=1000 -> 0 decimals, >=100 -> 1, >=10 -> 2, else 3
    expect(formatPlcValue(1234, meta).display).toBe("1234 V");
    expect(formatPlcValue(412, meta).display).toBe("412.0 V");
    expect(formatPlcValue(12.34, meta).display).toBe("12.34 V");
    expect(formatPlcValue(0.0008, meta).display).toBe("0.001 V");
  });

  it("does not append a unit when the value's unit cell is the literal `布尔量`", () => {
    const meta = baseMeta({ dataType: "Short", unit: "布尔量" });
    expect(formatPlcValue(3, meta).display).toBe("3.000");
  });

  it("falls back to NaN when the number is non-finite", () => {
    const meta = baseMeta({ dataType: "Float", unit: "Pa" });
    expect(formatPlcValue(NaN, meta)).toEqual({ display: "NaN", tone: "warn" });
  });

  it("renders empty strings as a muted dash", () => {
    const meta = baseMeta({ dataType: "String", unit: "文本" });
    expect(formatPlcValue("", meta)).toEqual({ display: "—", tone: "muted" });
    expect(formatPlcValue("ALARM HIGH", meta)).toEqual({ display: "ALARM HIGH", tone: "number" });
  });
});

describe("matchesQuery", () => {
  const meta = baseMeta();

  it("returns true for empty / whitespace-only queries", () => {
    expect(matchesQuery(meta, "")).toBe(true);
    expect(matchesQuery(meta, "   ")).toBe(true);
  });

  it("matches against the Chinese name", () => {
    expect(matchesQuery(meta, "腔体1")).toBe(true);
  });

  it("matches against the PLC symbol and English name", () => {
    expect(matchesQuery(meta, "DBVACOPSTATUS_BCHBHIVAC1")).toBe(true);
    expect(matchesQuery(meta, "bChb1HiVac")).toBe(true);
  });

  it("matches against the category text", () => {
    expect(matchesQuery(meta, "VacuumOperationStatus")).toBe(true);
    expect(matchesQuery(meta, "真空")).toBe(true);
  });

  it("matches against the remark", () => {
    expect(matchesQuery(meta, "推断")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(matchesQuery(meta, "DBVacOp")).toBe(true);
  });

  it("returns false for non-matching queries", () => {
    expect(matchesQuery(meta, "throttle valve")).toBe(false);
  });
});

describe("compareBySensorNo", () => {
  it("sorts sensors by their source-table sequence number", () => {
    const rows = [
      baseMeta({ no: 5, plcSymbol: "x5" }),
      baseMeta({ no: 1, plcSymbol: "x1" }),
      baseMeta({ no: 3, plcSymbol: "x3" })
    ];
    expect(rows.slice().sort(compareBySensorNo).map((r) => r.plcSymbol)).toEqual([
      "x1",
      "x3",
      "x5"
    ]);
  });
});

describe("PLC_SENSOR_META generated dataset", () => {
  it("contains exactly 387 rows in source order", () => {
    expect(PLC_SENSOR_META).toHaveLength(387);
    expect(PLC_SENSOR_META[0].no).toBe(1);
    expect(PLC_SENSOR_META[PLC_SENSOR_META.length - 1].no).toBe(387);
  });

  it("covers all 10 expected categories with matching counts", () => {
    const counts = new Map<string, number>();
    for (const row of PLC_SENSOR_META) {
      counts.set(row.categoryEn, (counts.get(row.categoryEn) ?? 0) + 1);
    }
    expect(counts.get("InterlockInput")).toBe(47);
    expect(counts.get("VacuumOperationStatus")).toBe(139);
    expect(counts.get("VacuumGauge")).toBe(52);
    expect(counts.get("MagnetronStatus")).toBe(56);
    expect(counts.get("TemperatureOrColdTrap")).toBe(9);
    expect(counts.get("IonSourceActual")).toBe(3);
    expect(counts.get("MKSFlowActual")).toBe(30);
    expect(counts.get("SputterPowerActual")).toBe(24);
    expect(counts.get("AxisStatus")).toBe(14);
    expect(counts.get("WindingActual")).toBe(13);
  });

  it("keeps `plcSymbol` unique across the table", () => {
    const seen = new Set<string>();
    for (const row of PLC_SENSOR_META) {
      expect(seen.has(row.plcSymbol)).toBe(false);
      seen.add(row.plcSymbol);
    }
  });
});

describe("normalizePlcName", () => {
  it("strips a single leading dot and lowercases", () => {
    expect(normalizePlcName(".G_IBAIROK")).toBe("g_ibairok");
    expect(normalizePlcName("G_IBAIROK")).toBe("g_ibairok");
    expect(normalizePlcName("g_ibAirOk")).toBe("g_ibairok");
  });

  it("ignores more than one leading dot", () => {
    expect(normalizePlcName("..foo")).toBe(".foo");
  });
});

describe("buildPlcSymbolLookup", () => {
  const live: PlcSymbolInfo[] = [
    { name: ".G_IBAIROK", type: "BOOL" },
    { name: ".DBVACOPSTATUS_BCHBHIVAC1", type: "BOOL" },
    { name: ".DBHTG_FPOWER_ACTUAL[0]", type: "REAL" }
  ];

  it("maps canonical meta names to their dotted PLC counterparts", () => {
    const { byCanonical, missing } = buildPlcSymbolLookup(live, [
      "g_ibAirOk",
      "dbVacOpStatus_bChbHiVac1"
    ]);
    expect(byCanonical.get("g_ibAirOk")).toBe(".G_IBAIROK");
    expect(byCanonical.get("dbVacOpStatus_bChbHiVac1")).toBe(".DBVACOPSTATUS_BCHBHIVAC1");
    expect(missing.size).toBe(0);
  });

  it("puts canonical names without a live match into `missing`", () => {
    const { byCanonical, missing } = buildPlcSymbolLookup(live, [
      "g_ibAirOk",
      "dbGauge_fData[0]",
      "someTotallyUnknownSymbol"
    ]);
    expect(byCanonical.has("g_ibAirOk")).toBe(true);
    expect(missing.has("dbGauge_fData[0]")).toBe(true);
    expect(missing.has("someTotallyUnknownSymbol")).toBe(true);
  });

  it("is case-insensitive", () => {
    const { byCanonical } = buildPlcSymbolLookup(
      [{ name: ".DBVACOPSTATUS_BCHBHIVAC1", type: "BOOL" }],
      ["DBVacOpStatus_bChbHiVac1"]
    );
    expect(byCanonical.get("DBVacOpStatus_bChbHiVac1")).toBe(".DBVACOPSTATUS_BCHBHIVAC1");
  });
});