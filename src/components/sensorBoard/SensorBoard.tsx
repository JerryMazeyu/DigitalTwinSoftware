import { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Radio, RefreshCw } from "lucide-react";

import { PLC_API_BASE } from "../../api/plcApi";
import {
  PLC_CATEGORIES,
  PLC_SENSOR_META,
  PLC_TOTAL_SENSORS,
  type PlcCategoryEn
} from "../../data/plcSensorMap";
import { usePlcSensors } from "../../hooks/usePlcSensors";

import { SensorBoardFilters } from "./SensorBoardFilters";
import { SensorBoardTable } from "./SensorBoardTable";

const buildInitialEnabled = (): Set<PlcCategoryEn> =>
  new Set(PLC_CATEGORIES.map((category) => category.en));

export const SensorBoard = () => {
  const [enabled, setEnabled] = useState<Set<PlcCategoryEn>>(buildInitialEnabled);
  const [query, setQuery] = useState("");
  const [intervalMs, setIntervalMs] = useState(5000);

  // Only symbols whose category is enabled are sent through the polling loop.
  // The search query is a display-time filter and does not affect polling.
  const wantedSymbols = useMemo(() => {
    if (enabled.size === 0) return [];
    return PLC_SENSOR_META
      .filter((m) => enabled.has(m.categoryEn as PlcCategoryEn))
      .map((m) => m.plcSymbol);
  }, [enabled]);

  const { bySymbol, resolved, missing, status, loading, error, lastFetchAt, refetch } =
    usePlcSensors({
      wantedSymbols,
      intervalMs
    });

  const toggleCategory = useCallback((en: PlcCategoryEn) => {
    setEnabled((current) => {
      const next = new Set(current);
      if (next.has(en)) {
        next.delete(en);
      } else {
        next.add(en);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setEnabled(buildInitialEnabled()), []);
  const clearAll = useCallback(() => setEnabled(new Set()), []);

  const totalVisible = useMemo(() => {
    return enabled.size > 0
      ? PLC_CATEGORIES.filter((category) => enabled.has(category.en)).reduce(
          (sum, category) => sum + category.count,
          0
        )
      : 0;
  }, [enabled]);

  const connected = status.connected;
  const connectionLabel = loading
    ? "连接中"
    : connected
      ? "已连接"
      : error
        ? "读取失败"
        : "服务离线";
  const connectionTone = loading ? "connecting" : connected ? "online" : error ? "error" : "offline";

  // Surface a one-line resolution summary so the operator can see
  // how many of the wanted sensors actually exist on the live PLC.
  const resolutionSummary =
    resolved.size + missing.size > 0
      ? `${resolved.size} 个匹配 PLC 符号${missing.size > 0 ? `，${missing.size} 个不可读（结构成员/数组下标）` : ""}`
      : null;

  return (
    <section className="panel sensor-board" aria-label="PLC 传感器实时看板">
      <header className="sensor-board-header">
        <div>
          <h2>PLC 传感器实时数据</h2>
          <p>
            Beckhoff TwinCAT · {PLC_TOTAL_SENSORS} 个点位 · 通过 {PLC_API_BASE} 轮询
          </p>
          {resolutionSummary && (
            <p className="sensor-board-resolution">{resolutionSummary}</p>
          )}
        </div>
        <div className="sensor-board-status">
          <span className={`sensor-connection tone-${connectionTone}`}>
            <Radio size={14} />
            <span>{connectionLabel}</span>
          </span>
          <span className="sensor-board-symbol-count">
            符号 {status.symbol_count ?? 0}
          </span>
          <button type="button" className="sensor-board-refresh" onClick={refetch} disabled={loading}>
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>{loading ? "拉取中..." : "立即刷新"}</span>
          </button>
        </div>
      </header>

      {error && (
        <div className="sensor-board-error" role="status">
          <AlertTriangle size={16} />
          <span>{error}</span>
          {status.last_error && status.last_error !== error && (
            <em>· PLC 端：{status.last_error}</em>
          )}
        </div>
      )}

      <SensorBoardFilters
        enabled={enabled}
        onToggle={toggleCategory}
        onSelectAll={selectAll}
        onClearAll={clearAll}
        query={query}
        onQueryChange={setQuery}
        intervalMs={intervalMs}
        onIntervalChange={setIntervalMs}
        totalVisible={totalVisible}
        totalEnabled={enabled.size}
      />

      <div className="sensor-board-scroll">
        <SensorBoardTable
          bySymbol={bySymbol}
          enabled={enabled}
          query={query}
          fetchedAt={lastFetchAt}
        />
      </div>
    </section>
  );
};