import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {MiningField,resourceSurveyPoint} from '../src/mining/field.js';
import {nearbySurfaceDeposits,surfaceDepositDescriptor,surfaceDepositCell,surfaceDepositColumns,SURFACE_DEPOSIT_ROWS,SURFACE_DEPOSIT_WORKERS} from '../src/mining/surface-deposits.js';
import {MOON_RADIUS,MOON_POSITION,RESOURCE_PROVINCES,moonResources} from '../src/moon-world.js';
import {bodySurfacePoint,bodySurfaceNormal,SELENE} from '../src/celestial.js';
import {asteroidField} from '../src/ring-world.js';
import {carve,createDensity,meshVolume,encodeDensity} from '../src/mining/volume.js';
import {MAX_SAVED_ROCKS} from '../src/mining/store.js';
import {RockCollision} from '../src/mining/collision.js';

const center=new Vector3(...MOON_POSITION);
function sample(province,x,y,altitude=2){
  const d=new Vector3(...province.direction),east=new Vector3().crossVectors(new Vector3(0,1,0),d).normalize(),north=new Vector3().crossVectors(d,east);
  return bodySurfacePoint(d.addScaledVector(east,x/MOON_RADIUS).addScaledVector(north,y/MOON_RADIUS).normalize(),SELENE,altitude);
}
class SynchronousWorker{
  postMessage(job){this.job=job;this.posts=(this.posts??0)+1;this.publish(job);}
  publish(job){
    const cut=job.point?carve(job.field,job.point,job.budget,.48,job.resourceWeights):{field:job.field,yieldVolume:[0,0,0]};
    if(!cut){this.onmessage({data:{id:job.id,empty:true}});return;}
    const mesh=meshVolume(cut.field,job.resourceWeights);
    this.onmessage({data:{id:job.id,...cut,...mesh,encodedField:encodeDensity(cut.field),collision:new RockCollision(mesh.positions).pack(),meshMs:0}});
  }
  terminate(){this.terminated=true;}
}
class DeferredWorker extends SynchronousWorker{postMessage(job){this.job=job;this.posts=(this.posts??0)+1;}}
function setup(t,Worker=SynchronousWorker){
  const previous=globalThis.Worker;globalThis.Worker=Worker;t.after(()=>{if(previous)globalThis.Worker=previous;else delete globalThis.Worker;});
  const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)},fields=[];
  const create=()=>{const field=new MiningField(new Scene(),storage,{local:[],hiddenIds:new Set()});fields.push(field);return field;};
  t.after(()=>fields.forEach(f=>f.dispose()));return {field:create(),create};
}

test('arbitrary copper terrain has nearby real copper-weighted deposits beyond the five survey anchors',()=>{
  let yieldVolume=[0,0,0];const variants=new Set(),ids=new Set();
  for(const p of RESOURCE_PROVINCES.filter(p=>p.resource==='copper')){
    for(const [x,y] of [[1700,3100],[13270,-8150],[-17400,22700],[-4000,-11000]]){
      const point=sample(p,x,y),deposits=nearbySurfaceDeposits(point);
      assert.ok(deposits.length>0,'mineral-rich cells do not have random occupancy holes');
      assert.ok(deposits[0].position.distanceTo(point)<200,'a mineable rock is within a bounded local walk');
      const d=deposits[0];ids.add(d.id);variants.add(d.variant);
      assert.ok(RESOURCE_PROVINCES.every(p=>bodySurfacePoint(new Vector3(...p.direction),SELENE).distanceTo(d.position)>80));
      assert.deepEqual(d.resourceWeights,moonResources(...d.position.clone().sub(center).normalize().toArray()).weights);
      assert.equal(d.dominant,'copper');assert.ok(d.resourceWeights[1]>.9);
      assert.ok(new Vector3(0,1,0).applyQuaternion(d.quaternion).dot(bodySurfaceNormal(d.position,SELENE))>.999,'outcrop follows the authoritative slope');
      const field=createDensity((x,y,z)=>asteroidField(x,y,z,d.variant));
      const cut=carve(field,[0,.5,.6],.025,.48,d.resourceWeights);assert.ok(cut);
      yieldVolume=yieldVolume.map((v,i)=>v+cut.yieldVolume[i]);
      assert.deepEqual(surfaceDepositDescriptor(d.row,d.column),d,'identity, density seed, terrain anchor and profile regenerate exactly');
    }
  }
  assert.equal(ids.size,8);assert.ok(variants.size>=3);
  assert.ok(yieldVolume[1]/yieldVolume.reduce((a,b)=>a+b,0)>.85,'actual removed material favors copper, not merely the label');
});

