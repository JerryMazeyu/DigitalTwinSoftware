import { useCallback, useMemo, useState } from "react";

import {
  PLC_CATEGORIES,
  PLC_SENSOR_META,
  type PlcCategoryEn,
  type PlcSensorMeta
} from "../../data/plcSensorMap";
import type { PlcVarLive } from "../../api/plcApi";
import { SensorTooltip } from "./SensorTooltip";
import { compareBySensorNo, formatPlcValue, matchesQuery } from "./format";

type SensorBoardTableProps = {
  bySymbol: Record<string, PlcVarLive>;
  enabled: Set<PlcCategoryEn>;
  query: string;
  fetchedAt: string | null;
};

const groupByCategory = (rows: PlcSensorMeta[]) => {
  const groups: Partial<Record<PlcCategoryEn, PlcSensorMeta[]>> = {};
  for (const row of rows) {
    const key = row.categoryEn as PlcCategoryEn;
    const bucket = groups[key] ?? [];
    bucket.push(row);
    groups[key] = bucket;
  }
  return groups;
};

const CategoryGroup = ({
  category,
  items,
  bySymbol,
  query,
  fetchedAt
}: {
  category: { en: PlcCategoryEn; cn: string; count: number };
  items: PlcSensorMeta[];
  bySymbol: Record<string, PlcVarLive>;
  query: string;
  fetchedAt: string | null;
}) => {
  const [collapsed, setCollapsed] = useState(false);
  const toggle = useCallback(() => setCollapsed((value) => !value), []);

  return (
    <section className={`sensor-group ${collapsed ? "collapsed" : ""}`}>
      <header className="sensor-group-header">
        <button type="button" className="sensor-group-toggle" onClick={toggle} aria-expanded={!collapsed}>
          <span className="sensor-group-toggle-mark">{collapsed ? "▶" : "▼"}</span>
          <span className="sensor-group-name">{category.cn}</span>
          <em className="sensor-group-count">{items.length} 项</em>
        </button>
      </header>
      {!collapsed && (
        <table className="sensor-group-table">
          <thead>
            <tr>
              <th style={{ width: "44%" }}>名称</th>
              <th style={{ width: "14%" }}>类型</th>
              <th style={{ width: "26%" }}>数值</th>
              <th>PLC 符号</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const live = bySymbol[item.plcSymbol];
              const formatted = formatPlcValue(live?.value, item);
              return (
                <tr
                  key={item.plcSymbol}
                  className={`sensor-row tone-${formatted.tone} ${matchesQuery(item, query) ? "" : "filtered"}`}
                >
                  <td>
                    <div className="sensor-row-name">
                      <span className="sensor-row-no">#{item.no}</span>
                      <span className="sensor-row-cn">{item.cnName}</span>
                    </div>
                    <SensorTooltip meta={item} fetchedAt={fetchedAt} />
                  </td>
                  <td>{item.dataType}</td>
                  <td className={`sensor-row-value tone-${formatted.tone}`}>{formatted.display}</td>
                  <td>
                    <code className="sensor-row-symbol">{item.plcSymbol}</code>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};

export const SensorBoardTable = ({ bySymbol, enabled, query, fetchedAt }: SensorBoardTableProps) => {
  const visible = useMemo(() => {
    return PLC_SENSOR_META.filter(
      (meta) => enabled.has(meta.categoryEn as PlcCategoryEn) && matchesQuery(meta, query)
    ).sort(compareBySensorNo);
  }, [enabled, query]);

  const grouped = useMemo(() => groupByCategory(visible), [visible]);
  const orderedCategories = useMemo(
    () =>
      PLC_CATEGORIES.filter((category) => (grouped[category.en]?.length ?? 0) > 0),
    [grouped]
  );

  if (orderedCategories.length === 0) {
    return (
      <div className="sensor-board-empty">
        {query ? "没有匹配搜索条件的点位" : "请至少勾选一个分类查看数据"}
      </div>
    );
  }

  return (
    <div className="sensor-board-table">
      {orderedCategories.map((category) => (
        <CategoryGroup
          key={category.en}
          category={category}
          items={grouped[category.en] ?? []}
          bySymbol={bySymbol}
          query={query}
          fetchedAt={fetchedAt}
        />
      ))}
    </div>
  );
};