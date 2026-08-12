import { useEffect, useRef, useState } from "react";

import {
  buildPlcSymbolLookup,
  classifyFetchError,
  fetchPlcStatus,
  fetchPlcSymbols,
  fetchPlcVar
} from "../api/plcApi";

export type PlcSensorValue = {
  value: unknown;
  type: string | null;
  lastFetchAt: string | null;
  connected: boolean;
  error: string | null;
  /** True when the canonical name could not be resolved on the live PLC. */
  unresolved: boolean;
  /** True when the read failed with a timeout (read endpoint is stuck). */
  timedOut: boolean;
};

const INITIAL: PlcSensorValue = {
  value: null,
  type: null,
  lastFetchAt: null,
  connected: false,
  error: null,
  unresolved: false,
  timedOut: false
};

/**
 * Single-symbol polling hook for things like "this one mesh needs the chamber-1 hi-vac boolean".
 * Builds the lookup once and reuses it across polls. All fetches go through
 * `fetchPlcVar` which has its own timeout, so this hook never hangs the UI.
 */
export const usePlcSensorValue = (plcSymbol: string, intervalMs = 2000): PlcSensorValue => {
  const [state, setState] = useState<PlcSensorValue>(INITIAL);
  const actualNameRef = useRef<string | null>(null);
  const aliveRef = useRef(true);

  useEffect(() => {
    aliveRef.current = true;
    actualNameRef.current = null;
    let interval: number | null = null;

    const runOnce = async () => {
      try {
        if (!actualNameRef.current) {
          const { symbols } = await fetchPlcSymbols();
          const lookup = buildPlcSymbolLookup(symbols, [plcSymbol]);
          const actual = lookup.byCanonical.get(plcSymbol);
          if (!actual) {
            if (!aliveRef.current) return;
            setState({ ...INITIAL, unresolved: true, connected: true });
            return;
          }
          actualNameRef.current = actual;
        }

        const status = await fetchPlcStatus();
        if (!aliveRef.current) return;
        const live = await fetchPlcVar(actualNameRef.current);
        if (!aliveRef.current) return;

        if (!live) {
          setState((current) => ({
            ...current,
            connected: status.connected,
            error: "读取被中止",
            timedOut: true,
            lastFetchAt: new Date().toISOString()
          }));
          return;
        }

        const timedOut = live.type === "Timeout" || live.type === "NetworkError";
        setState({
          value: live.value,
          type: live.type,
          lastFetchAt: new Date().toISOString(),
          connected: status.connected,
          error: timedOut ? "PLC 读取超时，请检查 BeckhoffJMJReader 服务" : null,
          unresolved: false,
          timedOut
        });
      } catch (error) {
        if (!aliveRef.current) return;
        const kind = classifyFetchError(error);
        setState((current) => ({
          ...current,
          error:
            kind === "timeout"
              ? "PLC 读取超时"
              : error instanceof Error
                ? error.message
                : "fetch failed",
          timedOut: kind === "timeout"
        }));
      }
    };

    void runOnce();
    if (intervalMs > 0) {
      interval = window.setInterval(runOnce, intervalMs);
    }
    return () => {
      aliveRef.current = false;
      if (interval !== null) {
        window.clearInterval(interval);
      }
    };
  }, [plcSymbol, intervalMs]);

  return state;
};