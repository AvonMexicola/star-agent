import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {raycastFauna,parkedShipHit,faunaOrientation} from '../src/fauna/fauna-target.js';
import {createWeaponTarget} from '../src/effects/weapon-target.js';
import {AEON} from '../src/celestial.js';
const v=(...a)=>new THREE.Vector3(...a),origin=v(25e9,2e9,-3e9);
const dims={pyrebear:{width:2,height:2,length:3}};
const entity=(id,z,health=240)=>({id,species:'pyrebear',position:origin.clone().add(v(0,0,z)).toArray(),normal:[0,1,0],forward:[0,0,-1],health});
test('hurt volumes resolve nearest living torso at stellar coordinates and exclude misses',()=>{
 const near=entity('near',-8),far=entity('far',-15),start=origin.clone().add(v(0,1,0));
 const hit=raycastFauna([far,near],start,v(0,0,-1),30,dims);
 assert.equal(hit.id,'near');assert.ok(Math.abs(hit.distance-6.71)<1e-6);assert.ok(hit.normal.z>.99);
 assert.equal(raycastFauna([near],start,v(1,0,0),30,dims),null);
 assert.equal(raycastFauna([near],start,v(0,0,-1),5,dims),null);
 assert.equal(raycastFauna([entity('dead',-3,0),far],start,v(0,0,-1),30,dims).id,'far');
});
test('hurt volume follows slope and heading without losing metre-scale coordinates',()=>{
 const e=entity('side',-8);e.normal=[1,0,0];e.forward=[0,0,-1];const q=faunaOrientation(e);
 assert.ok(v(0,1,0).applyQuaternion(q).distanceTo(v(1,0,0))<1e-10);
 const hit=raycastFauna([e],origin.clone().add(v(1,0,0)),v(0,0,-1),30,dims);assert.equal(hit.id,'side');
});
test('existing world blockers win before fauna; aiming never applies damage',()=>{
 let damage=0;const start=origin.clone().add(v(0,1,0)),e=entity('bear',-8);
 const nav={body:AEON,normal:v(0,1,0),faunaRaycast:(s,d,r)=>raycastFauna([e],s,d,r,dims),onFaunaWeaponHit:()=>damage++};
 const target=createWeaponTarget({nav,mining:{raycast:()=>null}});
 assert.equal(target(start,v(0,0,-1),origin,20).kind,'fauna');
 nav.buildingRaycast=()=>({distance:3,point:start.clone().add(v(0,0,-3))});
 assert.equal(target(start,v(0,0,-1),origin,20).distance,3);assert.equal(damage,0);
 nav.buildingRaycast=()=>null;nav.parkedShipRaycast=()=>({distance:2,point:start.clone().add(v(0,0,-2))});
 assert.equal(target(start,v(0,0,-1),origin,20).distance,2);
});
test('parked ship blocker uses navigation hull and supports an expanded fauna clearance',()=>{
 const nav={shipPosition:origin,shipOrientation:new THREE.Quaternion(),layout:{flightBounds:{min:[-2,0,-3],max:[2,3,3]}}};
 const start=origin.clone().add(v(0,1,10));
 assert.equal(parkedShipHit(nav,start,v(0,0,-1),20).distance,7);
 assert.equal(parkedShipHit(nav,start,v(0,0,-1),20,1).distance,6);
 assert.equal(parkedShipHit(nav,start,v(1,0,0),20),null);
});
