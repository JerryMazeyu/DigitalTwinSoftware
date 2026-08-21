import { Canvas, extend, useFrame, useThree, type ReactThreeFiber } from "@react-three/fiber";
import { Anchor, Layers3, Maximize2, Minimize2 } from "lucide-react";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CoaterObjModel } from "./CoaterObjModel";
import { ChamberMask } from "./ChamberMask";
import { MachinePhaseVideo } from "./MachinePhaseVideo";
import { coaterModelLayers, createAllLayerSelection, toggleLayerSelection, type CoaterModelLayerId } from "../domain/modelLayers";
import {
  classifyMachinePhase,
  PHASE_ALL_SYMBOLS,
  valuesFromSymbolMaps
} from "../domain/machinePhase";
import type { MachineStatus, RiskLevel, SystemHealth } from "../domain/models";
import {
  MeshPlcLabelBannerTracker,
  type MeshPlcLabelTrackerRef
} from "./sensorBoard/MeshPlcLabel";
import { ClusterDotOverlay } from "./sensorBoard/ClusterDotOverlay";
import { ClusterDataPanel } from "./sensorBoard/ClusterDataPanel";
import { usePlcSensors } from "../hooks/usePlcSensors";
import { useIdleTimer } from "../hooks/useIdleTimer";
import { PLC_ANCHOR_CONFIG } from "../data/plcAnchorConfig";
import { MACHINE_PHASE_OVERRIDE, PHASE_LABEL, type MachinePhase } from "../domain/machinePhase";
import { clusterAnchorsByPosition, type AnchorCluster } from "../data/plcAnchorClusters";
import { PLC_SENSOR_META } from "../data/plcSensorMap";
import { CHAMBERS, CHAMBER_PRIMARY_SYMBOL, CHAMBER_SYMBOLS, type ChamberId } from "../data/chambers";
import { ChamberSelector } from "./sensorBoard/ChamberSelector";
import { API_BASE } from "../api/coatingApi";
import {
  type ApiFile,
  type CoatingJob,
  formatTime,
  getOutputImageEntries,
  getPrimaryInputImage,
  inspectionTypeLabel,
  isLongStripImageSize,
  resultLevelTone,
  statusLabel
} from "../domain/coatingJobs";

extend({ OrbitControls: ThreeOrbitControls });

declare module "@react-three/fiber" {
  interface ThreeElements {
    orbitControls: ReactThreeFiber.Object3DNode<ThreeOrbitControls, typeof ThreeOrbitControls>;
  }
}

// 相机 Y 与模型 MODEL_Y_OFFSET / plcAnchorConfig 锚点 Y 一同上抬了 0.8，
// 保证模型抬高后构图仍然居中（位置与 target 同步 +0.8）。
const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 1.52, 12];
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 1.52, 0);
// 全屏下相机往后拉，让模型在更大的视口里看起来更小（更多留白）。
// 12 → 20：模型宽度约 8.8 单位，全屏下视野横向约 17.6，模型占视口 ~50%。
const FULLSCREEN_CAMERA_POSITION: [number, number, number] = [0, 1.52, 20];

// 空闲复位动画：两个目标位置缓存成 Vector3（避免每帧 new），用帧率无关
// 的指数阻尼收敛。RESET_DAMPING 越大回正越快；RESET_EPSILON 是收敛阈值，
// 收敛即自停以省 CPU。
const RESET_DAMPING = 6;
const RESET_EPSILON = 0.02;
const DEFAULT_CAMERA_POSITION_V = new THREE.Vector3(...DEFAULT_CAMERA_POSITION);
const FULLSCREEN_CAMERA_POSITION_V = new THREE.Vector3(...FULLSCREEN_CAMERA_POSITION);

type TwinMachine3DProps = {
  machine: MachineStatus;
  riskLevel: RiskLevel;
  health: SystemHealth[];
  /** 全局最新完成结果——仅在 3D 全屏时用于底部摘要叠层。 */
  latestJob?: CoatingJob;
  compact?: boolean;
};

const riskColor: Record<RiskLevel, string> = {
  normal: "#39d98a",
  watch: "#d4c557",
  warning: "#ff9f43",
  critical: "#ff5c5c"
};


class ModelErrorBoundary extends Component<PropsWithChildren<{ fallback: ReactNode }>, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return this.props.fallback;
    return this.props.children;
  }
}

/**
 * 相位徽章：在 panel-header 内（普通态）和全屏画布右下角（fullscreen
 * 态）各放一份，复用同一份样式与数据来源——确保两种模式下用户看到的
 * 相位提示完全一致。`floating` 修饰类把徽章改成绝对定位、浮在画布上。
 * 逻辑：`MACHINE_PHASE_OVERRIDE` 激活时切到黄色警示样式，否则是低调实时相位。
 */