test('spherical deposit queries preserve seam and polar identities without duplicates or off-moon work',()=>{
  for(const direction of [new Vector3(1,0,1e-12),new Vector3(1,0,-1e-12),new Vector3(0,1,0),new Vector3(0,-1,0)]){
    const point=bodySurfacePoint(direction.normalize(),SELENE,2),deposits=nearbySurfaceDeposits(point);
    assert.ok(deposits.length<100);assert.equal(new Set(deposits.map(d=>d.id)).size,deposits.length);
    assert.ok(deposits.every(d=>d.position.distanceTo(point)<=400));
    for(const d of deposits)assert.equal(surfaceDepositDescriptor(d.row,d.column+surfaceDepositColumns(d.row)).id,d.id);
  }
  const a=nearbySurfaceDeposits(bodySurfacePoint(new Vector3(1,0,1e-12),SELENE,2)).map(d=>d.id).sort();
  const b=nearbySurfaceDeposits(bodySurfacePoint(new Vector3(1,0,-1e-12),SELENE,2)).map(d=>d.id).sort();assert.deepEqual(a,b);
  assert.deepEqual(nearbySurfaceDeposits(new Vector3()),[]);
  assert.deepEqual(nearbySurfaceDeposits(center.clone().add(new Vector3(MOON_RADIUS+50000,0,0))),[]);
  assert.equal(surfaceDepositDescriptor(-1,0),null);assert.equal(surfaceDepositDescriptor(SURFACE_DEPOSIT_ROWS,0),null);
  assert.throws(()=>nearbySurfaceDeposits(new Vector3(),1001),/radius/);
});

test('regional streaming selects the nearest or aimed outcrop, preserves physical collision and restores saved cuts',t=>{
  const {field,create}=setup(t),p=RESOURCE_PROVINCES.find(p=>p.resource==='copper'),origin=sample(p,1700,3100);
  field.update(origin);assert.equal(field.regionalRocks.size,SURFACE_DEPOSIT_WORKERS);
  assert.equal(field.active.descriptor.regional,true,'a distant named survey must not hide the nearby regional target');
  assert.deepEqual(field.state.activePosition,field.active.position.toArray());assert.equal(field.targetName,'Copper outcrop');
  assert.equal(field.state.nearestRegional.dominant,'copper');assert.equal(field.state.nearestRegional.ready,true);
  const descriptors=field.regionalDescriptors;field.update(origin.clone());assert.equal(field.regionalDescriptors,descriptors,'cached query is retained in the same spatial cell');
  const rock=field.active,eye=rock.toWorld(new Vector3(0,.55,4)),direction=rock.toWorld(new Vector3(0,.55,0)).sub(eye).normalize();
  field.update(eye);const inspection=field.inspectTarget(eye,direction);assert.equal(inspection.rockId,rock.rockId);assert.equal(inspection.status,'ready');assert.equal(field.active,rock);
  const events=[];field.onExtract=data=>events.push(data);
  const hit=field.raycast(eye,direction);assert.equal(hit.rock,rock);field.onMine({point:hit.point,dt:.1,target:rock},direction);
  assert.equal(rock.snapshot.revision,1);assert.ok(field.store.mass>0);
  assert.equal(events.length,1);assert.ok(events[0].point.distanceTo(hit.point)<.036);assert.ok(events[0].yields.some(n=>n>0));
  assert.deepEqual(rock.worker.job.resourceWeights,rock.descriptor.resourceWeights);
  assert.ok(field.constrainEVA(rock.toWorld(new Vector3(-4,0,0)),rock.toWorld(new Vector3(4,0,0))).hit);
  assert.ok(field.constrainWalker(rock.toWorld(new Vector3(-4,1.5,0)),rock.toWorld(new Vector3(4,1.5,0))).hit);
  assert.ok(field.constrainFlight(rock.toWorld(new Vector3(-15,0,0)),rock.toWorld(new Vector3(15,0,0))).hit);
  const saved=rock.snapshot.field.slice(),mass=field.store.mass,id=rock.rockId;
  field.update(new Vector3());assert.equal(field.regionalRocks.size,0);assert.equal(rock.disposed,true);assert.equal(field.store.initialRocks.has(id),false);
  field.update(origin);assert.deepEqual(field.regionalRocks.get(id).snapshot.field,saved);assert.equal(field.store.mass,mass);
  const restored=create();restored.update(origin);assert.deepEqual(restored.regionalRocks.get(id).snapshot.field,saved);assert.equal(restored.store.mass,mass,'restoring an outcrop awards no new cargo');
  for(let index=0;index<MAX_SAVED_ROCKS-1;index++){
    const key=`slot-fixture-${index}`,initial=createDensity();restored.store.getRock(key,initial);
    assert.equal(restored.store.commitRock(key,{field:initial,yieldVolume:[0,0,0]},0),true);
  }
  assert.equal(Object.keys(restored.store.state.rocks).length,MAX_SAVED_ROCKS);
  const virgin=[...restored.regionalRocks.values()].find(r=>r.rockId!==id),posts=virgin.worker.posts;
  virgin.onMine({point:virgin.toWorld(new Vector3(0,.5,1)),dt:.1},new Vector3(0,0,-1));
  assert.equal(virgin.worker.posts,posts,'regional rocks share the bounded saved-domain cap');assert.match(restored.store.warning,/save full/i);
  assert.equal(restored.store.canEditRock(id),true,'the already saved regional rock remains editable');
});

