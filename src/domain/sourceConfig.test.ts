import { describe, expect, it } from "vitest";

import {
  DataSourceConfigSchema,
  buildDefaultSourceConfigs,
  getConfiguredObjectTypes,
  summarizeProtocolCoverage
} from "./sourceConfig";

describe("source configuration", () => {
  it("defines schema-valid collection settings for the three production machines", () => {
    const configs = buildDefaultSourceConfigs();

    expect(configs).toHaveLength(3);
    expect(configs.map((config) => config.machineRole)).toEqual([
      "coating-machine",
      "industrial-pc",
      "algorithm-server"
    ]);

    for (const config of configs) {
      expect(DataSourceConfigSchema.safeParse(config).success).toBe(true);
      expect(config.protocol).not.toBe("temporary-script");
      expect(config.endpoint).toMatch(/^(opc\.tcp|modbus|ws|http|file|gigE):\/\//);
      expect(config.mappings.every((mapping) => mapping.enabled && mapping.pollIntervalMs > 0)).toBe(true);
    }
  });

  it("covers process data, line-scan frames, algorithm results, and system health", () => {
    const objectTypes = getConfiguredObjectTypes(buildDefaultSourceConfigs());

    expect(objectTypes).toEqual(
      expect.arrayContaining([
        "MachineStatus",
        "CameraFrame",
        "DetectionResult",
        "WrinklePrediction",
        "SystemHealth"
      ])
    );
  });

  it("summarizes protocol coverage without losing endpoint traceability", () => {
    const summary = summarizeProtocolCoverage(buildDefaultSourceConfigs());

    expect(summary).toContain("OPC UA");
    expect(summary).toContain("GigE Vision");
    expect(summary).toContain("WebSocket");
    expect(summary).toContain("192.168.");
  });
});
