import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3, Quaternion, Matrix4, Raycaster, Scene} from 'three';
import {readGLBGeometry} from './helpers/gltf-geometry.js';
import {StratumGameplaySystems, GannetGameplaySystems, STRATUM_GAMEPLAY_LAYOUT, GANNET_GAMEPLAY_LAYOUT} from '../src/medium-ship-gameplay.js';
import {StationComplex} from '../src/station-complex.js';
import {stationQuaternion} from '../src/station.js';
import {PLAYABLE_STATION_OPTIONS} from '../src/station-fleet-hangar.js';
import {sampleRoverSupport, roverShipLocal} from '../src/rover-support.js';
import {roverCarrierStart, roverCarrierClear, guardRoverCarrier} from '../src/rover-carrier.js';
import {createRoverPhysics} from '../src/rover-physics.js';
import {bodySurfacePoint, bodyOffset, SELENE} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION, LANDING_FRAME} from '../src/moon-world.js';
import {MiningStore, MINING_KEY} from '../src/mining/store.js';
import {LocalTrading, LOCAL_TRADER} from '../src/trading/local.js';
import {capacitySBU, placeCrate, validGrid} from '../src/cargo/grid.js';
import {emptyItems} from '../src/inventory/containers.js';
import {createDensity, carve, ROCK_ID} from '../src/mining/volume.js';
import {shipHandling} from '../src/ship-handling.js';

