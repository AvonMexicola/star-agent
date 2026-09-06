import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { MoonStones, scatterMoonStones, stoneGeometry, STONE_LAYERS } from '../src/moon-stones.js';
import { MOON_RADIUS, MOON_POSITION, MOON_LANDING_DIRECTION, moonSurface } from '../src/moon-world.js';
const center=new THREE.Vector3(...MOON_POSITION),up=new THREE.Vector3(...MOON_LANDING_DIRECTION);
const foot=up.clone().multiplyScalar(MOON_RADIUS+moonSurface(...up.toArray()).height).add(center);
const eye=foot.clone().addScaledVector(up,1.75);

test('lunar stone cells cover poles and the longitude seam without duplicate cells',()=>{
 const sample=direction=>{const cells=new Map();scatterMoonStones(direction,20,.55,51,(x,y,z,col,row)=>{
  const key=`${col}/${row}`;assert.ok(!cells.has(key));cells.set(key,[x,y,z]);assert.ok(Math.abs(Math.hypot(x,y,z)-1)<1e-10);
 });return cells;};
 for(const direction of [new THREE.Vector3(0,1,0),new THREE.Vector3(0,-1,0),new THREE.Vector3(0,0,-1)]){
  const cells=sample(direction);assert.ok(cells.size>3500&&cells.size<4800,`complete cap: ${cells.size}`);
 }
 const a=sample(new THREE.Vector3(1e-7,0,-1).normalize()),b=sample(new THREE.Vector3(-1e-7,0,-1).normalize());
 let shared=0;for(const [key,value] of a)if(b.has(key)){assert.deepEqual(value,b.get(key));shared++;}assert.ok(shared>a.size*.98);
});
test('stone variants have distinct profiles and stay small enough to step over',()=>{
 const heights=[];
 for(let variant=0;variant<3;variant++){
  const geometry=stoneGeometry(variant);assert.equal(geometry.boundingBox.min.y,0);
  assert.ok([...geometry.attributes.position.array,...geometry.attributes.normal.array].every(Number.isFinite));
  heights.push(geometry.boundingBox.max.y);assert.ok(geometry.boundingBox.max.y*.87<.4);geometry.dispose();
 }
 assert.ok(heights[1]<heights[0]*.7);
 for(const layer of STONE_LAYERS)assert.ok(layer.buffer>=layer.range+layer.movement);
});
test('lunar stones retain canonical anchors and identity when camera and render origin move',()=>{
 const grain=new THREE.DataTexture(new Uint8Array([128,128,128,255]),1,1);grain.needsUpdate=true;
 const stones=new MoonStones(new THREE.Scene(),grain);stones.update(eye,eye);
 assert.ok(stones.stats.pebbles>1500);assert.ok(stones.stats.rocks>500);
 const layer=stones.layers[0],records=new Map(layer.cache),matrix=new THREE.Matrix4();
 for(let variant=0;variant<3;variant++){
  const matching=[...records.values()].filter(r=>r.variant===variant),mesh=layer.meshes[variant];
  for(let i=0;i<matching.length;i+=137){
   mesh.getMatrixAt(i,matrix);const point=new THREE.Vector3().setFromMatrixPosition(matrix).add(layer.origin),r=matching[i],dir=point.clone().normalize();
   assert.ok(Math.abs(point.length()-MOON_RADIUS-moonSurface(...dir.toArray()).height+r.size*.045)<.00002,'anchor within 20 micrometres');
  }
 }
 const moved=eye.clone().addScaledVector(new THREE.Vector3(0,1,0).cross(up).normalize(),3),rebuilds=stones.stats.rebuilds;
 stones.update(moved,moved);assert.equal(stones.stats.rebuilds,rebuilds+1,'moving three metres only rebuilds pebbles');
 let shared=0;for(const [key,value] of layer.cache)if(records.has(key)){assert.deepEqual(value,records.get(key));shared++;}assert.ok(shared>records.size*.7);
 const matrices=layer.meshes.map(m=>m.instanceMatrix.array.slice());
 stones.update(moved,new THREE.Vector3(1e9,-2e9,3e9));
 layer.meshes.forEach((mesh,i)=>assert.deepEqual(mesh.instanceMatrix.array,matrices[i]));
 const counts=[stones.stats.pebbles,stones.stats.rocks];stones.update(moved,moved,foot);assert.ok(stones.stats.pebbles<counts[0]);assert.ok(stones.stats.rocks<counts[1]);
 stones.update(moved,moved,null);assert.equal(stones.stats.pebbles,counts[0]);
 stones.update(new THREE.Vector3(0,2000000,0),eye);assert.equal(stones.stats.visible,false);assert.ok(stones.layers.every(l=>!l.group.visible));
 stones.dispose();grain.dispose();
});
