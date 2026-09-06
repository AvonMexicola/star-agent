import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3,Quaternion,Euler} from 'three';
import {MiningField} from '../src/mining/field.js';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {MoonRings} from '../src/moon-rings.js';
import {asteroidDescriptorV1,asteroidDescriptor,asteroidField,ringCellAt} from '../src/ring-world.js';
import {MOON_POSITION} from '../src/moon-world.js';
import {createDensity,carve,meshVolume,encodeDensity} from '../src/mining/volume.js';
import {RockCollision} from '../src/mining/collision.js';
class WorkerFixture {
  postMessage(job){this.job=job;const cut=job.point?carve(job.field,job.point,job.budget,.48,job.resourceWeights):{field:job.field,yieldVolume:[0,0,0]};if(!cut){this.onmessage({data:{id:job.id,empty:true}});return;}
    const mesh=meshVolume(cut.field,job.resourceWeights);this.onmessage({data:{id:job.id,...cut,...mesh,encodedField:encodeDensity(cut.field),collision:new RockCollision(mesh.positions).pack(),meshMs:0}});
  }
  terminate(){this.terminated=true;}
}
function setup(t){
  const old=globalThis.Worker;globalThis.Worker=WorkerFixture;t.after(()=>{if(old)globalThis.Worker=old;else delete globalThis.Worker;});
  const values=new Map();let writes=0;const storage={getItem:key=>values.get(key)??null,setItem:(key,value)=>{values.set(key,value);writes++;}};
  const seed=new MiningStore(storage),legacy=asteroidDescriptorV1(523645),initial=createDensity((x,y,z)=>asteroidField(x,y,z,legacy.family));
  seed.getRock(legacy.key,initial);const cut=carve(initial,[0,0,1.1],.03);assert.ok(cut?.removed>0);assert.ok(seed.commitRock(legacy.key,cut,0));
  const saved=storage.getItem(MINING_KEY),mass=seed.mass,writesBefore=writes,scene=new Scene(),rings=new MoonRings(scene,12),field=new MiningField(scene,storage,rings);
  t.after(()=>{field.dispose();rings.dispose();});
  return {field,rings,legacy,storage,saved,mass,writes:()=>writes,writesBefore};
}
test('legacy saved edits attach to original descriptor coordinates without changing cuts or backpack',t=>{
  const {field,rings,legacy,storage,saved,mass,writes,writesBefore}=setup(t);
  assert.equal(rings.legacyDescriptors,field.legacyDescriptors);assert.equal(rings.legacyDescriptors.length,1);
  const descriptor=rings.legacyDescriptors[0];assert.ok(rings.hiddenIds.has(descriptor.id),'saved pristine shell is hidden before the first rendered frame');assert.equal(descriptor.id,-523646);assert.equal(descriptor.key,legacy.key);assert.deepEqual(descriptor.position,legacy.position);assert.deepEqual(descriptor.rotation,legacy.rotation);
  const center=new Vector3(...MOON_POSITION),quaternion=new Quaternion().setFromEuler(new Euler(...descriptor.rotation));
  const origin=new Vector3(0,0,4).applyQuaternion(quaternion).add(new Vector3(...descriptor.position)).add(center);
  // The renderer supplies saved descriptors in its local list. This test isolates
  // that field contract; visibility across draw-distance changes is tested separately.
  rings.local=[descriptor];rings.cellKey=ringCellAt(origin).join(':');field.update(origin);
  assert.equal(field.active.rockId,legacy.key);assert.equal(field.active.snapshot.revision,1);assert.ok(field.active.ready);assert.ok(rings.hiddenIds.has(descriptor.id));assert.equal(rings.hiddenIds.has(523645),false);
  assert.equal(field.store.mass,mass);assert.equal(storage.getItem(MINING_KEY),saved);assert.equal(writes(),writesBefore);
  const direction=new Vector3(0,0,-1).applyQuaternion(quaternion),hit=field.raycast(origin,direction);assert.equal(hit?.rock.rockId,legacy.key);
  field.onMine({point:hit.point,dt:.1,target:hit.rock},direction);assert.equal(field.active.snapshot.revision,2);assert.ok(field.store.mass>mass);
});
test('saved legacy collision remains available before its cell streams or its worker restores',t=>{
  const {field,rings,legacy}=setup(t),center=new Vector3(...MOON_POSITION),quaternion=new Quaternion().setFromEuler(new Euler(...legacy.rotation)),target=new Vector3(...legacy.position).add(center);
  const a=new Vector3(0,0,4).applyQuaternion(quaternion).add(target),b=new Vector3(0,0,-4).applyQuaternion(quaternion).add(target);
  field.update(new Vector3());rings.cellKey='unstreamed';field.collisionKey=null;
  assert.ok(rings.hiddenIds.has(-523646));assert.ok(field.constrainSpace(a,b,.35).hit);
  assert.ok(field.collisionDescriptors.some(d=>d.id===-523646),'fallback cells retain bounded saved descriptors');
  assert.equal(field.cache.size,0);
});
test('saved v2 ids remain positive and are not confused with same-number legacy ids',t=>{
  const {field,rings}=setup(t),v2=asteroidDescriptor(7549),initial=createDensity((x,y,z)=>asteroidField(x,y,z,v2.family));
  field.store.getRock(v2.key,initial);assert.ok(field.store.commitRock(v2.key,carve(initial,[0,0,1.1],.03),0));
  field.update(new Vector3());assert.ok(rings.hiddenIds.has(7549));assert.ok(rings.hiddenIds.has(-523646));assert.equal(rings.hiddenIds.has(-7550),false);assert.equal(field.legacyDescriptors.length,1);
});