const v = p => new Vector3(...p);
const near = (a, b, e = .00003) => assert.ok(Math.abs(a - b) < e, `${a} differs from ${b}`);
const settle = (s, rider = null) => {
  for (let i = 0; i < 300; i++) { const carry = s.update(.05, rider); if (rider) rider.y += carry; }
  assert.equal(s.moving, false); assert.equal(s.queued ?? null, null);
};
function walk(s, path, eva = false) {
  let p = v(path[0]);
  for (const end of path.slice(1).map(v)) {
    const count = Math.ceil(p.distanceTo(end) / .05), from = p.clone();
    for (let i = 1; i <= count; i++) {
      const q = from.clone().lerp(end, i / count), fitted = eva ? s.constrainEVA(p,q).point : s.constrain(p, q);
      assert.ok(fitted.distanceTo(q) < .000001, `Blocked walk ${p.toArray()} → ${q.toArray()}`);
      const y = s.floorAt(q); assert.notEqual(y, null, `Missing floor ${q.toArray()}`);
      p.copy(q); p.y = y + s.eyeHeight;
    }
  }
  return p;
}
test('Stratum boarding follows the fully deployed real ramp and rejects a moving or occupied entry', () => {
  const s = new StratumGameplaySystems();
  walk(s, [[0,3.1,-4.2],[0,3.1,5.75]]);
  const a = v([0,3.1,6.7]), b = v([0,3.1,7.3]);
  assert.ok(s.constrain(a,b).equals(a)); assert.equal(s.floorAt(v([0,2.5,9])), null);
  assert.equal(s.operate('ramp:aft',v([0,3.1,5.75]),{inFlight:true}).ok,false);
  assert.equal(s.operate('ramp:aft',v([0,3.1,5.75])).ok,true);
  s.update(.25); assert.equal(s.floorAt(v([0,2.5,9])),null); settle(s);
  const end = walk(s, [[0,3.1,5.75],[0,3.1,7],[0,1.75,12.2]]); near(end.y,1.75);
  assert.equal(s.operate('ramp:aft',v([0,2.4,9])).ok,false);
  assert.equal(s.operate('ramp:aft',v([1.35,1.75,7.7])).ok,true); settle(s); assert.equal(s.secured,true);
});
test('Gannet has a real cabin portal, a full-width vestibule, and no floor across a lowered elevator gap', () => {
  const g = new GannetGameplaySystems();
  walk(g, [[0,3.15,-6.8],[0,3.15,3.8],[2.1,3.15,4.1],[2.1,3.15,7.625]]);
  walk(g, [[0,3.15,4.1],[2.1,3.15,4.1],[2.1,3.15,7.625]], true);
  const a = v([1.5,3.15,3]), b = v([1.5,3.15,3.8]); assert.ok(g.constrain(a,b).equals(a));
  const rider = v([2.1,3.15,7.625]);
  assert.equal(g.operate('elevator:vehicle', rider).ok,true); settle(g,rider);
  near(rider.y,1.75); near(g.lift.y,0); near(g.hatch.progress,1);
  assert.equal(g.floorAt(v([0,3.15,7])),null); near(g.floorAt(v([0,1.75,7])),0);
  assert.equal(g.operate('elevator:vehicle',rider).ok,true); settle(g,rider);
  near(rider.y,3.15); assert.equal(g.secured,true);
});
test('Gannet movement guards reject a straddling player and pause on loss of power', () => {
  const g = new GannetGameplaySystems(), rider = v([0,3.15,4.5]);
  assert.equal(g.operate('elevator:vehicle',rider).ok,true);
  for(let i=0;i<180;i++)g.update(.05,rider);
  near(g.lift.y,1.4); assert.equal(g.queued,'lower');
  const clear = v([0,3.15,4]); g.update(.05,clear); g.update(.05,clear);
  assert.ok(g.lift.target===0); g.powered=false; const y=g.lift.y;
  for(let i=0;i<20;i++)g.update(.1,clear); near(g.lift.y,y);
  assert.equal(g.operate('elevator:vehicle',clear,{powered:false}).ok,false);
  g.setPowered(true); settle(g,clear); near(g.lift.y,0);
  assert.equal(g.operate('elevator:vehicle',clear,{powered:false}).ok,false);
  assert.equal(g.powered,true,'a rejected interaction cannot latch the mechanism power off');
});
test('EVA stops at actual outboard hulls while the occupied cabin aisle stays traversable', async () => {
  for(const [id,System,start,end,aisle] of [
    ['stratum',StratumGameplaySystems,[-7,2.65,0],[-3,2.65,0],[[0,3.1,-4.2],[0,3.1,3]]],
    ['gannet',GannetGameplaySystems,[-9,3.72,0],[-4.5,3.72,0],[[0,3.15,-6.8],[0,3.15,3]]],
  ]){
    const {scene}=await readGLBGeometry(new URL(`../public/models/${id}.glb`,import.meta.url));
    scene.updateMatrixWorld(true);
    const a=v(start),b=v(end),delta=b.clone().sub(a);
    const hits=new Raycaster(a,delta.clone().normalize(),0,delta.length()).intersectObject(scene,true);
    assert.ok(hits.some(hit=>!hit.object.material.transparent),`${id}: route crosses actual opaque geometry`);
    const systems=new System();
    assert.equal(systems.constrainEVA(a,b).hit,true,`${id}: exterior collision blocks the drive`);
    assert.equal(systems.constrainEVA(v(aisle[0]),v(aisle[1])).hit,false,`${id}: cabin remains hollow`);
  }
});
function carrierFixture() {
  const g = new GannetGameplaySystems(), up = v(MOON_LANDING_DIRECTION);
  const north = v(LANDING_FRAME.north).projectOnPlane(up).normalize(), right = north.clone().cross(up).normalize();
  const frame = {position:bodySurfacePoint(up,SELENE), quaternion:new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(right,up,north.clone().negate()))};
  const start = roverCarrierStart(g), world = p => p.clone().applyQuaternion(frame.quaternion).add(frame.position);
  const support = p => sampleRoverSupport(p,{freighter:g,frame});
  const physics = createRoverPhysics({position:world(start.position),quaternion:frame.quaternion.clone().multiply(start.quaternion),sampleSupport:support,
    referenceUp:p=>support(p)?.source.startsWith('gannet')?v([0,1,0]).applyQuaternion(frame.quaternion):bodyOffset(p).normalize(),
    constrain:state=>roverCarrierClear(state,g,frame)});
  physics.step(1/60,{brake:1});
  assert.equal(physics.state.supported,true); assert.equal(physics.state.blocked,false);
  guardRoverCarrier(g,()=>({state:physics.state,frame,spawned:true,busy:false}));
  return {g,frame,physics,start,world};
}
test('the Gannet carries all four Burrow wheels through the lift and permits real ground exit and reverse loading', () => {
  const {g,frame,physics,start,world} = carrierFixture();
  assert.ok(physics.state.wheels.every(w=>w.source==='gannet-lift:vehicle'));
  assert.equal(g.operate('elevator:vehicle',null).ok,true);
  for(let i=0;i<350;i++){
    const previous=g.lift.y;g.update(.025,null);
    physics.setPose(physics.state.position.clone().addScaledVector(v([0,1,0]).applyQuaternion(frame.quaternion),g.lift.y-previous),physics.state.quaternion,{preserveMotion:true});
    physics.step(.025,{brake:1});assert.equal(physics.state.blocked,false,JSON.stringify({i,reason:physics.state.reason,lift:g.lift.y,pose:roverShipLocal(physics.state.position,frame).toArray(),wheels:physics.state.wheels.map(w=>w.source)}));
  }
  near(g.lift.y,0);assert.equal(g.queued,null);
  const drive = (target,throttle) => {
    const sources=new Set();
    for(let i=0;i<1800;i++){
      physics.step(1/120,{throttle}); assert.equal(physics.state.blocked,false,`${physics.state.reason} at ${roverShipLocal(physics.state.position,frame).toArray()}`);
      for(const w of physics.state.wheels)sources.add(w.source);
      if((roverShipLocal(physics.state.position,frame).z-target)*throttle>=0)return sources;
    }
    assert.fail('Rover never reached target');
  };
  assert.ok(drive(15,1).has('terrain'));
  for(let i=0;i<240;i++)physics.step(1/120,{brake:1});
  assert.ok(drive(start.position.z,-1).has('gannet-lift:vehicle'));
  for(let i=0;i<240;i++)physics.step(1/120,{brake:1});
  assert.ok(physics.state.wheels.every(w=>w.source==='gannet-lift:vehicle'));
  // A partly loaded vehicle cannot summon a platform through its underbody.
  physics.setPose(world(v([0,0,10.5])),frame.quaternion.clone().multiply(start.quaternion));physics.step(1/60,{brake:1});
  assert.equal(g.operate('elevator:vehicle',null).ok,false);
});
test('medium freight volumes are independent, fully supported, and do not change existing capacity', () => {
  assert.equal(capacitySBU('nomad'),6);assert.equal(capacitySBU('atlas'),512);
  for(const [id,size,count] of [['stratum',16,2],['gannet',64,2]]){
    const crates=[];
    for(let i=0;i<count;i++){const crate=placeCrate(id,crates,{id:`${id}-${i}`,sbu:size,resource:'basalt'});assert.ok(crate);crates.push(crate);}
    assert.equal(validGrid(id,crates),true);assert.equal(placeCrate(id,crates,{id:'extra',sbu:1,resource:'basalt'}),null);
    assert.equal(capacitySBU(id),size*count);
  }
  const rates=['nomad','stratum','gannet','atlas'].map(id=>shipHandling(id).thrust);
  assert.ok(rates.every((n,i)=>i===0||n<rates[i-1]));
});
test('dedicated ore and newly registered freight survive reload without losing legacy cargo or duplicating cuts', () => {
  const saved=new Map(), disk={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v)};
  const store=new MiningStore(disk), trade=new LocalTrading(store);
  assert.equal(store.registerContainer({id:'stratum-ore',name:'Stratum ore bin',kind:'ship',boxes:8}),true);
  assert.deepEqual(store.limits('stratum-ore'),{resources:384,supplies:0});
  assert.equal(store.write(store.withItems(store.state,'pack',{...emptyItems(),basalt:48})),true);
  const cut=carve(createDensity(),[0,0,1.35],.025);
  assert.equal(store.commitRock(ROCK_ID,cut,0,'stratum-ore'),true);
  assert.equal(trade.registerHull('gannet'),true);assert.equal(trade.registerHull('stratum'),true);
  const raw=disk.getItem(MINING_KEY);assert.equal(trade.registerHull('gannet'),true);assert.equal(disk.getItem(MINING_KEY),raw);
  assert.equal(store.commitRock(ROCK_ID,cut,0,'stratum-ore'),false);
  const loaded=new MiningStore(disk);assert.equal(loaded.blocked,undefined);assert.deepEqual(loaded.state,store.state);
  assert.equal(loaded.container('pack').items.basalt,48);assert.ok(loaded.container('stratum-ore').items.basalt>0);
  for(const hull of ['nomad','atlas','stratum','gannet'])assert.ok(loaded.state.commerce.ships[`${LOCAL_TRADER}:${hull}`]);
  const before=store.state;disk.setItem=()=>{throw Error('quota');};
  assert.equal(store.transfer('basalt','stratum-ore','ship',.001).ok,false);assert.equal(store.state,before);
});

