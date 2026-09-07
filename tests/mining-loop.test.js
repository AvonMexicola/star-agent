import test from 'node:test';
import assert from 'node:assert/strict';
import { Scene } from 'three';
import { MiningStore, MINING_KEY, RECOVERED_KG_PER_CUBIC_METRE } from '../src/mining/store.js';
import { createDensity, carve, meshVolume } from '../src/mining/volume.js';
import { asteroidField } from '../src/ring-world.js';
import { MineableRock } from '../src/mining/rock.js';
import { MINING_XP_PER_KG, miningSkill } from '../src/mining/progression.js';
import { emptyItems, PROCESSED_IDS, stacksFor } from '../src/inventory/containers.js';
import { craft } from '../src/crafting/transactions.js';

function setup() {
  const data = new Map();
  const disk = {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};
  return {disk,store:new MiningStore(disk)};
}
// A wide audit cut exhausts the real generated density using production carve
// quadrature. This measures total recoverable mass, not a normal tool reach or
// browser mining journey; no invented reward array or emptied field is injected.
const fields = Array.from({length:6},(_,variant)=>createDensity((x,y,z)=>asteroidField(x,y,z,variant)));
const cuts = fields.map(field=>carve(field,[0,0,0],100,4,[.96,.04,0]));
const largest = cuts.reduce((best,cut,index)=>cut.removed>cuts[best].removed?index:best,0);
const initial = fields[largest], exhausted = cuts[largest];
const xp = store => store.state.progression.mining.xp;
const near = (actual,expected) => assert.ok(Math.abs(actual-expected)<1e-7,`${actual} ≠ ${expected}`);

test('three largest common generated outcrops fit the starter backpack and persist exact accepted XP', () => {
  const {store,disk} = setup();
  assert.equal(store.state.boxes.pack,1);
  assert.equal(store.capacity,48);
  for(let i=0;i<3;i++) {
    const id=`loop-common-${i}`;
    store.getRock(id,initial);
    assert.equal(store.commitRock(id,exhausted,0),true,`whole common rock ${i+1} fits without depositing`);
    assert.equal(carve(store.getRock(id).field,[0,0,0],100,4),null,'the generated rock is exhausted');
  }
  near(store.mass,41.23594230923754);
  near(xp(store),store.mass*MINING_XP_PER_KG);
  assert.equal(miningSkill(store.state.progression).level,3);
  assert.ok(stacksFor(store.container('pack').items).length<=8,'normal starter supplies still fit alongside minerals');
  const reload = new MiningStore(disk);
  assert.deepEqual(reload.state,store.state);
  near(xp(reload),3*exhausted.removed*RECOVERED_KG_PER_CUBIC_METRE*MINING_XP_PER_KG);
  const id='loop-common-3';store.getRock(id,initial);
  const before=store.state,raw=disk.getItem(MINING_KEY);
  assert.equal(store.commitRock(id,exhausted,0),false,'fourth complete rock exceeds one box');
  assert.equal(store.state,before);assert.equal(disk.getItem(MINING_KEY),raw);
  assert.equal(store.getRock(id).revision,0);assert.deepEqual(store.getRock(id).field,initial);
  assert.equal(store.addBox('pack').ok,true);assert.equal(store.capacity,96);
  assert.equal(store.commitRock(id,exhausted,0),true,'attaching the second box extends the same loop');
  near(xp(store),store.mass*MINING_XP_PER_KG);
});

test('legacy saves gain zero XP without changing old cargo, cuts, supplies or construction', () => {
  const {store,disk}=setup();
  const cut=carve(store.state.field,[0,0,1.35],.025);
  assert.equal(store.commit(cut,0),true);
  const old=JSON.parse(disk.getItem(MINING_KEY));delete old.progression;
  old.pack=[12,0,0];old.ship=[32,5,2];old.build={version:1,nextId:1,claims:[]};
  const raw=JSON.stringify(old);disk.setItem(MINING_KEY,raw);
  const reload=new MiningStore(disk);
  assert.ok(!reload.blocked);assert.equal(xp(reload),0);
  assert.deepEqual(reload.state.pack,old.pack);assert.deepEqual(reload.state.ship,old.ship);
  assert.deepEqual(reload.state.field,cut.field);assert.equal(reload.state.revision,1);
  assert.deepEqual(reload.state.supplies,old.supplies);assert.deepEqual(reload.state.build,old.build);
  assert.equal(disk.getItem(MINING_KEY),raw,'migration reads without overwriting original save');
});

