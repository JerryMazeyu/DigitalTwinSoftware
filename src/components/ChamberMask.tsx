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
 * 即使局部被模型遮挡也清晰可见。
 */
type ChamberMaskProps = {
  chamberId: ChamberId | null;
};

/** 把配置里的四个角构建成 three.js 形状路径（XY 平面，y 向上）。 */
function buildShape(def: ChamberMaskDef): THREE.Shape {
  const [c0, c1, c2, c3] = def.corners;
  const shape = new THREE.Shape();
  shape.moveTo(c0[0], c0[1]);
  shape.lineTo(c1[0], c1[1]);
  shape.lineTo(c2[0], c2[1]);
  shape.lineTo(c3[0], c3[1]);
  if (def.kind === "stadium") {
    // 半圆：圆心 = 底边(c3→c2)中点，半径 = 底边半长，向 -Y 凸出。
    // absarc 用逆时针方向（Math.PI → 0），在 y 向上的坐标系里途经 -Y（下方）。
    const cx = (c2[0] + c3[0]) / 2;
    const cy = c2[1];
    const r = Math.abs(c2[0] - c3[0]) / 2;
    shape.absarc(cx, cy, r, Math.PI, 0, false);
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

export function ChamberMask({ chamberId }: ChamberMaskProps) {
  const def = chamberId ? CHAMBER_MASK_CONFIG[chamberId] : null;

  const shape = useMemo(() => (def ? buildShape(def) : null), [def]);
  const contour = useMemo(() => (shape ? buildContour(shape) : null), [shape]);

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
    </group>
  );
}