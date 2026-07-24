import { PLC_SENSOR_META } from "../data/plcSensorMap";

// PLC data source: separate Beckhoff JMJ Reader FastAPI service.
// Override via VITE_PLC_API_BASE; default matches BeckhoffJMJReader/main.py:132.
const envBase = (import.meta as ImportMeta & { env?: { VITE_PLC_API_BASE?: string } }).env?.VITE_PLC_API_BASE;

export const PLC_API_BASE = (envBase || "http://127.0.0.1:8000").replace(/\/$/, "");

export type PlcVarLive = {
  name: string;
  type: string;
  value: unknown;
};

export type PlcVarsPayload = {
  variables: PlcVarLive[];
  error?: string;
};

export type PlcStatusPayload = {
  connected: boolean;
  ams_net_id?: string;
  port?: number;
  plc_ip?: string;
  symbol_count?: number;
  last_error?: string | null;
};

export type PlcSymbolInfo = {
  name: string;
  type: string;
  size?: number | null;
};

export type PlcSymbolsPayload = {
  symbols: PlcSymbolInfo[];
  count: number;
};

/**
 * Read the connection status advertised by the Beckhoff reader.
 * Returns a synthetic `connected: false` payload when the service is unreachable
 * so callers can render the board without throwing.
 */
export const fetchPlcStatus = async (signal?: AbortSignal): Promise<PlcStatusPayload> => {
  try {
    const response = await fetch(`${PLC_API_BASE}/api/status`, { signal });
    if (!response.ok) {
      return { connected: false, last_error: `HTTP ${response.status}` };
    }
    return (await response.json()) as PlcStatusPayload;
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      return { connected: false, last_error: "aborted" };
    }
    return {
      connected: false,
      last_error: error instanceof Error ? error.message : "无法连接 PLC 读取服务"
    };
  }
};

/** Read all live variables. NOTE: returns 3310+ entries — too slow for polling. */
export const fetchPlcVars = async (signal?: AbortSignal): Promise<{
  bySymbol: Record<string, PlcVarLive>;
  raw: PlcVarsPayload | null;
  error: string | null;
}> => {
  try {
    const response = await fetch(`${PLC_API_BASE}/api/vars`, { signal });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return { bySymbol: {}, raw: null, error: text || `HTTP ${response.status}` };
    }
    const payload = (await response.json()) as PlcVarsPayload;
    if (payload.error) {
      return { bySymbol: {}, raw: payload, error: payload.error };
    }
    const bySymbol: Record<string, PlcVarLive> = {};
    for (const v of payload.variables ?? []) {
      bySymbol[v.name] = v;
    }
    return { bySymbol, raw: payload, error: null };
  } catch (error) {
    if ((error as { name?: string })?.name === "AbortError") {
      return { bySymbol: {}, raw: null, error: "aborted" };
    }
    return {
      bySymbol: {},
      raw: null,
      error: error instanceof Error ? error.message : "无法读取 PLC 变量"
    };
  }
};

/** Read a single variable by its PLC name (with or without the `.` prefix). */
export const fetchPlcVar = async (plainName: string, signal?: AbortSignal): Promise<PlcVarLive> => {
  const url = `${PLC_API_BASE}/api/vars/${encodeURIComponent(plainName)}`;
  const response = await fetch(url, { signal });
  if (!response.ok) {
    return { name: plainName, type: "Unknown", value: null };
  }
  return (await response.json()) as PlcVarLive;
};

/**
 * Fetch the full symbol catalog from the reader. Cheap (~50ms for 3k symbols)
 * and used to map our对照表 canonical names to the real PLC dotted/UPPER form.
 */
export const fetchPlcSymbols = async (signal?: AbortSignal): Promise<PlcSymbolsPayload> => {
  const response = await fetch(`${PLC_API_BASE}/api/symbols`, { signal });
  if (!response.ok) {
    throw new Error(`/api/symbols HTTP ${response.status}`);
  }
  return (await response.json()) as PlcSymbolsPayload;
};

/**
 * Normalize a PLC name for case-insensitive comparison:
 * strips a single leading `.` and lowercases.
 * `.G_IBAIROK` and `g_ibAirOk` both map to `g_ibairok`.
 */
export const normalizePlcName = (name: string): string =>
  name.replace(/^\./, "").toLowerCase();

export type PlcSymbolLookup = {
  /** Map from our canonical meta name (e.g. `g_ibAirOk`) to the actual PLC name (e.g. `.G_IBAIROK`). */
  byCanonical: ReadonlyMap<string, string>;
  /** Canonical meta names that have no matching symbol on the live PLC. */
  missing: ReadonlySet<string>;
};

export const buildPlcSymbolLookup = (
  liveSymbols: ReadonlyArray<PlcSymbolInfo>,
  canonicalNames: ReadonlyArray<string>
): PlcSymbolLookup => {
  const byNorm = new Map<string, string>();
  for (const s of liveSymbols) {
    byNorm.set(normalizePlcName(s.name), s.name);
  }
  const byCanonical = new Map<string, string>();
  const missing = new Set<string>();
  for (const cn of canonicalNames) {
    const actual = byNorm.get(normalizePlcName(cn));
    if (actual !== undefined) {
      byCanonical.set(cn, actual);
    } else {
      missing.add(cn);
    }
  }
  return { byCanonical, missing };
};

/** Convenience: every canonical plcSymbol declared in our metadata. */
export const ALL_META_SYMBOLS: readonly string[] = PLC_SENSOR_META.map((m) => m.plcSymbol);