import { useMemo } from "react";
import * as THREE from "three";

import { CHAMBER_MASK_CONFIG, type ChamberMaskDef } from "../data/chamberMaskConfig";
import type { ChamberId } from "../data/chambers";

/**
 * 3D Canvas 内的腔室高亮蒙版：选中腔室后在 XY 平面（面向默认相机）渲染
 * 一个半透明彩色形状。形状与坐标全部来自 `chamberMaskConfig.ts`——调位置
 * 只改配置文件，不碰这里。
 *
 * - rectangle：四个点构成的长方形。
 * - stadium：长方形 + 下方拼接的半圆（镀膜室）。
 *
 * 填充用 `meshBasicMaterial`（不受光、纯色高亮），`depthWrite={false}` 让
 * 半透明片不写深度、不误挡后方几何；描边用 `depthTest={false}` 保证轮廓
 * 即使局部被模型遮挡也清晰可见。边缘柔化：沿轮廓叠加多层向外扩展、透
 * 明度递减的同色光晕环（辉光效果），视觉上让硬边泛开、更柔和。
 */
type ChamberMaskProps = {
  chamberId: ChamberId | null;
};

/** 单个光晕环：外扩后的闭合轮廓点 + 透明度。 */
type GlowRing = {
  pts: Float32Array;
  opacity: number;
};

/** 把配置里的四个角构建成 three.js 形状路径（XY 平面，y 向上）。 */
function buildShape(def: ChamberMaskDef): THREE.Shape {
  const [c0, c1, c2, c3] = def.corners;
  const shape = new THREE.Shape();
  shape.moveTo(c0[0], c0[1]);
  shape.lineTo(c1[0], c1[1]);
  shape.lineTo(c2[0], c2[1]);
  if (def.kind === "stadium") {
    // 半圆：用 2 段三次贝塞尔拟合（替代 absarc）。
    // 原版 absarc(c3 → c2) 让 c2 在 path 里出现两次，加上 closePath 的 c0，
    // 形成退化三角形 → 三角化时在底边出现"接缝"线。
    // 贝塞尔方案让 path 顺序为 c0→c1→c2→贝塞尔→c3→closePath c0，所有顶点
    // 唯一，无重复点；且贝塞尔段在连接处切线连续，外法线自然平滑，
    // 光晕环不再"硬拐"。
    const cx = (c2[0] + c3[0]) / 2;
    const cy = c2[1];
    const r = Math.abs(c2[0] - c3[0]) / 2;
    const k = 0.5522847498 * r;  // 三次贝塞尔拟合 1/4 圆弧的控制点距离系数
    // 段1：c2 → (cx, cy-r)（右下 1/4 圆，向 -Y 凸）
    shape.bezierCurveTo(c2[0], cy - k, cx + k, cy - r, cx, cy - r);
    // 段2：(cx, cy-r) → c3（左下 1/4 圆）
    shape.bezierCurveTo(cx - k, cy - r, c3[0], cy - k, c3[0], cy);
  } else {
    shape.lineTo(c3[0], c3[1]);
  }
  shape.closePath();
  return shape;
}

/** 沿形状轮廓取点，返回闭合的描边顶点（XY 平面，z=0 由外层 group 平移）。 */
function buildContour(shape: THREE.Shape): Float32Array {
  const pts = shape.getPoints(60);
  const arr = new Float32Array((pts.length + 1) * 3);
  for (let i = 0; i < pts.length; i++) {
    arr[i * 3] = pts[i].x;
    arr[i * 3 + 1] = pts[i].y;
    arr[i * 3 + 2] = 0;
  }
  // 首尾同点闭合。
  arr[pts.length * 3] = pts[0].x;
  arr[pts.length * 3 + 1] = pts[0].y;
  arr[pts.length * 3 + 2] = 0;
  return arr;
}

/**
 * 生成同色光晕环：取形状轮廓点，按「顶点角法线（相邻边均值方向）朝外」
 * 逐点外扩 d，得到一圈形状相同、尺寸略大的同色细线。多圈从密到疏、透
 * 明度递减叠加，在蒙版边缘外形成渐进淡出的辉光，弱化硬边。d/opacity
 * 为种子值，直接改这里即可微调光晕浓淡，不需要碰渲染代码。
 */
function buildGlowRings(shape: THREE.Shape): GlowRing[] {
  const pts = shape.getPoints(64);
  if (pts.length === 0) return [];
  if (pts[0].distanceToSquared(pts[pts.length - 1]) < 1e-9) pts.pop();

  // 质心：凸形状下「顶点 - 质心」可当作外法线的大致方向。
  let cx = 0;
  let cy = 0;
  for (const p of pts) {
    cx += p.x;
    cy += p.y;
  }
  cx /= pts.length;
  cy /= pts.length;

  // 逐点外扩方向：相邻两点连线的垂直方向（角平分线法线），并保证朝外。
  const n = pts.length;
  const dirs: { x: number; y: number }[] = new Array(n);
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n];
    const curr = pts[i];
    const next = pts[(i + 1) % n];
    let nx = -(next.y - prev.y);
    let ny = next.x - prev.x;
    const len = Math.hypot(nx, ny) || 1;
    nx /= len;
    ny /= len;
    // 凸形状：外法线应与「质心朝外」同向，否则取反。
    if (nx * (curr.x - cx) + ny * (curr.y - cy) < 0) {
      nx = -nx;
      ny = -ny;
    }
    dirs[i] = { x: nx, y: ny };
  }

  const rings: { d: number; opacity: number }[] = [
    { d: 0.04, opacity: 0.32 },
    { d: 0.085, opacity: 0.2 },
    { d: 0.13, opacity: 0.1 }
  ];

  return rings.map(({ d, opacity }) => {
    const arr = new Float32Array((n + 1) * 3);
    for (let i = 0; i < n; i++) {
      arr[i * 3] = pts[i].x + dirs[i].x * d;
      arr[i * 3 + 1] = pts[i].y + dirs[i].y * d;
      arr[i * 3 + 2] = 0;
    }
    arr[n * 3] = arr[0];
    arr[n * 3 + 1] = arr[1];
    arr[n * 3 + 2] = 0;
    return { pts: arr, opacity };
  });
}

export function ChamberMask({ chamberId }: ChamberMaskProps) {
  const def = chamberId ? CHAMBER_MASK_CONFIG[chamberId] : null;

  const shape = useMemo(() => (def ? buildShape(def) : null), [def]);
  const contour = useMemo(() => (shape ? buildContour(shape) : null), [shape]);
  const glowRings = useMemo(() => (shape ? buildGlowRings(shape) : []), [shape]);

  if (!def || !shape || !contour) return null;

  return (
    <group position={[0, 0, def.z]}>
      {/* 半透明填充 */}
      <mesh>
        <shapeGeometry args={[shape]} />
        <meshBasicMaterial
          color={def.color}
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>
      {/* 同色轮廓描边，突出蒙版边界 */}
      <line>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" args={[contour, 3]} />
        </bufferGeometry>
        <lineBasicMaterial
          color={def.color}
          transparent
          opacity={0.9}
          depthTest={false}
        />
      </line>
      {/* 边缘光晕：从密到疏的同色细环，透明度递减，形成辉光柔化硬边 */}
      {glowRings.map((ring, i) => (
        <line key={i}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[ring.pts, 3]} />
          </bufferGeometry>
          <lineBasicMaterial
            color={def.color}
            transparent
            opacity={ring.opacity}
            depthTest={false}
          />
        </line>
      ))}
    </group>
  );
}