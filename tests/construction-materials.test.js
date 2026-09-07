import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3} from 'three';
import {MiningStore,MINING_KEY,MAX_SAVED_ROCKS} from '../src/mining/store.js';
import {MATERIAL_IDS,itemMass,fitsBox} from '../src/inventory/containers.js';
import {RECIPES} from '../src/crafting/recipes.js';
import {craft,previewCraft} from '../src/crafting/transactions.js';
import {nearbyConstructionDeposits,constructionDepositDescriptor} from '../src/mining/construction-deposits.js';
import {AEON,PYRE,bodySurfacePoint,bodySurfaceNormal} from '../src/celestial.js';
import {createDensity,carve,meshVolume,encodeDensity} from '../src/mining/volume.js';
import {MineableRock} from '../src/mining/rock.js';
import {RockCollision} from '../src/mining/collision.js';
import {asteroidField} from '../src/ring-world.js';
const storage=()=>{const data=new Map();return {getItem:id=>data.get(id)??null,setItem:(id,v)=>data.set(id,v)};};
function setup(){const disk=storage(),store=new MiningStore(disk);store.state.supplies.pack={};return {disk,store};}
test('field recipes conserve every kilogram and require no water or grid',()=>{
 for(const r of RECIPES){assert.equal(itemMass(r.inputs),itemMass(r.outputs));assert.equal(r.inputs.ice,undefined);assert.equal(r.power,0);assert.equal(r.workstation,'field');}
 const {store}=setup();store.state.pack=[10,0,0];
 assert.equal(craft(store,'aggregate',{quantity:8}).ok,true);
 assert.equal(craft(store,'mineral-binder',{quantity:2}).ok,true);
 assert.equal(craft(store,'concrete').ok,true);
 assert.equal(store.container('pack').items.concrete,10);assert.equal(store.mass,10);
 assert.equal(craft(store,'concrete').ok,false);assert.equal(store.mass,10);
 assert.equal(fitsBox({concrete:49},1),false);
});
test('processed cargo survives every withItems transfer and reload without changing extensions or old cuts',()=>{
 const {store,disk}=setup();store.state.pack=[2,1,0];store.state.build={custom:'preserved'};
 const field=store.state.field;
 assert.equal(craft(store,'aggregate').ok,true);assert.equal(craft(store,'conductor').ok,true);
 assert.equal(store.transfer('aggregate','pack','ship',1).ok,true);
 assert.equal(store.transfer('basalt','pack','ship',1).ok,true);
 const reload=new MiningStore(disk);assert.equal(reload.blocked,undefined);
 assert.equal(reload.container('pack').items.conductor,1);assert.equal(reload.container('ship').items.aggregate,1);
 assert.deepEqual(reload.state.build,{custom:'preserved'});assert.deepEqual(reload.state.field,field);
 const legacy=JSON.parse(disk.getItem(MINING_KEY));delete legacy.materials;disk.setItem(MINING_KEY,JSON.stringify(legacy));
 assert.equal(new MiningStore(disk).blocked,undefined);
});
test('preview, capacity rejection, quota failure and stale session never consume inputs',()=>{
 const {store,disk}=setup();store.state.pack=[2,0,0];assert.equal(store.write(store.state),true);
 const before=store.state,raw=disk.getItem(MINING_KEY);
 assert.equal(previewCraft(store,'aggregate').ok,true);assert.equal(store.state,before);assert.equal(disk.getItem(MINING_KEY),raw);
 assert.equal(craft(store,'aggregate',{quantity:NaN}).ok,false);
 store.state.materials.ship={concrete:192};
 assert.equal(craft(store,'aggregate',{target:'ship'}).ok,false);assert.equal(store.state,before);
 disk.setItem=()=>{throw Error('quota');};assert.equal(craft(store,'aggregate').ok,false);assert.equal(store.state,before);assert.equal(disk.getItem(MINING_KEY),raw);
 const stale=setup();stale.store.state.pack=[1,0,0];stale.disk.setItem(MINING_KEY,'other session');
 assert.equal(craft(stale.store,'aggregate').ok,false);assert.equal(stale.store.state.pack[0],1);
});
test('all processed fractions use the same pack mass budget; malformed material saves are retained and blocked',()=>{
 const {store,disk}=setup();store.state.materials.pack={concrete:48};assert.equal(store.free,0);
 assert.equal(store.commit({field:store.state.field,yieldVolume:[.01,0,0]},0),false);
 assert.equal(store.write(store.state),true);const saved=JSON.parse(disk.getItem(MINING_KEY));saved.materials.pack.concrete=-1;
 const raw=JSON.stringify(saved);disk.setItem(MINING_KEY,raw);assert.equal(new MiningStore(disk).blocked,true);assert.equal(disk.getItem(MINING_KEY),raw);
 assert.equal(MATERIAL_IDS.length,11);
});
test('Aeon and Pyre regenerate finite canonical-ground outcrops including local copper',()=>{
 for(const body of [AEON,PYRE]){
  let deposits=[];
  for(const direction of [[1,0,0],[.6,.7,.2],[-.3,.8,.4],[0,1,0],[0,-1,0]]){
   const point=bodySurfacePoint(new Vector3(...direction).normalize(),body,2);
   const nearby=nearbyConstructionDeposits(point,760);deposits.push(...nearby);
   assert.equal(new Set(nearby.map(d=>d.id)).size,nearby.length);
  }
  assert.ok(deposits.length>0,body.id);assert.ok(deposits.some(d=>d.dominant==='copper'));
  const d=deposits.find(d=>d.dominant==='copper');assert.deepEqual(constructionDepositDescriptor(body,d.row,d.column),d);
  assert.ok(new Vector3(0,1,0).applyQuaternion(d.quaternion).dot(bodySurfaceNormal(d.position,body))>.99);
  const field=createDensity((x,y,z)=>asteroidField(x,y,z,d.variant)),cut=carve(field,[0,.5,.6],.025,.48,d.resourceWeights);
  assert.ok(cut);assert.ok(cut.yieldVolume[1]>0);assert.ok(cut.yieldVolume.reduce((a,b)=>a+b,0)<=.025+1e-6);
  const {store,disk}=setup();store.getRock(d.id,field);assert.equal(store.commitRock(d.id,cut,0),true);
  assert.equal(store.commitRock(d.id,cut,0),false);const reload=new MiningStore(disk);assert.equal(reload.getRock(d.id,field).revision,1);assert.deepEqual(reload.getRock(d.id,field).field,cut.field);
 }
});

