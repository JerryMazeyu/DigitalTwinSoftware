import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { PlcSensorMeta } from "../../data/plcSensorMap";

type SensorTooltipProps = {
  meta: PlcSensorMeta;
  fetchedAt?: string | null;
};

const Row = ({ label, value }: { label: string; value: string }) => (
  <div className="sensor-tooltip-row">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

const VIEWPORT_MARGIN = 8;
const ROW_OFFSET = 6;

/**
 * Tooltip uses `position: fixed` so it escapes the `.sensor-board-scroll`
 * overflow clip. On hover we measure the host row + viewport, place the
 * tooltip just below the row, and flip above the row if there's no room
 * below. Horizontal clamping keeps it inside the viewport.
 */
export const SensorTooltip = ({ meta, fetchedAt }: SensorTooltipProps) => {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  // Compute position when shown becomes true.
  useLayoutEffect(() => {
    if (!shown) return;
    const el = ref.current;
    if (!el) return;
    const row = el.closest("tr");
    if (!row) return;

    const rowRect = row.getBoundingClientRect();
    const tooltipRect = el.getBoundingClientRect();
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;

    // Default: below the row. Flip above if it would clip the bottom.
    let top = rowRect.bottom + ROW_OFFSET;
    if (top + tooltipRect.height > viewportHeight - VIEWPORT_MARGIN) {
      top = rowRect.top - tooltipRect.height - ROW_OFFSET;
      if (top < VIEWPORT_MARGIN) {
        top = VIEWPORT_MARGIN;
      }
    }

    let left = rowRect.left + 12;
    if (left + tooltipRect.width > viewportWidth - VIEWPORT_MARGIN) {
      left = viewportWidth - tooltipRect.width - VIEWPORT_MARGIN;
    }
    if (left < VIEWPORT_MARGIN) {
      left = VIEWPORT_MARGIN;
    }

    el.style.top = `${top}px`;
    el.style.left = `${left}px`;
  }, [shown, meta.plcSymbol]);

  // Toggle visibility on row mouseenter/mouseleave. Listening on the row
  // (rather than using CSS :hover) lets us control the timing of the
  // position measurement.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const row = el.closest("tr");
    if (!row) return;
    const onEnter = () => setShown(true);
    const onLeave = () => setShown(false);
    row.addEventListener("mouseenter", onEnter);
    row.addEventListener("mouseleave", onLeave);
    return () => {
      row.removeEventListener("mouseenter", onEnter);
      row.removeEventListener("mouseleave", onLeave);
    };
  }, [meta.plcSymbol]);

  return (
    <div
      ref={ref}
      className={`sensor-tooltip ${shown ? "visible" : ""}`}
      role="tooltip"
    >
      <Row label="中文名" value={meta.cnName} />
      <Row label="英文名" value={meta.enName} />
      <Row label="PLC 符号" value={meta.plcSymbol} />
      <Row label="OPC 地址" value={meta.opcAddress} />
      <Row label="数据类型" value={meta.dataType} />
      <Row label="扫描周期" value={`${meta.scanPeriodMs} ms`} />
      <Row label="单位/类型" value={meta.unit} />
      <Row label="值含义" value={meta.valueMeaning} />
      {meta.remark && <Row label="备注" value={meta.remark} />}
      {fetchedAt && <Row label="最近一次拉取" value={new Date(fetchedAt).toLocaleTimeString()} />}
    </div>
  );
};