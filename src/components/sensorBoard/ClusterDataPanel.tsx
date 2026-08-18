import { useState } from "react";

import { formatLabelValue } from "./MeshPlcLabel";
import type { PlcAnchorCategory, PlcAnchorConfigEntry } from "../../data/plcAnchorConfig";
import type { PlcSensorMeta } from "../../data/plcSensorMap";
import type { PlcSensorLiveState } from "../../hooks/usePlcSensors";

/** 5 个分类的中文标签，按用户列表保留 5 个。 */
const CATEGORY_LABELS: Record<PlcAnchorCategory, string> = {
  SputterPowerActual: "溅射电源",
  WindingActual: "卷绕",
  VacuumGauge: "真空规读数",
  IonSourceActual: "离子源",
  TemperatureOrColdTrap: "温度 · 冷捕集"
};

const CATEGORY_ORDER: PlcAnchorCategory[] = [
  "SputterPowerActual",
  "WindingActual",
  "VacuumGauge",
  "IonSourceActual",
  "TemperatureOrColdTrap"
];

export type ClusterDataPanelProps = {
  /** 全部锚点（按 PLC_ANCHOR_CONFIG 全量），右侧面板按此渲染。 */
  allAnchors: PlcAnchorConfigEntry[];
  /** 当前仍可见的锚点 plcSymbol 集合，用于判断 is-on / is-off。 */
  visibleAnchorSymbols: Set<string>;
  anchorLive: PlcSensorLiveState;
  metaBySymbol: Map<string, PlcSensorMeta>;
  hoveredClusterKey: string | null;
  onHoverCluster: (key: string | null) => void;
};

/**
 * 数字孪生右侧 25% 区域：按分类折叠展示每个锚点的实时数值。每行只显示
 * 中文名 + 当前值，不出现 partId 等英文标识符；同坐标的多个数据点在此面板里
 * 平铺为多个独立行，不再按 worldPosition 聚合。
 */
export function ClusterDataPanel({
  allAnchors,
  visibleAnchorSymbols,
  anchorLive,
  metaBySymbol,
  hoveredClusterKey,
  onHoverCluster
}: ClusterDataPanelProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  return (
    <aside className="machine-data-panel">
      {CATEGORY_ORDER.map((cat) => {
        const items = allAnchors.filter((a) => a.categoryEn === cat);
        if (items.length === 0) return null;

        const isCollapsed = collapsed[cat] ?? false;

        return (
          <section key={cat} className="data-panel-section">
            <button
              type="button"
              className="data-panel-header"
              onClick={() =>
                setCollapsed((prev) => ({ ...prev, [cat]: !prev[cat] }))
              }
              aria-expanded={!isCollapsed}
            >
              <span className="data-panel-header-label">
                {CATEGORY_LABELS[cat]}
              </span>
              <em className="data-panel-header-count">{items.length} 项</em>
            </button>

            {!isCollapsed && (
              <ul className="data-panel-list">
                {items.map((anchor) => {
                  const isVisible = visibleAnchorSymbols.has(anchor.plcSymbol);
                  const positionKey = anchor.worldPosition.join(",");
                  const isHovered = hoveredClusterKey === positionKey;

                  const meta = metaBySymbol.get(anchor.plcSymbol);
                  const live = anchorLive.bySymbol[anchor.plcSymbol];
                  // 隐藏的锚点不轮询，值固定为 "—"
                  const value = isVisible ? live?.value ?? null : null;
                  const formatted = formatLabelValue(value, meta?.dataType);

                  return (
                    <li
                      key={anchor.plcSymbol}
                      className={[
                        "data-panel-row",
                        isHovered ? "is-hovered" : "",
                        isVisible ? "is-on" : "is-off"
                      ]
                        .filter(Boolean)
                        .join(" ")}
                      onMouseEnter={() => onHoverCluster(positionKey)}
                      onMouseLeave={() => onHoverCluster(null)}
                      title={anchor.cnName ?? meta?.cnName ?? anchor.partId}
                    >
                      <span className="data-panel-row-value-name">
                        {anchor.cnName ?? meta?.cnName ?? anchor.partId}
                      </span>
                      <span
                        className={`data-panel-row-value-text tone-${formatted.tone}`}
                      >
                        {formatted.text}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        );
      })}
    </aside>
  );
}