import { Activity, AlertTriangle, CameraOff, MonitorCog, Radio, ServerCrash, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { AlgorithmPanel } from "./components/AlgorithmPanel";
import { LineScanViewer } from "./components/LineScanViewer";
import { SourceConfigPage } from "./components/SourceConfigPage";
import { TrendPanel } from "./components/TrendPanel";
import { TwinMachine3D } from "./components/TwinMachine3D";
import type { SimulationMode } from "./domain/models";
import { useLiveSnapshot } from "./hooks/useLiveSnapshot";

type AppView = "dashboard" | "config";

const modeOptions: Array<{ mode: SimulationMode; label: string; icon: typeof Activity }> = [
  { mode: "normal", label: "正常流", icon: Activity },
  { mode: "camera-offline", label: "相机离线", icon: CameraOff },
  { mode: "algorithm-timeout", label: "算法超时", icon: ServerCrash },
  { mode: "readonly", label: "只读模式", icon: ShieldCheck }
];

const statusText = {
  running: "运行中",
  stopped: "停机",
  warning: "告警运行",
  offline: "离线",
  "control-pending": "只读确认"
};

export function App() {
  const [mode, setMode] = useState<SimulationMode>("normal");
  const [view, setView] = useState<AppView>("dashboard");
  const snapshot = useLiveSnapshot(mode);

  const totalAlarms = snapshot.alarms.length;
  const onlineCount = useMemo(() => snapshot.systemHealth.filter((item) => item.online).length, [snapshot.systemHealth]);
  const systemTime = new Date(snapshot.machineStatus.updatedAt).toLocaleString("zh-CN", { hour12: false });

  return (
    <div className={view === "config" ? "app-shell config-shell" : "app-shell"}>
      <header className="topbar">
        <div className="brand-block">
          <div className="brand-mark">DT</div>
          <div>
            <h1>卷对卷镀膜数字孪生工作台</h1>
            <p>一号产线 / 配方 {snapshot.machineStatus.recipe} / 批次 {snapshot.machineStatus.batchId}</p>
          </div>
        </div>
        <div className="status-strip">
          <div><span>状态</span><strong>{statusText[snapshot.machineStatus.status]}</strong></div>
          <div><span>系统时间</span><strong>{systemTime}</strong></div>
          <div><span>连接</span><strong>{onlineCount}/{snapshot.systemHealth.length}</strong></div>
          <div className={totalAlarms > 0 ? "alarm-count active" : "alarm-count"}><span>告警</span><strong>{totalAlarms}</strong></div>
        </div>
        <div className="top-actions">
          <div className="page-switch" aria-label="页面切换">
            <button className={view === "dashboard" ? "active" : ""} type="button" onClick={() => setView("dashboard")}>
              <Activity size={16} />
              <span>监控驾驶舱</span>
            </button>
            <button className={view === "config" ? "active" : ""} type="button" onClick={() => setView("config")}>
              <MonitorCog size={16} />
              <span>采集配置</span>
            </button>
          </div>
          {view === "dashboard" && (
            <div className="mode-switch" aria-label="模拟数据流模式">
              {modeOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <button
                    className={mode === option.mode ? "active" : ""}
                    key={option.mode}
                    type="button"
                    onClick={() => setMode(option.mode)}
                    title={option.label}
                  >
                    <Icon size={16} />
                    <span>{option.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </header>

      {view === "dashboard" ? (
        <>
          <main className="dashboard-grid">
            <TwinMachine3D machine={snapshot.machineStatus} riskLevel={snapshot.wrinklePrediction.riskLevel} health={snapshot.systemHealth} />
            <LineScanViewer
              frame={snapshot.cameraFrame}
              detections={snapshot.detections}
              riskLevel={snapshot.wrinklePrediction.riskLevel}
              mode={snapshot.mode}
            />
            <AlgorithmPanel
              detections={snapshot.detections}
              prediction={snapshot.wrinklePrediction}
              alarms={snapshot.alarms}
              actions={snapshot.controlActions}
              health={snapshot.systemHealth}
            />
          </main>

          <TrendPanel trends={snapshot.trends} alarms={snapshot.alarms} actions={snapshot.controlActions} />
        </>
      ) : (
        <SourceConfigPage />
      )}

      <footer className="data-flow">
        <Radio size={15} />
        <span>{"线扫相机 -> 工控机 -> 算法服务器 -> 工控机 -> 数字孪生平台；控制建议默认不自动下发。"}</span>
        {totalAlarms > 0 && <strong><AlertTriangle size={15} />存在需确认事件</strong>}
      </footer>
    </div>
  );
}
