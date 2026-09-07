import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { SHIP_LAYOUT } from './boarding.js';
import { stacksFor, RESOURCE_IDS, itemMass } from './inventory/containers.js';

/** Read the same installed boxes, stacks and mass limits used by cargo transfers. */
export function nomadCargoState(store) {
  const cargo = store.container('ship'), limits = store.limits('ship');
  const stacks = stacksFor(cargo.items).length;
  const minerals = RESOURCE_IDS.reduce((sum, id) => sum + (cargo.items[id] ?? 0), 0);
  return { boxes: cargo.boxes, stacks, slots: cargo.boxes * 8,
    minerals, mineralLimit: limits.resources,
    supplies: itemMass(cargo.items) - minerals, supplyLimit: limits.supplies };
}

/** A usable procedural fallback plus the live cargo screen shared by both models. */
export function createNomadCabin() {
  const group = new THREE.Group();group.name = 'Nomad utility cabin systems';
  const fallback = new THREE.Group();fallback.name = 'Utility cabin fallback';group.add(fallback);
  const dark = new THREE.MeshStandardMaterial({ color: 0x273732, roughness: .72, metalness: .18 });
  const metal = new THREE.MeshStandardMaterial({ color: 0x8a9691, roughness: .4, metalness: .68 });
  const fabric = new THREE.MeshStandardMaterial({ color: 0x6c8174, roughness: .98 });
  const shell = new THREE.MeshStandardMaterial({ color: 0xc6d1c8, roughness: .62, metalness: .25 });
  function box(name, position, size, material, parent = fallback) {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(...size, 1, .025), material);
    mesh.name = name;mesh.position.set(...position);mesh.castShadow = true;mesh.receiveShadow = true;parent.add(mesh);return mesh;
  }
  const b = SHIP_LAYOUT.berth, r = SHIP_LAYOUT.cargoRack;
  box('Berth plinth', [-1.165, 1.35, .275], [.93, .70, 2.25], dark);
  box('Berth mattress', [-1.165, 1.72, .275], [.86, .16, 2.15], fabric);
  box('Berth pillow', [-1.165, 1.82, 1.07], [.70, .12, .35], shell);
  box('Cargo rack back', [-1.60, 1.83, 2.85], [.09, 1.63, 1.60], dark);
  for (const y of [1.08, 1.79, 2.50]) box('Cargo shelf', [-1.25, y, 2.85], [.80, .065, 1.60], metal);
  let boxes = Array.from({ length: 8 }, (_, i) => box(`CargoBox_${i + 1}`, [-1.23, 1.42 + Math.floor(i / 4) * .71, 2.26 + (i % 4) * .39], [.60, .55, .34], shell));
  box('Cargo readout housing', [-.96, 2.91, 2.83], [.14, .51, 1.12], dark);
  const canvas = document.createElement('canvas');canvas.width = 512;canvas.height = 256;
  const context = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;texture.generateMipmaps = false;
  const material = new THREE.MeshBasicMaterial({ map: texture, toneMapped: false });material.userData.unweathered = true;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.04, .46), material);
  screen.name = 'Live cargo manifest';screen.position.set(-.879, 2.91, 2.83);screen.rotation.y = Math.PI / 2;group.add(screen);
  let state = { boxes: 0, stacks: 0, slots: 0, minerals: 0, mineralLimit: 0, supplies: 0, supplyLimit: 0 }, lastKey = '';
  function update(nav, store) {
    if (store) state = nomadCargoState(store);
    boxes.forEach((box, i) => { box.visible = i < state.boxes; });
    const key = JSON.stringify(state);
    if (key === lastKey) return;lastKey = key;
    context.fillStyle = '#14251e';context.fillRect(0, 0, 512, 256);
    context.fillStyle = '#b6efd1';context.font = '20px monospace';context.fillText('NOMAD / AFT CARGO', 24, 35);
    context.font = 'bold 48px monospace';context.fillText(`${String(state.boxes).padStart(2, '0')} / 08`, 24, 94);
    context.font = '18px monospace';context.fillText('BOXES INSTALLED', 270, 87);
    context.fillStyle = '#92a99b';context.fillText(`${state.stacks} / ${state.slots} STACK SLOTS`, 24, 136);
    context.fillStyle = '#b6efd1';context.fillText(`SUPPLIES  ${state.supplies.toFixed(1)} / ${state.supplyLimit} kg`, 24, 175);
    context.fillText(`MINERALS  ${state.minerals.toFixed(1)} / ${state.mineralLimit} kg`, 24, 207);
    context.fillStyle = '#92a99b';context.font = '15px monospace';context.fillText('INTERACT BESIDE RACK TO TRANSFER', 24, 237);
    texture.needsUpdate = true;group.userData.cargo = { ...state };
  }
  group.adoptModel = model => {
    const cabin = model.getObjectByName('NomadCabin');
    const authoredBoxes = Array.from({ length: 8 }, (_, i) => model.getObjectByName(`CargoBox_${i + 1}`));
    if (!cabin || authoredBoxes.some(box => !box)) return false;
    fallback.visible = false;boxes = authoredBoxes;lastKey = '';
    update();return true;
  };
  group.update = update;
  group.userData.layout = { berth: b, rack: r };
  update();return group;
}
