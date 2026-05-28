import {
  type AlarmEvent,
  type CameraFrame,
  type ControlAction,
  type DetectionResult,
  type MachineStatus,
  type SimulationMode,
  type SystemHealth,
  type TrendPoint,
  type TwinSnapshot,
  type WrinklePrediction,
  riskLevelFromScore
} from "./models";

export const MAX_HISTORY_POINTS = 80;

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const rounded = (value: number, digits = 1) => Number(value.toFixed(digits));
const isoAt = (base: Date, offsetSec: number) => new Date(base.getTime() + offsetSec * 1000).toISOString();
const seedWave = (tick: number, phase: number, amplitude: number) => Math.sin(tick * 0.37 + phase) * amplitude;
const eventTimeKey = (isoTime: string) => isoTime.slice(11, 19).replace(/:/g, "");

const recommendationFor = (riskScore: number, mode: SimulationMode) => {
  if (mode === "readonly") return "只读监控：等待网关确认设备状态后再开放控制";
  if (riskScore >= 80) return "建议人工确认后降低线速度 8%，并复核收卷张力";
  if (riskScore >= 60) return "建议检查卷材边缘状态，保持当前配方并提高采样频率";
  if (riskScore >= 35) return "建议关注下游 90 秒趋势，暂不下发控制";
  return "维持当前工艺窗口，继续监控";
};

const buildMachineStatus = (now: string, tick: number, riskScore: number, mode: SimulationMode): MachineStatus => ({
  status:
    mode === "readonly"
      ? "control-pending"
      : mode === "camera-offline"
        ? "warning"
        : riskScore >= 80
          ? "warning"
          : "running",
  lineSpeed: rounded(42 + seedWave(tick, 0.1, 2.7)),
  tension: rounded(118 + seedWave(tick, 1.2, 9.4)),
  temperature: rounded(72 + seedWave(tick, 2.4, 3.2)),
  vacuum: rounded(0.82 + seedWave(tick, 0.7, 0.03), 2),
  power: rounded(64 + seedWave(tick, 1.7, 5.8)),
  recipe: "PVDF-AL-07",
  batchId: "B20260528-03",
  rollMaterial: "铝箔基材 6.5um / 620mm",
  updatedAt: now
});

const buildCameraFrame = (now: string, tick: number, mode: SimulationMode): CameraFrame => ({
  frameId: `F-${String(202605280000 + tick).padStart(12, "0")}`,
  capturedAt: now,
  cameraId: "LSC-01",
  linePosition: "检测段 K2+14.6m",
  imageUrl: `/demo-frames/frame-${tick % 6}.svg`,
  width: 2048,
  height: 220,
  quality: mode === "camera-offline" ? 0 : rounded(clamp(0.94 + seedWave(tick, 0.3, 0.04), 0.6, 1), 2)
});

const buildDetections = (frame: CameraFrame, tick: number, riskScore: number, mode: SimulationMode): DetectionResult[] => {
  if (mode === "camera-offline") return [];

  const base: DetectionResult = {
    frameId: frame.frameId,
    defectClass: riskScore >= 60 ? "wrinkle" : tick % 3 === 0 ? "scratch" : "pollution",
    confidence: rounded(clamp(0.72 + riskScore / 400 + seedWave(tick, 1.1, 0.06), 0.55, 0.98), 2),
    bbox: {
      x: rounded(0.12 + ((tick * 7) % 36) / 100, 3),
      y: rounded(0.18 + ((tick * 5) % 22) / 100, 3),
      width: rounded(0.16 + (tick % 4) * 0.018, 3),
      height: rounded(0.18 + (tick % 3) * 0.022, 3)
    },
    maskOpacity: riskScore >= 60 ? 0.46 : 0.3,
    severity: riskScore >= 80 ? "critical" : riskScore >= 60 ? "high" : riskScore >= 35 ? "medium" : "low",
    algorithmVersion: "AD-WP-2.7.4",
    detectedAt: frame.capturedAt
  };

  const detections = [base];
  if (riskScore >= 55) {
    detections.push({
      ...base,
      defectClass: "residue",
      confidence: rounded(clamp(base.confidence - 0.11, 0.51, 0.92), 2),
      bbox: {
        x: rounded(clamp(base.bbox.x + 0.34, 0, 0.78), 3),
        y: rounded(clamp(base.bbox.y + 0.12, 0, 0.74), 3),
        width: 0.13,
        height: 0.12
      },
      severity: riskScore >= 80 ? "high" : "medium"
    });
  }

  return detections;
};

const buildWrinklePrediction = (
  frame: CameraFrame,
  tick: number,
  riskScore: number,
  mode: SimulationMode
): WrinklePrediction => ({
  frameId: frame.frameId,
  riskScore,
  spreadProbability: rounded(clamp(riskScore / 100 + seedWave(tick, 2.2, 0.04), 0, 0.98), 2),
  predictionWindowSec: riskScore >= 80 ? 60 : 120,
  spreadDirection: tick % 4 === 0 ? "left" : tick % 4 === 1 ? "downstream" : tick % 4 === 2 ? "right" : "center",
  riskLevel: riskLevelFromScore(riskScore),
  recommendation: recommendationFor(riskScore, mode),
  predictedAt: frame.capturedAt
});

