import { useLoader } from "@react-three/fiber";
import { useMemo } from "react";
import * as THREE from "three";
import { MTLLoader } from "three/examples/jsm/loaders/MTLLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";

import { coaterModelLayerMeshes } from "../domain/generatedModelLayers";
import type { CoaterModelLayerId } from "../domain/modelLayers";

const MODEL_DIR = "/models/coater-20260702";
const TARGET_WIDTH = 6.65;
const MODEL_Y_OFFSET = 0.78;
const meshLayerByName = new Map(
  Object.entries(coaterModelLayerMeshes).flatMap(([layerId, meshNames]) => (
    meshNames.map((meshName) => [meshName, layerId as CoaterModelLayerId] as const)
  ))
);

const prepareMaterial = (material: THREE.Material) => {
  material.side = THREE.DoubleSide;
  material.needsUpdate = true;
};

const prepareObject = (object: THREE.Object3D, visibleLayerIds: CoaterModelLayerId[]) => {
  const visibleLayers = new Set(visibleLayerIds);

  object.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      const rootLayer = meshLayerByName.get(child.name);
      child.visible = rootLayer ? visibleLayers.has(rootLayer) : true;

      if (Array.isArray(child.material)) {
        child.material.forEach(prepareMaterial);
      } else {
        prepareMaterial(child.material);
      }
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

export function CoaterObjModel({ visibleLayerIds }: { visibleLayerIds: CoaterModelLayerId[] }) {
  const materials = useLoader(MTLLoader, `${MODEL_DIR}/coater.mtl`);
  const obj = useLoader(OBJLoader, `${MODEL_DIR}/coater.obj`, (loader) => {
    materials.preload();
    loader.setMaterials(materials);
  });

  const prepared = useMemo(() => prepareObject(obj.clone(true), visibleLayerIds), [obj, visibleLayerIds]);

  return (
    <group position={[0, MODEL_Y_OFFSET, 0]} rotation={[Math.PI / 2, 0, 0]} scale={[prepared.scale, prepared.scale, prepared.scale]}>
      <primitive object={prepared.object} />
    </group>
  );
}
