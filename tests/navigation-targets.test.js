import test from 'node:test';
import assert from 'node:assert/strict';
import {Vector3,Quaternion} from 'three';
import {AEON,SELENE,bodySurfacePoint,bodyAltitude} from '../src/celestial.js';
import {NAV_BODIES,NAV_ARRIVAL,NavigationLock,aimedNavigationTarget,navigationEndpoint,planNavigationTravel,surfaceTarget} from '../src/navigation-targets.js';
import {sampleTravel,abortTravel} from '../src/travel-model.js';
import {navigationObjectiveIds} from '../src/navigation-objectives.js';
import {TRANSPORT_ROUTES} from '../src/transport/catalog.js';
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
test('surface sites approach vertically, while routes to the far hemisphere are blocked',()=>{
 const start=new Vector3(0,0,AEON.radius*3);
 const near=surfaceTarget('near','Near',AEON,[0,0,1]),far=surfaceTarget('far','Far',AEON,[0,0,-1]);
 assert.ok(planNavigationTravel(start,near).ok);assert.match(planNavigationTravel(start,far).reason,/blocked by Aeon/);
 assert.ok(Math.abs(navigationEndpoint(start,near).distanceTo(v(near.center))-NAV_ARRIVAL)<1e-6);
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