const buildHealth = (now: string, tick: number, mode: SimulationMode): SystemHealth[] => {
  const algorithmTimeout = mode === "algorithm-timeout";
  const cameraOffline = mode === "camera-offline";

  return [
    { node: "ipc", online: true, latencyMs: rounded(6 + Math.abs(seedWave(tick, 0.2, 3))), statusText: "工控机采集网关在线", updatedAt: now },
    {
      node: "camera",
      online: !cameraOffline,
      latencyMs: cameraOffline ? 0 : rounded(13 + Math.abs(seedWave(tick, 1.1, 8))),
      statusText: cameraOffline ? "线扫相机离线，保留最新可用帧" : "线扫相机帧流稳定",
      updatedAt: now
    },
    {
      node: "algorithm-server",
      online: true,
      latencyMs: algorithmTimeout ? 1280 : rounded(58 + Math.abs(seedWave(tick, 2.1, 22))),
      statusText: algorithmTimeout ? "算法响应超时，结果延迟" : "算法服务推理正常",
      updatedAt: now
    },
    { node: "model-service", online: !algorithmTimeout, latencyMs: algorithmTimeout ? 1280 : rounded(41 + Math.abs(seedWave(tick, 1.8, 18))), statusText: algorithmTimeout ? "模型队列积压" : "模型版本 AD-WP-2.7.4", updatedAt: now },
    { node: "network", online: true, latencyMs: rounded(9 + Math.abs(seedWave(tick, 0.6, 6))), statusText: "工控机到算法服务器链路正常", updatedAt: now },
    { node: "coating-machine", online: true, latencyMs: rounded(18 + Math.abs(seedWave(tick, 1.4, 5))), statusText: mode === "readonly" ? "设备状态未完全确认，只读监控" : "镀膜机反馈在线", updatedAt: now }
  ];
};

const buildAlarms = (now: string, riskScore: number, mode: SimulationMode): AlarmEvent[] => {
  const alarms: AlarmEvent[] = [];
  if (riskScore >= 60) {
    alarms.push({
      eventId: `ALM-${eventTimeKey(now)}-W`,
      level: riskScore >= 80 ? "critical" : "warning",
      source: "algorithm",
      description: riskScore >= 80 ? "褶皱扩散风险进入严重区间" : "褶皱风险升高，建议提高巡检频率",
      occurredAt: now,
      acknowledged: false
    });
  }
  if (mode === "camera-offline") {
    alarms.push({
      eventId: `ALM-${eventTimeKey(now)}-C`,
      level: "critical",
      source: "camera",
      description: "线扫相机离线，实时图像流中断",
      occurredAt: now,
      acknowledged: false
    });
  }
  if (mode === "algorithm-timeout") {
    alarms.push({
      eventId: `ALM-${eventTimeKey(now)}-A`,
      level: "warning",
      source: "algorithm",
      description: "算法服务器响应超时，展示最近一次可信结果",
      occurredAt: now,
      acknowledged: false
    });
  }
  return alarms;
};

const buildControlActions = (now: string, riskScore: number, mode: SimulationMode): ControlAction[] => [
  {
    action: recommendationFor(riskScore, mode),
    status: mode === "readonly" ? "blocked" : riskScore >= 80 ? "confirm-required" : "suggested",
    operator: "未确认",
    confirmedAt: undefined,
    deviceResponse: mode === "readonly" ? "网关未确认设备状态，控制能力锁定" : "仅生成建议，未下发至镀膜机",
    auditTrail: [`${now} 平台生成辅助决策建议`, `${now} 等待有权限操作人确认`]
  }
];

const buildTrendPoint = (
  now: string,
  machineStatus: MachineStatus,
  riskScore: number,
  detections: DetectionResult[]
): TrendPoint => ({
  time: now,
  lineSpeed: machineStatus.lineSpeed,
  tension: machineStatus.tension,
  temperature: machineStatus.temperature,
  vacuum: machineStatus.vacuum,
  wrinkleRisk: riskScore,
  defectCount: detections.length
});

export const createInitialSnapshot = (baseDate = new Date(), mode: SimulationMode = "normal"): TwinSnapshot => {
  const now = baseDate.toISOString();
  const riskScore = 48;
  const machineStatus = buildMachineStatus(now, 0, riskScore, mode);
  const cameraFrame = buildCameraFrame(now, 0, mode);
  const detections = buildDetections(cameraFrame, 0, riskScore, mode);
  return {
    mode,
    machineStatus,
    cameraFrame,
    detections,
    wrinklePrediction: buildWrinklePrediction(cameraFrame, 0, riskScore, mode),
    alarms: buildAlarms(now, riskScore, mode),
    controlActions: buildControlActions(now, riskScore, mode),
    systemHealth: buildHealth(now, 0, mode),
    trends: [buildTrendPoint(now, machineStatus, riskScore, detections)]
  };
};

export const advanceSnapshot = (
  previous: TwinSnapshot,
  tick: number,
  mode: SimulationMode = previous.mode
): TwinSnapshot => {
  const previousTime = new Date(previous.cameraFrame.capturedAt);
  const now = isoAt(previousTime, 1.2);
  const riskScore = rounded(clamp(52 + seedWave(tick, 0.8, 24) + (tick % 17 === 0 ? 22 : 0), 8, 96));
  const machineStatus = buildMachineStatus(now, tick, riskScore, mode);
  const cameraFrame = buildCameraFrame(now, tick, mode);
  const detections = buildDetections(cameraFrame, tick, riskScore, mode);
  const trends = [...previous.trends, buildTrendPoint(now, machineStatus, riskScore, detections)].slice(-MAX_HISTORY_POINTS);

  return {
    mode,
    machineStatus,
    cameraFrame,
    detections,
    wrinklePrediction: buildWrinklePrediction(cameraFrame, tick, riskScore, mode),
    alarms: buildAlarms(now, riskScore, mode),
    controlActions: buildControlActions(now, riskScore, mode),
    systemHealth: buildHealth(now, tick, mode),
    trends
  };
};
