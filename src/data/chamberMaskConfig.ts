/**
 * 6 个物理腔室的 2D 高亮蒙版配置：选中腔室后，在 3D 模型的腔室位置
 * 显示一个半透明的彩色蒙版（面向默认相机的 XY 平面，浮在机器前方）。
 *
 * 位置单位 = R3F 世界坐标（与 plcAnchorConfig.worldPosition 同坐标系）；
 * 坐标系与 three.js 一致：X 向右（沿机器长轴）、Y 向上、Z 面向观测者。
 * 蒙版浮在 Z≈1.1，即机器前缘（Z≈1）前一点。
 *
 * 形状：
 *   - rectangle：`corners` 四个点定义一个长方形（XY 平面）。
 *   - stadium：  长方形 + 下方拼接半圆（镀膜室）。半圆直径 = 长方形
 *                corners[2]↔corners[3] 底边的长度，圆心 = 底边中点，
 *                向 -Y 方向凸出。只调 corners 即可整体微调形状。
 *
 * 颜色/坐标是种子值，直接改这里即可微调——不需要碰 UI 代码。
 */

import type { ChamberId } from "./chambers";

export type ChamberMaskDef =
  | {
      kind: "rectangle";
      /** 半透明填充色（hex）。 */
      color: string;
      /** 浮起深度（Z，面向默认相机）。 */
      z: number;
      /** 长方形四个顶点（XY 平面），顺序：左上 → 右上 → 右下 → 左下。 */
      corners: [number, number][];
    }
  | {
      kind: "stadium"; // 长方形 + 下方拼接半圆
      color: string;
      z: number;
      /** 长方形四个顶点（同上）；半圆直径 = 底边长度，向 -Y 凸出。 */
      corners: [number, number][];
    };

// 六个腔室的 X 分段（沿长轴 [-4.4, 4.4] 由主锚点坐标切分）：
//   unwind [-4.40, -3.30]  heat-degas [-3.30, -2.05]  pretreat [-2.05, -0.40]
//   coating [-0.40, +1.90] inspect [+1.90, +3.50]     rewind [+3.50, +4.40]
export const CHAMBER_MASK_CONFIG: Record<ChamberId, ChamberMaskDef> = {
  unwind: {
    kind: "rectangle",
    color: "#5ad8c9",
    z: 1.1,
    corners: [[-4.4, 2.85], [-3.3, 2.85], [-3.3, 0.2], [-4.4, 0.2]]
  },
  "heat-degas": {
    kind: "rectangle",
    color: "#ffb23f",
    z: 1.1,
    corners: [[-3.25, 2.85], [-1.9, 2.85], [-1.9, 1.85], [-3.25, 1.85]]
  },
  pretreat: {
    kind: "rectangle",
    color: "#8ab4f8",
    z: 1.1,
    corners: [[-1.9, 2.85], [-0.9, 2.85], [-0.9, 2.55], [-1.9, 2.55]]
  },
  coating: {
    kind: "stadium",
    color: "#f08a6e",
    z: 1.1,
    corners: [[-0.85, 2.85], [2.5, 2.85], [2.5, 1.75], [-0.85, 1.75]]
  },
  inspect: {
    kind: "rectangle",
    color: "#f5d76e",
    z: 1.1,
    corners: [[2.5, 2.85], [3.3, 2.85], [3.3, 2.55], [2.5, 2.55]]
  },
  rewind: {
    kind: "rectangle",
    color: "#39d98a",
    z: 1.1,
    corners: [[3.3, 2.85], [4.4, 2.85], [4.4, 0.2], [3.3, 0.2]]
  }
};