test('complete medium hulls launch and dock through all twenty actual tilted station bays', async () => {
  const [gltf,lod,exteriorGltf,exteriorLodGltf] = await Promise.all(
    ['station','station_lod1','station-exterior','station-exterior-lod1'].map(name =>
      readGLBGeometry(new URL(`../public/models/${name}.glb`,import.meta.url))));
  const direction=v([.23,.91,.34]).normalize();
  const orientation=stationQuaternion(direction,new Quaternion()).multiply(
    new Quaternion().setFromAxisAngle(v([1,0,0]),Math.PI/9)).normalize();
  const station=new StationComplex(new Scene(),{...PLAYABLE_STATION_OPTIONS,
    gltf,lod,exteriorGltf,exteriorLodGltf,direction,orientation});
  await station.readyPromise;
  assert.equal(station.pods.length,20);
  let journeys=0;
  for(const pod of station.pods)for(const [id,layout] of [['stratum',STRATUM_GAMEPLAY_LAYOUT],['gannet',GANNET_GAMEPLAY_LAYOUT]]){
    const attitude=pod.inverseQuaternion.clone().multiply(pod.padQuaternion);
    const pilot=(clearance,rootZ=pod.padLocal.z)=>pod.toWorld(v(layout.seatEye).applyQuaternion(attitude)
      .add(new Vector3(pod.padLocal.x,pod.interiorBox.min.y+clearance,rootZ)),new Vector3());
    const dock=pilot(0),hover=pilot(1),outside=pilot(1,pod.openingZ-Math.max(...layout.flightBounds.min.map(Math.abs),...layout.flightBounds.max.map(Math.abs))-8);
    pod.beginOpening();pod.setOpeningProgress(0);
    assert.equal(station.constrainStep(outside,hover,pod.padQuaternion,false,layout).hit,true,`${id} berth ${pod.id}: closed door blocks the full hull`);
    pod.setOpeningProgress(1);
    assert.equal(pod.canDock(hover,layout,pod.padQuaternion),true,`${id} berth ${pod.id}: complete hull fits`);
    for(const [from,to,phase] of [[dock,hover,'launch'],[hover,outside,'departure'],[outside,hover,'approach'],[hover,dock,'landing']]){
      const result=station.constrainStep(from,to,pod.padQuaternion,false,layout);
      assert.equal(result.hit,false,`${id} berth ${pod.id}: ${phase}`);
      assert.ok(result.point.distanceTo(to)<1e-7,`${id} berth ${pod.id}: reaches actual ${phase} endpoint`);
    }
    journeys++;
  }
  assert.equal(journeys,40);
});