function PhaseBadge({ phase, floating = false }: { phase: MachinePhase; floating?: boolean }) {
  const phaseLabel = PHASE_LABEL[phase];
  const isOverride = MACHINE_PHASE_OVERRIDE !== null;
  const className = [
    "phase-badge",
    isOverride ? "is-override" : "",
    floating ? "is-fullscreen-floating" : ""
  ].filter(Boolean).join(" ");
  return (
    <div
      className={className}
      role="status"
      aria-live="polite"
      title={
        isOverride
          ? `当前相位被 VITE_MACHINE_PHASE=${MACHINE_PHASE_OVERRIDE} 强制覆盖——这不是真实 PLC 数据`
          : "实时相位判定（来自 PLC 实时值）"
      }
    >
      {isOverride && <span className="phase-badge-icon" aria-hidden="true">⚠</span>}
      <span className="phase-badge-text">
        {isOverride ? (
          <>
            <strong>调试覆盖</strong>
            <em> · 当前相位：「{phaseLabel}」（非真实 PLC 数据）</em>
          </>
        ) : (
          <>实时相位：{phaseLabel}</>
        )}
      </span>
    </div>
  );
}

function FreeCameraControls({
  isFullscreen,
  idle
}: {
  isFullscreen: boolean;
  idle: boolean;
}) {
  const { camera, gl } = useThree();
  const controls = useRef<ThreeOrbitControls>(null);
  // 复位动画运行中标记：idle 上升沿触发、收敛后自停；用户操作让 idle
  // 翻回 false 时立即停，避免强行覆盖用户正在操作的视角。
  const resettingRef = useRef(false);

  useEffect(() => {
    resettingRef.current = idle;
  }, [idle]);

  useEffect(() => {
    // 全屏下相机往后拉，让模型在更大的视口里看起来更小（更多留白）。
    const position = isFullscreen ? FULLSCREEN_CAMERA_POSITION : DEFAULT_CAMERA_POSITION;
    const target = DEFAULT_CAMERA_TARGET;
    camera.position.set(...position);
    camera.lookAt(target);

    if (controls.current) {
      controls.current.target.copy(target);
      controls.current.enableDamping = true;
      controls.current.dampingFactor = 0.08;
      controls.current.enablePan = true;
      controls.current.enableZoom = true;
      controls.current.rotateSpeed = 0.75;
      controls.current.zoomSpeed = 0.9;
      controls.current.panSpeed = 0.45;
      controls.current.minDistance = 2.4;
      // 全屏下放大 zoom 上限，让用户能拉到更远继续看缩放后的模型
      controls.current.maxDistance = isFullscreen ? 28 : 9.2;
      controls.current.minPolarAngle = Math.PI / 3.2;
      controls.current.maxPolarAngle = Math.PI / 2.04;
      controls.current.minAzimuthAngle = -Math.PI / 2.6;
      controls.current.maxAzimuthAngle = Math.PI / 2.6;
    }
    controls.current?.update();
  }, [camera, isFullscreen]);

  useFrame((_, rawDelta) => {
    const ctrl = controls.current;
    if (!ctrl) return;
    if (!resettingRef.current) {
      ctrl.update();
      return;
    }
    // 必须同时 lerp position 与 target：OrbitControls.update() 会用
    // position - target 偏移重算相机姿态，只改 position 会被覆盖。
    const lambda = 1 - Math.exp(-RESET_DAMPING * Math.min(rawDelta, 0.1));
    const targetPosition = isFullscreen
      ? FULLSCREEN_CAMERA_POSITION_V
      : DEFAULT_CAMERA_POSITION_V;
    camera.position.lerp(targetPosition, lambda);
    ctrl.target.lerp(DEFAULT_CAMERA_TARGET, lambda);
    ctrl.update();
    // 收敛：double 精度到位、snap 到目标，自停以省 CPU。
    if (
      camera.position.distanceTo(targetPosition) < RESET_EPSILON &&
      ctrl.target.distanceTo(DEFAULT_CAMERA_TARGET) < RESET_EPSILON
    ) {
      camera.position.copy(targetPosition);
      ctrl.target.copy(DEFAULT_CAMERA_TARGET);
      ctrl.update();
      resettingRef.current = false;
    }
  });

  return (
    <orbitControls
      ref={controls}
      args={[camera, gl.domElement]}
    />
  );
}

function Roller({
  position,
  radius,
  length,
  speed,
  color = "#9da8ad"
}: {
  position: [number, number, number];
  radius: number;
  length: number;
  speed: number;
  color?: string;
}) {
  const mesh = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (mesh.current) {
      mesh.current.rotation.y += delta * speed;
    }
  });

  return (
    <group position={position}>
      <mesh ref={mesh} rotation={[Math.PI / 2, 0, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[radius, radius, length, 72]} />
        <meshStandardMaterial color={color} metalness={0.82} roughness={0.22} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[radius * 1.08, radius * 1.08, 0.08, 72]} />
        <meshStandardMaterial color="#1d272b" metalness={0.76} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0, length / 2 + 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.18, radius * 0.18, 0.28, 32]} />
        <meshStandardMaterial color="#5d686d" metalness={0.8} roughness={0.24} />
      </mesh>
      <mesh position={[0, 0, -length / 2 - 0.12]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[radius * 0.18, radius * 0.18, 0.28, 32]} />
        <meshStandardMaterial color="#5d686d" metalness={0.8} roughness={0.24} />
      </mesh>
    </group>
  );
}

