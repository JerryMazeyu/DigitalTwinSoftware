import { useEffect, useRef, useState, type MutableRefObject } from "react";
import { formatLabelValue } from "./MeshPlcLabel";
import type { MeshPlcLabelTrackerRef } from "./MeshPlcLabel";

export type ClusterDotOverlayProps = {
  /**
   * 与 `MeshPlcLabelBannerTracker` 共用的像素坐标 ref：每帧由
   * R3F 写入 `{ x, y, visible, dirty }`，本组件只读。
   */
  trackerRef: MutableRefObject<MeshPlcLabelTrackerRef>;
  /** 簇内成员的行数据，渲染时直接复用 formatLabelValue。 */
  rows: { cnName: string; value: unknown; dataType?: string }[];
  /** 外部传入的「正在被高亮」状态（来自右侧面板 hover）。 */
  externallyHovered: boolean;
  /** 鼠标进入/离开圆点时调用，与右侧面板双向同步。 */
  onHoverChange?: (hovering: boolean) => void;
};

/**
 * 把单个 cluster 在画布上渲染成一个小圆点。圆点的位置由 trackerRef 驱动（与
 * 现有的 `<MeshPlcLabelBannerTracker>` 共用同一根 R3F pipeline）。鼠标
 * hover 时弹出详情卡：列出该簇每个成员的 cnName 和当前实时数值。
 */
export function ClusterDotOverlay({
  trackerRef,
  rows,
  externallyHovered,
  onHoverChange
}: ClusterDotOverlayProps) {
  const elRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const [hovered, setHovered] = useState(false);

  // 同步像素坐标 → DOM transform。RAF 循环写入 transform / display，
  // 不触发 React 重渲染。
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = elRef.current;
      const t = trackerRef.current;
      if (el && t.dirty) {
        el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;
        el.style.display = t.visible ? "block" : "none";
        if (popoverRef.current && t.visible) {
          popoverRef.current.style.transform = `translate3d(${t.x}px, ${t.y}px, 0)`;
        }
        t.dirty = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trackerRef]);

  const isHovered = hovered || externallyHovered;

  return (
    <>
      <div
        ref={elRef}
        className={`cluster-dot-anchor${isHovered ? " is-hovered" : ""}`}
        style={{ display: "none" }}
      >
        <span
          className="cluster-dot"
          onMouseEnter={() => {
            setHovered(true);
            onHoverChange?.(true);
          }}
          onMouseLeave={() => {
            setHovered(false);
            onHoverChange?.(false);
          }}
        />
      </div>
      <div
        ref={popoverRef}
        className="cluster-popover-anchor"
        style={{ display: isHovered ? "block" : "none" }}
      >
        <div className="cluster-popover">
          {rows.map((row, i) => {
            const formatted = formatLabelValue(row.value, row.dataType);
            return (
              <div key={i} className="cluster-popover-row">
                <span className="cluster-popover-row-name">{row.cnName}</span>
                <span className={`cluster-popover-row-value tone-${formatted.tone}`}>
                  {formatted.text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}