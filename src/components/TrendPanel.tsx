import ReactECharts from "echarts-for-react";
import { ClipboardList, Gauge, Thermometer, Waves } from "lucide-react";
import { useMemo } from "react";

import type { AlarmEvent, ControlAction, TrendPoint } from "../domain/models";

type TrendPanelProps = {
  trends: TrendPoint[];
  alarms: AlarmEvent[];
  actions: ControlAction[];
};

export function TrendPanel({ trends, alarms, actions }: TrendPanelProps) {
  const option = useMemo(() => {
    const labels = trends.map((point) => new Date(point.time).toLocaleTimeString("zh-CN", { hour12: false }));
    return {
      animation: false,
      backgroundColor: "transparent",
      grid: { left: 38, right: 18, top: 26, bottom: 26 },
      tooltip: { trigger: "axis" },
      legend: {
        top: 0,
        right: 10,
        textStyle: { color: "#aeb9bd", fontSize: 11 },
        itemWidth: 10,
        itemHeight: 6
      },
      xAxis: {
        type: "category",
        data: labels,
        boundaryGap: false,
        axisLine: { lineStyle: { color: "#38464d" } },
        axisLabel: { color: "#7d8b91", fontSize: 10, hideOverlap: true }
      },
      yAxis: [
        {
          type: "value",
          min: 0,
          max: 140,
          axisLine: { lineStyle: { color: "#38464d" } },
          splitLine: { lineStyle: { color: "rgba(130, 154, 163, 0.12)" } },
          axisLabel: { color: "#7d8b91", fontSize: 10 }
        }
      ],
      series: [
        {
          name: "张力 N",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: trends.map((point) => point.tension),
          lineStyle: { color: "#5ad8c9", width: 2 }
        },
        {
          name: "线速",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: trends.map((point) => point.lineSpeed),
          lineStyle: { color: "#8ab4f8", width: 2 }
        },
        {
          name: "温度",
          type: "line",
          smooth: true,
          showSymbol: false,
          data: trends.map((point) => point.temperature),
          lineStyle: { color: "#f3c969", width: 2 }
        },
        {
          name: "褶皱风险",
          type: "line",
          smooth: true,
          showSymbol: false,
          areaStyle: { color: "rgba(255, 159, 67, 0.12)" },
          data: trends.map((point) => point.wrinkleRisk),
          lineStyle: { color: "#ff9f43", width: 2.4 }
        }
      ]
    };
  }, [trends]);

  return (
    <section className="panel trend-panel" aria-label="趋势曲线和事件时间线">
      <div className="trend-chart">
        <div className="panel-header compact">
          <div>
            <h2>趋势曲线</h2>
            <p>保留最近 {trends.length} 个采样点，避免无限增长</p>
          </div>
          <div className="trend-tags">
            <span><Gauge size={14} />速度</span>
            <span><Thermometer size={14} />温度</span>
            <span><Waves size={14} />褶皱</span>
          </div>
        </div>
        <ReactECharts option={option} style={{ height: "112px", width: "100%" }} opts={{ renderer: "canvas" }} />
      </div>
      <div className="timeline">
        <div className="block-title"><ClipboardList size={16} />事件时间线</div>
        {(alarms.length > 0 ? alarms : actions).slice(0, 3).map((event, index) => {
          const isAlarm = "eventId" in event;
          return (
            <div className="timeline-row" key={isAlarm ? event.eventId : `${event.action}-${index}`}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <strong>{isAlarm ? event.description : event.action}</strong>
                <p>{isAlarm ? new Date(event.occurredAt).toLocaleTimeString("zh-CN", { hour12: false }) : event.deviceResponse}</p>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
