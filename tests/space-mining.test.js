import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {MiningField,ringSurveyPoint} from '../src/mining/field.js';
import {MoonRings} from '../src/moon-rings.js';
import {RING_NORMAL} from '../src/ring-world.js';
import {MOON_POSITION} from '../src/moon-world.js';
import {carve,meshVolume,encodeDensity} from '../src/mining/volume.js';
import {RockCollision} from '../src/mining/collision.js';

class SynchronousWorker {
  postMessage(job){const cut=job.point?carve(job.field,job.point,job.budget):{field:job.field,yieldVolume:[0,0,0]};
    if(!cut){this.onmessage({data:{id:job.id,empty:true}});return;}
    const mesh=meshVolume(cut.field);this.onmessage({data:{id:job.id,...cut,...mesh,encodedField:encodeDensity(cut.field),collision:new RockCollision(mesh.positions).pack(),meshMs:0}});
  }
  terminate(){this.terminated=true;}
}
test('ring rock promotion mines into the shared backpack and restores its cut after streaming away',t=>{
  const old=globalThis.Worker;globalThis.Worker=SynchronousWorker;t.after(()=>{if(old)globalThis.Worker=old;else delete globalThis.Worker;});
  const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)},scene=new Scene(),rings=new MoonRings(scene,12),field=new MiningField(scene,storage,rings);
  const target=ringSurveyPoint(),origin=target.clone().add(new Vector3(0,0,5)),direction=target.clone().sub(origin).normalize();
  rings.update(origin);field.update(origin);assert.ok(field.spaceMode);assert.ok(field.cache.size<=2);
  const hit=field.raycast(origin,direction);assert.ok(hit?.rock.space);const id=hit.rock.rockId;
  field.onMine({point:hit.point,dt:.1,target:hit.rock},direction);
  assert.equal(field.store.state.rocks[id].revision,1);assert.ok(field.store.mass>0);const saved=field.store.state.rocks[id].field.slice(),mass=field.store.mass;
  rings.update(new Vector3());field.update(new Vector3());assert.equal(field.cache.size,0);
  globalThis.Worker=class extends SynchronousWorker {postMessage(job){this.job=job;}};
  rings.update(origin);field.update(origin);assert.equal(field.active.ready,false);
  assert.ok(field.constrainEVA(origin,target.clone().addScaledVector(direction,5)).hit,'restoring edited rock remains collision safe');
  for(const rock of field.cache.values())SynchronousWorker.prototype.postMessage.call(rock.worker,rock.worker.job);
  field.update(origin);assert.deepEqual(field.active.snapshot.field,saved);assert.equal(field.store.mass,mass);assert.ok(rings.hiddenIds.has(hit.rock.descriptor.id));
  const carvedHit=field.raycast(origin,direction);assert.ok(carvedHit.distance>hit.distance+.01);
  field.dispose();rings.dispose();assert.equal(scene.children.length,0);
});


test('EVA uses surface/cache collision and high-speed ring entry brakes before unstreamed debris',t=>{
  const old=globalThis.Worker;globalThis.Worker=SynchronousWorker;t.after(()=>{if(old)globalThis.Worker=old;else delete globalThis.Worker;});
  const scene=new Scene(),rings=new MoonRings(scene,12),field=new MiningField(scene,{getItem:()=>null,setItem(){}},rings);
  const a=field.ground.toWorld(new Vector3(-4,0,0)),b=field.ground.toWorld(new Vector3(4,0,0));assert.ok(field.constrainEVA(a,b).hit);
  const cache=field.fieldCache,c=cache.position.clone(),right=new Vector3(1,0,0).applyQuaternion(cache.quaternion);
  assert.ok(field.constrainEVA(c.clone().addScaledVector(right,-4),c.clone().addScaledVector(right,4)).hit);
  const target=ringSurveyPoint(),normal=new Vector3(...RING_NORMAL),start=target.clone().addScaledVector(normal,20000),end=target.clone().addScaledVector(normal,-20000);
  assert.equal(rings.local.length,0);const stopped=field.constrainFlight(start,end);assert.ok(stopped.hit&&stopped.debrisBrake);assert.ok(stopped.point.clone().sub(new Vector3(...MOON_POSITION)).dot(normal)>1299.9);
  const away=cache.position.clone().sub(field.ground.position).normalize(),eye=cache.position.clone().addScaledVector(away,2),aim=field.ground.position.clone().sub(eye).normalize();
  assert.ok(field.ground.raycast(eye,aim,12));assert.equal(field.raycast(eye,aim,12),null);
  field.dispose();rings.dispose();
});
