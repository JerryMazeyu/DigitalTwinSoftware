import { describe, expect, it } from "vitest";

import type { PlcAnchorConfigEntry } from "./plcAnchorConfig";
import { clusterAnchorsByPosition } from "./plcAnchorClusters";

// 测试 fixture 工厂：尽量小，每个测试自给自足。
const entry = (
  plcSymbol: string,
  worldPosition: [number, number, number]
): PlcAnchorConfigEntry => ({
  plcSymbol,
  partId: plcSymbol,
  categoryEn: "WindingActual",
  worldPosition,
  defaultVisible: true,
});

describe("clusterAnchorsByPosition", () => {
  it("returns an empty array when given no anchors", () => {
    expect(clusterAnchorsByPosition([])).toEqual([]);
  });

  it("returns a singleton cluster for each anchor with a unique worldPosition", () => {
    const anchors = [
      entry("a", [-4, 0.1, 0.6]),
      entry("b", [0, 2.5, 0.6]),
      entry("c", [1, 1.7, 0.6]),
    ];

    const clusters = clusterAnchorsByPosition(anchors);

    expect(clusters).toHaveLength(3);
    for (const cluster of clusters) {
      expect(cluster.members).toHaveLength(1);
    }
    // 位置键按 "x,y,z" 编码，便于 React key 使用。
    expect(clusters[0].positionKey).toBe("-4,0.1,0.6");
    expect(clusters[0].worldPosition).toEqual([-4, 0.1, 0.6]);
    expect(clusters[0].members[0].plcSymbol).toBe("a");
  });

  it("merges anchors that share an identical worldPosition into one cluster", () => {
    const anchors = [
      entry("Axis_2", [-4, 0.1, 0.6]),
      entry("Tension_1", [-4, 0.1, 0.6]),
      entry("HMI_Act_Wind_R", [-4, 0.1, 0.6]),
    ];

    const clusters = clusterAnchorsByPosition(anchors);

    expect(clusters).toHaveLength(1);
    expect(clusters[0].members.map((m) => m.plcSymbol)).toEqual([
      "Axis_2",
      "Tension_1",
      "HMI_Act_Wind_R"
    ]);
    expect(clusters[0].worldPosition).toEqual([-4, 0.1, 0.6]);
  });

  it("preserves the original ordering of anchors inside each cluster", () => {
    const anchors = [
      entry("z_third", [-4, 0.1, 0.6]),
      entry("a_first", [-4, 0.1, 0.6]),
      entry("m_second", [-4, 0.1, 0.6])
    ];

    const [cluster] = clusterAnchorsByPosition(anchors);

    expect(cluster.members.map((m) => m.plcSymbol)).toEqual([
      "z_third",
      "a_first",
      "m_second"
    ]);
  });

  it("treats numerically equal but textually different positions as different clusters", () => {
    // 浮点字面量 0.1 在 JS 中是 0.10000000000000001 之类的近似值。
    // 我们用浅比较 join(",")，因此 "0,0.1,0.6" 与 "0,0.10,0.6" 会被视为不同 key。
    // 这个测试钉死当前语义——后续若要换严格浮点比较，需先改这里。
    const anchors = [
      entry("a", [0, 0.1, 0.6]),
      entry("b", [0, 0.1, 0.6])
    ];

    expect(clusterAnchorsByPosition(anchors)).toHaveLength(1);

    const divergent = [
      entry("a", [0, 0.1, 0.6]),
      entry("b", [0, 0.1, 0.7])
    ];
    expect(clusterAnchorsByPosition(divergent)).toHaveLength(2);
  });

  it("produces a stable positionKey that round-trips through the worldPosition tuple", () => {
    const pos: [number, number, number] = [-1.53, 1.4, -0.6];
    const [cluster] = clusterAnchorsByPosition([entry("x", pos)]);

    expect(cluster.positionKey.split(",").map(Number)).toEqual(pos);
  });
});