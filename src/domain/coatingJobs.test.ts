import { describe, expect, it } from "vitest";

import {
  formatScore,
  formatVoltage,
  getOutputImageEntries,
  inspectionTypeLabel,
  isLongStripImageSize,
  isReadyJob,
  jobKey,
  type CoatingJob
} from "./coatingJobs";

const baseJob: CoatingJob = {
  id: "20260512_160924_6d7b83de",
  type: "anomaly",
  status: "ready",
  inputDirReady: true,
  outputDirReady: true,
  inputImages: [],
  inputFiles: [],
  outputFiles: [],
  outputImages: {},
  request: null,
  result: null,
  summary: {},
  missing: []
};

describe("coating job helpers", () => {
  it("builds stable keys and Chinese labels", () => {
    expect(jobKey(baseJob)).toBe("anomaly:20260512_160924_6d7b83de");
    expect(inspectionTypeLabel.trend).toBe("趋势预测");
    expect(inspectionTypeLabel.anomaly).toBe("异常检测");
  });

  it("formats numeric result fields consistently", () => {
    expect(formatScore(0.29403626918792725)).toBe("0.294");
    expect(formatVoltage(-0.29)).toBe("-0.290");
    expect(formatScore()).toBe("-");
  });

  it("finds output images by task type", () => {
    const job: CoatingJob = {
      ...baseJob,
      outputImages: {
        anomalyMap: { name: "map.png", url: "/map.png", role: "anomaly-map", length: 10, lastModified: "2026-05-12T00:00:00.000Z" },
        heatmap: { name: "heat.png", url: "/heat.png", role: "heatmap", length: 10, lastModified: "2026-05-12T00:00:00.000Z" }
      }
    };

    expect(isReadyJob(job)).toBe(true);
    expect(getOutputImageEntries(job).map((entry) => entry.label)).toEqual(["异常图", "热力图"]);
  });

  it("identifies 31901x1000 line-scan images as long-strip images", () => {
    expect(isLongStripImageSize(31901, 1000)).toBe(true);
    expect(isLongStripImageSize(6000, 1000)).toBe(true);
    expect(isLongStripImageSize(1920, 1080)).toBe(false);
    expect(isLongStripImageSize(0, 1000)).toBe(false);
  });
});
