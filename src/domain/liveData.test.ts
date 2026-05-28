import { describe, expect, it } from "vitest";

import {
  MAX_HISTORY_POINTS,
  advanceSnapshot,
  createInitialSnapshot
} from "./mockAdapter";
import {
  DetectionResultSchema,
  CameraFrameSchema,
  riskLevelFromScore
} from "./models";

describe("riskLevelFromScore", () => {
  it("maps wrinkle risk scores to production risk levels", () => {
    expect(riskLevelFromScore(12)).toBe("normal");
    expect(riskLevelFromScore(42)).toBe("watch");
    expect(riskLevelFromScore(68)).toBe("warning");
    expect(riskLevelFromScore(91)).toBe("critical");
  });
});

describe("live data adapter", () => {
  it("keeps trend history bounded and uses URL-based camera frames", () => {
    let snapshot = createInitialSnapshot(new Date("2026-05-28T06:00:00.000Z"));

    for (let index = 0; index < MAX_HISTORY_POINTS + 25; index += 1) {
      snapshot = advanceSnapshot(snapshot, index);
    }

    expect(snapshot.trends).toHaveLength(MAX_HISTORY_POINTS);
    expect(snapshot.cameraFrame.imageUrl).toMatch(/^\/demo-frames\//);
    expect(snapshot.cameraFrame.imageUrl.startsWith("data:image")).toBe(false);
    expect(snapshot.cameraFrame.capturedAt).toBe(snapshot.detections[0].detectedAt);
  });

  it("produces schema-valid frame and detection objects with normalized geometry", () => {
    const snapshot = createInitialSnapshot(new Date("2026-05-28T06:00:00.000Z"));
    const cameraParse = CameraFrameSchema.safeParse(snapshot.cameraFrame);
    const detectionParse = DetectionResultSchema.safeParse(snapshot.detections[0]);

    expect(cameraParse.success).toBe(true);
    expect(detectionParse.success).toBe(true);
    expect(snapshot.detections[0].bbox.x + snapshot.detections[0].bbox.width).toBeLessThanOrEqual(1);
    expect(snapshot.detections[0].bbox.y + snapshot.detections[0].bbox.height).toBeLessThanOrEqual(1);
  });
});