function Beam({ position, scale, color = "#263137" }: { position: [number, number, number]; scale: [number, number, number]; color?: string }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={scale} />
      <meshStandardMaterial color={color} metalness={0.45} roughness={0.42} />
    </mesh>
  );
}

function Bearing({ position }: { position: [number, number, number] }) {
  return (
    <group position={position}>
      <Beam position={[0, 0, 0]} scale={[0.26, 0.34, 0.18]} color="#202a2f" />
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.12, 0.12, 0.22, 28]} />
        <meshStandardMaterial color="#7b8589" metalness={0.74} roughness={0.28} />
      </mesh>
    </group>
  );
}

function FilmSegment({ position, length, angle = 0 }: { position: [number, number, number]; length: number; angle?: number }) {
  return (
    <mesh position={position} rotation={[0, 0, angle]} receiveShadow>
      <boxGeometry args={[length, 0.036, 1.18]} />
      <meshStandardMaterial color="#c0d3d6" emissive="#16393b" emissiveIntensity={0.16} metalness={0.12} roughness={0.2} transparent opacity={0.78} />
    </mesh>
  );
}

function GuardRail() {
  const posts: Array<[number, number, number]> = [
    [1.2, 0.08, -0.93],
    [1.9, 0.08, -0.93],
    [2.6, 0.08, -0.93],
    [3.3, 0.08, -0.93]
  ];

  return (
    <group>
      {posts.map((position) => (
        <Beam key={position.join("-")} position={position} scale={[0.04, 0.9, 0.04]} color="#b68a2c" />
      ))}
      <Beam position={[2.25, 0.54, -0.93]} scale={[2.16, 0.04, 0.04]} color="#c69b39" />
      <Beam position={[2.25, 0.25, -0.93]} scale={[2.16, 0.04, 0.04]} color="#c69b39" />
    </group>
  );
}

function CoatingAndDryer({ alertColor }: { alertColor: string }) {
  return (
    <group>
      <group position={[-0.82, 0.72, 0]}>
        <Beam position={[0, 0, 0]} scale={[1.45, 1.05, 1.42]} color="#27333a" />
        <Beam position={[0, -0.04, 0.74]} scale={[1.05, 0.42, 0.04]} color="#143234" />
        <Beam position={[0, -0.47, 0]} scale={[1.04, 0.08, 1.2]} color="#a47022" />
        <mesh position={[0.58, 0.48, 0.78]}>
          <sphereGeometry args={[0.075, 22, 22]} />
          <meshStandardMaterial color={alertColor} emissive={alertColor} emissiveIntensity={0.85} />
        </mesh>
      </group>
      <group position={[0.68, 0.96, 0]}>
        <Beam position={[0, 0, 0]} scale={[1.25, 0.62, 1.34]} color="#202b31" />
        <Beam position={[0, 0.34, 0]} scale={[1.36, 0.12, 1.44]} color="#354249" />
        <Beam position={[-0.34, -0.33, 0.7]} scale={[0.38, 0.08, 0.05]} color="#ffb23f" />
        <Beam position={[0.34, -0.33, 0.7]} scale={[0.38, 0.08, 0.05]} color="#ffb23f" />
      </group>
    </group>
  );
}

function InspectionStation({ alertColor }: { alertColor: string }) {
  return (
    <group position={[2.05, 0.74, 0]}>
      <Beam position={[0, 0.02, 0]} scale={[0.18, 1.28, 1.42]} color="#354248" />
      <Beam position={[0.12, 0.79, 0]} scale={[0.5, 0.15, 0.42]} color="#111a1e" />
      <mesh position={[0.12, 0.58, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.26, 0.42, 36]} />
        <meshStandardMaterial color="#0f171a" metalness={0.45} roughness={0.28} />
      </mesh>
      <Beam position={[0, 0.28, 0]} scale={[0.05, 0.05, 1.48]} color={alertColor} />
      <mesh position={[0.34, 0.14, 0]} rotation={[0, 0, Math.PI / 2]}>
        <coneGeometry args={[0.46, 0.9, 4]} />
        <meshStandardMaterial color={alertColor} emissive={alertColor} emissiveIntensity={0.32} transparent opacity={0.22} />
      </mesh>
    </group>
  );
}

