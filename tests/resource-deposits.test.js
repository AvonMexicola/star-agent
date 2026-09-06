import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {MiningField,resourceSurveyDirection,resourceSurveyPoint} from '../src/mining/field.js';
import {RESOURCE_PROVINCES,moonResources,MOON_POSITION} from '../src/moon-world.js';
import {bodyAltitude,bodySurfacePoint,SELENE} from '../src/celestial.js';
import {carve,meshVolume,encodeDensity} from '../src/mining/volume.js';
import {RockCollision} from '../src/mining/collision.js';
class SynchronousWorker {
  postMessage(job){this.job=job;const cut=job.point?carve(job.field,job.point,job.budget,.48,job.resourceWeights):{field:job.field,yieldVolume:[0,0,0]};
    if(!cut){this.onmessage({data:{id:job.id,empty:true}});return;}
    const mesh=meshVolume(cut.field,job.resourceWeights);this.onmessage({data:{id:job.id,...cut,...mesh,encodedField:encodeDensity(cut.field),collision:new RockCollision(mesh.positions).pack(),meshMs:0}});
  }
  terminate(){this.terminated=true;}
}
function setup(t){
  const previous=globalThis.Worker;globalThis.Worker=SynchronousWorker;t.after(()=>{if(previous)globalThis.Worker=previous;else delete globalThis.Worker;});
  const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)},scene=new Scene();
  const rings={local:[],hiddenIds:new Set()},field=new MiningField(scene,storage,rings);t.after(()=>field.dispose());return {field,scene};
}
test('resource survey approaches are offset from each authoritative mineral outcrop',()=>{
  const center=new Vector3(...MOON_POSITION);
  for(const province of RESOURCE_PROVINCES){
    const direction=resourceSurveyDirection(province.id),point=resourceSurveyPoint(province.id);
    assert.ok(Math.abs(new Vector3(...direction).length()-1)<1e-12);
    assert.ok(Math.abs(bodyAltitude(point,SELENE)-120)<1e-7);
    const landing=bodySurfacePoint(new Vector3(...direction),SELENE),deposit=bodySurfacePoint(new Vector3(...province.direction),SELENE);
    assert.ok(landing.distanceTo(deposit)>24&&landing.distanceTo(deposit)<35,'landing is about25m beside the finite rock');
    assert.equal(moonResources(...point.clone().sub(center).normalize().toArray()).dominant,province.resource);
  }
  assert.throws(()=>resourceSurveyPoint('missing-province'),/Unknown/);
});
test('one provincial worker streams at a time and preserves its shared-store excavation',t=>{
  const {field}=setup(t),p=RESOURCE_PROVINCES[0],q=RESOURCE_PROVINCES[1];
  field.update(resourceSurveyPoint(p.id));const rock=field.surfaceRock;
  assert.ok(rock.ready);assert.equal(rock.rockId,`selene-resource-v1-${p.id}`);assert.equal(field.active,rock);assert.equal(field.targetName,p.name);assert.equal(field.cache.size,0);
  const origin=rock.toWorld(new Vector3(0,0,4)),direction=rock.position.clone().sub(origin).normalize(),hit=field.raycast(origin,direction);
  assert.equal(hit.rock,rock);field.onMine({point:hit.point,dt:.1,target:rock},direction);
  assert.equal(rock.snapshot.revision,1);assert.ok(field.store.mass>0);const saved=rock.snapshot.field.slice(),mass=field.store.mass;
  assert.ok(field.constrainEVA(rock.toWorld(new Vector3(-4,0,0)),rock.toWorld(new Vector3(4,0,0))).hit);
  assert.ok(field.constrainWalker(rock.toWorld(new Vector3(-4,1.75,0)),rock.toWorld(new Vector3(4,1.75,0))).hit);
  assert.ok(field.constrainFlight(rock.toWorld(new Vector3(-15,0,0)),rock.toWorld(new Vector3(15,0,0))).hit);
  field.update(resourceSurveyPoint(q.id));assert.ok(rock.disposed&&rock.worker.terminated);assert.notEqual(field.surfaceRock,rock);assert.equal(field.active.rockId,`selene-resource-v1-${q.id}`);
  field.update(new Vector3());assert.equal(field.surfaceRock,null);assert.equal(field.active,field.ground);
  field.update(resourceSurveyPoint(p.id));assert.deepEqual(field.surfaceRock.snapshot.field,saved);assert.equal(field.store.mass,mass);
});
test('streaming does not spawn a second provincial worker while an excavation is pending',t=>{
  const {field}=setup(t),p=RESOURCE_PROVINCES[0],q=RESOURCE_PROVINCES[1];field.update(resourceSurveyPoint(p.id));
  const first=field.surfaceRock;first.pending=true;first.ready=false;assert.equal(field.state.pending,true);assert.ok(field.constrainEVA(first.toWorld(new Vector3(-4,0,0)),first.toWorld(new Vector3(4,0,0))).hit,'pending restore keeps excavation domain collision safe');field.update(resourceSurveyPoint(q.id));assert.equal(field.surfaceRock,first);assert.equal(first.disposed,undefined);
  first.pending=false;field.update(resourceSurveyPoint(q.id));assert.notEqual(field.surfaceRock,first);assert.equal(first.disposed,true);
});
