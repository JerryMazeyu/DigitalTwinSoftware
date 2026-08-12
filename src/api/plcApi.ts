import { PLC_SENSOR_META } from "../data/plcSensorMap";

// PLC data source: separate Beckhoff JMJ Reader FastAPI service.
// Override via VITE_PLC_API_BASE; default matches BeckhoffJMJReader/main.py:132.
const envBase = (import.meta as ImportMeta & { env?: { VITE_PLC_API_BASE?: string } }).env?.VITE_PLC_API_BASE;

export const PLC_API_BASE = (envBase || "http://127.0.0.1:8000").replace(/\/$/, "");

/** Per-request timeout (ms). Override via VITE_PLC_REQUEST_TIMEOUT_MS if needed. */
const envTimeout = Number(
  (import.meta as ImportMeta & { env?: { VITE_PLC_REQUEST_TIMEOUT_MS?: string } }).env?.VITE_PLC_REQUEST_TIMEOUT_MS
);
export const PLC_REQUEST_TIMEOUT_MS = Number.isFinite(envTimeout) && envTimeout > 0 ? envTimeout : 4000;

/** Build an AbortSignal that fires after `ms` or when the caller cancels. */
const timeoutSignal = (ms: number, external?: AbortSignal): AbortSignal => {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(new Error("timeout")), ms);
  if (external) {
    if (external.aborted) controller.abort(external.reason);
    else external.addEventListener("abort", () => controller.abort(external.reason), { once: true });
  }
  // The signal lives for the request; clean up timer when caller ends.
  controller.signal.addEventListener("abort", () => window.clearTimeout(timer), { once: true });
  return controller.signal;
};

/** Classify a thrown error: timeout vs network failure vs HTTP error. */
export type PlcFetchErrorKind = "timeout" | "network" | "aborted";
export const classifyFetchError = (error: unknown): PlcFetchErrorKind => {
  if (!error || typeof error !== "object") return "network";
  const e = error as { name?: string; message?: string };
  if (e.name === "AbortError") return "aborted";
  if (e.message === "timeout" || /timeout/i.test(e.message ?? "")) return "timeout";
  return "network";
};

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
    const response = await fetch(`${PLC_API_BASE}/api/status`, {
      signal: timeoutSignal(PLC_REQUEST_TIMEOUT_MS, signal)
    });
    if (!response.ok) {
      return { connected: false, last_error: `HTTP ${response.status}` };
    }
    return (await response.json()) as PlcStatusPayload;
  } catch (error) {
    if (classifyFetchError(error) === "aborted") {
      return { connected: false, last_error: "aborted" };
    }
    if (classifyFetchError(error) === "timeout") {
      return { connected: false, last_error: "timeout" };
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
    const response = await fetch(`${PLC_API_BASE}/api/vars`, {
      signal: timeoutSignal(PLC_REQUEST_TIMEOUT_MS, signal)
    });
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
    if (classifyFetchError(error) === "aborted") {
      return { bySymbol: {}, raw: null, error: "aborted" };
    }
    if (classifyFetchError(error) === "timeout") {
      return { bySymbol: {}, raw: null, error: `读取超时（${PLC_REQUEST_TIMEOUT_MS}ms）` };
    }
    return {
      bySymbol: {},
      raw: null,
      error: error instanceof Error ? error.message : "无法读取 PLC 变量"
    };
  }
};

/** Read a single variable by its PLC name. Times out after `PLC_REQUEST_TIMEOUT_MS`. */
export const fetchPlcVar = async (
  plainName: string,
  signal?: AbortSignal
): Promise<PlcVarLive | null> => {
  const url = `${PLC_API_BASE}/api/vars/${encodeURIComponent(plainName)}`;
  try {
    const response = await fetch(url, {
      signal: timeoutSignal(PLC_REQUEST_TIMEOUT_MS, signal)
    });
    if (!response.ok) {
      return { name: plainName, type: "Unknown", value: null };
    }
    return (await response.json()) as PlcVarLive;
  } catch (error) {
    const kind = classifyFetchError(error);
    if (kind === "aborted") return null;
    if (kind === "timeout") {
      return { name: plainName, type: "Timeout", value: null };
    }
    return { name: plainName, type: "NetworkError", value: null };
  }
};

/**
 * Fetch the full symbol catalog from the reader. Cheap (~50ms for 3k symbols)
 * and used to map our对照表 canonical names to the real PLC dotted/UPPER form.
 */
export const fetchPlcSymbols = async (signal?: AbortSignal): Promise<PlcSymbolsPayload> => {
  const response = await fetch(`${PLC_API_BASE}/api/symbols`, {
    signal: timeoutSignal(PLC_REQUEST_TIMEOUT_MS, signal)
  });
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