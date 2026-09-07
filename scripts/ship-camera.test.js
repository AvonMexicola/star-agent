import test from 'node:test';
import assert from 'node:assert/strict';
import {Quaternion,Vector3,Euler,Group,Mesh,BoxGeometry,MeshBasicMaterial,DoubleSide} from 'three';
import {ShipCamera,clipTerrainCamera,isShipCameraKey,clipShipCamera,groundRadiusAt,playerUp} from '../src/ship-camera.js';
import {SELENE,bodySurfacePoint} from '../src/celestial.js';
import {SHIP_LAYOUT} from '../src/boarding.js';
const near=(a,b,eps=1e-8)=>assert.ok(Math.abs(a-b)<eps,`${a} != ${b}`);
const nav=()=>({position:new Vector3(0,1692750,0),orientation:new Quaternion(),mode:'flight',normal:new Vector3(0,1,0),velocity:new Vector3(120,30,-50),shipPosition:null});
const noGround={surfaceRadius:()=>0};

test('on-foot camera follows hangar gravity and EVA follows suit attitude',()=>{
  const n=nav(),up=new Vector3(1,1,0).normalize();
  n.mode='walk';n.stationPhysics={up};
  assert.deepEqual(playerUp(n),up);
  n.mode='eva';n.orientation.setFromAxisAngle(new Vector3(0,0,1),Math.PI/2);
  assert.ok(playerUp(n).distanceTo(new Vector3(-1,0,0))<1e-8);
});

test('EVA shares the on-foot camera toggle while respecting the complete suit attitude',()=>{
  const body=nav();body.mode='eva';body.position.set(25e9,1e9,-8e9);
  body.orientation.setFromEuler(new Euler(.6,.4,.8));
  const before=structuredClone(body),view=new ShipCamera();
  view.toggle('eva');view.update(body,noGround);
  assert.equal(view.active,true);assert.equal(view.playerExternal,true);
  near(view.orientation.length(),1);assert.deepEqual(structuredClone(body),before);
  view.toggle('eva');view.update(body,noGround);assert.deepEqual(view.position,body.position);
  near(view.orientation.angleTo(body.orientation),0);
});

test('4 toggles an above-and-behind view and never changes the navigation pose or momentum',()=>{
  const body=nav(),saved=structuredClone(body),view=new ShipCamera();
  view.update(body,noGround);assert.deepEqual(view.position,body.position);assert.equal(view.active,false);
  assert.equal(view.toggle(body.mode),true);view.update(body,noGround);assert.equal(view.active,true);
  const local=view.position.clone().sub(body.position);
  near(local.x,0);near(local.y,7-SHIP_LAYOUT.seatEye[1]);near(local.z,24-SHIP_LAYOUT.seatEye[2]);
  assert.ok(new Vector3(0,0,-1).applyQuaternion(view.orientation).z<0);
  assert.deepEqual(structuredClone(body),saved);
  view.toggle(body.mode);view.update(body,noGround);assert.equal(view.engaged,true);assert.deepEqual(view.position,body.position);
  near(view.orientation.angleTo(body.orientation),0);
});

test('chase offset follows ship rotation with centimetre precision at astronomical positions',()=>{
  const body=nav();body.position.set(25e9,1592750,-25e9);
  body.orientation.setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
  const view=new ShipCamera();view.toggle('flight');view.update(body,noGround);
  const local=view.position.clone().sub(body.position).applyQuaternion(body.orientation.clone().invert());
  near(local.x,0,.00001);near(local.y,4.45,.00001);near(local.z,26.8,.00001);
  near(view.orientation.length(),1);
});

test('landed inspection uses ship attitude; leaving the seat returns to first person',()=>{
  const body=nav();body.mode='landed';body.shipPosition=new Vector3();
  body.shipOrientation=new Quaternion().setFromAxisAngle(new Vector3(0,1,0),Math.PI/2);
  const view=new ShipCamera();assert.equal(view.toggle('landed'),true);view.update(body,noGround);
  assert.ok(view.position.x>body.position.x+20);
  body.mode='walk';view.update(body,noGround);
  assert.equal(view.external,true);assert.equal(view.active,false);assert.deepEqual(view.position,body.position);
  assert.equal(view.toggle('walk'),true);view.update(body,noGround);
  assert.equal(view.active,true);assert.equal(view.playerExternal,true);
  view.toggle('walk');assert.equal(view.external,true);
  body.mode='landed';view.update(body,noGround);assert.equal(view.active,true);
});