test('malformed persisted XP blocks mining and retains the original save', () => {
  const {store,disk}=setup();assert.equal(store.write(store.state),true);
  const baseline=JSON.parse(disk.getItem(MINING_KEY));
  for(const invalid of [null,{}, {mining:{xp:-1}}, {mining:{xp:'25'}}, {mining:{xp:1e100}}]) {
    const raw=JSON.stringify({...baseline,progression:invalid});disk.setItem(MINING_KEY,raw);
    const reload=new MiningStore(disk);assert.equal(reload.blocked,true);
    const cut=carve(reload.state.field,[0,0,1.35],.025);
    assert.equal(reload.commit(cut,0),false);assert.equal(disk.getItem(MINING_KEY),raw);
  }
});

test('full stack slots reject an otherwise mass-affordable cut without XP or density changes', () => {
  const {store,disk}=setup();
  const items={...emptyItems(),...Object.fromEntries([...PROCESSED_IDS,'copper','ice'].map(id=>[id,1]))};
  const filled=store.withItems(store.state,'pack',items);
  assert.equal(store.validContainers(filled),true);assert.equal(store.write(filled),true);
  assert.equal(stacksFor(store.container('pack').items).length,8);
  const cut=carve(store.state.field,[0,0,1.35],.025,.48,[1,0,0]);
  assert.ok(cut.removed<store.free);assert.ok(cut.yieldVolume[0]>0);
  const before=store.state,raw=disk.getItem(MINING_KEY);
  assert.equal(store.commit(cut,0),false);assert.match(store.warning,/stack slots/);
  assert.equal(store.state,before);assert.equal(xp(store),0);assert.equal(disk.getItem(MINING_KEY),raw);
});

test('stale worker revisions, stale sessions and denied storage cannot publish XP or cuts', () => {
  const f=setup(),cut=carve(f.store.state.field,[0,0,1.35],.025);
  assert.equal(f.store.commit(cut,0),true);
  let before=f.store.state,raw=f.disk.getItem(MINING_KEY);
  assert.equal(f.store.commit(cut,0),false);assert.equal(f.store.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);
  for(const failure of ['quota','stale']) {
    const {store,disk}=setup();assert.equal(store.write(store.state),true);
    before=store.state;
    if(failure==='quota')disk.setItem=()=>{throw Error('quota');};
    else disk.setItem(MINING_KEY,disk.getItem(MINING_KEY)+' ');
    raw=disk.getItem(MINING_KEY);
    assert.equal(store.commit(cut,0),false);assert.equal(store.state,before);assert.equal(xp(store),0);
    assert.equal(disk.getItem(MINING_KEY),raw);assert.equal(store.state.revision,0);
  }
});

test('depleted and missed worker cuts leave XP, cargo and the persisted revision unchanged', () => {
  const {store,disk}=setup(),id='loop-empty';store.getRock(id,initial);
  assert.equal(store.commitRock(id,exhausted,0),true);
  const worker={postMessage(job){this.job=job;},terminate(){}};
  const rock=new MineableRock(new Scene(),null,{worker,store,rockId:id,initialField:initial});
  try {
    rock.receive({id:worker.job.id,field:exhausted.field,...meshVolume(exhausted.field)});
    const before=store.state,raw=disk.getItem(MINING_KEY);
    for(const point of [[0,0,0],[20,20,20],[0,0,0]]) {
      assert.equal(rock.request(point,.02),true);
      const result=carve(worker.job.field,worker.job.point,worker.job.budget);
      assert.equal(result,null);
      rock.receive({id:worker.job.id,empty:true});
      assert.equal(store.state,before);assert.equal(disk.getItem(MINING_KEY),raw);
    }
  } finally {rock.dispose();}
});

test('processing, transfers and bulk depositing do not manufacture mining XP', () => {
  const {store,disk}=setup();assert.equal(store.commit(carve(store.state.field,[0,0,0],2,1,[1,0,0]),0),true);
  const earned=xp(store);
  assert.equal(craft(store,'aggregate').ok,true);assert.equal(xp(store),earned);
  assert.equal(store.transfer('aggregate','pack','ship',1).ok,true);assert.equal(xp(store),earned);
  assert.equal(store.stow(),true);assert.equal(xp(store),earned);
  assert.equal(xp(new MiningStore(disk)),earned);
});
