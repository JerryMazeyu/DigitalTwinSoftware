import { useLoader } from "@react-three/fiber";
import { useEffect, useMemo } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

import type { CoaterModelLayerId } from "../domain/modelLayers";

const MODEL_DIR = "/models/coater-20260820";
const TARGET_WIDTH = 8.8;
// 模型整体抬高量（世界 Y）。与 plcAnchorConfig.ts 锚点 Y、相机、状态层的
// 平移保持一致——抬模型必须同步平移锚点，否则数据点位会错位。
const MODEL_Y_OFFSET = 1.9;
const visibleLayerIdsSet = new Set<CoaterModelLayerId>(["___01", "___02"]);

const prepareObject = (object: THREE.Object3D, visibleLayerIds: CoaterModelLayerId[]) => {
  const visibleLayers = new Set(visibleLayerIds);

  object.traverse((child) => {
    if (!(child instanceof THREE.Mesh)) return;

    child.castShadow = true;
    child.receiveShadow = true;
    const layerId = child.name as CoaterModelLayerId;
    child.visible = visibleLayerIdsSet.has(layerId) ? visibleLayers.has(layerId) : true;

    if (Array.isArray(child.material)) {
      child.material.forEach((material) => {
        material.side = THREE.DoubleSide;
        material.needsUpdate = true;
      });
    } else if (child.material) {
      child.material.side = THREE.DoubleSide;
      child.material.needsUpdate = true;
    }
  });

  const box = new THREE.Box3().setFromObject(object);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  object.position.set(-center.x, -center.y, -center.z);

  return {
    object,
    scale: TARGET_WIDTH / Math.max(size.x, size.y, size.z)
  };
};

export function CoaterObjModel({ visibleLayerIds, onScene }: { visibleLayerIds: CoaterModelLayerId[]; onScene?: (root: THREE.Object3D) => void }) {
  const gltf = useLoader(GLTFLoader, `${MODEL_DIR}/coater.glb`) as unknown as { scene: THREE.Group };

  const prepared = useMemo(() => prepareObject(gltf.scene.clone(true), visibleLayerIds), [gltf.scene, visibleLayerIds]);

  useEffect(() => {
    onScene?.(prepared.object);
  }, [prepared.object, onScene]);

  return (
    <group
      position={[0, MODEL_Y_OFFSET, 0]}
      rotation={[0, 0, 0]}
      scale={[prepared.scale, prepared.scale, prepared.scale]}
    >
      <primitive object={prepared.object} />
    </group>
  );
}