test('a close station wall falls back to cockpit and a distant wall retracts the boom',()=>{
  const body=nav(),view=new ShipCamera();view.toggle('flight');
  view.update(body,{...noGround,clipStation:(start,end)=>start.clone().lerp(end,.15)});
  assert.equal(view.active,false);assert.equal(view.obstructed,true);assert.equal(view.external,true);
  assert.deepEqual(view.position,body.position);
  view.update(body,{...noGround,clipStation:(start,end)=>start.clone().lerp(end,.75)});
  assert.equal(view.active,true);assert.equal(view.obstructed,true);
  assert.ok(view.position.distanceTo(body.position)<22);
  view.update(body,noGround);assert.equal(view.active,true);assert.equal(view.obstructed,false);
});

test('terrain clipping catches an intervening ridge with a clear endpoint and preserves clearance',()=>{
  const start=new Vector3(0,100,0),end=new Vector3(0,100,20);
  const radius=point=>point.z>=8&&point.z<=12?110:90;
  const before=structuredClone({start,end});
  const clipped=clipTerrainCamera(start,end,radius);
  assert.ok(clipped.z<8&&clipped.z>7.9);assert.deepEqual(structuredClone({start,end}),before);
  const sphere=clipTerrainCamera(new Vector3(0,101,0),new Vector3(0,90,5),()=>100);
  assert.ok(sphere.length()>100.45);
});

test('camera shortcut respects held keys, typing, modifiers, editable content and dialogs',()=>{
  for(const code of ['Digit4','Numpad4'])assert.equal(isShipCameraKey({code}),true);
  for(const field of ['repeat','ctrlKey','metaKey','altKey','shiftKey'])assert.equal(isShipCameraKey({code:'Digit4',[field]:true}),false);
  assert.equal(isShipCameraKey({code:'Digit5'}),false);
  assert.equal(isShipCameraKey({code:'Digit4',target:{isContentEditable:true}}),false);
  assert.equal(isShipCameraKey({code:'Digit4',target:{closest:()=>({})}}),false);
});


test('walking view follows look without changing physical eye and hides in a tight obstruction',()=>{
  const body=nav();body.mode='walk';body.orientation.setFromAxisAngle(new Vector3(1,0,0),-.4);
  const saved=structuredClone(body),view=new ShipCamera();view.toggle('walk');view.update(body,noGround);
  assert.equal(view.active,true);assert.ok(view.position.distanceTo(body.position)>3);
  near(view.orientation.length(),1);assert.deepEqual(structuredClone(body),saved);
  view.update(body,{...noGround,clipShip:start=>start.clone()});
  assert.equal(view.active,false);assert.equal(view.obstructed,true);assert.equal(view.playerExternal,true);
  view.update(body,noGround);assert.equal(view.active,true);
});

test('on-foot sight line clears the head and torso instead of pointing through the player',()=>{
  const body=nav();body.mode='walk';const view=new ShipCamera();view.toggle('walk');view.update(body,noGround);
  const direction=new Vector3(0,0,-1).applyQuaternion(view.orientation);
  const t=(body.position.z-view.position.z)/direction.z;
  const sightAtBody=view.position.clone().addScaledVector(direction,t).sub(body.position);
  assert.ok(sightAtBody.x>.7, 'central sight line stays beside the right shoulder');
});

test('ship triangle obstruction clips visible walls and ignores hidden fallback meshes',()=>{
  const ship=new Group(),wall=new Mesh(new BoxGeometry(4,4,.2),new MeshBasicMaterial({side:DoubleSide}));
  wall.position.z=2;ship.add(wall);ship.position.set(40,-20,10);
  const start=new Vector3(25e9,0,0),end=start.clone().add(new Vector3(0,0,4));
  const local=p=>p.clone().sub(start);
  const clipped=clipShipCamera(start,end,ship,local);
  assert.ok(clipped.z>1.6&&clipped.z<1.7);
  wall.visible=false;assert.deepEqual(clipShipCamera(start,end,ship,local),end);
  wall.geometry.dispose();wall.material.dispose();
});


test('camera clearance follows Selene terrain around its offset centre',()=>{
  const direction=new Vector3(1,0,0);
  const start=bodySurfacePoint(direction,SELENE,3),end=bodySurfacePoint(direction,SELENE,-2);
  const clipped=clipTerrainCamera(start,end);
  const clearance=clipped.length()-groundRadiusAt(clipped);
  assert.ok(clearance>=.45&&clearance<.5);
});
