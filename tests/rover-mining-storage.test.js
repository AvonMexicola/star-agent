import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene,Vector3,Quaternion } from 'three';
import { MiningStore,MINING_KEY } from '../src/mining/store.js';
import { MineableRock } from '../src/mining/rock.js';
import { createDensity,carve,meshVolume,ROCK_ID } from '../src/mining/volume.js';
import { MATERIAL_IDS,emptyItems } from '../src/inventory/containers.js';

const BIN='meridian-rover-bin',field=createDensity(),initialMesh=meshVolume(field),cut=carve(field,[0,0,1.35],.025);
const mass=items=>MATERIAL_IDS.reduce((sum,id)=>sum+(items[id]??0),0);
const near=(actual,expected)=>assert.ok(Math.abs(actual-expected)<1e-7,`${actual} != ${expected}`);
function fixture(){
  const data=new Map();let writes=0;
  const disk={getItem:key=>data.get(key)??null,setItem:(key,value)=>{writes++;data.set(key,value);}};
  const store=new MiningStore(disk);
  assert.equal(store.registerContainer({id:BIN,name:'Rover mineral bin',kind:'ship',boxes:2}),true);
  return {disk,store,get writes(){return writes;}};
}
function fill(store,id,items){assert.equal(store.write(store.withItems(store.state,id,{...emptyItems(),...items})),true);}
function rockFixture(store,rockId=ROCK_ID){
  const worker={jobs:[],postMessage(job){this.jobs.push(job);},terminate(){}},scene=new Scene();
  const rock=new MineableRock(scene,null,{store,worker,rockId,initialField:field,space:true,position:new Vector3(25e9,30,40),quaternion:new Quaternion()});
  rock.receive({id:worker.jobs[0].id,field:rock.snapshot.field,...initialMesh,meshMs:0});
  assert.equal(rock.ready,true);const events=[];rock.onExtract=event=>events.push(event);
  const input=(destination=BIN,dt=.1)=>({point:rock.toWorld(new Vector3(0,0,1.43)),normal:new Vector3(0,0,1),direction:new Vector3(0,0,-1),dt,rate:.22,destination});
  function reply(job=worker.jobs.at(-1),extra={}){
    const result=carve(job.field,job.point,job.budget,.48,job.resourceWeights);assert.ok(result?.removed>0);
    const data={id:job.id,...result,...meshVolume(result.field,job.resourceWeights),meshMs:0,...extra};rock.receive(data);return data;
  }
  return {rock,worker,events,input,reply};
}

test('the default mining transaction and free getter retain backpack behavior',()=>{
  const f=fixture(),{store}=f,remote=store.state.remote;
  near(store.freeFor(),48);near(store.free,store.freeFor('pack'));near(store.freeFor(BIN),96);
  const writes=f.writes;assert.equal(store.commit(cut,0),true);assert.equal(f.writes,writes+1);
  assert.deepEqual(store.state.pack,cut.yieldVolume);assert.equal(store.state.remote,remote);near(mass(store.container(BIN).items),0);
  near(store.free,store.capacity-store.mass);assert.deepEqual(new MiningStore(f.disk).state,store.state);
});

test('rover ore, rock revision and earned mining XP persist in one transaction without replay payouts',()=>{
  const f=fixture(),{store}=f,id='rover-deposit-a';store.getRock(id,field);
  const pack=store.state.pack,legacy=store.state.field,writes=f.writes;
  assert.equal(store.commitRock(id,cut,0,BIN),true);assert.equal(f.writes,writes+1);assert.equal(store.state.pack,pack);assert.equal(store.state.field,legacy);assert.equal(store.state.revision,0);
  assert.equal(store.state.rocks[id].field,cut.field);assert.equal(store.state.rocks[id].revision,1);
  for(const [i,key] of ['basalt','copper','ice'].entries())near(store.container(BIN).items[key],cut.yieldVolume[i]);
  near(store.state.progression.mining.xp,cut.removed*100);
  const saved=f.disk.getItem(MINING_KEY),state=store.state;
  assert.equal(store.commitRock(id,cut,0,'pack'),false);assert.equal(store.state,state);assert.equal(f.disk.getItem(MINING_KEY),saved);assert.equal(f.writes,writes+1);
  const reload=new MiningStore(f.disk);assert.deepEqual(reload.state,store.state);assert.equal(reload.container(BIN).kind,'ship');assert.equal(reload.container(BIN).boxes,2);
});

test('rover capacity includes processed minerals and remains independent of a full or absent backpack',()=>{
  const {store}=fixture();fill(store,BIN,{copper:5,aggregate:7,repair:2});fill(store,'pack',{basalt:48});
  near(store.free,0);near(store.freeFor(BIN),84);
  assert.equal(store.commitRock(ROCK_ID,cut,0,BIN),true);near(store.mass,48);
  store.state.loadout.slots.backpack=null;near(store.freeFor('pack'),0);assert.ok(store.freeFor(BIN)>83);
});

test('unknown, mass-full and slot-full destinations reject cuts without writes or state publication',()=>{
  const f=fixture(),{store}=f;
  for(const destination of ['missing-rover','__proto__','constructor',null]){
    const before=store.state,raw=f.disk.getItem(MINING_KEY),writes=f.writes;near(store.freeFor(destination),0);
    assert.equal(store.commitRock(ROCK_ID,cut,0,destination),false);assert.equal(store.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);assert.equal(f.writes,writes);assert.match(store.warning,/destination is unavailable/i);
  }
  for(const items of [{basalt:96},{sample:16}]){
    fill(store,BIN,items);assert.equal(store.validContainers(store.state),true);
    const before=store.state,raw=f.disk.getItem(MINING_KEY),writes=f.writes;
    assert.equal(store.commitRock(ROCK_ID,cut,0,BIN),false);assert.equal(store.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);assert.equal(f.writes,writes);assert.match(store.warning,/full/i);
  }
});