function ProcessMarkers({ alertColor }: { alertColor: string }) {
  const markers: Array<{ label: string; position: [number, number, number]; color: string }> = [
    { label: "T1", position: [-3.2, 1.22, 0.72], color: "#5ad8c9" },
    { label: "V1", position: [-0.28, 1.34, 0.72], color: "#8ab4f8" },
    { label: "C1", position: [2.0, 1.22, 0.72], color: alertColor },
    { label: "T2", position: [3.25, 1.0, 0.72], color: "#5ad8c9" }
  ];

  return (
    <>
      {markers.map((marker) => (
        <mesh key={marker.label} position={marker.position}>
          <sphereGeometry args={[0.075, 20, 20]} />
          <meshStandardMaterial color={marker.color} emissive={marker.color} emissiveIntensity={0.55} />
        </mesh>
      ))}
    </>
  );
}

function MachineScene({ machine, riskLevel }: { machine: MachineStatus; riskLevel: RiskLevel }) {
  const running = machine.status === "running" || machine.status === "warning";
  const speed = running ? Math.max(machine.lineSpeed / 15, 0.8) : 0.08;
  const alertColor = riskColor[riskLevel];

  return (
    <>
      <color attach="background" args={["#10171a"]} />
      <ambientLight intensity={0.62} />
      <directionalLight position={[4.8, 6.4, 5.2]} intensity={2.2} castShadow />
      <pointLight position={[-2.4, 2.6, 2.1]} intensity={1.2} color="#5ad8c9" />
      <pointLight position={[1.1, 2.2, 1.5]} intensity={0.7} color="#ffb23f" />

      <Beam position={[0, -0.48, 0]} scale={[7.35, 0.12, 2.08]} color="#172126" />
      <Beam position={[0, -0.22, 0.9]} scale={[6.9, 0.12, 0.1]} color="#263137" />
      <Beam position={[0, -0.22, -0.9]} scale={[6.9, 0.12, 0.1]} color="#263137" />
      {[-3.25, -1.25, 0.55, 2.35, 3.3].map((x) => (
        <group key={x}>
          <Beam position={[x, 0.34, 0.88]} scale={[0.11, 1.45, 0.1]} color="#29343a" />
          <Beam position={[x, 0.34, -0.88]} scale={[0.11, 1.45, 0.1]} color="#29343a" />
        </group>
      ))}
      <Beam position={[0.08, 1.06, 0.88]} scale={[6.5, 0.1, 0.08]} color="#354249" />
      <Beam position={[0.08, 1.06, -0.88]} scale={[6.5, 0.1, 0.08]} color="#354249" />

      <Roller position={[-3.22, 0.78, 0]} radius={0.56} length={1.44} speed={speed * 0.55} color="#aeb8bc" />
      <Roller position={[-2.25, 0.24, 0]} radius={0.32} length={1.34} speed={speed * 1.2} />
      <Roller position={[-1.28, 1.05, 0]} radius={0.36} length={1.34} speed={speed} />
      <Roller position={[-0.06, 0.22, 0]} radius={0.28} length={1.34} speed={speed * 1.35} color="#7c878c" />
      <Roller position={[1.18, 0.22, 0]} radius={0.26} length={1.34} speed={speed * 1.45} color="#7c878c" />
      <Roller position={[2.42, 0.24, 0]} radius={0.31} length={1.34} speed={speed * 1.24} />
      <Roller position={[3.28, 0.7, 0]} radius={0.55} length={1.44} speed={speed * 0.62} color="#9ea9ad" />

      {[-3.22, -2.25, -1.28, -0.06, 1.18, 2.42, 3.28].map((x) => (
        <group key={`bearing-${x}`}>
          <Bearing position={[x, 0.1, 0.86]} />
          <Bearing position={[x, 0.1, -0.86]} />
        </group>
      ))}

      <FilmSegment position={[-2.73, 0.5, 0]} length={1.25} angle={-0.42} />
      <FilmSegment position={[-1.65, 0.66, 0]} length={1.6} angle={0.38} />
      <FilmSegment position={[-0.18, 0.24, 0]} length={2.12} />
      <FilmSegment position={[1.7, 0.24, 0]} length={1.98} />
      <FilmSegment position={[2.84, 0.46, 0]} length={1.3} angle={0.34} />

      <CoatingAndDryer alertColor={alertColor} />
      <InspectionStation alertColor={alertColor} />
      <GuardRail />
      <ProcessMarkers alertColor={alertColor} />
      <gridHelper args={[8, 14, "#2d3a40", "#1b272c"]} position={[0, -0.4, 0]} />
    </>
  );
}

function ModelSceneEnvironment() {
  return (
    <>
      <color attach="background" args={["#10171a"]} />
      <ambientLight intensity={0.72} />
      <directionalLight position={[4.8, 6.4, 5.2]} intensity={2.4} castShadow />
      <pointLight position={[-2.4, 2.6, 2.1]} intensity={1.2} color="#5ad8c9" />
      <pointLight position={[1.1, 2.2, 1.5]} intensity={0.75} color="#ffb23f" />
      <gridHelper args={[8.5, 16, "#2d3a40", "#1b272c"]} position={[0, -0.45, 0]} />
    </>
  );
}

