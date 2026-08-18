/**
 * 把 PLC 锚点按 `worldPosition` 分桶成簇——相同坐标的所有 anchor 共享一个
 * 簇，渲染层用单个 banner 多行展示，避免数据互相覆盖。
 *
 * 触发条件（与方案对齐）：`worldPosition` 三元组文本相等。不使用浮点
 * 距离阈值，避免误伤相邻的真空规/溅射电源。
 */

import type { PlcAnchorConfigEntry } from "./plcAnchorConfig";

export type AnchorCluster = {
  /** React key 与 tracker ref 共享的位置键，格式 "x,y,z"。 */
  positionKey: string;
  worldPosition: [number, number, number];
  /** 保持 plcAnchorConfig 中的原始顺序。 */
  members: PlcAnchorConfigEntry[];
};

export function clusterAnchorsByPosition(
  anchors: PlcAnchorConfigEntry[]
): AnchorCluster[] {
  const groups = new Map<string, PlcAnchorConfigEntry[]>();
  for (const a of anchors) {
    const key = a.worldPosition.join(",");
    let bucket = groups.get(key);
    if (!bucket) {
      bucket = [];
      groups.set(key, bucket);
    }
    bucket.push(a);
  }
  const clusters: AnchorCluster[] = [];
  for (const [positionKey, members] of groups) {
    clusters.push({
      positionKey,
      worldPosition: members[0].worldPosition,
      members
    });
  }
  return clusters;
}