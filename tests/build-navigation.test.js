import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {Navigation} from '../src/navigation.js';
import {BuildSystem} from '../src/build/system.js';
import {createBuildObstacles} from '../src/build/obstacles.js';
import {MiningStore} from '../src/mining/store.js';
import {SELENE,bodySurfacePoint} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
import {CLAIM_RADIUS} from '../src/build/state.js';
const v=a=>new THREE.Vector3(...a);
function setup(t){
 const before={document:globalThis.document,window:globalThis.window};
 const surface=()=>({addEventListener(){},querySelector:()=>null,body:{classList:{toggle(){}}}});
 globalThis.document=surface();globalThis.window=surface();t.after(()=>{for(const [key,value] of Object.entries(before)){if(value===undefined)delete globalThis[key];else globalThis[key]=value;}});
 const nav=new Navigation(surface(),()=>{});nav.transitMoon();nav.mode='walk';nav.shipPosition=null;nav.insideShip=false;
 const origin=bodySurfacePoint(v(MOON_LANDING_DIRECTION),SELENE),store=new MiningStore(null),build=new BuildSystem({scene:new THREE.Scene(),nav,store,render:false});
 const c=build.newClaim(origin);c.id='build-claim-1';c.radius=CLAIM_RADIUS;c.pieces=[
  {id:'build-piece-2',type:'mainframe',position:[12,0,0],rotation:0,doorOpen:false},
  {id:'build-piece-3',type:'foundation',position:[0,.3,0],rotation:0,doorOpen:false},
  {id:'build-piece-4',type:'foundation',position:[0,.3,-4],rotation:0,doorOpen:false},
  {id:'build-piece-5',type:'stairs',position:[0,.3,0],rotation:0,doorOpen:false},
  {id:'build-piece-6',type:'wall',position:[-2,.3,-4],rotation:Math.PI/2,doorOpen:false},
  {id:'build-piece-7',type:'wall',position:[2,.3,-4],rotation:Math.PI/2,doorOpen:false},
  {id:'build-piece-8',type:'floor',position:[0,3.3,-4],rotation:0,doorOpen:false},
 ];store.state.build={version:1,nextId:9,claims:[c]};
 const mining={grounded:false,constrainWalker:(a,b)=>({point:b,hit:false,grounded:false}),constrainEVA:(a,b)=>({point:b,hit:false}),constrainFlight:(a,b)=>({point:b,hit:false})};
 nav.surfaceObstacles=createBuildObstacles(mining,build);
 nav.position.copy(build.toWorld(v([0,nav.layout.eyeHeight,3]),c));nav.orientation.fromArray(c.quaternion);nav.jumpHeight=0;nav.jumpVelocity=0;
 const local=()=>build.toLocal(nav.position,c);
 const tick=()=>nav.update(1/60);
 return {nav,build,c,local,tick};
}
test('actual navigation walks foundation, climbs stairs, stays on an upper floor and descends without jumping',t=>{
 const f=setup(t);f.nav.keys.add('KeyW');
 for(let i=0;i<240&&f.local().z>-4;i++)f.tick();f.nav.keys.clear();
 assert.ok(f.local().z<-3.5,`reached upper landing ${f.local().toArray()}`);
 assert.ok(Math.abs(f.local().y-(3.3+f.nav.layout.eyeHeight))<.04,`supported on upper floor ${f.local().toArray()}`);
 for(let i=0;i<120;i++)f.tick();assert.ok(Math.abs(f.local().y-(3.3+f.nav.layout.eyeHeight))<.04,'standing does not snap back to terrain');
 f.nav.keys.add('KeyS');for(let i=0;i<240&&f.local().z<2.6;i++)f.tick();f.nav.keys.clear();
 assert.ok(f.local().z>2.5,`descended the stairway ${f.local().toArray()}`);for(let i=0;i<120;i++)f.tick();assert.ok(f.local().y<2.2,`returned to the lower treads ${f.local().toArray()} jump=${f.nav.jumpHeight} velocity=${f.nav.jumpVelocity}`);
});
test('base obstruction is visible to weapon rays and blocks EVA passage through a closed wall',t=>{
 const f=setup(t),start=f.build.toWorld(v([4,1.5,-4]),f.c),end=f.build.toWorld(v([0,1.5,-4]),f.c),direction=end.clone().sub(start).normalize();
 const hit=f.build.raycast(start,direction,4);assert.ok(hit?.building);assert.ok(hit.distance<2);
 const movement=f.nav.surfaceObstacles.constrainEVA(start,end);assert.ok(movement.hit);assert.ok(movement.point.distanceTo(end)>1);
});
test('ship wing and nose envelopes hit building walls when the seat ray misses',t=>{
 const f=setup(t);f.c.pieces=[{id:'build-piece-9',type:'wall',position:[0,0,0],rotation:0,doorOpen:false}];
 f.nav.orientation.fromArray(f.c.quaternion);
 const move=(a,b)=>f.nav.surfaceObstacles.constrainFlight(f.build.toWorld(v(a),f.c),f.build.toWorld(v(b),f.c));
 // Seat passes 6 m to the right: the hull's left wing still crosses the wall.
 const start=[6,2,12],end=[6,2,-12];
 assert.equal(f.build.raycast(f.build.toWorld(v(start),f.c),f.build.toWorld(v(end),f.c).sub(f.build.toWorld(v(start),f.c)).normalize(),24),null);
 assert.ok(move(start,end).hit,'wing stops a seat-center miss');
 // The nose reaches the wall before the seat's short movement reaches its plane.
 const nose=move([0,2,5],[0,2,3]);assert.ok(nose.hit,'nose blocks before seat reaches wall');
 assert.ok(f.build.toLocal(nose.point,f.c).z>3.5);
 const safe=move([15,2,12],[15,2,-12]);assert.equal(safe.hit,false,'separated flight path remains clear');
});
test('EVA capsule catches an offset edge and ship can lift away from a floor contact',t=>{
 const f=setup(t);f.c.pieces=[{id:'build-piece-9',type:'wall',position:[0,0,0],rotation:0,doorOpen:false}];f.nav.orientation.fromArray(f.c.quaternion);
 const start=f.build.toWorld(v([2.2,1.7,2]),f.c),end=f.build.toWorld(v([2.2,1.7,-2]),f.c);
 assert.ok(f.nav.surfaceObstacles.constrainEVA(start,end).hit,'capsule radius catches wall edge missed by center ray');
 f.c.pieces=[{id:'build-piece-9',type:'foundation',position:[0,0,0],rotation:0,doorOpen:false}];
 const y=f.nav.layout.seatEye[1]-f.nav.layout.flightBounds.min[1];
 const lift=f.nav.surfaceObstacles.constrainFlight(f.build.toWorld(v([0,y,0]),f.c),f.build.toWorld(v([0,y+2,0]),f.c));
 assert.equal(lift.hit,false,'upward takeoff escapes contact without a false ground obstacle');
});
test('short sweeps retain distant high structures inside the cylindrical claim',t=>{
 const f=setup(t);f.c.pieces=[{id:'build-piece-9',type:'wall',position:[60,28,0],rotation:0,doorOpen:false}];
 const start=f.build.toWorld(v([60,29,.4]),f.c),direction=v([0,0,-1]).applyQuaternion(new THREE.Quaternion().fromArray(f.c.quaternion));
 assert.ok(f.build.raycast(start,direction,1)?.building,'cull sphere includes claim height as well as horizontal radius');
});