function ModelStatusLayer({ machine: _machine, riskLevel: _riskLevel }: { machine: MachineStatus; riskLevel: RiskLevel }) {
  // 原先三个 R3F 内联 mesh（细长方体 / 球 / 扁平玻璃板）是用旧 fallback 场景
  // 的硬编码坐标写的，跟当前 GLB 模型的实际位置完全对不上，渲染出来会
  // 像漂在模型周围的"杂物"（用户已确认）。GLB 本身已经足够清晰，这里
  // 不再叠额外的状态装饰；只保留空 group 让外部引用继续工作。
  return <group />;
}

function RealModelScene({
  machine,
  riskLevel,
  visibleLayerIds,
  onScene,
  clusters,
  getClusterTrackerRef,
  selectedChamber
}: {
  machine: MachineStatus;
  riskLevel: RiskLevel;
  visibleLayerIds: CoaterModelLayerId[];
  onScene: (root: THREE.Object3D) => void;
  clusters: AnchorCluster[];
  getClusterTrackerRef: (positionKey: string) => React.MutableRefObject<MeshPlcLabelTrackerRef>;
  selectedChamber: ChamberId | null;
}) {
  const [sceneRoot, setLocalSceneRoot] = useState<THREE.Object3D | null>(null);
  const handleScene = (root: THREE.Object3D) => {
    setLocalSceneRoot(root);
    onScene(root);
  };
  return (
    <>
      <ModelSceneEnvironment />
      <CoaterObjModel visibleLayerIds={visibleLayerIds} onScene={handleScene} />
      <ModelStatusLayer machine={machine} riskLevel={riskLevel} />
      {clusters.map((cluster) => (
        <MeshPlcLabelBannerTracker
          key={cluster.positionKey}
          sceneRoot={sceneRoot}
          worldPosition={cluster.worldPosition}
          offset={[0, 0.2, 0]}
          trackerRef={getClusterTrackerRef(cluster.positionKey)}
        />
      ))}
      {/* 选中腔室时的 2D 透明蒙版（XY 平面，面向默认相机） */}
      <ChamberMask chamberId={selectedChamber} />
    </>
  );
}

const FULLSCREEN_TYPE_TONE: Record<CoatingJob["type"], string> = {
  anomaly: "danger",
  trend: "success"
};

/** 全屏摘要里的单张图。膜面图（长宽比 ≥ 4）整宽 contain 铺开，
 *  复用非全屏 `.long-image` 的「网格坐标纸 + 整图 contain」处理；普通图居中缩略图。 */
function FullscreenResultImage({ label, file }: { label: string; file?: ApiFile }) {
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);
  // 与 App 的 ImagePreview 一致：膜面图默认按长条处理，onLoad 后再按真实尺寸细化。
  const isLongStrip = naturalSize ? isLongStripImageSize(naturalSize.width, naturalSize.height) : true;

  useEffect(() => {
    setNaturalSize(null);
  }, [file?.url]);

  return (
    <figure className="fullscreen-result-overlay-figure">
      <figcaption className="fullscreen-result-overlay-figure-label">{label}</figcaption>
      <div className={isLongStrip ? "fullscreen-result-overlay-imgbox is-long" : "fullscreen-result-overlay-imgbox"}>
        {file ? (
          <img
            src={`${API_BASE}${file.url}`}
            alt={label}
            onLoad={(event) => {
              setNaturalSize({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight
              });
            }}
          />
        ) : (
          <span className="fullscreen-result-overlay-imgbox-empty">暂无图片</span>
        )}
      </div>
    </figure>
  );
}

/** 仅 3D 全屏时显示的最新结果底部摘要——实时跟随全局最新任务。 */
function FullscreenResultOverlay({ job }: { job: CoatingJob }) {
  const inputFile = getPrimaryInputImage(job);
  const outputEntry = getOutputImageEntries(job)[0];
  const levelText = job.summary.level || statusLabel[job.status];

  return (
    <aside className="fullscreen-result-overlay" aria-label="最新检测结果">
      <div className="fullscreen-result-overlay-meta">
        <span className={`type-chip ${FULLSCREEN_TYPE_TONE[job.type]}`}>
          {inspectionTypeLabel[job.type]}
        </span>
        <strong className="fullscreen-result-overlay-id">{job.id}</strong>
        <span className={`result-level ${resultLevelTone(job.summary.level)}`}>{levelText}</span>
        <time className="fullscreen-result-overlay-time">{formatTime(job.updatedAt)}</time>
        <span className="fullscreen-result-overlay-live">
          <i className="fullscreen-result-overlay-pulse" aria-hidden="true" />
          实时
        </span>
      </div>
      <div className="fullscreen-result-overlay-images">
        <FullscreenResultImage label="输入" file={inputFile} />
        <FullscreenResultImage label="输出" file={outputEntry?.file} />
      </div>
    </aside>
  );
}

