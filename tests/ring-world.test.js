import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Scene} from 'three';
import {RING_POPULATION,RING_RADIUS,RING_WIDTH,RING_THICKNESS,RING_NORMAL,ASTEROID_FAMILIES,asteroidDescriptor,nearbyAsteroids,asteroidField,ringRock,ringCellAt,ringPathIntervals} from '../src/ring-world.js';
import {MOON_POSITION} from '../src/moon-world.js';
import {MoonRings,asteroidGeometry} from '../src/moon-rings.js';
import {createDensity,meshVolume,carve} from '../src/mining/volume.js';

test('twenty million stable descriptors fill a 20 km by 2 km ring without materializing the population',()=>{
  assert.equal(RING_POPULATION,20971520);assert.equal(RING_WIDTH,20000);
  const normal=new Vector3(...RING_NORMAL),types=new Set();
  for(let i=0;i<2000;i++){
    const r=asteroidDescriptor((i*104729)%RING_POPULATION),p=new Vector3(...r.position),height=p.dot(normal),radius=p.clone().addScaledVector(normal,-height).length();
    assert.deepEqual(r,asteroidDescriptor(r.id));assert.ok(Math.abs(height)<=RING_THICKNESS/2+.001);assert.ok(Math.abs(radius-RING_RADIUS)<=RING_WIDTH/2+.001);types.add(r.family);
  }
  assert.equal(types.size,ASTEROID_FAMILIES.length);assert.throws(()=>asteroidDescriptor(-1));
});
test('cell streaming contains the approached rock, remains bounded and survives rebasing',()=>{
  const descriptor=ringRock(5),point=new Vector3(...MOON_POSITION).add(new Vector3(...descriptor.position));
  const near=nearbyAsteroids(point,2);assert.ok(near.some(r=>r.id===descriptor.id));assert.ok(near.length<=3200);assert.equal(new Set(near.map(r=>r.id)).size,near.length);
  const scene=new Scene(),rings=new MoonRings(scene,48);rings.update(point);const before=rings.local;
  rings.update(point.clone().add(new Vector3(.001,.001,.001)));assert.equal(rings.local,before);
  rings.hiddenIds.add(descriptor.id);rings.update(point);assert.equal(rings.state.rendered,48-rings.descriptors.filter(r=>rings.localIds.has(r.id)).length+near.length-1);
  rings.update(new Vector3(0,0,0));assert.equal(rings.local.length,0);assert.ok(rings.state.rendered<=48);rings.dispose();assert.equal(scene.children.length,0);
});
test('every procedural rock family has a finite shared silhouette and editable interior',()=>{
  const signatures=[];
  for(let family=0;family<ASTEROID_FAMILIES.length;family++){
    const geometry=asteroidGeometry(family,1);assert.ok(geometry.attributes.position.array.every(Number.isFinite));
    const field=createDensity((x,y,z)=>asteroidField(x,y,z,family));assert.ok(field.some(v=>v<0));assert.ok(field.some(v=>v>0));
    const cut=carve(field,[0,0,1.2],.03);assert.ok(cut?.removed>0);assert.ok(cut.removed<=.030001);const mesh=meshVolume(cut.field);assert.ok(mesh.positions.every(Number.isFinite));
    signatures.push(field.reduce((sum,v)=>sum+v,0));geometry.dispose();
  }
  assert.equal(new Set(signatures).size,ASTEROID_FAMILIES.length);
});


test('finite ring segment intervals detect full high-speed crossings and reject paths outside the belt',()=>{
  const p=new Vector3(...MOON_POSITION).add(new Vector3(...ringRock(5).position)),normal=new Vector3(...RING_NORMAL);
  const intervals=ringPathIntervals(p.clone().addScaledVector(normal,20000),p.clone().addScaledVector(normal,-20000));
  assert.equal(intervals.length,1);assert.ok(intervals[0][0]>.4&&intervals[0][1]<.6);
  assert.deepEqual(ringPathIntervals(p.clone().addScaledVector(normal,20000),p.clone().addScaledVector(normal,10000)),[]);
  assert.deepEqual(ringPathIntervals(new Vector3(),new Vector3(1,2,3)),[]);
});
