import { z } from "zod";

export const DataObjectTypeSchema = z.enum([
  "MachineStatus",
  "CameraFrame",
  "DetectionResult",
  "WrinklePrediction",
  "AlarmEvent",
  "ControlAction",
  "SystemHealth"
]);

export const MachineRoleSchema = z.enum(["coating-machine", "industrial-pc", "algorithm-server"]);
export const ProtocolSchema = z.enum([
  "OPC UA",
  "Modbus TCP",
  "GigE Vision",
  "WebSocket",
  "HTTP REST",
  "Local File Watch"
]);

export const SourceMappingSchema = z.object({
  objectType: DataObjectTypeSchema,
  channel: z.string().min(1),
  fieldPath: z.string().min(1),
  unit: z.string().min(1),
  pollIntervalMs: z.number().int().positive(),
  enabled: z.boolean()
});

export const DataSourceConfigSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  machineRole: MachineRoleSchema,
  host: z.string().min(1),
  protocol: ProtocolSchema,
  endpoint: z.string().min(1),
  authMode: z.enum(["none", "token", "certificate", "local-service-account"]),
  gateway: z.string().min(1),
  latencyBudgetMs: z.number().int().positive(),
  heartbeatIntervalMs: z.number().int().positive(),
  enabled: z.boolean(),
  mappings: z.array(SourceMappingSchema).min(1)
});

export type DataObjectType = z.infer<typeof DataObjectTypeSchema>;
export type DataSourceConfig = z.infer<typeof DataSourceConfigSchema>;

export const buildDefaultSourceConfigs = (): DataSourceConfig[] => [
  {
    id: "src-coating-plc",
    name: "镀膜机 PLC 工艺数据",
    machineRole: "coating-machine",
    host: "192.168.10.21",
    protocol: "OPC UA",
    endpoint: "opc.tcp://192.168.10.21:4840/R2R-Coater",
    authMode: "certificate",
    gateway: "IPC-GW-01",
    latencyBudgetMs: 120,
    heartbeatIntervalMs: 1000,
    enabled: true,
    mappings: [
      { objectType: "MachineStatus", channel: "ns=3;s=LineSpeed", fieldPath: "lineSpeed", unit: "m/min", pollIntervalMs: 500, enabled: true },
      { objectType: "MachineStatus", channel: "ns=3;s=RewindTension", fieldPath: "tension", unit: "N", pollIntervalMs: 500, enabled: true },
      { objectType: "MachineStatus", channel: "ns=3;s=CoatingTemp", fieldPath: "temperature", unit: "C", pollIntervalMs: 1000, enabled: true },
      { objectType: "MachineStatus", channel: "ns=3;s=Vacuum", fieldPath: "vacuum", unit: "MPa", pollIntervalMs: 1000, enabled: true },
      { objectType: "SystemHealth", channel: "ns=3;s=Heartbeat", fieldPath: "coating-machine.online", unit: "bool", pollIntervalMs: 1000, enabled: true }
    ]
  },
  {
    id: "src-ipc-camera",
    name: "工控机线扫图像服务",
    machineRole: "industrial-pc",
    host: "192.168.10.35",
    protocol: "GigE Vision",
    endpoint: "gigE://192.168.10.35/cameras/LSC-01/frames",
    authMode: "local-service-account",
    gateway: "IPC-GW-01",
    latencyBudgetMs: 80,
    heartbeatIntervalMs: 1000,
    enabled: true,
    mappings: [
      { objectType: "CameraFrame", channel: "LSC-01.FrameUri", fieldPath: "imageUrl", unit: "url", pollIntervalMs: 200, enabled: true },
      { objectType: "CameraFrame", channel: "LSC-01.CaptureTime", fieldPath: "capturedAt", unit: "ISO8601", pollIntervalMs: 200, enabled: true },
      { objectType: "CameraFrame", channel: "LSC-01.Quality", fieldPath: "quality", unit: "ratio", pollIntervalMs: 200, enabled: true },
      { objectType: "SystemHealth", channel: "LSC-01.Heartbeat", fieldPath: "camera.online", unit: "bool", pollIntervalMs: 1000, enabled: true }
    ]
  },
  {
    id: "src-algo-server",
    name: "算法服务器推理结果",
    machineRole: "algorithm-server",
    host: "192.168.10.80",
    protocol: "WebSocket",
    endpoint: "ws://192.168.10.80:8088/inference/r2r-line-1",
    authMode: "token",
    gateway: "IPC-GW-01",
    latencyBudgetMs: 250,
    heartbeatIntervalMs: 1000,
    enabled: true,
    mappings: [
      { objectType: "DetectionResult", channel: "defects[]", fieldPath: "detections", unit: "list", pollIntervalMs: 200, enabled: true },
      { objectType: "WrinklePrediction", channel: "wrinklePrediction", fieldPath: "wrinklePrediction", unit: "score", pollIntervalMs: 500, enabled: true },
      { objectType: "AlarmEvent", channel: "events[]", fieldPath: "alarms", unit: "list", pollIntervalMs: 500, enabled: true },
      { objectType: "SystemHealth", channel: "modelService.heartbeat", fieldPath: "model-service.online", unit: "bool", pollIntervalMs: 1000, enabled: true }
    ]
  }
];

export const getConfiguredObjectTypes = (configs: DataSourceConfig[]): DataObjectType[] => {
  const ordered = new Set<DataObjectType>();
  for (const config of configs) {
    for (const mapping of config.mappings) {
      if (mapping.enabled) ordered.add(mapping.objectType);
    }
  }
  return Array.from(ordered);
};

export const summarizeProtocolCoverage = (configs: DataSourceConfig[]) =>
  configs
    .map((config) => `${config.name}: ${config.protocol} ${config.endpoint}`)
    .join(" | ");
