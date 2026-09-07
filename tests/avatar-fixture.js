import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { AvatarGLB } from '../blender/avatar-glb.mjs';
import { Character } from '../src/character.js';
import { Equipment } from '../src/equipment.js';

globalThis.self ??= globalThis;
globalThis.ProgressEvent ??= class { constructor(type, init) { Object.assign(this, { type }, init); } };
export async function loadAsset(url) {
  const glb = new AvatarGLB(new URL(`../public${url}`, import.meta.url));
  const bytes = glb.bytes({ materials: false });
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length), '');
}
export async function avatarFixture() {
  const scene = new THREE.Scene();
  const loader = { load(url, loaded, progress, failed) { loadAsset(url).then(loaded, failed); } };
  const character = new Character(scene, { url: '/models/props/player-expedition.glb', modelYaw: Math.PI, loader, placeholder: false });
  await character.readyPromise;
  const sockets = JSON.parse(readFileSync(new URL('../public/models/props/equipment-sockets.json', import.meta.url)));
  const equipment = new Equipment(character, scene, { rig: 'player-expedition', sockets, loader });
  await equipment.readyPromise;
  return { scene, character, equipment };
}
