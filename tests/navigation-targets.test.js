import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {BODIES,AEON,SELENE,bodySurfacePoint,bodyAltitude} from '../src/celestial.js';
import {NAV_BODIES,NAV_ARRIVAL,NAV_SURFACE_CLEARANCE,NavigationLock,aimedNavigationTarget,navigationEndpoint,planNavigationTravel,surfaceTarget} from '../src/navigation-targets.js';
import {createAvoidanceRoute,routePartClearance} from '../src/travel-route.js';
import {createTravelPlan,sampleTravel,abortTravel} from '../src/travel-model.js';
import {navigationObjectiveIds} from '../src/navigation-objectives.js';
import {TRANSPORT_ROUTES} from '../src/transport/catalog.js';
import {createSettlementLayouts} from '../src/settlements/layout.js';
import {SEED,setPlanetSeed} from '../src/generation.js';
const v=p=>new Vector3(...p),forward=new Vector3(0,0,-1);
const orientation=(start,end)=>new Quaternion().setFromUnitVectors(forward,end.clone().sub(start).normalize());
const moon=NAV_BODIES.find(b=>b.id==='selene');

test('freight guidance follows pickup, loose cargo, carrying and delivery, then clears',()=>{
 const route=TRANSPORT_ROUTES[0],mission={route:route.id,phase:'accepted',crate:'sealed'},s={owner:'pilot',account:{transport:{active:mission}},ships:[],loose:[]};
 assert.deepEqual(navigationObjectiveIds(s),[route.from]);
 mission.phase='issued';s.loose=[{id:'sealed'}];assert.deepEqual(navigationObjectiveIds(s),['freight-crate-sealed']);
 s.loose=[];s.account.carried={id:'sealed'};assert.deepEqual(navigationObjectiveIds(s),['your-ship']);
 delete s.account.carried;s.ships=[{owner:'other',crates:[{id:'sealed'}]}];assert.deepEqual(navigationObjectiveIds(s),[]);
 s.ships[0].owner='pilot';assert.deepEqual(navigationObjectiveIds(s),[route.to]);
 s.account.transport.active=null;assert.deepEqual(navigationObjectiveIds(s),[]);
});
test('recovery guidance advances required cargo only and removes completed wreck guidance',()=>{
 const mission={id:'recovery-1',job:'silent-atlas',phase:'accepted',cleared:false,crates:[]},s={owner:'pilot',account:{recovery:{active:mission}},ships:[],loose:[]};
 assert.deepEqual(navigationObjectiveIds(s),['wreck-recovery-1']);
 mission.phase='recover';mission.crates=['required'];s.loose=[{id:'bonus'},{id:'required'}];
 assert.deepEqual(navigationObjectiveIds(s),['wreck-recovery-1']);
 mission.cleared=true;assert.deepEqual(navigationObjectiveIds(s),['recovery-crate-required']);
 s.loose=[{id:'bonus'}];s.ships=[{owner:'pilot',crates:[{id:'required'}]}];assert.deepEqual(navigationObjectiveIds(s),['settlement-aeon']);
 s.account.recovery.active=null;assert.deepEqual(navigationObjectiveIds(s),[]);
});

