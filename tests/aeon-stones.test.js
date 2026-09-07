import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3,Matrix4} from 'three';
import {setPlanetSeed} from '../src/generation.js';
import {RADIUS,findDestinations} from '../src/world.js';
import {AEON,SELENE,bodySurfacePoint,bodySurfaceNormal} from '../src/celestial.js';
import {aeonStoneDescriptor,aeonStoneColumns,nearbyAeonStones,aeonStoneField} from '../src/mining/aeon-stones.js';
import {LooseStones} from '../src/mining/loose-stones.js';
import {MiningField} from '../src/mining/field.js';
import {MiningStore} from '../src/mining/store.js';
import {carve,createDensity,meshVolume,encodeDensity} from '../src/mining/volume.js';
import {RockCollision} from '../src/mining/collision.js';
import {craft} from '../src/crafting/transactions.js';
import {forestTilesAround,buildForestTile,FOREST_RECORD_STRIDE} from '../src/forest-distribution.js';

const disk=()=>{const entries=new Map();return {getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};};
function site(){return bodySurfacePoint(new Vector3(...findDestinations().forest),AEON,2);}
class Worker {
  postMessage(job){this.job=job;this.publish();}
  publish(){
    const job=this.job,cut=job.point?carve(job.field,job.point,job.budget,.48,job.resourceWeights):{field:job.field,yieldVolume:[0,0,0]};
    if(!cut){this.onmessage({data:{id:job.id,empty:true}});return;}
    const mesh=meshVolume(cut.field,job.resourceWeights);
    this.onmessage({data:{id:job.id,...cut,...mesh,encodedField:encodeDensity(cut.field),collision:new RockCollision(mesh.positions).pack(),meshMs:0}});
  }
  terminate(){}
}

test('Aeon stones regenerate seeded shape, position and slope with bounded seam/pole queries',()=>{
  setPlanetSeed(7291);const origin=site(),stones=nearbyAeonStones(origin),variants=new Set(stones.map(d=>d.variant));
  assert.ok(stones.length>10&&stones.length<350);assert.equal(variants.size,6);
  for(const d of stones){
    assert.deepEqual(aeonStoneDescriptor(d.row,d.column),d);
    assert.equal(aeonStoneDescriptor(d.row,d.column+aeonStoneColumns(d.row)).id,d.id);
    assert.ok(new Vector3(0,1,0).applyQuaternion(d.quaternion).dot(bodySurfaceNormal(bodySurfacePoint(new Vector3(...d.direction),AEON),AEON))>.99);
    assert.ok(d.position.length()>RADIUS);assert.deepEqual(d.resourceWeights,[1,0,0]);
    for(const tile of forestTilesAround(new Vector3(...d.direction),3)){
      const {records}=buildForestTile(tile);
      for(let i=0;i<records.length;i+=FOREST_RECORD_STRIDE)assert.ok(new Vector3(...d.direction).distanceTo(new Vector3(records[i],records[i+1],records[i+2]))*RADIUS>1.75,'loose rocks cannot engulf a tree trunk');
    }
  }
  try{setPlanetSeed(7292);const changed=nearbyAeonStones(origin);assert.ok(changed.every(d=>!stones.some(old=>old.id===d.id)));}
  finally{setPlanetSeed(7291);}
  assert.deepEqual(nearbyAeonStones(origin),stones);
  for(const direction of [[1,0,1e-12],[1,0,-1e-12],[0,1,0],[0,-1,0]]){
    const p=bodySurfacePoint(new Vector3(...direction).normalize(),AEON,2),list=nearbyAeonStones(p);
    assert.equal(new Set(list.map(d=>d.id)).size,list.length);assert.ok(list.length<350);
    assert.ok(list.every(d=>d.position.distanceTo(p)<=328));
  }
  assert.deepEqual(nearbyAeonStones(bodySurfacePoint(new Vector3(1,0,0),SELENE,2)),[]);
  assert.deepEqual(nearbyAeonStones(origin.clone().addScaledVector(origin.clone().normalize(),5000)),[]);
});

test('near instances match the editable density exactly, retain local precision and physical collision',()=>{
  const store=new MiningStore(disk()),stones=new LooseStones(new Scene(),store),origin=site();
  try{
    const descriptor=stones.query(origin)[0];stones.update(descriptor.position,new Map());
    const template=stones.template(descriptor.variant),expected=meshVolume(stones.initialField(descriptor),[1,0,0]);
    assert.deepEqual(template.geometry.attributes.position.array,expected.positions);
    assert.ok(template.near.count>0);const matrix=new Matrix4();template.near.getMatrixAt(0,matrix);
    assert.ok(new Vector3().setFromMatrixPosition(matrix).length()<65,'no planet-scale floats in instance matrices');
    const q=descriptor.quaternion,world=p=>p.applyQuaternion(q).add(descriptor.position);
    const a=world(new Vector3(-4,.5,0)),b=world(new Vector3(4,.5,0));
    assert.ok(stones.constrain('constrainEVA',a,b).hit,'unpromoted stones are solid');
    assert.ok(stones.stats.nearInstances<30,'dense voxel instances stay near the player');
    assert.ok(stones.stats.farInstances>stones.stats.nearInstances);
  }finally{stones.dispose();}
});

