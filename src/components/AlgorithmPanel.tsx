import { AlertOctagon, CheckCircle2, Clock3, LockKeyhole, Server, ShieldAlert, SlidersHorizontal } from "lucide-react";

import type { AlarmEvent, ControlAction, DetectionResult, RiskLevel, SystemHealth, WrinklePrediction } from "../domain/models";

type AlgorithmPanelProps = {
  detections: DetectionResult[];
  prediction: WrinklePrediction;
  alarms: AlarmEvent[];
  actions: ControlAction[];
  health: SystemHealth[];
};

const riskText: Record<RiskLevel, string> = {
  normal: "正常",
  watch: "关注",
  warning: "预警",
  critical: "严重"
};

const sourceText: Record<AlarmEvent["source"], string> = {
  machine: "镀膜机",
  camera: "相机",
  algorithm: "算法",
  network: "网络",
  control: "控制网关"
};

const nodeText: Record<SystemHealth["node"], string> = {
  ipc: "工控机",
  "algorithm-server": "算法服务器",
  camera: "线扫相机",
  network: "网络链路",
  "model-service": "模型服务",
  "coating-machine": "镀膜机"
};

export function AlgorithmPanel({ detections, prediction, alarms, actions, health }: AlgorithmPanelProps) {
  const primaryDetection = detections[0];
  const healthOnline = health.filter((item) => item.online).length;
  const action = actions[0];

  return (
    <aside className="panel algorithm-panel" aria-label="算法结果和控制建议">
      <div className="panel-header compact">
        <div>
          <h2>算法结果</h2>
          <p>异常检测 + 褶皱趋势预测</p>
        </div>
        <span className={`risk-chip risk-${prediction.riskLevel}`}>{riskText[prediction.riskLevel]}</span>
      </div>
      <div className="risk-gauge" style={{ "--score": prediction.riskScore } as React.CSSProperties}>
        <div>
          <strong>{prediction.riskScore}</strong>
          <span>褶皱风险</span>
        </div>
      </div>
      <div className="result-grid">
        <div>
          <span>扩散概率</span>
          <strong>{Math.round(prediction.spreadProbability * 100)}%</strong>
        </div>
        <div>
          <span>时间窗</span>
          <strong>{prediction.predictionWindowSec}s</strong>
        </div>
        <div>
          <span>扩散方向</span>
          <strong>{prediction.spreadDirection}</strong>
        </div>
        <div>
          <span>缺陷数量</span>
          <strong>{detections.length}</strong>
        </div>
      </div>
      <div className="decision-block">
        <div className="block-title"><ShieldAlert size={16} />处置建议</div>
        <p>{prediction.recommendation}</p>
      </div>
      <div className="decision-block control-readonly">
        <div className="block-title"><LockKeyhole size={16} />控制网关</div>
        <p>{action.deviceResponse}</p>
        <span>{action.status === "confirm-required" ? "需要权限校验和人工确认" : action.status === "blocked" ? "只读模式已启用" : "仅展示建议"}</span>
      </div>
      <div className="latest-detection">
        <div className="block-title"><SlidersHorizontal size={16} />当前检测</div>
        {primaryDetection ? (
          <div className="detection-focus">
            <strong>{primaryDetection.defectClass}</strong>
            <span>置信度 {Math.round(primaryDetection.confidence * 100)}%</span>
            <span>严重度 {primaryDetection.severity}</span>
          </div>
        ) : (
          <div className="empty-row">无有效检测结果</div>
        )}
      </div>
      <div className="health-list">
        <div className="block-title"><Server size={16} />链路状态 {healthOnline}/{health.length}</div>
        {health.map((item) => (
          <div className="health-row" key={item.node}>
            {item.online ? <CheckCircle2 size={15} /> : <AlertOctagon size={15} />}
            <strong>{nodeText[item.node]}</strong>
            <span>{item.latencyMs}ms</span>
          </div>
        ))}
      </div>
      <div className="alarm-list">
        <div className="block-title"><Clock3 size={16} />告警事件</div>
        {alarms.length === 0 ? <div className="empty-row">近一帧无新增告警</div> : alarms.map((alarm) => (
          <div className={`alarm-row level-${alarm.level}`} key={alarm.eventId}>
            <strong>{sourceText[alarm.source]}</strong>
            <span>{alarm.description}</span>
          </div>
        ))}
      </div>
    </aside>
  );
}
