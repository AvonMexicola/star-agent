import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3,Quaternion} from 'three';
import {setPlanetSeed} from '../src/generation.js';
import {createSettlementLayouts} from '../src/settlements/layout.js';
import {createSettlements} from '../src/settlements/system.js';
import {SETTLEMENTS,settlementMarketId} from '../src/settlements/catalog.js';
import {PIECES} from '../src/build/definitions.js';
import {supportedPieces} from '../src/build/structure.js';
import {mountReason} from '../src/build/mounts.js';
import {BODIES,bodySurfacePoint} from '../src/celestial.js';
import {restoreBuildAnchors} from '../src/build/anchors.js';
import {SHIP_LAYOUT} from '../src/boarding.js';
import {emptyCommerce,ensureAccount,normalizeSettlementMarkets,commerceCommand} from '../src/trading/model.js';
import {LocalTrading} from '../src/trading/local.js';
import {MiningStore} from '../src/mining/store.js';
const sites=createSettlementLayouts(),v=a=>new Vector3(...a);

test('four distinct settlements use supported kit pieces and supported roof/light mounts',()=>{
 assert.deepEqual(sites.map(s=>s.body),['aeon','selene','pyre','miasma']);
 assert.equal(new Set(sites.map(s=>JSON.stringify(s.claim.pieces.map(p=>[p.type,p.position,p.rotation])))).size,4);
 for(const s of sites){
  const support=supportedPieces(s.claim.pieces);
  for(const p of s.claim.pieces){assert.ok(PIECES[p.type]);assert.equal(mountReason(p,s.claim.pieces),null,`${s.id} ${p.type}`);if(['wall','floor','stairs'].includes(PIECES[p.type].category))assert.ok(support.has(p.id),p.id);}
  assert.equal(s.pad.type,'foundation-pad-large');assert.equal(s.pad.landingPad,true);
  assert.equal(s.claim.pieces.filter(p=>p.type==='doorway').length,3);
 }
});
test('slab surfaces clear actual terrain and all pad piers reach it',()=>{
 for(const s of sites){const body=BODIES.find(b=>b.id===s.body),q=new Quaternion(...s.claim.quaternion),up=new Vector3(0,1,0).applyQuaternion(q),origin=v(s.claim.origin);
  for(const p of s.claim.pieces.filter(p=>PIECES[p.type].padSize)){
   const [w,l]=PIECES[p.type].footprint;
   for(let x=-w/2;x<=w/2;x+=2)for(let z=-l/2;z<=l/2;z+=2){const point=new Vector3(x+p.position[0],0,z+p.position[2]).applyQuaternion(q).add(origin);const ground=bodySurfacePoint(point.sub(v(body.center)).normalize(),body).sub(origin).dot(up);assert.ok(p.position[1]-ground>.02,`${s.id} deck buried`);assert.ok(p.position[1]-ground<8,`${s.id} unsupported pier`);}
  }
  const restored=restoreBuildAnchors({claims:[s.claim]});assert.equal(restored.ok,true);assert.ok(v(restored.build.claims[0].origin).distanceTo(origin)<.00001);
 }
});
test('physical pad support, terminal reach, open door collision and online exclusion share one layout',()=>{
 const s=sites[1],q=new Quaternion(...s.claim.quaternion),nav={position:v(s.claim.origin),orientation:q,layout:SHIP_LAYOUT,mode:'walk',insideShip:false};
 let enabled=true;const system=createSettlements({scene:new Scene(),nav,render:false,enabled:()=>enabled});
 try{
  const pad=system.buildings.toWorld(v(s.pad.position),s.claim),pose={position:pad,orientation:q};
  assert.equal(system.landingSurface(pose)?.size,'L');assert.equal(Boolean(system.docked(s.id,pose)),true);
  assert.equal(Boolean(system.docked(s.id,{...pose,position:pad.clone().addScaledVector(new Vector3(0,1,0).applyQuaternion(q),20)})),false);
  const a=system.buildings.toWorld(new Vector3(-2,s.pad.position[1]+1.75,-14),s.claim),b=system.buildings.toWorld(new Vector3(-2,s.pad.position[1]+1.75,-19.8),s.claim);
  const walked=system.constrainWalker(a,b);assert.ok(walked.point.distanceTo(b)<.001,'exchange doorway is physically clear');
  assert.ok(system.terminalPosition(s.id).distanceTo(b)<2.8,'trade terminal reachable through open doorway');
  const wall=system.buildings.toWorld(new Vector3(6,s.pad.position[1]+1.75,-14),s.claim);assert.ok(system.raycast(wall,new Vector3(0,0,-1).applyQuaternion(q),6),'adjacent wall blocks the same route');
  assert.equal(system.beacons().length,4);
  system.buildings.canBuild=()=>true;system.buildings.protectedClaims=()=>system.claims;
  assert.match(system.buildings.validate({...s.claim,owner:'local-player'},s.terminalPiece),/public trade settlement/);
  enabled=false;assert.equal(system.beacons().length,0);assert.equal(system.landingSurface(pose),null);assert.equal(system.terminalPosition(s.id),null);
 }finally{system.dispose();}
});
test('independent finite markets consume real cargo/credits, reject distance, preserve receipts and never refill on reload',()=>{
 let state=normalizeSettlementMarkets(emptyCommerce());ensureAccount(state,'pilot');
 const ctx={terminal:()=>true,docked:()=>true,stationMarket:settlementMarketId};
 const m={op:'buy',terminal:'settlement-selene',ship:'pilot:nomad',resource:'ice',sbu:1,commandId:'settlement-test',revision:state.revision};
 const before=structuredClone(state);assert.throws(()=>commerceCommand(state,'pilot',m,{...ctx,terminal:()=>false}),/Walk up/);assert.deepEqual(state,before);
 const result=commerceCommand(state,'pilot',m,ctx);state=result.state;
 assert.equal(state.markets[m.terminal].stock.ice,before.markets[m.terminal].stock.ice-1);assert.equal(state.ships[m.ship].crates.length,1);assert.equal(state.accounts.pilot.credits,before.accounts.pilot.credits-result.quote.total);
 assert.deepEqual(state.markets['settlement-aeon'],before.markets['settlement-aeon']);assert.equal(commerceCommand(state,'pilot',m,ctx).replayed,true);
 const crate=state.ships[m.ship].crates[0];state=commerceCommand(state,'pilot',{...m,op:'sell',crate:crate.id,revision:state.revision,commandId:'sell-back'},ctx).state;
 assert.equal(state.markets[m.terminal].stock.ice,before.markets[m.terminal].stock.ice);assert.equal(state.ships[m.ship].crates.length,0);assert.ok(state.accounts.pilot.credits<before.accounts.pilot.credits);
 state.markets[m.terminal].stock.ice=0;assert.equal(normalizeSettlementMarkets(state),state);assert.equal(state.markets[m.terminal].stock.ice,0);
 const damaged=structuredClone(state);delete damaged.markets[m.terminal];assert.throws(()=>normalizeSettlementMarkets(damaged),/Original save retained/);
});
test('local market migration preserves player inventory, build data and exhausted market stock',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k)??null,setItem:(k,value)=>values.set(k,value)};
 const store=new MiningStore(storage),before=structuredClone(store.state);const local=new LocalTrading(store);
 assert.equal(local.error,'');assert.deepEqual(store.state.build,before.build);assert.deepEqual(store.state.items,before.items);
 const saved=structuredClone(store.state);saved.commerce.markets['settlement-pyre'].stock.basalt=0;store.write(saved);
 const reloaded=new LocalTrading(new MiningStore(storage));assert.equal(reloaded.error,'');assert.equal(reloaded.state.markets['settlement-pyre'].stock.basalt,0);
 assert.equal(SETTLEMENTS.every(s=>reloaded.state.markets[s.id]),true);
});

test('non-default planet seeds retain four supported settlements without changing the canonical terrain',()=>{
 try{for(const seed of [0,1,42,12345,4294967295]){setPlanetSeed(seed);assert.equal(createSettlementLayouts().length,4,`seed ${seed}`);}}finally{setPlanetSeed(7291);createSettlementLayouts();}
});
