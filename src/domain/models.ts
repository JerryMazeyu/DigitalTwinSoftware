import { z } from "zod";

export const riskLevels = ["normal", "watch", "warning", "critical"] as const;
export type RiskLevel = (typeof riskLevels)[number];

export type SimulationMode = "normal" | "camera-offline" | "algorithm-timeout" | "readonly";

export const riskLevelFromScore = (score: number): RiskLevel => {
  if (score >= 80) return "critical";
  if (score >= 60) return "warning";
  if (score >= 35) return "watch";
  return "normal";
};

export const NormalizedBoxSchema = z
  .object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    width: z.number().min(0).max(1),
    height: z.number().min(0).max(1)
  })
  .refine((box) => box.x + box.width <= 1, "box exceeds image width")
  .refine((box) => box.y + box.height <= 1, "box exceeds image height");

export const MachineStatusSchema = z.object({
  status: z.enum(["running", "stopped", "warning", "offline", "control-pending"]),
  lineSpeed: z.number().nonnegative(),
  tension: z.number().nonnegative(),
  temperature: z.number(),
  vacuum: z.number().nonnegative(),
  power: z.number().nonnegative(),
  recipe: z.string().min(1),
  batchId: z.string().min(1),
  rollMaterial: z.string().min(1),
  updatedAt: z.string().datetime()
});

export const CameraFrameSchema = z.object({
  frameId: z.string().min(1),
  capturedAt: z.string().datetime(),
  cameraId: z.string().min(1),
  linePosition: z.string().min(1),
  imageUrl: z.string().min(1),
  width: z.number().positive(),
  height: z.number().positive(),
  quality: z.number().min(0).max(1)
});

export const DetectionResultSchema = z.object({
  frameId: z.string().min(1),
  defectClass: z.enum(["foreign", "residue", "scratch", "pollution", "breakage", "wrinkle"]),
  confidence: z.number().min(0).max(1),
  bbox: NormalizedBoxSchema,
  maskOpacity: z.number().min(0).max(1),
  severity: z.enum(["low", "medium", "high", "critical"]),
  algorithmVersion: z.string().min(1),
  detectedAt: z.string().datetime()
});

export const WrinklePredictionSchema = z.object({
  frameId: z.string().min(1),
  riskScore: z.number().min(0).max(100),
  spreadProbability: z.number().min(0).max(1),
  predictionWindowSec: z.number().positive(),
  spreadDirection: z.enum(["left", "right", "center", "downstream"]),
  riskLevel: z.enum(riskLevels),
  recommendation: z.string().min(1),
  predictedAt: z.string().datetime()
});

export const AlarmEventSchema = z.object({
  eventId: z.string().min(1),
  level: z.enum(["info", "warning", "critical"]),
  source: z.enum(["machine", "camera", "algorithm", "network", "control"]),
  description: z.string().min(1),
  occurredAt: z.string().datetime(),
  acknowledged: z.boolean(),
  recoveredAt: z.string().datetime().optional()
});

export const ControlActionSchema = z.object({
  action: z.string().min(1),
  status: z.enum(["suggested", "confirm-required", "sent", "acknowledged", "blocked"]),
  operator: z.string().min(1),
  confirmedAt: z.string().datetime().optional(),
  deviceResponse: z.string().min(1),
  auditTrail: z.array(z.string().min(1))
});

export const SystemHealthSchema = z.object({
  node: z.enum(["ipc", "algorithm-server", "camera", "network", "model-service", "coating-machine"]),
  online: z.boolean(),
  latencyMs: z.number().nonnegative(),
  statusText: z.string().min(1),
  updatedAt: z.string().datetime()
});

export type MachineStatus = z.infer<typeof MachineStatusSchema>;
export type CameraFrame = z.infer<typeof CameraFrameSchema>;
export type DetectionResult = z.infer<typeof DetectionResultSchema>;
export type WrinklePrediction = z.infer<typeof WrinklePredictionSchema>;
export type AlarmEvent = z.infer<typeof AlarmEventSchema>;
export type ControlAction = z.infer<typeof ControlActionSchema>;
export type SystemHealth = z.infer<typeof SystemHealthSchema>;

export type TrendPoint = {
  time: string;
  lineSpeed: number;
  tension: number;
  temperature: number;
  vacuum: number;
  wrinkleRisk: number;
  defectCount: number;
};

export type TwinSnapshot = {
  mode: SimulationMode;
  machineStatus: MachineStatus;
  cameraFrame: CameraFrame;
  detections: DetectionResult[];
  wrinklePrediction: WrinklePrediction;
  alarms: AlarmEvent[];
  controlActions: ControlAction[];
  systemHealth: SystemHealth[];
  trends: TrendPoint[];
};
