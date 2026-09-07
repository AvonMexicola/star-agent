import * as THREE from 'three';
import { ensureStationMaterialUVs } from './station-finish-materials.js';

export const STATION_EXTERIOR_URL = '/models/station-exterior.glb';
export const STATION_EXTERIOR_LOD_URL = '/models/station-exterior-lod1.glb';

/** Explicit development inspection start, entered through the local launcher.
 * Regular station transit and docking retain their own physical approach. */
export function placeStationExteriorPreview(nav, aspect = 16 / 9) {
  const station = nav.station;
  if (!station.ready || !station.exterior.authored || station.multiplayerState) return false;
  nav.orbit();
  const offset = new THREE.Vector3(-3800, 2100, -4200);
  offset.multiplyScalar(Math.max(1, 1.15 / aspect));
  nav.position.copy(station.centre).add(offset.applyQuaternion(station.baseQuaternion));
  nav.orientToward(station.centre, station.up);
  nav.enabled = true;
  return true;
}

/** The authored kit is a fixed spine and one reusable rotating ring. All GPU
 * geometry stays in port-local metres; StationComplex owns the world rebase. */
export function createAuthoredExterior(gltf, finish) {
  const source = gltf.scene;
  const fixed = source?.getObjectByName('FixedStructure');
  const template = source?.getObjectByName('RingTemplate');
  const shell = source?.getObjectByName('HubShellDetail');
  if (!fixed || !template || !shell) throw new Error('Station exterior kit is missing an assembly.');
  source.updateMatrixWorld(true);
  for (const [assembly, minimum] of [[fixed,[2100,150,900]],[template,[100,2800,2800]],[shell,[40,8,34]]]) {
    const bounds=new THREE.Box3().setFromObject(assembly);
    const size=bounds.getSize(new THREE.Vector3()).toArray();
    let meshes=0;
    assembly.traverse(mesh=>{
      if(!mesh.isMesh)return;
      const geometry=mesh.geometry,positions=geometry.getAttribute('position');
      if(!positions?.count||!geometry.getAttribute('normal'))return;
      if((geometry.index?.count??positions.count)>=3)meshes++;
    });
    if(!meshes||bounds.isEmpty()||size.some((value,i)=>!Number.isFinite(value)||value<minimum[i])){
      throw new Error(`Station exterior kit has an empty or incomplete ${assembly.name} assembly.`);
    }
  }
  const group = new THREE.Group();
  group.name = 'Aeon authored exterior / geometry review';
  const hubShell = shell.clone(true);
  group.add(fixed.clone(true), hubShell);
  const rings = [-1110, 1110].map((x, i) => {
    const ring = template.clone(true);
    ring.name = `Habitat ring ${i + 1}`;
    ring.position.x = x;
    group.add(ring);
    return ring;
  });
  const prepared = new Set();
  group.updateMatrixWorld(true);
  const scale = new THREE.Vector3();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    // These are metre-scale grain UVs, not unique paint UVs. Reconstruct them
    // once on the shared decoded geometry instead of shipping duplicate floats.
    mesh.getWorldScale(scale);
    ensureStationMaterialUVs(mesh.geometry, scale);
    // A whole kilometre-scale ring must not consume the occupied hangar's
    // small shadow map. Native material lighting and authored contacts remain.
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    const material = mesh.material;
    if (!prepared.has(material)) {
      prepared.add(material);
      material.userData.unweathered = true;
      material.envMapIntensity = .4;
      if (material.emissive.getHex() === 0 && finish) {
        const steel = material.name === 'ExteriorSteel';
        material.bumpMap = steel ? finish.textures.brushed : finish.textures.powdercoat;
        material.roughnessMap = material.bumpMap;
        material.bumpScale = steel ? .00012 : .00045;
      }
    }
    if (material.emissive.getHex() === 0) mesh.onBeforeRender = exteriorEnvironment;
  });
  return { group, rings, hubShell, authored: true };
}

/** A coarse export retains every silhouette assembly but drops subpixel edge
 * bevels. Hysteresis avoids repeated swaps near the overview distance. Physical
 * collision remains the hero's immutable local trees at either render level. */
export function attachExteriorLod(exterior, gltf, finish) {
  const lod = createAuthoredExterior(gltf, finish);
  lod.group.name = 'Exterior distant render only';
  lod.group.visible = false;
  exterior.group.add(lod.group);
  exterior.lod = lod;
  exterior.detailLevel = 'hero';
  const fixed = exterior.group.getObjectByName('FixedStructure');
  exterior.updateDetail = distance => {
    const distant = exterior.detailLevel === 'lod1' ? distance > 3800 : distance > 4200;
    exterior.detailLevel = distant ? 'lod1' : 'hero';
    fixed.visible = !distant;
    lod.hubShell.visible = exterior.hubShell.visible;
    exterior.hubShell.visible &&= !distant;
    exterior.rings.forEach((ring, i) => {
      ring.visible = !distant;
      lod.rings[i].quaternion.copy(ring.quaternion);
    });
    lod.group.visible = distant;
  };
}

/** Reuse the scene's actual planet-oriented PMREM. Preserve a readable local
 * response without changing space lighting or making the paint emissive. */
function exteriorEnvironment(_renderer, scene, _camera, _geometry, material) {
  if (material.envMap !== scene.environment) {
    material.envMap = scene.environment;
    material.needsUpdate = true;
  }
  material.envMapRotation.copy(scene.environmentRotation);
}
