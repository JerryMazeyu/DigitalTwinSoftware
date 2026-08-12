import { useCallback, useEffect, useRef, useState } from "react";

import {
  buildPlcSymbolLookup,
  classifyFetchError,
  fetchPlcStatus,
  fetchPlcSymbols,
  fetchPlcVar,
  type PlcStatusPayload,
  type PlcSymbolLookup,
  type PlcVarLive
} from "../api/plcApi";

const DEFAULT_CONCURRENCY = 16;

export type PlcSensorLiveState = {
  /** Map of `canonicalPlcSymbol -> live variable` for the resolved subset. */
  bySymbol: Record<string, PlcVarLive>;
  /** Canonical names that exist on the live PLC. */
  resolved: ReadonlySet<string>;
  /** Canonical names that have no matching PLC symbol (structure members, array indexes, etc.). */
  missing: ReadonlySet<string>;
  /** Latest connection snapshot from `/api/status`. */
  status: PlcStatusPayload;
  /** True until the first round-trip completes (success or failure). */
  loading: boolean;
  /** Last error from the most recent failed fetch. Null while healthy. */
  error: string | null;
  /** ISO timestamp of the last successful values fetch. */
  lastFetchAt: string | null;
  /** ISO timestamp of the symbol lookup. Null until built. */
  resolvedAt: string | null;
};

export interface UsePlcSensorsOptions {
  /** Canonical meta `plcSymbol` names the dashboard wants to monitor. */
  wantedSymbols: readonly string[];
  /** Polling interval in ms. 0 disables polling (manual refresh only). Default 5000. */
  intervalMs?: number;
  /** Concurrent `/api/vars/{name}` requests per cycle. Default 16. */
  concurrency?: number;
  /** Whether to fetch on mount. Defaults to true. */
  enabled?: boolean;
}

const INITIAL_STATUS: PlcStatusPayload = {
  connected: false,
  last_error: null
};

const INITIAL_STATE: PlcSensorLiveState = {
  bySymbol: {},
  resolved: new Set<string>(),
  missing: new Set<string>(),
  status: INITIAL_STATUS,
  loading: true,
  error: null,
  lastFetchAt: null,
  resolvedAt: null
};

const runWithConcurrency = async <T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const laneCount = Math.max(1, Math.min(concurrency, items.length));
  const lanes = Array.from({ length: laneCount }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await worker(items[i]);
    }
  });
  await Promise.all(lanes);
  return results;
};

export const usePlcSensors = (options: UsePlcSensorsOptions) => {
  const {
    wantedSymbols,
    intervalMs = 5000,
    concurrency = DEFAULT_CONCURRENCY,
    enabled = true
  } = options;

  const [state, setState] = useState<PlcSensorLiveState>(INITIAL_STATE);
  const lookupRef = useRef<PlcSymbolLookup | null>(null);
  const intervalRef = useRef<number | null>(null);
  const aliveRef = useRef(true);
  const fetchingRef = useRef(false);

  // Stable key for wantedSymbols so reference changes don't refetch the symbol catalog.
  const wantedKey = wantedSymbols.slice().sort().join("|");

  const fetchValues = useCallback(
    async (lookup: PlcSymbolLookup) => {
      const resolvedNames: string[] = [];
      for (const canonical of wantedSymbols) {
        const actual = lookup.byCanonical.get(canonical);
        if (actual !== undefined) resolvedNames.push(canonical);
      }
      if (resolvedNames.length === 0) {
        if (!aliveRef.current) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: null,
          bySymbol: {},
          lastFetchAt: new Date().toISOString()
        }));
        return;
      }

      fetchingRef.current = true;
      try {
        const fetches = await runWithConcurrency(
          resolvedNames,
          concurrency,
          async (canonical) => {
            const actual = lookup.byCanonical.get(canonical)!;
            const live = await fetchPlcVar(actual);
            return [canonical, live] as const;
          }
        );
        if (!aliveRef.current) return;

        const bySymbol: Record<string, PlcVarLive> = {};
        let timeoutCount = 0;
        for (const [canonical, live] of fetches) {
          if (live) {
            if (live.type === "Timeout" || live.type === "NetworkError") {
              timeoutCount += 1;
            } else {
              bySymbol[canonical] = live;
            }
          }
        }
        const allTimedOut = timeoutCount === resolvedNames.length;
        setState((current) => ({
          ...current,
          bySymbol,
          loading: false,
          error: allTimedOut
            ? `PLC 读取超时（${resolvedNames.length}/${resolvedNames.length} 项），请检查 BeckhoffJMJReader 服务的 pyads 状态`
            : timeoutCount > 0
              ? `${timeoutCount}/${resolvedNames.length} 项读取超时`
              : null,
          lastFetchAt: new Date().toISOString()
        }));
      } catch (error) {
        if (!aliveRef.current) return;
        setState((current) => ({
          ...current,
          loading: false,
          error: classifyFetchError(error) === "timeout"
            ? "PLC 读取批量超时"
            : error instanceof Error
              ? error.message
              : "PLC 读取失败"
        }));
      } finally {
        fetchingRef.current = false;
      }
    },
    [concurrency, wantedSymbols]
  );

  const runOnce = useCallback(async () => {
    let lookup = lookupRef.current;
    let lookupJustBuilt = false;
    if (!lookup) {
      try {
        const { symbols } = await fetchPlcSymbols();
        lookup = buildPlcSymbolLookup(symbols, wantedSymbols);
        lookupRef.current = lookup;
        lookupJustBuilt = true;
      } catch (error) {
        if (!aliveRef.current) return;
        const kind = classifyFetchError(error);
        setState((current) => ({
          ...current,
          loading: false,
          error:
            kind === "timeout"
              ? "无法获取 PLC 符号表（读取超时）"
              : error instanceof Error
                ? error.message
                : "无法获取 PLC 符号表"
        }));
        return;
      }
    }

    const status = await fetchPlcStatus();
    if (!aliveRef.current) return;

    if (lookupJustBuilt) {
      setState((current) => ({
        ...current,
        status,
        resolved: new Set(lookup!.byCanonical.keys()),
        missing: new Set(lookup!.missing),
        resolvedAt: new Date().toISOString(),
        error: null
      }));
    } else {
      setState((current) => ({ ...current, status }));
    }

    await fetchValues(lookup);
  }, [fetchValues, wantedSymbols]);

  useEffect(() => {
    if (!enabled) {
      aliveRef.current = true;
      return;
    }
    aliveRef.current = true;
    lookupRef.current = null;
    void runOnce();

    if (intervalMs > 0) {
      intervalRef.current = window.setInterval(() => {
        if (fetchingRef.current) return;
        void runOnce();
      }, intervalMs);
    }

    return () => {
      aliveRef.current = false;
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
    // wantedKey ensures we rebuild the lookup when the wanted set changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, intervalMs, wantedKey]);

  const refetch = useCallback(() => {
    if (fetchingRef.current) return;
    void runOnce();
  }, [runOnce]);

  return {
    ...state,
    refetch
  };
};