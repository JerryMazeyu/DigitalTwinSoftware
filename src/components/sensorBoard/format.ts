import type { PlcSensorMeta } from "../../data/plcSensorMap";

export const PLACEHOLDER_VALUE = "—";

export type ValueFormat = {
  display: string;
  tone: "ok" | "warn" | "err" | "muted" | "number";
};

/**
 * Format a live PLC value into a presentation-ready string + tone.
 * - Boolean: `✓ 正常` / `✗ 异常`
 * - number: precision chosen by magnitude
 * - everything else: stringified
 */
export const formatPlcValue = (value: unknown, meta: PlcSensorMeta): ValueFormat => {
  if (value === null || value === undefined) {
    return { display: PLACEHOLDER_VALUE, tone: "muted" };
  }
  if (meta.dataType === "Boolean" || typeof value === "boolean") {
    return value
      ? { display: "✓ 正常", tone: "ok" }
      : { display: "✗ 异常", tone: "err" };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      return { display: "NaN", tone: "warn" };
    }
    const abs = Math.abs(value);
    let digits: number;
    if (abs >= 1000) digits = 0;
    else if (abs >= 100) digits = 1;
    else if (abs >= 10) digits = 2;
    else digits = 3;
    const body = value.toFixed(digits);
    return { display: meta.unit && meta.unit !== "布尔量" ? `${body} ${meta.unit}` : body, tone: "number" };
  }
  if (typeof value === "string") {
    return value.length === 0
      ? { display: PLACEHOLDER_VALUE, tone: "muted" }
      : { display: value, tone: "number" };
  }
  return { display: String(value), tone: "number" };
};

export const matchesQuery = (meta: PlcSensorMeta, query: string): boolean => {
  if (!query) return true;
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    meta.cnName.toLowerCase().includes(needle) ||
    meta.enName.toLowerCase().includes(needle) ||
    meta.plcSymbol.toLowerCase().includes(needle) ||
    meta.categoryCn.toLowerCase().includes(needle) ||
    meta.categoryEn.toLowerCase().includes(needle) ||
    meta.remark.toLowerCase().includes(needle)
  );
};

/** Stable, deterministic sort key inside a category. */
export const compareBySensorNo = (a: PlcSensorMeta, b: PlcSensorMeta) => a.no - b.no;