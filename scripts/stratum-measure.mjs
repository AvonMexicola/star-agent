import fs from 'node:fs';
import crypto from 'node:crypto';
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { STRATUM_LAYOUT as L } from '../src/stratum-layout.js';
import { createStratumSystems } from '../src/stratum-systems.js';

const directory=new URL('../assets/stratum/',import.meta.url);
const bytes=fs.readFileSync(new URL('../public/models/stratum.glb',import.meta.url));
const loader=new GLTFLoader();
loader.register(parser=>{parser.loadTextureImage=async index=>{const texture=new THREE.Texture();parser.associations.set(texture,{textures:index});return texture;};return{name:'StratumCpuMeasurements'};});
const {scene:model}=await loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
const rig=createStratumSystems(model);
const fromSpec=p=>new THREE.Box3(new THREE.Vector3(...p.min),new THREE.Vector3(...p.max));
function actualBounds(root){
  root.updateMatrixWorld(true);const b=new THREE.Box3();
  root.traverse(o=>{if(!o.isMesh)return;const p=o.geometry.attributes.position;for(let i=0;i<p.count;i++)b.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld));});return b;
}
const authored=JSON.parse(fs.readFileSync(new URL('authored-bounds.json',directory))).parts;
const parts=authored.map(p=>({id:p.id,box:fromSpec(p),source:'evaluated static source meshes'}));
const dynamic=L.gear.legs.map(p=>({id:p.node,node:p.node,box:new THREE.Box3(),source:'13 sampled actual gear poses, 0..1'}));
dynamic.push(...L.mining.booms.map(p=>({id:p.node,node:p.node,box:new THREE.Box3(),source:'169 sampled actual yaw/pitch combinations including limits'})));
const parked=actualBounds(model);
for(let step=0;step<=12;step++){
  rig.applyPose({gearProgress:step/12});
  for(const p of dynamic.filter(p=>p.id.startsWith('Gear_')))p.box.union(actualBounds(model.getObjectByName(p.node)));
}
for(let y=0;y<=12;y++)for(let p=0;p<=12;p++){
  const yaw=-L.mining.yawLimit+2*L.mining.yawLimit*y/12,pitch=L.mining.pitchMin+(L.mining.pitchMax-L.mining.pitchMin)*p/12;
  rig.applyPose({aim:[{yaw,pitch},{yaw,pitch}]});
  for(const part of dynamic.filter(p=>p.id.startsWith('MiningBoom')))part.box.union(actualBounds(model.getObjectByName(part.node)));
}
rig.applyPose({gearProgress:1,rampProgress:0,aim:[{yaw:0,pitch:0},{yaw:0,pitch:0}]});
parts.push(...dynamic,{id:'access-stowed',node:L.ramp.hingeNode,box:actualBounds(model.getObjectByName(L.ramp.hingeNode)),source:'actual closed nested ramp and hatch'});
// 2cm guard covers interpolation between angular samples. Floor contacts are
// clamped to the exact datum, so no invented negative-Y envelope blocks takeoff.
const record={assetSha256:crypto.createHash('sha256').update(bytes).digest('hex'),units:'metres',
  convention:'Closed access only; conservative all-gear/all-boom envelope. Individual ground-reaching gear volumes, not a full-width floor box.',
  paddingMetres:.02,parts:parts.map(({id,node,box,source})=>{
    box.expandByScalar(.02);box.min.y=Math.max(0,box.min.y);
    return{id,...(node?{node}:{}),min:box.min.toArray(),max:box.max.toArray(),source};
  })};
fs.writeFileSync(new URL('flight-parts.json',directory),JSON.stringify(record,null,2)+'\n');
rig.applyPose({rampProgress:1});const deployed=actualBounds(model);
const measurements={assetSha256:record.assetSha256,parkedBounds:{min:parked.min.toArray(),max:parked.max.toArray()},
  deployedBounds:{min:deployed.min.toArray(),max:deployed.max.toArray()},closedEnvelope:L.flightBounds,
  neutralMuzzles:L.mining.booms.map((_,i)=>{const p=rig.muzzle(i);return{name:p.name,position:p.position.toArray(),direction:p.direction.toArray()};}),
  nozzles:L.nozzles.map((_,i)=>{const p=rig.nozzle(i);return{name:p.name,position:p.position.toArray(),direction:p.direction.toArray()};}),
  gearSamples:13,boomSamples:169,flightPartCount:record.parts.length,
  precisionProbeMetres:25_000_000_000,scope:'CPU real-binary geometry and normalized rigs. No renderer/gameplay/performance acceptance.'};
fs.writeFileSync(new URL('measurements.json',directory),JSON.stringify(measurements,null,2)+'\n');
console.log(JSON.stringify(measurements,null,2));