test('a loose stone is aimable, mined once, and keeps its exact cut through worker eviction and reload',t=>{
  const previous=globalThis.Worker;globalThis.Worker=Worker;t.after(()=>{if(previous)globalThis.Worker=previous;else delete globalThis.Worker;});
  const storage=disk(),field=new MiningField(new Scene(),storage,{local:[],hiddenIds:new Set()});t.after(()=>field.dispose());
  const origin=site();field.update(origin);
  const d=field.stones.descriptors.find(d=>d.variant===3&&!field.regionalRocks.has(d.id)),eye=new Vector3(0,.55,4).applyQuaternion(d.quaternion).add(d.position),target=new Vector3(0,.55,0).applyQuaternion(d.quaternion).add(d.position),direction=target.sub(eye).normalize();
  const preparing=field.inspectTarget(eye,direction);assert.equal(preparing.rockId,d.id);assert.equal(preparing.status,'preparing');
  assert.equal(field.raycast(eye,direction),null,'a visible proxy cannot award material before its worker is ready');
  field.update(eye);assert.equal(field.regionalRocks.size,3);
  const inspected=field.inspectTarget(eye,direction);assert.equal(inspected.rockId,d.id);assert.equal(inspected.status,'ready');
  const rock=field.regionalRocks.get(d.id),hit=field.raycast(eye,direction);assert.equal(hit.rock,rock);
  field.onMine({...hit,target:rock,dt:.1},direction);assert.equal(rock.snapshot.revision,1);assert.ok(field.store.state.pack[0]>0);assert.deepEqual(field.store.state.pack.slice(1),[0,0]);
  const saved=rock.snapshot.field.slice(),mass=field.store.mass,positions=rock.mesh.geometry.attributes.position.array.slice();
  // Evict the worker while retaining the visible regional area, then inspect the
  // saved proxy. Its geometry and collision must not become a whole boulder.
  const away=eye.clone().addScaledVector(new Vector3(1,0,0).applyQuaternion(d.quaternion),100);
  field.regionalAimed=null;field.update(away);assert.ok(!field.regionalRocks.has(d.id));
  const proxy=field.stones.edited.get(d.id);assert.ok(proxy);assert.deepEqual(proxy.mesh.geometry.attributes.position.array,positions);
  assert.equal(proxy.mesh.count,1);assert.deepEqual(proxy.collision.positions,positions);
  const reloaded=new MiningField(new Scene(),storage,{local:[],hiddenIds:new Set()});t.after(()=>reloaded.dispose());reloaded.update(away);
  assert.deepEqual(reloaded.stones.edited.get(d.id).mesh.geometry.attributes.position.array,positions);
  reloaded.update(eye);assert.deepEqual(reloaded.regionalRocks.get(d.id).snapshot.field,saved);assert.equal(reloaded.store.mass,mass);
});

test('finite Aeon stone mass makes existing concrete with no free inputs or repeated-cut rewards',()=>{
  const store=new MiningStore(disk()),origin=site(),deposits=nearbyAeonStones(origin).filter(d=>d.variant===3).slice(0,3);
  let repeats=0;
  outer:for(const d of deposits){
    const initial=createDensity((x,y,z)=>aeonStoneField(x,y,z,d.variant));store.getRock(d.id,initial);
    for(let y=1.5;y>=-.5;y-=.5)for(let x=-1.5;x<=1.5;x+=.5)for(let z=-1.5;z<=1.5;z+=.5){
      const before=store.getRock(d.id,initial),cut=carve(before.field,[x,y,z],.4,.48,[1,0,0]);if(!cut)continue;
      assert.equal(store.commitRock(d.id,cut,before.revision),true);const mass=store.mass;
      assert.equal(store.commitRock(d.id,cut,before.revision),false);assert.equal(store.mass,mass);repeats++;
      if(store.mass>=10)break outer;
    }
  }
  assert.ok(repeats>20);const mass=store.mass;assert.ok(mass>=10,'enough real finite stone to process');
  assert.equal(craft(store,'aggregate',{quantity:8}).ok,true);assert.equal(craft(store,'mineral-binder',{quantity:2}).ok,true);assert.equal(craft(store,'concrete').ok,true);
  assert.equal(store.container('pack').items.concrete,10);assert.ok(Math.abs(store.mass-mass)<1e-6);assert.ok(Math.abs(store.state.pack[0]-(mass-10))<1e-6);
});
