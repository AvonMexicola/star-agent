import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene, Vector3, Ray, Sphere } from 'three';
import { MiningField, ringSurveyPoint } from '../src/mining/field.js';
import { MoonRings } from '../src/moon-rings.js';
import { asteroidDescriptor, ringCellAt } from '../src/ring-world.js';
import { MOON_POSITION } from '../src/moon-world.js';
import { carve, meshVolume, encodeDensity } from '../src/mining/volume.js';
import { RockCollision } from '../src/mining/collision.js';
class ImmediateWorker {
  postMessage(job) {
    this.job=job;
    const cut=job.point?carve(job.field,job.point,job.budget,.48,job.resourceWeights):{field:job.field,yieldVolume:[0,0,0]};
    if(!cut){this.onmessage({data:{id:job.id,empty:true}});return;}
    const mesh=meshVolume(cut.field,job.resourceWeights);
    this.onmessage({data:{id:job.id,...cut,...mesh,encodedField:encodeDensity(cut.field),collision:new RockCollision(mesh.positions).pack(),meshMs:0}});
  }
  terminate(){this.terminated=true;}
}
function setup(t,Worker=ImmediateWorker){
  const previous=globalThis.Worker;globalThis.Worker=Worker;
  const scene=new Scene(),rings=new MoonRings(scene,6),values=new Map(),store={getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v)},field=new MiningField(scene,store,rings);
  t.after(()=>{field.dispose();rings.dispose();if(previous)globalThis.Worker=previous;else delete globalThis.Worker;});
  const origin=ringSurveyPoint(),center=new Vector3(...MOON_POSITION);
  const descriptor=(id,offset,family=0,size=1)=>({...asteroidDescriptor(id),position:origin.clone().add(new Vector3(...offset)).sub(center).toArray(),rotation:[0,0,0],family,size,mineable:size===1});
  return {field,rings,origin,descriptor};
}
test('aiming the third-nearest small asteroid promotes and mines it across all six families',t=>{
  const {field,rings,origin,descriptor}=setup(t),direction=new Vector3(0,0,1);
  for(let family=0;family<6;family++){
    const target=descriptor(1301+family*8,[0,0,7],family);
    rings.local=[descriptor(2001,[-3,0,1]),descriptor(2002,[3,0,1]),target];
    field.aimedDescriptor=null;field.update(origin);
    assert.equal(field.cache.has(target.id),false,'nearest-only streaming omits the aimed third rock');
    const inspected=field.inspectTarget(origin,direction);
    assert.match(target.key,/^selene-ring-v2-/);assert.equal(inspected.rockId,target.key);assert.equal(inspected.status,'ready');assert.ok(field.cache.size<=2);
    const hit=field.raycast(origin,direction);assert.equal(hit.rock.rockId,target.key);
    field.onMine({point:hit.point,dt:.1,target:hit.rock},direction);
    assert.equal(field.store.state.rocks[target.key].revision,1);assert.ok(field.store.mass>0);
    const aimed=field.aimedDescriptor;
    field.raycast(origin,new Vector3(-1,0,0)); // Passive muzzle/obstruction query.
    assert.equal(field.aimedDescriptor,aimed);
    field.update(origin);assert.ok(field.cache.has(target.id),'next frame retains aimed worker');
  }
});
test('a clear rendered gap beside a large neighbor permits targeting, laser hits and EVA movement',t=>{
  const {field,rings,origin,descriptor}=setup(t),direction=new Vector3(0,0,1);
  const target=descriptor(3101,[0,0,7]),neighbor=descriptor(3200,[35,0,20],3,20);
  rings.local=[target,neighbor];field.update(origin);
  const before=new Ray(origin,direction).intersectSphere(new Sphere(origin.clone().add(new Vector3(35,0,20)),neighbor.size*1.95),new Vector3());
  assert.ok(before&&before.distanceTo(origin)<5,'old inflated sphere falsely occluded the beam');
  assert.equal(rings.raycastDescriptor(neighbor,origin,direction,8),null);
  assert.equal(field.inspectTarget(origin,direction).rockId,target.key);
  assert.equal(field.raycast(origin,direction).rock.rockId,target.key);
  const proposed=origin.clone().addScaledVector(direction,4);
  assert.equal(rings.constrainDescriptor(neighbor,origin,proposed,.35).hit,false);
  rings.cellKey=ringCellAt(origin).join(':');field.collisionKey=null;
  assert.equal(field.constrainSpace(origin,proposed,.35).hit,false);
  // Moving the actual mesh onto the ray must block mining the rock behind it.
  neighbor.position=origin.clone().add(new Vector3(0,0,4)).sub(new Vector3(...MOON_POSITION)).toArray();neighbor.size=2;
  assert.equal(field.raycast(origin,direction),null);
  const inspected=field.inspectTarget(origin,direction);assert.equal(inspected.status,'too-large');assert.equal(inspected.rockId,neighbor.key);
});
test('pending worker slots show preparation without cancelling jobs or growing the worker pool',t=>{
  class DeferredWorker extends ImmediateWorker {postMessage(job){this.job=job;}}
  const {field,rings,origin,descriptor}=setup(t,DeferredWorker),direction=new Vector3(0,0,1),target=descriptor(4101,[0,0,7]);
  rings.local=[descriptor(4201,[-3,0,1]),descriptor(4202,[3,0,1]),target];field.update(origin);
  const workers=[...field.cache.values()].map(rock=>rock.worker);
  assert.equal(field.inspectTarget(origin,direction).status,'preparing');assert.equal(field.cache.size,2);
  assert.ok(workers.every(worker=>!worker.terminated));
  ImmediateWorker.prototype.postMessage.call(workers[0],workers[0].job);
  assert.equal(field.inspectTarget(origin,direction).status,'preparing');assert.ok(field.cache.has(target.id));assert.equal(field.cache.size,2);
  const selected=field.cache.get(target.id);
  ImmediateWorker.prototype.postMessage.call(selected.worker,selected.worker.job);
  assert.equal(field.inspectTarget(origin,direction).status,'ready');assert.equal(field.raycast(origin,direction).rock,selected);
});
test('inspection explains range and save capacity without awarding or silently replacing a rock',t=>{
  const {field,rings,origin,descriptor}=setup(t),direction=new Vector3(0,0,1),target=descriptor(5101,[0,0,25]);
  rings.local=[target];field.update(origin);
  const far=field.inspectTarget(origin,direction);assert.equal(far.status,'out-of-range');assert.ok(far.distance>8);assert.equal(field.raycast(origin,direction),null);
  target.position=origin.clone().add(new Vector3(0,0,7)).sub(new Vector3(...MOON_POSITION)).toArray();
  for(const rock of field.cache.values())rock.position.fromArray(target.position).add(new Vector3(...MOON_POSITION));
  field.store.canEditRock=()=>false;
  assert.equal(field.inspectTarget(origin,direction).status,'save-full');assert.equal(field.store.mass,0);
});
