import { Canvas, extend, useFrame, useThree, type ReactThreeFiber } from "@react-three/fiber";
import { Activity, Gauge, Layers3, RadioTower, ScanLine } from "lucide-react";
import { Component, Suspense, useEffect, useMemo, useRef, useState, type PropsWithChildren, type ReactNode } from "react";
import * as THREE from "three";
import { OrbitControls as ThreeOrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

import { CoaterObjModel } from "./CoaterObjModel";
import { coaterModelLayers, createAllLayerSelection, toggleLayerSelection, type CoaterModelLayerId } from "../domain/modelLayers";
import type { MachineStatus, RiskLevel, SystemHealth } from "../domain/models";
import {
  MeshPlcLabelOverlay,
  MeshPlcLabelTracker,
  type MeshPlcLabelTrackerRef
} from "./sensorBoard/MeshPlcLabel";
import { usePlcSensorValue } from "../hooks/usePlcSensorValue";

extend({ OrbitControls: ThreeOrbitControls });

declare module "@react-three/fiber" {
  interface ThreeElements {
    orbitControls: ReactThreeFiber.Object3DNode<ThreeOrbitControls, typeof ThreeOrbitControls>;
  }
}

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0.72, 12];
const DEFAULT_CAMERA_TARGET = new THREE.Vector3(0, 0.72, 0);