test('actual Aeon/Pyre rock rays use their own terrain and finite density edits survive reload',()=>{
 class Worker {
  postMessage(job){
   const cut=job.point?carve(job.field,job.point,job.budget,.48,job.resourceWeights):{field:job.field,yieldVolume:[0,0,0]};
   if(!cut){this.onmessage({data:{id:job.id,empty:true}});return;}
   const mesh=meshVolume(cut.field,job.resourceWeights);
   this.onmessage({data:{id:job.id,...cut,...mesh,encodedField:encodeDensity(cut.field),collision:new RockCollision(mesh.positions).pack(),meshMs:0}});
  }
  terminate(){}
 }
 for(const body of [AEON,PYRE]){
  let d;
  for(const direction of [[1,0,0],[.6,.7,.2],[-.3,.8,.4],[0,1,0],[0,-1,0]]){
   d=nearbyConstructionDeposits(bodySurfacePoint(new Vector3(...direction).normalize(),body,2),760)[0];if(d)break;
  }
  assert.ok(d);
  const {store,disk}=setup(),initialField=createDensity((x,y,z)=>asteroidField(x,y,z,d.variant));
  const rock=new MineableRock(new Scene(),null,{worker:new Worker(),store,rockId:d.id,position:d.position,quaternion:d.quaternion,initialField,resourceWeights:d.resourceWeights});
  try{
   const eye=rock.toWorld(new Vector3(0,.8,4)),direction=rock.toWorld(new Vector3(0,.8,0)).sub(eye).normalize();
   const hit=rock.raycast(eye,direction);assert.ok(hit,body.id+' has reachable exposed rock');
   rock.onMine({point:hit.point,normal:hit.normal,dt:.1},direction);
   assert.equal(rock.snapshot.revision,1);assert.ok(store.mass>0);
   const reloaded=new MiningStore(disk);assert.equal(reloaded.getRock(d.id,initialField).revision,1);
   assert.deepEqual(reloaded.getRock(d.id,initialField).field,rock.snapshot.field);
   // Exhaust one contact volume: repeated requests cannot regenerate its mass.
   let field=initialField,total=0,last;
   for(let i=0;i<80;i++){
    last=carve(field,[0,.5,.6],.045,.48,d.resourceWeights);if(!last)break;
    total+=last.yieldVolume.reduce((a,b)=>a+b,0);field=last.field;
   }
   assert.equal(last,null);assert.ok(total>0&&total<1);
  }finally{rock.dispose();}
 }
});

test('bounded deposit ledger fits a measured serialized budget and never evicts saved ore',()=>{
 const {store,disk}=setup(),field=createDensity();
 for(let i=0;i<MAX_SAVED_ROCKS;i++){
  const id=`budget-rock-${i}`;store.getRock(id,field);assert.equal(store.commitRock(id,{field,yieldVolume:[0,0,0]},0),true);
 }
 assert.ok(disk.getItem(MINING_KEY).length<3300000);
 assert.equal(store.canEditRock('extra-rock'),false);assert.equal(store.canEditRock('budget-rock-0'),true);
 const reload=new MiningStore(disk);assert.equal(Object.keys(reload.state.rocks).length,MAX_SAVED_ROCKS);
 assert.equal(reload.getRock('budget-rock-0',field).revision,1);
});