test('request budgets use rover free space and full or unknown destinations submit no mining work',()=>{
  const {store}=fixture();fill(store,'pack',{basalt:48});fill(store,BIN,{basalt:95.99});
  const f=rockFixture(store);f.rock.onMine(f.input());assert.equal(f.rock.pending,true);near(f.worker.jobs.at(-1).budget,.01);assert.equal(f.rock.job.destination,BIN);f.rock.dispose();
  fill(store,BIN,{basalt:96});const full=rockFixture(store);
  for(const destination of [BIN,'missing-rover',null])full.rock.onMine(full.input(destination));
  assert.equal(full.worker.jobs.length,1);assert.equal(full.rock.pending,false);full.rock.dispose();
});

test('a delayed job retains its destination despite later tool input or destination fields in the reply',()=>{
  const {store}=fixture(),f=rockFixture(store),first=f.input();f.rock.onMine(first);
  const roverJob=f.worker.jobs.at(-1);assert.equal(f.rock.job.destination,BIN);first.destination='pack';
  const handheld=f.input('pack');delete handheld.direction;f.rock.onMine(handheld,new Vector3(0,0,-1));
  assert.equal(f.rock.budgetDestination,'pack');assert.equal(f.rock.job.destination,BIN);
  const result=f.reply(roverJob,{destination:'pack'});near(store.mass,0);near(mass(store.container(BIN).items),result.removed);assert.equal(f.events[0].destination,BIN);
  f.rock.receive(result);assert.equal(f.events.length,1,'replayed worker result grants no second event or payout');
  f.rock.onMine({...handheld,dt:0},new Vector3(0,0,-1));assert.equal(f.rock.job.destination,'pack');
  const packResult=f.reply();near(store.mass,packResult.removed);near(mass(store.container(BIN).items),result.removed);assert.equal(f.events[1].destination,'pack');f.rock.dispose();
});

test('switching destinations discards only the previous unsubmitted cut budget',()=>{
  const {store}=fixture(),f=rockFixture(store);
  f.rock.onMine(f.input(BIN,.06));assert.equal(f.worker.jobs.length,1);near(f.rock.budget,.0132);
  f.rock.onMine(f.input('pack',.06));assert.equal(f.worker.jobs.length,1);near(f.rock.budget,.0132);
  f.rock.onMine(f.input('pack',.03));assert.equal(f.worker.jobs.length,2);assert.equal(f.rock.job.destination,'pack');near(f.worker.jobs.at(-1).budget,.0198);f.rock.dispose();
});

test('a save failure preserves both inventories, earned XP, visible mesh and collision together',()=>{
  const {store,disk}=fixture(),f=rockFixture(store),oldGeometry=f.rock.mesh.geometry,oldCollision=f.rock.collision;
  f.rock.onMine(f.input());const before=store.state,raw=disk.getItem(MINING_KEY);
  disk.setItem=()=>{throw Error('quota');};const result=f.reply();
  assert.equal(store.state,before);assert.equal(store.saved,false);assert.equal(disk.getItem(MINING_KEY),raw);assert.equal(f.rock.mesh.geometry,oldGeometry);assert.equal(f.rock.collision,oldCollision);assert.equal(f.events.length,0);
  f.rock.receive(result);assert.equal(f.events.length,0);near(store.mass,0);near(mass(store.container(BIN).items),0);near(store.state.progression.mining.xp,0);
  assert.deepEqual(new MiningStore(disk).state,before);f.rock.dispose();
});

test('capacity is checked again at completion and cannot overwrite cargo added while a job is pending',()=>{
  const {store,disk}=fixture(),f=rockFixture(store),oldGeometry=f.rock.mesh.geometry,oldCollision=f.rock.collision;
  f.rock.onMine(f.input());fill(store,BIN,{basalt:96});const filled=store.state,raw=disk.getItem(MINING_KEY);f.reply();
  assert.equal(store.state,filled);assert.equal(disk.getItem(MINING_KEY),raw);assert.equal(f.rock.mesh.geometry,oldGeometry);assert.equal(f.rock.collision,oldCollision);assert.equal(f.events.length,0);assert.equal(store.state.revision,0);near(store.state.progression.mining.xp,0);f.rock.dispose();
});

test('competing rocks cannot spend the same remaining rover capacity or duplicate mining rewards',()=>{
  const {store}=fixture();fill(store,BIN,{basalt:95.97});const a=rockFixture(store,'rover-concurrent-a'),b=rockFixture(store,'rover-concurrent-b'),oldGeometry=b.rock.mesh.geometry;
  a.rock.onMine(a.input());b.rock.onMine(b.input());const first=a.reply();b.reply();
  assert.equal(a.events.length,1);assert.equal(b.events.length,0);assert.equal(store.state.rocks['rover-concurrent-a'].revision,1);assert.equal(store.state.rocks['rover-concurrent-b'],undefined);assert.equal(b.rock.mesh.geometry,oldGeometry);
  near(mass(store.container(BIN).items),95.97+first.removed);near(store.state.progression.mining.xp,first.removed*100);near(store.mass,0);a.rock.receive(first);assert.equal(a.events.length,1);
  a.rock.dispose();b.rock.dispose();
});
