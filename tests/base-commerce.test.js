import test from 'node:test';import assert from 'node:assert/strict';
import {placeCrate} from '../src/cargo/grid.js';
import { baseFixture } from './helpers/base-commerce.js';
import { MiningStore } from '../src/mining/store.js';
import { commerceCommand,ensureAccount,validCommerce } from '../src/trading/model.js';
import { registerBase,baseDocked,validBaseTerminal } from '../src/trading/base-site.js';
import { publicBaseTerminal,tradeSummary,releaseInvalidBaseOffers } from '../src/trading/base-stock.js';
const source='build-crate-5';
function stocked(){const f=baseFixture();f.store.write(f.store.withItems(f.store.state,source,{...f.store.container(source).items,copper:80}));f.link();f.id=Object.keys(f.local.state.terminals)[0];return f;}
test('owner selects a finite part of actual local stock; transfer, save and unlist agree',()=>{
 const f=stocked();f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:3,price:48});
 assert.equal(f.store.container(source).items.copper,80);assert.equal(f.local.state.terminals[f.id].stock.copper,3);
 assert.equal(f.store.transfer('copper',source,'ship',40).ok,false);assert.match(f.store.warning,/reserved/);assert.equal(f.store.blocked,undefined);
 assert.equal(f.store.transfer('copper',source,'ship',16).ok,true);assert.equal(f.local.state.terminals[f.id].base.storage[source].items.copper,64);
 assert.equal(new MiningStore(f.disk).state.commerce.terminals[f.id].stock.copper,3);
 f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:0,price:48});assert.equal(f.store.transfer('copper',source,'ship',64).ok,true);
 f.build.dispose();
});
test('new deposits stay unlisted and invalid offers or failed saves retain stock',()=>{
 const f=stocked();f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:1,price:48});
 f.store.write(f.store.withItems(f.store.state,source,{...f.store.container(source).items,copper:96}));assert.equal(f.local.state.terminals[f.id].stock.copper,1);
 const before=f.store.state;assert.throws(()=>f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:7,price:48}),/exceeds/);assert.equal(f.store.state,before);
 f.disk.setItem=()=>{throw Error('quota');};assert.throws(()=>f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:2,price:48}),/Save unavailable/);assert.equal(f.store.state,before);f.build.dispose();
});
test('buyer purchase atomically spends source stock, reservation, credits and cargo; replay is inert',()=>{
 const f=stocked();f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:3,price:48});
 const state=structuredClone(f.local.state);ensureAccount(state,'buyer');const m={op:'buy',commandId:'purchase-1',revision:state.revision,terminal:f.id,ship:'buyer:nomad',resource:'copper',sbu:2};
 const ctx={terminal:()=>true,docked:()=>true};const result=commerceCommand(state,'buyer',m,ctx),t=result.state.terminals[f.id];
 assert.equal(t.base.storage[source].items.copper,48);assert.equal(t.stock.copper,1);assert.equal(result.state.accounts.buyer.credits,1404);assert.equal(result.state.accounts['local-player'].credits,state.accounts['local-player'].credits+96);assert.equal(result.state.ships['buyer:nomad'].crates[0].sbu,2);
 assert.ok(commerceCommand(result.state,'buyer',m,ctx).replayed);assert.throws(()=>commerceCommand(result.state,'buyer',{...m,commandId:'race-2'},ctx),/Cargo changed/);
 const leaked=publicBaseTerminal(t,'buyer',{near:true});assert.equal(leaked.base.storage,undefined);assert.equal(leaked.base.offers,undefined);assert.match(tradeSummary(t),/Copper/);assert.ok(validCommerce(result.state));f.build.dispose();
});
test('closed shop, no reach, full cargo and forged owner edits leave source unchanged',()=>{
 const f=stocked();f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:3,price:48});const s=structuredClone(f.local.state);ensureAccount(s,'buyer');
 const m={op:'buy',commandId:'x',revision:s.revision,terminal:f.id,ship:'buyer:nomad',resource:'copper',sbu:1};
 assert.throws(()=>commerceCommand(s,'buyer',m,{terminal:()=>false}),/Walk up/);
 assert.throws(()=>commerceCommand(s,'buyer',m,{terminal:()=>true,docked:()=>true,baseActive:()=>false}),/unpowered/);
 s.accounts.buyer.credits=0;assert.throws(()=>commerceCommand(s,'buyer',m,{terminal:()=>true,docked:()=>true}),/Insufficient/);s.accounts.buyer.credits=1500;
 const ship=s.ships['buyer:nomad'];for(let i=0;i<6;i++)ship.crates.push(placeCrate('nomad',ship.crates,{id:`full-${i}`,resource:'basalt',sbu:1}));
 assert.ok(validCommerce(s));const before=structuredClone(s);assert.throws(()=>commerceCommand(s,'buyer',m,{terminal:()=>true,docked:()=>true}),/grid space/);assert.deepEqual(s,before);
 s.terminals[f.id].base.open=false;assert.throws(()=>commerceCommand(s,'buyer',m,{terminal:()=>true,docked:()=>true}),/closed/);
 assert.throws(()=>commerceCommand(s,'buyer',{...m,op:'base-settings',setting:'public',value:true},{terminal:()=>true}),/owner/);f.build.dispose();
});
test('source or terminal removal with reservations is rejected without destroying the save',()=>{
 const f=stocked();f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:1,price:48});const before=f.store.state;
 assert.equal(f.store.write({...before,build:{...before.build,claims:[]},remote:{}}),false);assert.equal(f.store.state,before);assert.match(f.store.warning,/Unlist/);f.build.dispose();
});
test('shared commissioning validates geometry and ignores all client stock',()=>{
 const f=stocked(),s=structuredClone(f.local.state);s.terminals={};ensureAccount(s,'server-owner');
 const result=registerBase(s,'server-owner',{claim:f.claim,terminalPiece:'build-piece-4'},{nav:f.nav,shared:true});
 const t=result.state.terminals[result.terminal];assert.ok(validBaseTerminal(t));assert.equal(t.base.storage[source].items.copper,0);assert.equal(result.state.accounts['server-owner'].credits,1000);assert.equal(t.base.public,false);f.build.dispose();
});

test('trusted expiry removes the listing with its base; restored lower stock cancels only excess offers',()=>{
 const f=stocked();f.command({op:'base-offer',terminal:f.id,source,resource:'copper',quantity:3,price:48});
 const reduced=f.store.withItems(f.store.state,source,{...f.store.container(source).items,copper:16});assert.equal(f.store.write(releaseInvalidBaseOffers(reduced)),true);assert.equal(f.local.state.terminals[f.id].stock.copper,1);
 assert.equal(f.store.write(releaseInvalidBaseOffers({...f.store.state,build:{...f.store.state.build,claims:[]},remote:{}})),true);assert.equal(f.local.state.terminals[f.id],undefined);f.build.dispose();
});
