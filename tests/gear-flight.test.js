import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Navigation} from '../src/navigation.js';
import {gearStep,gearPrompt} from '../src/gear-flight.js';
import {installLandingGear} from '../src/ship-utilities.js';
import {EnergyEffects} from '../src/effects/energy-effects.js';
import {TravelEffects} from '../src/travel-effects.js';
function setup(t){
  const doc=globalThis.document,win=globalThis.window;
  globalThis.document={addEventListener(){},querySelector:()=>null,body:{classList:{toggle(){}}}};globalThis.window={addEventListener(){}};
  t.after(()=>{globalThis.document=doc;globalThis.window=win;});
  return new Navigation({addEventListener(){}},()=>{});
}
const advance=(n,seconds)=>{for(let i=0;i<Math.round(seconds*60);i++)n.update(1/60);};

test('gear animation clock is stable across frame rates and renderer uses authoritative progress',async()=>{
  for(const hz of [15,30,60,120]){let progress=1;for(let i=0;i<hz*2;i++)progress=gearStep(progress,false,1/hz);assert.equal(progress,0);}
  const ship=new THREE.Group(),model=new THREE.Group(),gear=new THREE.Group();gear.name='LandingGear_front';model.add(gear);ship.readyPromise=Promise.resolve(model);
  installLandingGear(ship);await ship.readyPromise;
  ship.updateGear(1,false,.5);assert.equal(ship.userData.gearProgress,.5);assert.equal(gear.scale.y,.54);
  ship.updateGear(0,false,0);assert.equal(gear.scale.y,.08);
});

for(const id of ['nomad','atlas','kestrel'])for(const assist of [true,false])test(`${id} ${assist?'assisted':'inertial'}: deployed gear limits boost; full retraction releases cruise`,t=>{
  const n=setup(t);n.shipId=id;n.flightAssist=assist;n.position.set(0,1592750*3,0);n.orientation.identity();
  assert.equal(n.gearLimited,false);n.toggleGear();advance(n,2);
  n.keys.add('KeyW');n.keys.add('ShiftLeft');advance(n,4);
  assert.ok(n.speed<=35.001);assert.equal(n.speedProfile.limit,35);
  assert.match(n.freeTravelRoute().reason,/Retract landing gear/);
  assert.match(gearPrompt(n),/PRESS G/);assert.match(gearPrompt(n,true),/LB\+RB/);
  n.toggleGear();advance(n,1);assert.equal(n.gearLimited,true);assert.ok(n.speed<=35.001);assert.match(gearPrompt(n),/RETRACTING/);
  advance(n,1);assert.equal(n.gearLimited,false);assert.equal(gearPrompt(n),'');advance(n,3);assert.ok(n.speed>100);
  // Redeploying at speed decelerates continuously instead of a one-frame stop.
  const before=n.speed;n.toggleGear();n.update(1/60);assert.ok(n.speed<before);assert.ok(n.speed>before*.9);
  advance(n,8);assert.ok(n.speed<35.01);
});

test('gear prompts do not tell walkers, landed pilots or an automatic launch to retract',()=>{
  for(const extra of [{mode:'walk'},{mode:'landed'},{stationLift:true},{autoland:true},{powered:false},{travel:{}}])
    assert.equal(gearPrompt({mode:'flight',powered:true,gearDeployed:true,gearProgress:1,...extra}), '');
});

test('automatic surface descent also respects gear maneuver speed',t=>{
  const n=setup(t);n.position.set(0,1592750+5000,0);n.landOrLaunch();
  assert.equal(n.autoland,true);advance(n,2);assert.equal(n.gearProgress,1);
  assert.ok(n.speed>0&&n.speed<=35);assert.equal(n.gearDeployed,true);
});

test('normal spaceflight makes dust and never a tunnel; travel tunnel needs an active drive',()=>{
  const fx=new EnergyEffects(new THREE.Scene()),camera=new THREE.PerspectiveCamera(),origin=new THREE.Vector3(),velocity=new THREE.Vector3(0,0,-9000);
  for(let i=0;i<120;i++)fx.update(1/60,{origin,camera,velocity,flying:true,inSpace:true});
  assert.ok(fx.state.particles>10);assert.ok(fx.state.travel>0);assert.equal(fx.state.slipstream,0);
  assert.ok(fx.particles.slots.some(p=>p.alive&&p.cameraLocal));
  fx.reset();for(let i=0;i<60;i++)fx.update(1/60,{origin,camera,velocity,flying:true,inSpace:true,relativistic:true});
  assert.equal(fx.state.slipstream,0);assert.equal(fx.state.particles,0);
  fx.reset();for(let i=0;i<60;i++)fx.update(1/60,{origin,camera,velocity,flying:true,inSpace:false});assert.equal(fx.state.particles,0);fx.dispose();
  const tunnel=new TravelEffects(),nav={travel:null,travelState:null};tunnel.update(1,nav,camera);assert.equal(tunnel.state.visible,false);
  nav.travel={elapsed:2};nav.travelState={phase:'spooling',speed:0};tunnel.update(1,nav,camera);assert.equal(tunnel.state.visible,true);
  nav.travel=null;nav.travelState=null;tunnel.update(.016,nav,camera);assert.equal(tunnel.state.visible,false);assert.equal(tunnel.state.intensity,0);tunnel.dispose();
});