type TwinMachine3DProps = {
  machine: MachineStatus;
  riskLevel: RiskLevel;
  health: SystemHealth[];
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

function FreeCameraControls() {
  const { camera, gl } = useThree();
  const controls = useRef<ThreeOrbitControls>(null);

  useEffect(() => {
    camera.position.set(...DEFAULT_CAMERA_POSITION);
    camera.lookAt(DEFAULT_CAMERA_TARGET);

    if (controls.current) {
      controls.current.target.copy(DEFAULT_CAMERA_TARGET);
      controls.current.enableDamping = true;
      controls.current.dampingFactor = 0.08;
      controls.current.enablePan = true;
      controls.current.enableZoom = true;
      controls.current.rotateSpeed = 0.75;
      controls.current.zoomSpeed = 0.9;
      controls.current.panSpeed = 0.45;
      controls.current.minDistance = 2.4;
      controls.current.maxDistance = 9.2;
      controls.current.minPolarAngle = Math.PI / 3.2;
      controls.current.maxPolarAngle = Math.PI / 2.04;
      controls.current.minAzimuthAngle = -Math.PI / 2.6;
      controls.current.maxAzimuthAngle = Math.PI / 2.6;
    }
    controls.current?.update();
  }, [camera]);

  useFrame(() => {
    controls.current?.update();
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

function ModelStatusLayer({ machine, riskLevel }: { machine: MachineStatus; riskLevel: RiskLevel }) {
  const alertColor = riskColor[riskLevel];
  const running = machine.status === "running" || machine.status === "warning";

  return (
    <group>
      <mesh position={[1.82, 0.1, 0.78]}>
        <boxGeometry args={[0.06, 0.06, 1.12]} />
        <meshStandardMaterial color={alertColor} emissive={alertColor} emissiveIntensity={0.42} transparent opacity={0.86} />
      </mesh>
      <mesh position={[3.05, 1.18, -0.48]}>
        <sphereGeometry args={[0.095, 24, 24]} />
        <meshStandardMaterial color={alertColor} emissive={alertColor} emissiveIntensity={running ? 0.95 : 0.35} />
      </mesh>
      <mesh position={[-2.74, -0.34, 0]} receiveShadow>
        <boxGeometry args={[1.32, 0.032, 1.06]} />
        <meshStandardMaterial color="#c0d3d6" emissive="#16393b" emissiveIntensity={running ? 0.24 : 0.07} metalness={0.12} roughness={0.2} transparent opacity={0.72} />
      </mesh>
    </group>
  );
}

function RealModelScene({
  machine,
  riskLevel,
  visibleLayerIds,
  onScene,
  chamber1TrackerRef
}: {
  machine: MachineStatus;
  riskLevel: RiskLevel;
  visibleLayerIds: CoaterModelLayerId[];
  onScene: (root: THREE.Object3D) => void;
  chamber1TrackerRef: React.MutableRefObject<MeshPlcLabelTrackerRef>;
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
      <MeshPlcLabelTracker
        sceneRoot={sceneRoot}
        meshName="___01"
        worldPosition={[0, 1.1, 0]}
        offset={[0, 1.0, 0]}
        trackerRef={chamber1TrackerRef}
      />
    </>
  );
}

export function TwinMachine3D({ machine, riskLevel, health, compact = false }: TwinMachine3DProps) {
  const onlineCount = useMemo(() => health.filter((item) => item.online).length, [health]);
  const [layerPanelOpen, setLayerPanelOpen] = useState(false);
  const [visibleLayerIds, setVisibleLayerIds] = useState<CoaterModelLayerId[]>(() => createAllLayerSelection());
  const [coaterScene, setCoaterScene] = useState<THREE.Object3D | null>(null);
  const chamber1TrackerRef = useRef<MeshPlcLabelTrackerRef>({ x: 0, y: 0, visible: false, dirty: true });
  const chamber1Live = usePlcSensorValue("dbVacOpStatus_bChbHiVac1", 2000);

  return (
    <section className={compact ? "panel machine-panel machine-panel-fill" : "panel machine-panel"} aria-label="镀膜机三维数字孪生">
      <div className="panel-header">
        <div>
          <h2>镀膜机 3D 数字孪生</h2>
          <p>放卷 - 张力辊 - 涂布腔 - 烘干 - 线扫检测 - 收卷</p>
        </div>
        <span className={`risk-chip risk-${riskLevel}`}>
          {machine.status === "control-pending" ? "只读监控" : "设备联动"}
        </span>
      </div>
      <div className={compact ? "machine-canvas machine-canvas-fill" : "machine-canvas"}>
        <div className="model-layer-control">
          <button
            className={layerPanelOpen ? "active" : ""}
            type="button"
            onClick={() => setLayerPanelOpen((open) => !open)}
            title="显示或隐藏模型图层"
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
        <Canvas camera={{ position: DEFAULT_CAMERA_POSITION, fov: 30 }} shadows>
          <FreeCameraControls />
          <ModelErrorBoundary fallback={<MachineScene machine={machine} riskLevel={riskLevel} />}>
            <Suspense fallback={<MachineScene machine={machine} riskLevel={riskLevel} />}>
              <RealModelScene
                machine={machine}
                riskLevel={riskLevel}
                visibleLayerIds={visibleLayerIds}
                onScene={setCoaterScene}
                chamber1TrackerRef={chamber1TrackerRef}
              />
            </Suspense>
          </ModelErrorBoundary>
        </Canvas>
        <MeshPlcLabelOverlay
          trackerRef={chamber1TrackerRef}
          cnName="腔体1高真空"
          enName="dbVacOpStatus_bChbHiVac1"
          value={chamber1Live.unresolved ? null : chamber1Live.value}
          dataType="Boolean"
        />
        <div className="machine-overlay">
          <div><Activity size={15} />线速 {machine.lineSpeed} m/min</div>
          <div><Gauge size={15} />张力 {machine.tension} N</div>
          <div><ScanLine size={15} />检测段 K2+14.6m</div>
          <div><RadioTower size={15} />链路 {onlineCount}/{health.length} 在线</div>
        </div>
      </div>
      <div className="machine-metrics">
        <div><span>温度</span><strong>{machine.temperature} C</strong></div>
        <div><span>真空度</span><strong>{machine.vacuum} MPa</strong></div>
        <div><span>功率</span><strong>{machine.power} kW</strong></div>
      </div>
    </section>
  );
}