test('targeted world arrivals end 20 km above the canonical surface in world doubles',()=>{
 for(const target of NAV_BODIES.filter(b=>b.id!=='star')){
  const start=v(target.center).add(new Vector3(0,0,target.radius*4));
  const end=navigationEndpoint(start,target),body=target.id==='aeon'?AEON:target.id==='selene'?SELENE:null;
  const route=planNavigationTravel(start,target);assert.ok(route.ok,route.reason);
  assert.ok(route.plan.end.distanceTo(end)<1e-6);
  if(body)assert.ok(Math.abs(bodyAltitude(end,body)-NAV_ARRIVAL)<1e-6);
  assert.ok(sampleTravel(route.plan,route.plan.duration).position.distanceTo(end)<1e-6);
 }
});
test('point approach is 20 km short, samples continuously, and abort never jumps',()=>{
 const start=v(SELENE.center).add(new Vector3(0,0,SELENE.radius*5));
 const t={id:'signal',name:'Signal',category:'missions',center:start.clone().add(new Vector3(200_000,0,0)).toArray()};
 const route=planNavigationTravel(start,t);assert.ok(route.ok,route.reason);assert.equal(route.plan.end.distanceTo(v(t.center)),NAV_ARRIVAL);
 const a=sampleTravel(route.plan,3.01),b=sampleTravel(route.plan,3.02);assert.ok(b.position.distanceTo(a.position)>0);
 const abort=abortTravel(route.plan,3.02);assert.ok(sampleTravel(abort,0).position.equals(b.position));
 assert.equal(planNavigationTravel(v(t.center).add(new Vector3(5000,0,0)),t).ok,false);
});
test('surface sites approach vertically at 35 km and route around the far hemisphere',()=>{
 const start=new Vector3(0,0,AEON.radius*3);
 const near=surfaceTarget('near','Near',AEON,[0,0,1]),far=surfaceTarget('far','Far',AEON,[0,0,-1]);
 assert.ok(planNavigationTravel(start,near).ok);const route=planNavigationTravel(start,far);assert.ok(route.ok,route.reason);assert.ok(route.plan.path.some(p=>p.kind==='arc'));assert.ok(route.plan.distance>start.distanceTo(route.plan.end));
 assert.ok(Math.abs(navigationEndpoint(start,near).distanceTo(v(near.center))-NAV_SURFACE_CLEARANCE)<1e-6);
});
test('body acquisition needs no map and cannot see a moon through a foreground world',()=>{
 const start=v(SELENE.center).add(new Vector3(0,0,SELENE.radius*5)),q=orientation(start,v(SELENE.center));
 assert.equal(aimedNavigationTarget(start,q,NAV_BODIES)?.id,'selene');
 assert.equal(aimedNavigationTarget(start,new Quaternion(),[{id:'behind',category:'missions',center:start.clone().add(new Vector3(0,0,100_000)).toArray()}]),null);
 const camera=new Vector3(0,0,AEON.radius*3),hidden={id:'hidden-moon',category:'bodies',radius:1000,center:[0,0,-AEON.radius*3]};
 assert.equal(aimedNavigationTarget(camera,new Quaternion(),[hidden]),null);
});
test('charge requires a stable target, resets on loss and never completes from a stalled frame',()=>{
 const lock=new NavigationLock();for(let i=0;i<180;i++)lock.update(1/60,moon,true);assert.ok(lock.ready);
 lock.update(.01,moon,false);assert.equal(lock.charge,0);
 lock.update(20,moon,true);assert.ok(lock.charge<.04);lock.update(.01,{id:'aeon'},true);assert.ok(lock.charge<.01);
 lock.update(.01,null,true);assert.equal(lock.id,null);
});
test('invalid signals and obstacles cannot construct a travel plan',()=>{
 assert.equal(planNavigationTravel([NaN,0,0],moon).ok,false);
 assert.equal(planNavigationTravel([0,0,AEON.radius*3],null).ok,false);
 const route=planNavigationTravel(v(SELENE.center).add(new Vector3(0,0,SELENE.radius*5)),moon,{obstacles:[{center:[NaN,0,0],radius:1}]});assert.equal(route.ok,false);
});

test('near-side lunar crater approaches remain valid below the global highest-peak envelope',()=>{
 const direction=new Vector3(.7315901433539745,.6625,-.16084033122109326);
 const start=direction.multiplyScalar(SELENE.radius*3).add(v(SELENE.center));
 const result=planNavigationTravel(start,moon);assert.ok(result.ok,result.reason);
 assert.ok(Math.abs(bodyAltitude(result.plan.end,SELENE)-NAV_ARRIVAL)<1e-6);
});


test('map-selected hidden locations and moons can charge while sight-only acquisition stays occluded',()=>{
 const start=new Vector3(0,0,AEON.radius*3),far=surfaceTarget('far','Far',AEON,[0,0,-1]);
 assert.equal(aimedNavigationTarget(start,new Quaternion(),[far]),null);
 assert.equal(aimedNavigationTarget(start,new Quaternion(),[far],far.id)?.id,far.id);
 const direction=v(SELENE.center).normalize(),behind=direction.clone().multiplyScalar(-AEON.radius*3);
 const q=orientation(behind,v(SELENE.center));
 assert.notEqual(aimedNavigationTarget(behind,q,NAV_BODIES)?.id,'selene');
 assert.equal(aimedNavigationTarget(behind,q,NAV_BODIES,'selene')?.id,'selene');
 const route=planNavigationTravel(behind,moon);assert.ok(route.ok,route.reason);
 assert.ok(route.plan.path.some(p=>p.kind==='arc'&&p.body==='aeon'));
});

test('all four far-side surface routes maintain 35 km terrain clearance, including aborts',()=>{
 for(const body of BODIES.filter(b=>!b.star)){
  const center=v(body.center),start=center.clone().add(new Vector3(0,0,body.radius+100_000));
  const target=surfaceTarget(`far-${body.id}`,'Far side',body,[0,0,-1]);
  const {ok,reason,plan}=planNavigationTravel(start,target);assert.ok(ok,reason);
  assert.ok(plan.path.some(p=>p.kind==='arc'));
  assert.ok(Math.abs(bodyAltitude(plan.end,body)-NAV_SURFACE_CLEARANCE)<.001);
  let previous=null;
  for(let i=0;i<=300;i++){
   const elapsed=plan.duration*i/300,s=sampleTravel(plan,elapsed);
   assert.ok(bodyAltitude(s.position,body)>=NAV_SURFACE_CLEARANCE-.001,`${body.id} terrain clearance`);
   assert.ok(Math.abs(s.direction.length()-1)<1e-10);
   if(previous)assert.ok(s.remaining<=previous.remaining);
   previous=s;
   if(i%10===0&&s.speed>0){
    const abort=abortTravel(plan,elapsed);
    assert.ok(sampleTravel(abort,0).position.distanceTo(s.position)<.001);
    for(let j=0;j<=30;j++)assert.ok(bodyAltitude(sampleTravel(abort,abort.duration*j/30).position,body)>=NAV_SURFACE_CLEARANCE-.001);
    assert.equal(sampleTravel(abort,Infinity).speed,0);
   }
  }
 }
});

