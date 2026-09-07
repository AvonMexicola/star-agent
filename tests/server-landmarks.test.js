import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3} from 'three';
import {createWorld} from '../server/world.js';
import {findDestinations} from '../src/world.js';
import {bodySurfacePoint,AEON} from '../src/celestial.js';
import {nearbyLandmarks} from '../src/landmark-distribution.js';

test('authoritative world installs landmark navigation and blocks shots with the actual roof',async()=>{
  const world=await createWorld(),nav=world.createNavigation(0,()=>{});
  const origin=bodySurfacePoint(new Vector3(...findDestinations().forest),AEON,2);
  const d=nearbyLandmarks(origin,4200).find(d=>d.variant%6===2);
  const point=p=>new Vector3(...p).multiplyScalar(d.scale).applyQuaternion(d.quaternion).add(d.position);
  const a=point([0,25,-110]),b=point([0,25,110]);
  assert.ok(nav.surfaceObstacles);assert.equal(nav.surfaceObstacles.constrainWalker(a,b).hit,false);
  const blocked=nav.surfaceObstacles.constrainWalker(point([0,51,-110]),point([0,51,110]));assert.equal(blocked.hit,true);
  const distance=world.occludes(point([0,25,0]),d.direction,100);
  assert.ok(distance>5&&distance<40,'a roof hit is nearer than a target above it');
  assert.equal(world.occludes(a,b.clone().sub(a).normalize(),a.distanceTo(b)),null,'the open shelter does not block a ray');
});
