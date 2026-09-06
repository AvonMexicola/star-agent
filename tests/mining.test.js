import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3, Scene } from 'three';
import { createDensity, carve, meshVolume, SIDE, MINERALS } from '../src/mining/volume.js';
import { RockCollision } from '../src/mining/collision.js';
import { MiningStore, MINING_KEY } from '../src/mining/store.js';
import { MineableRock } from '../src/mining/rock.js';

const storage=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
const initial=createDensity(),mesh=meshVolume(initial),collision=new RockCollision(mesh.positions);

test('seeded rock is bounded, repeatable and has usable exterior and cut materials',()=>{
  assert.deepEqual(initial,createDensity());assert.equal(initial.length,SIDE**3);
  assert.ok(mesh.positions.length/9>1000&&mesh.positions.length/9<50000);
  assert.ok(mesh.positions.every(Number.isFinite)&&mesh.normals.every(Number.isFinite));
  assert.equal(MINERALS.length,3);assert.ok(Math.max(...mesh.colors.subarray(0,5000))>.2);
});
test('carving respects its removal budget, does not mutate the previous revision, and exhausts a hole',()=>{
  let f=initial,total=0;const before=initial.slice();
  for(let i=0;i<40;i++){const r=carve(f,[0,0,1.35],.015);if(!r)break;assert.ok(r.removed<=.0150001&&r.removed>0);assert.ok(r.yieldVolume[1]>0);total+=r.removed;f=r.field;}
  assert.deepEqual(initial,before);assert.ok(total>.03&&total<.6);assert.equal(carve(f,[0,0,1.35],.015),null);
  assert.equal(carve(f,[10,10,10],1),null);assert.equal(carve(f,[NaN,0,0],1),null);
});
test('meshed carving moves the physical ray hit into the rock',()=>{
  const origin=new Vector3(0,0,4),direction=new Vector3(0,0,-1),before=collision.raycast(origin,direction,8);
  let f=initial;for(let i=0;i<8;i++){const r=carve(f,[0,0,1.32],.04);if(r)f=r.field;}
  const after=new RockCollision(meshVolume(f).positions).raycast(origin,direction,8);
  assert.ok(after.distance>before.distance+.2,'actual collision follows the cut');
  const blocked=collision.sweep(new Vector3(0,.7,4),new Vector3(0,.7,-4));
  assert.equal(blocked.hit,true);assert.ok(blocked.point.z>1.4,'capsule does not tunnel through the boulder');
  const fall=collision.sweep(new Vector3(.4,6,.2),new Vector3(.4,1,.2));
  assert.ok(fall.grounded&&fall.point.y>2.5,'falling walker lands on the rendered top');
});
test('a fully removed volume no longer blocks traversal',()=>{
  const empty=new Float32Array(initial.length).fill(2),c=new RockCollision(meshVolume(empty).positions);
  assert.equal(c.raycast(new Vector3(0,0,4),new Vector3(0,0,-1),8),null);
  assert.equal(c.sweep(new Vector3(0,1,4),new Vector3(0,1,-4)).hit,false);
});
test('cuts and collected samples survive reload as one transaction without replay rewards',()=>{
  const db=storage(),s=new MiningStore(db),result=carve(s.state.field,[0,0,1.35],.025);
  assert.equal(s.commit(result,0),true);assert.equal(s.commit(result,0),false);
  const reloaded=new MiningStore(db);assert.deepEqual(reloaded.state,s.state);assert.ok(reloaded.mass>0);
  const mass=reloaded.mass;assert.equal(reloaded.stow(),true);assert.equal(reloaded.mass,0);
  assert.ok(Math.abs(new MiningStore(db).state.ship.reduce((a,b)=>a+b,0)-mass)<1e-8);
});
test('full pouch, unavailable storage and invalid saves cannot silently destroy rock or credit cargo',()=>{
  const db=storage(),s=new MiningStore(db),result=carve(s.state.field,[0,0,1.35],.025);
  s.state.pack=[12,0,0];assert.equal(s.commit(result,0),false);assert.equal(s.state.revision,0);
  const noSave=new MiningStore({getItem:()=>null,setItem:()=>{throw Error('quota');}});
  assert.equal(noSave.commit(result,0),false);assert.equal(noSave.state.revision,0);assert.equal(noSave.mass,0);
  db.setItem(MINING_KEY,'broken');const bad=new MiningStore(db);assert.equal(bad.blocked,true);assert.equal(bad.commit(result,0),false);assert.equal(db.getItem(MINING_KEY),'broken');
});
test('a stale worker cannot publish over current collision or geometry; a rejected save publishes neither',()=>{
  const worker={postMessage(data){this.message=data;},terminate(){}},scene=new Scene(),rock=new MineableRock(scene,storage(),{worker});
  rock.receive({id:999,...mesh,field:initial});assert.equal(rock.ready,false);
  rock.receive({id:worker.message.id,...mesh,field:initial,meshMs:1});assert.equal(rock.ready,true);
  const oldGeometry=rock.mesh.geometry,oldCollision=rock.collision;
  rock.request([0,0,1.35],.02);rock.store.storage.setItem=()=>{throw Error('quota');};
  const result=carve(initial,[0,0,1.35],.02);rock.receive({id:worker.message.id,...result,...meshVolume(result.field),meshMs:1});
  assert.equal(rock.mesh.geometry,oldGeometry);assert.equal(rock.collision,oldCollision);assert.equal(rock.store.mass,0);
  rock.dispose();assert.equal(scene.children.length,0);
});

test('fixed tetrahedral meshing produces closed exterior and carved surfaces',()=>{
  for(const field of [initial,carve(initial,[0,0,1.4],.05).field]){
    const p=meshVolume(field).positions,edges=new Map();
    for(let i=0;i<p.length;i+=9){const ids=[0,3,6].map(j=>Array.from(p.slice(i+j,i+j+3),v=>Math.round(v*1e6)).join(','));for(let j=0;j<3;j++){const key=[ids[j],ids[(j+1)%3]].sort().join('/');edges.set(key,(edges.get(key)||0)+1);}}
    assert.ok([...edges.values()].every(n=>n===2),'each welded edge has exactly two incident triangles');
  }
});