export function TwinMachine3D({ machine, riskLevel, health: _health, latestJob, compact = false }: TwinMachine3DProps) {
  // 全屏按钮——把整个 .machine-canvas 容器（含图层/锚点按钮、Canvas、
  // banner overlays）一次性全屏显示。fullscreenchange 事件负责让按钮图
  // 标在「进入/退出」之间切换，跟随浏览器原生状态。
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  useEffect(() => {
    const handler = () =>
      setIsFullscreen(document.fullscreenElement === canvasContainerRef.current);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);
  const toggleFullscreen = () => {
    const target = canvasContainerRef.current;
    if (!target) return;
    if (document.fullscreenElement === target) {
      document.exitFullscreen().catch(() => {});
    } else {
      target.requestFullscreen().catch(() => {});
    }
  };

  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [visibleLayerIds, setVisibleLayerIds] = useState<CoaterModelLayerId[]>(() => createAllLayerSelection());
  const [coaterScene, setCoaterScene] = useState<THREE.Object3D | null>(null);

  // ----- 3D 锚点面板接线 -----
  const metaBySymbol = useMemo(
    () => new Map(PLC_SENSOR_META.map((m) => [m.plcSymbol, m])),
    []
  );

  // 默认可见锚点（配置层开启）组成用户可切换的候选集。defaultVisible: false
  // 的锚点既不出现在面板里也不会被轮询——这就是「配置 > 开关面板」的优先级。
  const anchorCandidates = useMemo(
    () => PLC_ANCHOR_CONFIG.filter((a) => a.defaultVisible),
    []
  );

  const [anchorVisibility, setAnchorVisibility] = useState<Set<string>>(
    () => new Set(anchorCandidates.map((a) => a.plcSymbol))
  );
  const [anchorPanelOpen, setAnchorPanelOpen] = useState(false);

  const toggleAnchor = (plcSymbol: string) =>
    setAnchorVisibility((prev) => {
      const next = new Set(prev);
      if (next.has(plcSymbol)) next.delete(plcSymbol);
      else next.add(plcSymbol);
      return next;
    });

  // 整组切换：当前全开时一键全关；其它情况（全关/部分开）一键全开。
  const toggleAnchorGroup = (categoryEn: string) =>
    setAnchorVisibility((prev) => {
      const items = anchorCandidates.filter((a) => a.categoryEn === categoryEn);
      const allOn = items.length > 0 && items.every((a) => prev.has(a.plcSymbol));
      const next = new Set(prev);
      if (allOn) {
        for (const a of items) next.delete(a.plcSymbol);
      } else {
        for (const a of items) next.add(a.plcSymbol);
      }
      return next;
    });

  // 当前选中的腔室（null = 显示全部）。腔室按钮触发 setSelectedChamber，
  // 控制下方三处状态：右侧面板按腔室过滤 + 排序，3D 圆点高亮，批量轮询
  // 范围收敛到该腔室的 plcSymbol。
  const [selectedChamber, setSelectedChamber] = useState<ChamberId | null>(null);

// 同时满足「配置开启」、「用户已切换开启」、「属于当前选中腔室（如有）」的锚点。
  const visibleAnchors = useMemo(() => {
    const base = anchorCandidates.filter((a) =>
      anchorVisibility.has(a.plcSymbol)
    );
    if (!selectedChamber) return base;
    const chamberSymbols = CHAMBER_SYMBOLS.get(selectedChamber);
    if (! chamberSymbols) return base;
    return base.filter((a) => chamberSymbols.has(a.plcSymbol));
  }, [anchorCandidates, anchorVisibility, selectedChamber]);

  // 按 worldPosition 把可见锚点分簇；同一物理位置的多个数据点共享一个 banner。
  const visibleClusters = useMemo(
    () => clusterAnchorsByPosition(visibleAnchors),
    [visibleAnchors]
  );

  // 全部锚点（按 PLC_ANCHOR_CONFIG 的全部条目，无论是否 defaultVisible）——
  // 右侧面板过滤前的全集。
  const allAnchors = useMemo(() => PLC_ANCHOR_CONFIG, []);

  // 右侧面板实际展示的锚点列表：未选腔室时显示全部；选中时按腔室配置里的
  // plcSymbol 顺序展示（首项 = 主锚点，放第一排加粗）。
  const displayedAnchors = useMemo(() => {
    if (!selectedChamber) return allAnchors;
    const chamber = CHAMBERS.find((c) => c.id === selectedChamber);
    if (!chamber) return allAnchors;
    const symbols = chamber.anchorPlcSymbolsOverride ?? [chamber.primaryPlcSymbol];
    const bySymbol = new Map(allAnchors.map((a) => [a.plcSymbol, a]));
    return symbols
      .map((s) => bySymbol.get(s))
      .filter((a): a is NonNullable<typeof a> => a !== undefined);
  }, [allAnchors, selectedChamber]);

  // 当前腔室的主锚点 plcSymbol（用于面板行加粗显示）。
  const primaryPlcSymbols = useMemo(() => {
    if (!selectedChamber) return new Set<string>();
    const sym = CHAMBER_PRIMARY_SYMBOL.get(selectedChamber);
    return sym ? new Set([sym]) : new Set<string>();
  }, [selectedChamber]);

  // 当前被 hover 的 cluster key——3D 上的小圆点和右侧数据面板共用同一状态，
  // 一方 hover 时另一方同步高亮。
  const [hoveredClusterKey, setHoveredClusterKey] = useState<string | null>(null);

  // 每个簇对应一个 ref，按需懒创建——key 为簇的位置键。
  const clusterTrackerRefs = useRef<Record<string, MeshPlcLabelTrackerRef>>({});
  const getClusterTrackerRef = (positionKey: string): React.MutableRefObject<MeshPlcLabelTrackerRef> => {
    if (!clusterTrackerRefs.current[positionKey]) {
      clusterTrackerRefs.current[positionKey] = { x: 0, y: 0, visible: false, dirty: true };
    }
    return { current: clusterTrackerRefs.current[positionKey] };
  };

  // 批量轮询——一次符号查询 + 16 路并发拉取，替代原本需要 22+ 个独立
  // usePlcSensorValue 定时器的方案。
  const anchorLive = usePlcSensors({
    wantedSymbols: visibleAnchors.map((a) => a.plcSymbol),
    intervalMs: 2000
  });

  // 机器运行相位用独立的固定订阅集——wantedSymbols 不随锚点开关 / 腔室选
  // 择收缩，否则卷绕 / 镀膜位被隐藏时会被误判为「不在运行」。
  const phaseLive = usePlcSensors({
    wantedSymbols: PHASE_ALL_SYMBOLS,
    intervalMs: 2000
  });

  // 15 秒空闲无操作：触发相机复位 + 机器状态视频轮播；任一鼠标点击 /
  // 键盘 / 滚轮事件都会立即打断并从头重新计时。
  const idle = useIdleTimer(15000);

  const phase = useMemo(
    () => classifyMachinePhase(valuesFromSymbolMaps(phaseLive.bySymbol)),
    [phaseLive.bySymbol]
  );

  return (
    <section className={compact ? "panel machine-panel machine-panel-fill" : "panel machine-panel"} aria-label="镀膜机三维数字孪生">
      <div className="panel-header">
        <div>
          <h2>镀膜机 3D 数字孪生</h2>
        </div>
        <PhaseBadge phase={phase} />
        <span className={`risk-chip risk-${riskLevel}`}>
          {machine.status === "control-pending" ? "只读监控" : "设备联动"}
        </span>
      </div>
      <div
        ref={canvasContainerRef}
        className={
          compact
            ? "machine-canvas machine-canvas-grid machine-canvas-fill"
            : "machine-canvas machine-canvas-grid"
        }
        // 阻止浏览器对画布上的按钮 / 文字 / SVG 触发默认拖拽行为
        //（否则会把"锚点"等按钮文字拖成新的标签页，干扰 OrbitControls）。
        onDragStart={(e) => e.preventDefault()}
      >
        <div className="machine-canvas-main">
          <button
            type="button"
            className="machine-fullscreen-toggle"
            onClick={toggleFullscreen}
            title={isFullscreen ? "退出全屏" : "进入全屏"}
            aria-label={isFullscreen ? "退出全屏" : "进入全屏"}
          >
            {isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />}
          </button>
          <div className="model-layer-control model-layer-control-left">
            <button
              className={layerPanelOpen ? "active" : ""}
              type="button"
              disabled
              onClick={() => setLayerPanelOpen((open) => !open)}
              title="图层切换暂未启用 —— 当前镀膜机模型未分层，待后续重新生成图层映射"
              aria-label="图层切换（暂未启用）"
            >
              <Layers3 size={15} />
              <span>图层</span>
            </button>
            {layerPanelOpen && (
              <div className="model-layer-popover">
                <div className="layer-actions">
                  <button type="button" onClick={() => setVisibleLayerIds(createAllLayerSelection())}>全部</button>
                </div>
                {coaterModelLayers.map((layer) => (
                  <label key={layer.id}>
                    <input
                      checked={visibleLayerIds.includes(layer.id)}
                      type="checkbox"
                      onChange={() => setVisibleLayerIds((current) => toggleLayerSelection(current, layer.id))}
                    />
                    <span>{layer.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div className="model-layer-control model-layer-control-left">
            <button
              className={anchorPanelOpen ? "active" : ""}
              type="button"
              onClick={() => setAnchorPanelOpen((open) => !open)}
              title="临时切换 PLC 数据点锚点的显示"
            >
              <Anchor size={15} />
              <span>锚点</span>
            </button>
            {anchorPanelOpen && (
              <div className="model-layer-popover">
                <div className="layer-actions">
                  <button
                    type="button"
                    onClick={() => setAnchorVisibility(new Set(anchorCandidates.map((a) => a.plcSymbol)))}
                  >
                    全部
                  </button>
                  <button
                    type="button"
                    onClick={() => setAnchorVisibility(new Set())}
                  >
                    清空
                  </button>
                </div>
                {(["SputterPowerActual", "WindingActual", "VacuumGauge", "IonSourceActual", "TemperatureOrColdTrap"] as const).map((cat) => {
                  const items = anchorCandidates.filter((a) => a.categoryEn === cat);
                  if (items.length === 0) return null;
                  const onCount = items.filter((a) => anchorVisibility.has(a.plcSymbol)).length;
                  const allOn = onCount === items.length;
                  const allOff = onCount === 0;
                  const categoryLabels: Record<typeof cat, string> = {
                    SputterPowerActual: "溅射电源",
                    WindingActual: "卷绕",
                    VacuumGauge: "真空规读数",
                    IonSourceActual: "离子源",
                    TemperatureOrColdTrap: "温度 · 冷捕集"
                  };
                  return (
                    <div key={cat} className="anchor-category">
                      <label
                        className="anchor-category-header"
                        title={allOn ? "关闭整组" : allOff ? "开启整组" : "同步开启整组"}
                      >
                        <input
                          type="checkbox"
                          ref={(el) => {
                            if (el) el.indeterminate = !allOn && !allOff;
                          }}
                          checked={allOn}
                          onChange={() => toggleAnchorGroup(cat)}
                        />
                        <span>{categoryLabels[cat]}</span>
                        <em>{items.length} 项</em>
                      </label>
                      {items.map((anchor) => {
                        const meta = metaBySymbol.get(anchor.plcSymbol);
                        const label = anchor.cnName ?? meta?.cnName ?? anchor.partId;
                        return (
                          <label key={anchor.plcSymbol} title={anchor.partId}>
                            <input
                              checked={anchorVisibility.has(anchor.plcSymbol)}
                              type="checkbox"
                              onChange={() => toggleAnchor(anchor.plcSymbol)}
                            />
                            <span>{label}</span>
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
                <div className="anchor-summary">
                  可见 {visibleAnchors.length} 项 · 已配置 {anchorCandidates.length} 项
                </div>
              </div>
            )}
          </div>
          <MachinePhaseVideo phase={phase} visible={idle} isFullscreen={isFullscreen} />
          {isFullscreen && <PhaseBadge phase={phase} floating />}
          <Canvas camera={{ position: DEFAULT_CAMERA_POSITION, fov: 30 }} shadows>
            <FreeCameraControls isFullscreen={isFullscreen} idle={idle} />
            <ModelErrorBoundary fallback={<MachineScene machine={machine} riskLevel={riskLevel} />}>
              <Suspense fallback={<MachineScene machine={machine} riskLevel={riskLevel} />}>
                <RealModelScene
                  machine={machine}
                  riskLevel={riskLevel}
                  visibleLayerIds={visibleLayerIds}
                  onScene={setCoaterScene}
                  clusters={visibleClusters}
                  getClusterTrackerRef={getClusterTrackerRef}
                  selectedChamber={selectedChamber}
                />
              </Suspense>
            </ModelErrorBoundary>
          </Canvas>
          {/* 把每个可见 cluster 在 3D 上画成一个小圆点；hover 时弹出详情卡。
           * 圆点位置由 MeshPlcLabelBannerTracker 通过同一个 trackerRef 写入。
           */}
          {visibleClusters.map((cluster) => {
            const rows = cluster.members.map((member) => {
              const meta = metaBySymbol.get(member.plcSymbol);
              const live = anchorLive.bySymbol[member.plcSymbol];
              return {
                cnName: member.cnName ?? meta?.cnName ?? member.partId,
                value: live?.value ?? null,
                dataType: meta?.dataType
              };
            });
            return (
              <ClusterDotOverlay
                key={cluster.positionKey}
                trackerRef={getClusterTrackerRef(cluster.positionKey)}
                rows={rows}
                externallyHovered={hoveredClusterKey === cluster.positionKey}
                highlighted={selectedChamber !== null}
                onHoverChange={(hovering) =>
                  setHoveredClusterKey(hovering ? cluster.positionKey : null)
                }
              />
            );
          })}
        </div>
        <ClusterDataPanel
          allAnchors={displayedAnchors}
          visibleAnchorSymbols={anchorVisibility}
          anchorLive={anchorLive}
          metaBySymbol={metaBySymbol}
          primaryPlcSymbols={primaryPlcSymbols}
          hoveredClusterKey={hoveredClusterKey}
          onHoverCluster={setHoveredClusterKey}
        />
        <ChamberSelector
          selected={selectedChamber}
          onSelect={setSelectedChamber}
        />
        {isFullscreen && latestJob && (
          <FullscreenResultOverlay key={latestJob.id} job={latestJob} />
        )}
      </div>
    </section>
  );
}