test('a station obstacle on the arc or endpoint still blocks travel',()=>{
 const start=new Vector3(0,0,AEON.radius*3),target=surfaceTarget('far','Far',AEON,[0,0,-1]);
 const route=planNavigationTravel(start,target);assert.ok(route.ok);
 const arc=route.plan.path.find(p=>p.kind==='arc');
 const center=arc.radial.clone().applyAxisAngle(arc.axis,arc.angle/2).multiplyScalar(arc.radius).add(arc.center);
 assert.match(planNavigationTravel(start,target,{obstacles:[{center:center.toArray(),radius:2000,name:'Station'}]}).reason,/blocked by Station/);
 assert.match(planNavigationTravel(start,target,{obstacles:[{center:route.plan.end.toArray(),radius:2000,name:'Station'}]}).reason,/blocked by Station/);
 assert.equal(planNavigationTravel(start,target,{obstacles:null}).ok,false);
 assert.equal(planNavigationTravel([0,0,0],target).ok,false);
});


test('two blocking worlds produce a cleared path and cloned network paths sample identically',()=>{
 const start=new Vector3(-300,0,0),end=new Vector3(500,0,0);
 const worlds=[{id:'a',name:'A',center:[0,0,0],radius:100},{id:'b',name:'B',center:[230,0,0],radius:70}];
 const path=createAvoidanceRoute(start,end,worlds),plan=createTravelPlan(start,end,{path});
 assert.equal(path.filter(p=>p.kind==='arc').length,2);
 for(const p of path)for(const w of worlds)assert.ok(routePartClearance(p,w.center)>=w.radius-.001);
 const clone={...plan,path:JSON.parse(JSON.stringify(path))};
 for(let i=0;i<=100;i++){
  const a=sampleTravel(plan,plan.duration*i/100),b=sampleTravel(clone,plan.duration*i/100);
  assert.ok(a.position.distanceTo(b.position)<1e-8);assert.ok(a.direction.distanceTo(b.direction)<1e-8);
 }
});

test('Greenbank signal wins over Aeon and an explicit bearing cannot silently switch destinations',()=>{
 const previousSeed=SEED;setPlanetSeed(7291);
 try{
  const site=createSettlementLayouts().find(s=>s.id==='settlement-aeon');
  const center=v(site.pad.position).applyQuaternion(new Quaternion(...site.claim.quaternion)).add(v(site.claim.origin));
  const target={id:site.id,name:site.name,category:'trade',body:site.body,parent:site.body,surface:true,center:center.toArray(),radius:0};
  const normal=center.clone().normalize(),axis=normal.clone().cross(new Vector3(0,1,0)).normalize();
  const start=normal.clone().applyAxisAngle(axis,.55).multiplyScalar(AEON.radius*3),targets=[...NAV_BODIES,target];
  const wrong=planNavigationTravel(start,NAV_BODIES.find(t=>t.id==='aeon'));
  assert.ok(wrong.ok,wrong.reason);
  assert.ok(wrong.plan.end.distanceTo(center)>870_000&&wrong.plan.end.distanceTo(center)<872_000,'reproduce the reported planet-approach miss');
  const acquired=aimedNavigationTarget(start,orientation(start,center),targets);
  assert.equal(acquired?.id,'settlement-aeon','pointing at Greenbank must acquire the settlement without a map selection');
  const correct=planNavigationTravel(start,acquired);assert.ok(correct.ok,correct.reason);
  assert.ok(Math.abs(correct.plan.end.distanceTo(center)-NAV_SURFACE_CLEARANCE)<10,'arrive above the actual raised settlement pad');
  assert.equal(aimedNavigationTarget(start,orientation(start,new Vector3()),targets,target.id),null,'turning toward Aeon must not replace the tracked settlement');
  assert.equal(aimedNavigationTarget(start,orientation(start,new Vector3()),targets)?.id,'aeon','clearing the target restores ordinary world acquisition');
  assert.equal(aimedNavigationTarget(start,orientation(start,center),targets,'missing-signal'),null,'a missing explicit signal never falls back to another destination');
  assert.equal(aimedNavigationTarget(start,orientation(start,center),targets,'aeon')?.id,'aeon','an explicitly selected world remains available behind a point beacon');
 }finally{setPlanetSeed(previousSeed);}
});
