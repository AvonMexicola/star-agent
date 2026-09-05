import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { MOON_RADIUS, MOON_POSITION, MOON_DISTANCE, MOON_CLEARANCE, CRATERS, moonSurface, moonAltitude, moonApproach, constrainMoonStep } from '../src/moon-world.js';
import { RADIUS, SUN_DISTANCE } from '../src/world.js';

const center=new Vector3(...MOON_POSITION),perimeter=MOON_RADIUS+MOON_CLEARANCE;
test('lunar scale, approach and relief stay clear of Aeon and the flyby perimeter',()=>{
  assert.ok(Math.abs(center.length()-MOON_DISTANCE)<1e-8);
  assert.ok(MOON_DISTANCE-MOON_RADIUS>RADIUS*10);
  assert.ok(moonAltitude(moonApproach())>MOON_RADIUS*2);
  for(let i=0;i<2000;i++){
    const y=1-2*(i+.5)/2000,angle=i*Math.PI*(3-Math.sqrt(5)),r=Math.sqrt(1-y*y),d=[r*Math.cos(angle),y,r*Math.sin(angle)];
    const sample=moonSurface(...d);
    assert.deepEqual(sample,moonSurface(...d));
    assert.ok(sample.height<MOON_CLEARANCE&&sample.height>-MOON_RADIUS*.1);
    assert.ok(sample.albedo>=.065&&sample.albedo<=.27);
  }
  assert.equal(CRATERS.length,96);
});

test('lunar relief is continuous at the longitude seam and poles',()=>{
  for(const y of [-1,-.999,-.5,0,.5,.999,1]){
    const x=-Math.sqrt(1-y*y),a=moonSurface(x,y,1e-10),b=moonSurface(x,y,-1e-10);
    assert.ok(Math.abs(a.height-b.height)<.001);
    assert.ok(Math.abs(a.albedo-b.albedo)<1e-5);
  }
});

test('swept lunar collision stops fast crossings with both endpoints outside',()=>{
  const previous=center.clone().add(new Vector3(0,0,perimeter*4));
  const proposed=center.clone().add(new Vector3(0,0,-perimeter*4));
  const start=previous.clone(),end=proposed.clone(),hit=constrainMoonStep(previous,proposed);
  assert.equal(hit.hit,true);assert.ok(hit.point.z>center.z);
  assert.ok(Math.abs(hit.point.distanceTo(center)-perimeter-.01)<1e-7);
  assert.ok(previous.equals(start)&&proposed.equals(end));
});

test('flyby perimeter allows tangential and outward travel and resolves invalid starts',()=>{
  const point=center.clone().add(new Vector3(0,0,perimeter+1));
  assert.equal(constrainMoonStep(point,point.clone()).hit,false);
  assert.equal(constrainMoonStep(point,point.clone().add(new Vector3(0,0,100))).hit,false);
  assert.equal(constrainMoonStep(point,point.clone().add(new Vector3(100,0,0))).hit,false);
  const hit=constrainMoonStep(center,center.clone().add(new Vector3(1,0,0)));
  assert.ok(Number.isFinite(hit.point.length()));
  assert.ok(Math.abs(hit.point.distanceTo(center)-perimeter)<1e-7);
  const far=new Vector3(0,0,SUN_DISTANCE);
  assert.equal(constrainMoonStep(far,far.clone().add(new Vector3(0,1,0))).hit,false);
});

test('crater centres are depressed relative to the raised rims',()=>{
  const crater=CRATERS[0],normal=new Vector3(...crater.direction),tangent=new Vector3().crossVectors(normal,new Vector3(0,1,0)).normalize();
  const rim=normal.clone().multiplyScalar(Math.cos(crater.radius)).addScaledVector(tangent,Math.sin(crater.radius));
  assert.ok(moonSurface(...rim.toArray()).height>moonSurface(...normal.toArray()).height+crater.depth*.5);
});
