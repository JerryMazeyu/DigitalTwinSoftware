import { useEffect, useRef, useState } from "react";

import {
  buildPlcSymbolLookup,
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
};

const INITIAL: PlcSensorValue = {
  value: null,
  type: null,
  lastFetchAt: null,
  connected: false,
  error: null,
  unresolved: false
};

/**
 * Single-symbol polling hook for things like "this one mesh needs the chamber-1 hi-vac boolean".
 * Builds the lookup once and reuses it across polls.
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
        setState({
          value: live.value,
          type: live.type,
          lastFetchAt: new Date().toISOString(),
          connected: status.connected,
          error: null,
          unresolved: false
        });
      } catch (error) {
        if (!aliveRef.current) return;
        setState((current) => ({
          ...current,
          error: error instanceof Error ? error.message : "fetch failed"
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