test('pending regional workers stay bounded during travel and conservatively protect their domains',t=>{
  const {field}=setup(t,DeferredWorker),p=RESOURCE_PROVINCES.find(p=>p.resource==='copper'),origin=sample(p,1700,3100);
  field.update(origin);const original=[...field.regionalRocks.values()];assert.equal(original.length,3);
  const rock=original[0];assert.equal(rock.ready,false);
  assert.ok(field.constrainEVA(rock.toWorld(new Vector3(-4,0,0)),rock.toWorld(new Vector3(4,0,0))).hit);
  field.update(sample(p,10000,4000));assert.deepEqual([...field.regionalRocks.values()],original);assert.ok(original.every(r=>!r.disposed));
  for(const r of original)r.worker.publish(r.worker.job);
  field.update(sample(p,10000,4000));assert.equal(field.regionalRocks.size,3);assert.ok(original.every(r=>r.disposed&&r.worker.terminated));
  const named=resourceSurveyPoint(p.id,0);field.update(named);assert.ok(field.regionalRocks.size<=3);assert.equal(surfaceDepositCell(named).length,2);
});

test('a cut finishing after a cell crossing is saved once before its regional worker is evicted',t=>{
  const {field}=setup(t),p=RESOURCE_PROVINCES.find(p=>p.resource==='copper'),origin=sample(p,13270,-8150);
  field.update(origin);const rock=field.active,id=rock.rockId;
  rock.worker.postMessage=function(job){this.job=job;this.posts++;};
  const eye=rock.toWorld(new Vector3(0,.5,4)),direction=rock.toWorld(new Vector3(0,.5,0)).sub(eye).normalize(),hit=field.raycast(eye,direction);
  assert.equal(hit.rock,rock);field.onMine({point:hit.point,dt:.1,target:rock},direction);assert.equal(rock.pending,true);
  const elsewhere=sample(p,-17400,22700);field.update(elsewhere);
  assert.equal(field.regionalRocks.get(id),rock);assert.equal(rock.disposed,undefined);assert.ok(field.regionalRocks.size<=3);
  rock.worker.publish(rock.worker.job);assert.equal(rock.snapshot.revision,1);const mass=field.store.mass,saved=rock.snapshot.field.slice();assert.ok(mass>0);
  field.update(elsewhere);assert.equal(rock.disposed,true);assert.equal(field.regionalRocks.has(id),false);
  rock.worker.publish(rock.worker.job);assert.equal(field.store.mass,mass,'late duplicate publication cannot award material twice');
  field.update(origin);assert.deepEqual(field.regionalRocks.get(id).snapshot.field,saved);assert.equal(field.store.mass,mass);
});
