import { Search, X } from "lucide-react";
import { useCallback } from "react";

import {
  PLC_CATEGORIES,
  type PlcCategory,
  type PlcCategoryEn
} from "../../data/plcSensorMap";

export const REFRESH_OPTIONS: Array<{ value: number; label: string }> = [
  { value: 0, label: "手动" },
  { value: 1000, label: "1 秒" },
  { value: 5000, label: "5 秒" },
  { value: 10000, label: "10 秒" }
];

type SensorBoardFiltersProps = {
  enabled: Set<PlcCategoryEn>;
  onToggle: (en: PlcCategoryEn) => void;
  onSelectAll: () => void;
  onClearAll: () => void;
  query: string;
  onQueryChange: (value: string) => void;
  intervalMs: number;
  onIntervalChange: (ms: number) => void;
  totalVisible: number;
  totalEnabled: number;
};

const FilterRow = ({
  category,
  enabled,
  onToggle
}: {
  category: PlcCategory;
  enabled: boolean;
  onToggle: (en: PlcCategoryEn) => void;
}) => {
  const handleChange = useCallback(() => {
    onToggle(category.en);
  }, [onToggle, category.en]);
  return (
    <label className={`sensor-filter-chip ${enabled ? "on" : "off"}`}>
      <input type="checkbox" checked={enabled} onChange={handleChange} />
      <span className="sensor-filter-name">{category.cn}</span>
      <span className="sensor-filter-count">{category.count}</span>
    </label>
  );
};

export const SensorBoardFilters = ({
  enabled,
  onToggle,
  onSelectAll,
  onClearAll,
  query,
  onQueryChange,
  intervalMs,
  onIntervalChange,
  totalVisible,
  totalEnabled
}: SensorBoardFiltersProps) => (
  <div className="sensor-board-filters">
    <div className="sensor-board-row sensor-board-row-search">
      <div className="sensor-search">
        <Search size={15} />
        <input
          type="text"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="搜索中文名 / 英文名 / PLC 符号 / 备注..."
        />
        {query && (
          <button type="button" className="sensor-search-clear" onClick={() => onQueryChange("")}>
            <X size={13} />
          </button>
        )}
      </div>
      <div className="sensor-board-actions">
        <span className="sensor-board-summary">
          可见 <strong>{totalVisible}</strong> 项 · 已启用 <strong>{totalEnabled}</strong> 类
        </span>
        <div className="sensor-interval">
          <span>刷新</span>
          {REFRESH_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={intervalMs === option.value ? "active" : ""}
              onClick={() => onIntervalChange(option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>

    <div className="sensor-board-row sensor-board-row-categories">
      <div className="sensor-board-presets">
        <button type="button" onClick={onSelectAll}>全选</button>
        <button type="button" onClick={onClearAll}>清空</button>
      </div>
      <div className="sensor-category-grid">
        {PLC_CATEGORIES.map((category) => (
          <FilterRow
            key={category.en}
            category={category}
            enabled={enabled.has(category.en)}
            onToggle={onToggle}
          />
        ))}
      </div>
    </div>
  </div>
);