test('landing assist touches down on a clear designated pad and rejects an undersized or occupied pad',t=>{
 const f=setup(t),pad={id:'build-piece-9',type:'foundation-pad-small',position:[0,.3,0],rotation:0,doorOpen:false,landingPad:true};
 f.c.pieces=[f.c.pieces[0],pad];f.nav.mode='flight';f.nav.insideShip=false;f.nav.position.copy(f.build.toWorld(v([0,18,0]),f.c));f.nav.baseLandingSurface=()=>f.build.landingSurface();f.nav.enabled=true;f.nav.focused=true;
 assert.ok(f.build.landingSurface());f.nav.landOrLaunch();
 for(let i=0;i<1800&&f.nav.mode!=='landed';i++)f.tick();assert.equal(f.nav.mode,'landed');assert.ok(Math.abs(f.build.toLocal(f.nav.shipPosition,f.c).y-.3)<1e-5,'ship rests on the slab, not terrain');
 f.nav.mode='flight';f.nav.position.copy(f.build.toWorld(v([7,18,0]),f.c));assert.equal(f.build.landingSurface(),null,'full wings plus clearance must fit');
 f.nav.position.copy(f.build.toWorld(v([0,18,0]),f.c));f.c.pieces.push({id:'build-piece-10',type:'crate',position:[0,.3,0],rotation:0,doorOpen:false});assert.equal(f.build.landingSurface(),null,'cargo on the pad blocks landing assist');
});
