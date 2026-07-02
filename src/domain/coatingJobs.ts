export type InspectionType = "anomaly" | "trend";

export type JobStatus = "ready" | "waiting-input" | "waiting-output" | "incomplete" | "invalid";

export type FileRole =
  | "input-image"
  | "request-json"
  | "result-json"
  | "prediction-image"
  | "anomaly-map"
  | "heatmap"
  | "other";

export type ApiFile = {
  name: string;
  url: string;
  role: FileRole;
  length: number;
  lastModified: string;
};

export type OutputImages = {
  prediction?: ApiFile;
  anomalyMap?: ApiFile;
  heatmap?: ApiFile;
};

export type JobSummary = {
  level?: string;
  score?: number;
  analogVoltage?: number;
  timestamp?: string;
  imageType?: string;
  sourceImage?: string;
  sourceImageCount?: number;
  cropCount?: number;
  abnormalCropCount?: number;
  originalSize?: [number, number];
};

export type CoatingJob = {
  id: string;
  type: InspectionType;
  status: JobStatus;
  createdAt?: string;
  updatedAt?: string;
  inputDirReady: boolean;
  outputDirReady: boolean;
  inputImages: ApiFile[];
  inputFiles: ApiFile[];
  outputFiles: ApiFile[];
  requestFile?: ApiFile;
  resultFile?: ApiFile;
  outputImages: OutputImages;
  request: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  summary: JobSummary;
  missing: string[];
};

export type MonitorHealth = {
  dataRoot: string;
  scanIntervalMs: number;
  lastScanAt: string;
  rootExists: boolean;
  totalJobs: number;
  readyJobs: number;
  trendJobs: number;
  anomalyJobs: number;
};

export type JobsPayload = {
  jobs: CoatingJob[];
  health: MonitorHealth;
};

export const inspectionTypeLabel: Record<InspectionType, string> = {
  anomaly: "异常检测",
  trend: "趋势预测"
};

export const statusLabel: Record<JobStatus, string> = {
  ready: "已就绪",
  "waiting-input": "等待输入",
  "waiting-output": "等待输出",
  incomplete: "文件不完整",
  invalid: "解析异常"
};

export const jobKey = (job: Pick<CoatingJob, "type" | "id">) => `${job.type}:${job.id}`;

export const isReadyJob = (job: Pick<CoatingJob, "status">) => job.status === "ready";

export const formatScore = (score?: number) => {
  if (typeof score !== "number" || Number.isNaN(score)) return "-";
  return score.toFixed(3);
};

export const formatVoltage = (voltage?: number) => {
  if (typeof voltage !== "number" || Number.isNaN(voltage)) return "-";
  return voltage.toFixed(3);
};

export const formatTime = (value?: string) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
};

export const getOutputImageEntries = (job: CoatingJob) => {
  if (job.type === "trend") {
    return job.outputImages.prediction ? [{ key: "prediction", label: "预测图", file: job.outputImages.prediction }] : [];
  }

  return [
    job.outputImages.anomalyMap ? { key: "anomalyMap", label: "异常图", file: job.outputImages.anomalyMap } : undefined,
    job.outputImages.heatmap ? { key: "heatmap", label: "热力图", file: job.outputImages.heatmap } : undefined
  ].filter((entry): entry is { key: string; label: string; file: ApiFile } => Boolean(entry));
};

export const getPrimaryInputImage = (job: CoatingJob) => job.inputImages[0];

export const getCropResults = (job: CoatingJob) => {
  const cropResults = job.result?.crop_results;
  return Array.isArray(cropResults) ? cropResults : [];
};

export const isLongStripImageSize = (width: number, height: number) => (
  width > 0 && height > 0 && width / height >= 4
);

export const isLongImageJob = (job: CoatingJob) => {
  const size = job.summary.originalSize;
  return Boolean(size && isLongStripImageSize(size[0], size[1]));
};
