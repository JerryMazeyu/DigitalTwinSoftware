import assert from "node:assert/strict";
import { mkdtemp, rm, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { scanCoatingJobs } from "./monitor.mjs";

const makeFile = async (file, content = "x") => {
  await writeFile(file, content);
};

test("scanCoatingJobs pairs trend and anomaly input/output folders", async () => {
  const root = await mkdtemp(join(tmpdir(), "coating-monitor-"));
  try {
    const trendId = "20260512_160447_7e7daf5d";
    const anomalyId = "20260512_160924_6d7b83de";

    await mkdir(join(root, "trend_api", "input", trendId), { recursive: true });
    await mkdir(join(root, "trend_api", "output", trendId), { recursive: true });
    await mkdir(join(root, "anomaly_api", "input", anomalyId), { recursive: true });
    await mkdir(join(root, "anomaly_api", "output", anomalyId), { recursive: true });

    await makeFile(join(root, "trend_api", "input", trendId, "00.jpg"));
    await makeFile(join(root, "trend_api", "output", trendId, "prediction.jpg"));
    await makeFile(join(root, "trend_api", "output", trendId, `${trendId}.json`), JSON.stringify({
      process_id: trendId,
      source_images: ["00.jpg"],
      pred_level: "很可能预测正确",
      analog_voltage: -0.29,
      timestamp: "2026-05-12T16:02:43.973003"
    }));

    await makeFile(join(root, "anomaly_api", "input", anomalyId, `${anomalyId}.jpg`));
    await makeFile(join(root, "anomaly_api", "input", anomalyId, "request.json"), JSON.stringify({
      process_id: anomalyId,
      image_type: "very long",
      source_image: "source.jpg"
    }));
    await makeFile(join(root, "anomaly_api", "output", anomalyId, `${anomalyId}.png`));
    await makeFile(join(root, "anomaly_api", "output", anomalyId, `${anomalyId}_heatmap.png`));
    await makeFile(join(root, "anomaly_api", "output", anomalyId, `${anomalyId}.json`), JSON.stringify({
      process_id: anomalyId,
      sample_score: 0.29,
      anomaly_level: "很可能异常",
      analog_voltage: 0.53,
      original_size: [31901, 1000],
      num_crops: 1,
      timestamp: "2026-05-12T16:07:21.677114",
      crop_results: [{ sample_score: 0.29, anomaly_level: "很可能异常" }],
      files: { anomaly_map: `${anomalyId}.png`, heatmap: `${anomalyId}_heatmap.png` }
    }));

    const payload = await scanCoatingJobs({ dataRoot: root, scanIntervalMs: 1000, maxJobs: 10 });
    assert.equal(payload.health.readyJobs, 2);
    assert.equal(payload.health.trendJobs, 1);
    assert.equal(payload.health.anomalyJobs, 1);

    const trend = payload.jobs.find((job) => job.type === "trend");
    assert.equal(trend.status, "ready");
    assert.equal(trend.summary.sourceImageCount, 1);
    assert.equal(trend.outputImages.prediction.name, "prediction.jpg");

    const anomaly = payload.jobs.find((job) => job.type === "anomaly");
    assert.equal(anomaly.status, "ready");
    assert.equal(anomaly.summary.imageType, "very long");
    assert.equal(anomaly.summary.abnormalCropCount, 1);
    assert.equal(anomaly.outputImages.heatmap.name, `${anomalyId}_heatmap.png`);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
