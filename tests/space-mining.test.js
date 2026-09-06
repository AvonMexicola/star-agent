import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {MiningField,ringSurveyPoint} from '../src/mining/field.js';
import {MoonRings} from '../src/moon-rings.js';
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
  rings.update(origin);field.update(origin);assert.deepEqual(field.active.snapshot.field,saved);assert.equal(field.store.mass,mass);assert.ok(rings.hiddenIds.has(hit.rock.descriptor.id));
  const carvedHit=field.raycast(origin,direction);assert.ok(carvedHit.distance>hit.distance+.01);
  field.dispose();rings.dispose();assert.equal(scene.children.length,0);
});
