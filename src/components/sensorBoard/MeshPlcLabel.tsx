import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef, type MutableRefObject } from "react";
import * as THREE from "three";

export type MeshPlcLabelTrackerRef = {
  /** Pixel x relative to the canvas top-left. */
  x: number;
  /** Pixel y relative to the canvas top-left. */
  y: number;
  /** False if behind the camera or off-screen. */
  visible: boolean;
  /** Set to true after each frame so the overlay can pull. */
  dirty: boolean;
};

export type MeshPlcLabelTrackerProps = {
  /** GLB scene root. Required when using `meshName`. */
  sceneRoot?: THREE.Object3D | null;
  /** Mesh name to look up via `sceneRoot.traverse()`. */
  meshName?: string;
  /** Fallback absolute world position. Used when `meshName` is missing or the lookup misses. */
  worldPosition?: [number, number, number];
  /** Local-space offset added to the resolved position (so the label floats above the part). */
  offset?: [number, number, number];
  trackerRef: MutableRefObject<MeshPlcLabelTrackerRef>;
};

/**
 * Lives INSIDE the R3F Canvas. Each frame, projects a 3D anchor point into
 * canvas-relative pixel coords and writes them to `trackerRef`.
 *
 * Resolution order:
 *   1. If `meshName` resolves inside `sceneRoot`, follow that mesh.
 *   2. Otherwise use `worldPosition` directly.
 *   3. If neither is available, the label stays hidden.
 */
export function MeshPlcLabelTracker({
  sceneRoot,
  meshName,
  worldPosition,
  offset,
  trackerRef
}: MeshPlcLabelTrackerProps) {
  const { camera, gl } = useThree();
  const targetRef = useRef<THREE.Object3D | null>(null);
  const scratch = useRef(new THREE.Vector3());
  const fallbackRef = useRef<THREE.Vector3 | null>(
    worldPosition ? new THREE.Vector3(...worldPosition) : null
  );

  // (Re)locate the mesh whenever the scene changes or the name changes.
  useEffect(() => {
    targetRef.current = null;
    if (!sceneRoot || !meshName) return;
    sceneRoot.traverse((child) => {
      if (child.name === meshName) {
        targetRef.current = child;
      }
    });
  }, [sceneRoot, meshName]);

  useEffect(() => {
    fallbackRef.current = worldPosition ? new THREE.Vector3(...worldPosition) : null;
  }, [worldPosition?.[0], worldPosition?.[1], worldPosition?.[2]]);

  useFrame(() => {
    const tracker = trackerRef.current;
    const v = scratch.current;

    if (targetRef.current) {
      targetRef.current.updateWorldMatrix(true, false);
      if (offset) {
        v.fromArray(offset);
        targetRef.current.localToWorld(v);
      } else {
        targetRef.current.getWorldPosition(v);
      }
    } else if (fallbackRef.current) {
      v.copy(fallbackRef.current);
      if (offset) v.add(new THREE.Vector3(...offset));
    } else {
      if (tracker.visible) {
        tracker.visible = false;
        tracker.dirty = true;
      }
      return;
    }

    v.project(camera);
    const rect = gl.domElement.getBoundingClientRect();
    tracker.x = (v.x * 0.5 + 0.5) * rect.width;
    tracker.y = (-v.y * 0.5 + 0.5) * rect.height;
    // In front of camera, within reasonable NDC bounds (allow a small overscan).
    tracker.visible = v.z >= -1 && v.z <= 1 && Math.abs(v.x) <= 1.1 && Math.abs(v.y) <= 1.1;
    tracker.dirty = true;
  });

  return null;
}

export type MeshPlcLabelOverlayProps = {
  trackerRef: MutableRefObject<MeshPlcLabelTrackerRef>;
  cnName: string;
  enName?: string;
  value: unknown;
  dataType?: string;
};

/**
 * Lives OUTSIDE the R3F Canvas (sibling of the canvas element). Reads the
 * trackerRef every animation frame and translates a single absolute-positioned
 * div — no React re-renders on camera move.
 */
export function MeshPlcLabelOverlay({
  trackerRef,
  cnName,
  enName,
  value,
  dataType
}: MeshPlcLabelOverlayProps) {
  const elRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const el = elRef.current;
      const t = trackerRef.current;
      if (el && t.dirty) {
        el.style.transform = `translate3d(${t.x}px, ${t.y}px, 0) translate(-50%, calc(-100% - 8px))`;
        el.style.display = t.visible ? "block" : "none";
        t.dirty = false;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [trackerRef]);

  const formatted = formatLabelValue(value, dataType);

  return (
    <div
      ref={elRef}
      className={`mesh-plc-label tone-${formatted.tone}`}
      style={{ display: "none" }}
    >
      <span className="mesh-plc-label-name">{cnName}</span>
      <span className="mesh-plc-label-value">{formatted.text}</span>
      {enName && <span className="mesh-plc-label-en">{enName}</span>}
    </div>
  );
}

const formatLabelValue = (
  value: unknown,
  dataType?: string
): { text: string; tone: "ok" | "err" | "muted" | "number" } => {
  if (value === null || value === undefined) {
    return { text: "—", tone: "muted" };
  }
  if (typeof value === "boolean" || dataType === "Boolean") {
    return value
      ? { text: "✓ 正常", tone: "ok" }
      : { text: "✗ 异常", tone: "err" };
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return { text: "NaN", tone: "muted" };
    const abs = Math.abs(value);
    let d = 0;
    if (abs < 10 && abs > 0) d = 3;
    else if (abs < 100) d = 2;
    else if (abs < 1000) d = 1;
    return { text: value.toFixed(d), tone: "number" };
  }
  return { text: String(value), tone: "number" };
};