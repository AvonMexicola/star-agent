import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {Navigation} from '../src/navigation.js';
import {step} from '../src/flight-model.js';
import {shipHandling,steeringStep} from '../src/ship-handling.js';
import {flightSpeedProfile} from '../src/travel-model.js';
const ids=['kestrel','nomad','atlas'],vacuum={density:0,gravity:new Vector3()};
const state=()=>({velocity:new Vector3(),orientation:new Quaternion(),angularVelocity:new Vector3()});
const near=(a,b,eps=1e-7)=>assert.ok(Math.abs(a-b)<eps,`${a} vs ${b}`);
const ordered=values=>{assert.ok(values[0]>values[1]*1.3,values.join(','));assert.ok(values[1]>values[2]*1.5,values.join(','));};

test('ship speed spread stays narrow; station and terrain limits are shared even with boost',()=>{
  for(const altitude of [1000,45000,100000])for(const boost of [false,true]){
    const speeds=ids.map(shipId=>flightSpeedProfile({shipId,altitude,clearance:Infinity,boost}).speed);
    assert.ok(speeds[0]>speeds[1]&&speeds[1]>speeds[2]);assert.ok(speeds[0]/speeds[2]<1.11);
    for(const constraint of [{clearance:10},{stationDistance:100}]){
      const limited=ids.map(shipId=>flightSpeedProfile({shipId,altitude,boost,...constraint}).speed);
      near(limited[0],limited[1]);near(limited[1],limited[2]);
    }
  }
  assert.equal(shipHandling('future-hull'),shipHandling('nomad'));
});

test('assisted acceleration and stopping distinguish hulls without changing eventual cruise speed',()=>{
  const speeds=ids.map(shipId=>step(state(),{shipId,assist:true,targetVelocity:new Vector3(0,0,-300)},vacuum,.2).velocity.length());
  ordered(speeds);
  const distances=ids.map(shipId=>{
    let s=state(),distance=0;s.velocity.set(0,0,-300);
    for(let i=0;i<2400;i++){s=step(s,{shipId,assist:true},vacuum,1/60);distance+=s.velocity.length()/60;}
    assert.ok(s.velocity.length()<.1);return distance;
  });
  ordered([...distances].reverse());
  for(const shipId of ids){
    const next=step(state(),{shipId,assist:true,targetVelocity:new Vector3(0,0,-300)},vacuum,40);
    near(next.velocity.length(),300,.001);
  }
});

test('inertial forward, lateral and rotational authority follow ship profile; power-off coasting stays physical',()=>{
  for(const translation of [new Vector3(0,0,-1),new Vector3(1,0,0),new Vector3(0,1,0)])
    ordered(ids.map(shipId=>step(state(),{shipId,translation},vacuum,1).velocity.length()));
  ordered(ids.map(shipId=>step(state(),{shipId,rotation:new Vector3(0,1,0)},vacuum,.5).angularVelocity.y));
  for(const shipId of ids){const s=state();s.velocity.set(12,34,56);assert.deepEqual(step(s,{shipId},vacuum,2).velocity,s.velocity);}
});

function navigation(t){
  const oldDocument=globalThis.document,oldWindow=globalThis.window;
  let modal=false;globalThis.document={addEventListener(){},querySelector:()=>modal?{}:null,body:{classList:{toggle(){}}}};
  globalThis.window={addEventListener(){}};
  t.after(()=>{globalThis.document=oldDocument;globalThis.window=oldWindow;});
  const nav=new Navigation({addEventListener(){}},()=>{});
  const pad={id:'Handling test controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  nav.gamepad.read=()=>[pad];
  const reset=id=>{pad.axes.fill(0);pad.buttons.forEach(b=>{b.pressed=false;b.value=0;});nav.orbit();nav.shipId=id;nav.position.set(0,1592750*3,0);nav.orientation.identity();nav.update(0);};
  return {nav,pad,reset,modal:value=>modal=value};
}

test('keyboard and controller yaw, pitch and roll use the same distinct hull response',t=>{
  const {nav,pad,reset}=navigation(t);
  for(const [key,axis,button] of [['ArrowRight',2,null],['ArrowDown',3,null],['KeyE',null,5]]){
    const angles=ids.map(id=>{
      const run=controller=>{reset(id);if(controller){if(axis!==null)pad.axes[axis]=1;else pad.buttons[button]={pressed:true,value:1};}else nav.keys.add(key);
        for(let i=0;i<30;i++)nav.update(1/60);return new Quaternion().angleTo(nav.orientation);};
      const keyboard=run(false),controller=run(true);near(keyboard,controller);return keyboard;
    });
    ordered(angles);
  }
});

test('Atlas mouse turn rate is bounded, settles on release, and cannot leak through menus or leaving the seat',t=>{
  const {nav,reset,modal}=navigation(t);reset('atlas');
  nav.look(100,0);nav.update(1/60);assert.ok(nav.orientation.angleTo(new Quaternion())<.01);
  for(let i=0;i<30;i++){nav.look(.01,0);nav.update(1/60);}
  const turning=nav.orientation.clone();nav.update(1/60);assert.ok(nav.orientation.angleTo(turning)>0);
  for(let i=0;i<150;i++)nav.update(1/60);assert.ok(nav.assistedTurn.length()<1e-4);
  nav.look(.3,.2);modal(true);nav.update(1/60);modal(false);
  assert.equal(nav.pendingLook.length(),0);assert.equal(nav.assistedTurn.length(),0);
  const stopped=nav.orientation.clone();nav.update(1/60);near(nav.orientation.angleTo(stopped),0);
  nav.look(.3,.2);nav.embark();assert.equal(nav.pendingLook.length(),0);assert.equal(nav.assistedTurn.length(),0);
});

test('Atlas steering integration is stable across30/60/120Hz including release',()=>{
  const run=dt=>{let rate=0,angle=0;for(let i=0;i<Math.round(2/dt);i++){const r=steeringStep(rate,i*dt<1?.35:0,dt,.22);rate=r.rate;angle+=r.angle;}return {rate,angle};};
  for(const dt of [1/30,1/60]){near(run(dt).rate,run(1/120).rate);near(run(dt).angle,run(1/120).angle);}
});

test('Atlas mouse input keeps the same turn across render rates and main-loop physics subdivisions',t=>{
  const {nav,reset}=navigation(t);
  const run=hz=>{reset('atlas');const dt=1/hz,steps=Math.ceil(dt/.025);
    for(let frame=0;frame<hz*2;frame++){nav.look(.85*dt,0);nav.beginFrame(dt);for(let i=0;i<steps;i++)nav.update(dt/steps);}
    return new Quaternion().angleTo(nav.orientation);
  };
  const expected=run(120);for(const hz of [15,30,60])near(run(hz),expected,1e-6);
});
