import test from 'node:test';import assert from 'node:assert/strict';
import { MiningStore } from '../src/mining/store.js';import { LocalTrading } from '../src/trading/local.js';
const ctx={terminal:()=>true,docked:()=>true,resources:()=>16};
test('local cargo and loose ore persist together; stale tabs and failed writes cannot duplicate resources',()=>{
 const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v)};const store=new MiningStore(storage);store.write(store.withItems(store.state,'pack',{...store.container('pack').items,basalt:16}));const trader=new LocalTrading(store),stale=new LocalTrading(new MiningStore(storage));
 const result=trader.command({op:'pack',resource:'basalt',sbu:1,ship:'local-player:nomad',terminal:'station:1',commandId:'local-pack',revision:0},ctx);assert.equal(result.resourceDelta,-16);assert.equal(store.container('pack').items.basalt,0);
 const restored=new LocalTrading(new MiningStore(storage));assert.equal(restored.state.ships['local-player:nomad'].crates.length,1);
 assert.throws(()=>stale.command({op:'buy',resource:'basalt',sbu:1,ship:'local-player:nomad',terminal:'station:1',commandId:'stale',revision:0},ctx),/Save unavailable/);
 storage.setItem=()=>{throw Error('disk full');};const before=structuredClone(restored.state);assert.throws(()=>restored.command({op:'buy',resource:'basalt',sbu:1,ship:'local-player:nomad',terminal:'station:1',commandId:'failed',revision:1},ctx),/Save unavailable/);assert.deepEqual(restored.state,before);
});
