import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Meadow, meadowGeometry, flowerGeometry, meadowHabitat, contactStrength, MEADOW_PRELOAD, MEADOW_RANGE, MEADOW_REBUILD } from '../src/meadow.js';
import { Vegetation } from '../src/vegetation.js';
import { RADIUS, terrainHeight, latLonDirection } from '../src/world.js';

function fixture(){
 const vegetation={scatter:Vegetation.prototype.scatter,scatterRecords:Vegetation.prototype.scatterRecords,isExcluded:()=>false,exclusionPosition:null};
 const meadow=new Meadow(new THREE.Scene(),vegetation);
 const up=new THREE.Vector3(...latLonDirection(15.74,22.44));
 const foot=up.clone().multiplyScalar(RADIUS+terrainHeight(...up.toArray()));
 return {meadow,up,foot,eye:foot.clone().addScaledVector(up,1.75)};
}
test('meadow ribbons and flowers have pinned roots and finite geometry',()=>{
 for(const geometry of [meadowGeometry(),flowerGeometry()]){
  geometry.computeBoundingBox();assert.equal(geometry.boundingBox.min.y,0);
  assert.ok(geometry.boundingBox.max.y<=1.04);
  assert.ok([...geometry.attributes.position.array,...geometry.attributes.normal.array].every(Number.isFinite));geometry.dispose();
 }
 assert.ok(MEADOW_PRELOAD>=MEADOW_RANGE+MEADOW_REBUILD);
 assert.equal(contactStrength(0),1);assert.equal(contactStrength(2.4),0);
 assert.ok(contactStrength(1)>contactStrength(2));
 for(const [y,h] of [[.9,500],[0,-5],[0,2300],[0,5]])assert.equal(meadowHabitat(y,h),false);
});
test('dense meadow roots match canonical terrain and shared cells survive a rebase',()=>{
 const {meadow,up,foot,eye}=fixture();meadow.update(eye,eye,0,true);
 assert.ok(meadow.grass.count>7000);assert.ok(meadow.flowers.count>100);
 const first=new Map(meadow.cache),oldOrigin=meadow.origin.clone(),matrix=new THREE.Matrix4();
 for(let i=0;i<meadow.grass.count;i+=251){
  meadow.grass.getMatrixAt(i,matrix);const p=new THREE.Vector3().setFromMatrixPosition(matrix).add(oldOrigin),d=p.clone().normalize();
  assert.ok(Math.abs(p.length()-RADIUS-terrainHeight(...d.toArray())+.018)<.002,'root within 2 mm of canonical terrain');
 }
 const east=new THREE.Vector3(0,1,0).cross(up).normalize();
 const moved=eye.clone().addScaledVector(east,2);meadow.update(moved,moved,1,true);
 let shared=0;for(const [key,value]of meadow.cache)if(first.has(key)){assert.deepEqual(value,first.get(key));shared++;}
 assert.ok(shared>first.size*.7);assert.ok(meadow.stats.contacts>=2);
 assert.ok(meadow.uniforms.meadowContacts.value.some(c=>c.w>0));
 meadow.update(moved,moved,4,false);assert.equal(meadow.stats.contacts,0);
 meadow.update(foot.clone().addScaledVector(up,11),eye,5,false);assert.equal(meadow.group.visible,false);
 meadow.dispose();
});
test('landing exclusion suppresses plants and restores them when the ship leaves',()=>{
 const {meadow,eye}=fixture();meadow.update(eye,eye,0);const count=meadow.grass.count;
 meadow.vegetation.exclusionPosition=eye;meadow.vegetation.isExcluded=()=>true;meadow.update(eye,eye,1);
 assert.equal(meadow.grass.count,0);assert.equal(meadow.flowers.count,0);
 meadow.vegetation.exclusionPosition=null;meadow.vegetation.isExcluded=()=>false;meadow.update(eye,eye,2);
 assert.equal(meadow.grass.count,count);meadow.dispose();
});

test('engine telemetry distinguishes assisted hovering from inertial coasting and boost',async()=>{
 const {step}=await import('../src/flight-model.js');
 const state={position:new THREE.Vector3(0,RADIUS+5,0),velocity:new THREE.Vector3(),orientation:new THREE.Quaternion()};
 const env={gravity:new THREE.Vector3(0,-9.81,0),density:1.2};
 const hover=step(state,{assist:true},env,.02);assert.ok(Math.abs(hover.engineAcceleration.y-9.81)<1e-9);
 const coast=step(state,{assist:false},env,.02);assert.equal(coast.engineAcceleration.length(),0);
 const thrust=step(state,{assist:false,translation:new THREE.Vector3(0,1,0)},env,.02);
 const boost=step(state,{assist:false,translation:new THREE.Vector3(0,1,0),boost:true},env,.02);
 assert.ok(Math.abs(boost.engineAcceleration.y/thrust.engineAcceleration.y-3)<1e-9);
 assert.equal(state.velocity.length(),0);
});

test('downwash follows exhaust direction onto canonical ground and rejects inactive engines',async()=>{
 const {flightDownwash}=await import('../src/meadow.js');
 const {meadow,up,foot}=fixture();
 const nav={position:foot.clone().addScaledVector(up,6),orientation:new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0,1,0),up),
  mode:'flight',enabled:true,body:{airless:false},engineAcceleration:up.clone().multiplyScalar(9.81)};
 const wash=flightDownwash(nav);assert.ok(wash&&wash.strength>0&&wash.radius>2.5);
 const n=wash.point.clone().normalize();assert.ok(Math.abs(wash.point.length()-RADIUS-terrainHeight(...n.toArray()))<1e-7);
 const side=new THREE.Vector3(0,1,0).cross(up).normalize();
 nav.engineAcceleration.addScaledVector(side,5);
 const angled=flightDownwash(nav);assert.ok(angled.point.clone().sub(wash.point).dot(side)<-1,'tilting exhaust moves the footprint');
 nav.engineAcceleration.set(0,0,0);assert.equal(flightDownwash(nav),null);
 nav.engineAcceleration.copy(up).multiplyScalar(-10);assert.equal(flightDownwash(nav),null);
 nav.engineAcceleration.copy(up).multiplyScalar(10);nav.mode='landed';assert.equal(flightDownwash(nav),null);
 nav.mode='flight';nav.body.airless=true;assert.equal(flightDownwash(nav),null);
 nav.body.airless=false;nav.position.addScaledVector(up,40);assert.equal(flightDownwash(nav),null);
 meadow.dispose();
});

test('thruster bending ramps up and recovers after the engines stop',()=>{
 const {meadow,eye,foot}=fixture(),wash={point:foot,radius:5,strength:1};
 meadow.update(eye,eye,.2,false,wash);assert.ok(meadow.stats.downwash>.7);
 for(let i=2;i<=15;i++)meadow.update(eye,eye,i*.2,false,null);
 assert.ok(meadow.stats.downwash<.001);meadow.dispose();
});
