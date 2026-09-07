import test from 'node:test';import assert from 'node:assert/strict';
import {initialPower,powerStep,advancePower,powerStatus,DECAY_MS} from '../src/build/power.js';
import {powerEnvironment} from '../src/build/power-environment.js';
import {updateBaseSites,emptyBaseSites,createBaseSites} from '../server/base-sites.js';
import {createMemoryStore} from '../server/database.js';
import {withClaimAnchor} from '../src/build/anchors.js';
import {SELENE,bodySurfacePoint} from '../src/celestial.js';
import {Vector3,Quaternion} from 'three';import {SUN_POSITION} from '../src/stellar-world.js';import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
import {miningFuelProfile} from '../src/mining/power-fuels.js';
import {MiningStore} from '../src/mining/store.js';import {ROCK_ID} from '../src/mining/volume.js';
const hour=3600000,env=(solar=0,wind=0)=>({solar:()=>solar,wind:()=>wind});
const claim=(types=[])=>withClaimAnchor({id:'build-claim-1',owner:'local-player',name:'Power test',body:'selene',radius:64,useBuffer:false,origin:bodySurfacePoint(new Vector3(...MOON_LANDING_DIRECTION),SELENE).toArray(),quaternion:[0,0,0,1],pieces:['mainframe',...types].map((type,i)=>({id:`build-piece-${i+2}`,type,position:[i*4,0,0],rotation:0,doorOpen:false}))});
const snapshot=c=>({action:'save',revision:0,build:{version:1,nextId:c.pieces.length+2,claims:[c]},storage:{'build-core-1':{name:'Mainframe supplies',boxes:2,items:{'uranium-ore':1,'metal-stock':10}}}});
test('new batteries are empty; actual surplus charges them and nighttime consumes charge',()=>{
 const c={...claim(['solar-array','battery']),power:initialPower(0)};const p=powerStep(c,hour,env(1));assert.ok(Math.abs(p.charge-(2+2.5-.28))<1e-9);assert.equal(p.health,100);
 const night=powerStep({...c,power:p},2*hour,env());assert.ok(Math.abs(night.charge-(p.charge-.28))<1e-9);
});
test('depletion partway through interval counts only truly unpowered time',()=>{
 const c={...claim(),power:{...initialPower(0),charge:.26}};const p=powerStep(c,2*hour,env());assert.equal(p.charge,0);assert.ok(Math.abs(p.health-(100-100/72))<1e-9);
 const live=powerStep({...c,power:p},3*hour,env(1));assert.ok(live.health<p.health,'no generator means sunlight itself cannot power a base');
});
test('finite generator fuel conserves energy and stops burning when batteries are full',()=>{
 const c={...claim(['uranium-generator']),power:{...initialPower(0),charge:2,fuel:{'uranium-ore':1,'helium-3-regolith':0}}};const p=powerStep(c,hour,env());assert.equal(p.charge,2);assert.ok(Math.abs(1-p.fuel['uranium-ore']-.27/240)<1e-9);
 const tiny=powerStep({...c,power:{...initialPower(0),charge:0,fuel:{'uranium-ore':.0001,'helium-3-regolith':0}}},hour,env());assert.equal(tiny.fuel['uranium-ore'],0);assert.ok(tiny.health<100);assert.equal(tiny.charge,0);
});
test('airless moons produce no wind and a roof blocks an otherwise sun-facing array',()=>{
 const direction=new Vector3(...SUN_POSITION).sub(new Vector3(...SELENE.center)).normalize();
 const c=claim(['solar-array','wind-turbine']);c.origin=bodySurfacePoint(direction,SELENE).toArray();c.quaternion=new Quaternion().setFromUnitVectors(new Vector3(0,1,0),direction).toArray();delete c.anchor;
 const sunny=withClaimAnchor(c);assert.equal(powerEnvironment(sunny,0).wind(),0);assert.ok(powerEnvironment(sunny,0).solar(sunny.pieces[1])>.99);
 sunny.pieces.push({id:'build-piece-9',type:'floor',position:[4,3,0],rotation:0,doorOpen:false});assert.equal(powerEnvironment(sunny,0).solar(sunny.pieces[1]),0);
 assert.ok(powerEnvironment({...sunny,body:'aeon'},0).wind()>0);
});
test('server initializes upkeep itself, expires while offline and rejects stale resurrection',()=>{
 const c=claim();c.power={...initialPower(1e12),health:100,charge:700};let s=updateBaseSites(null,snapshot(c),0);assert.equal(s.build.claims[0].power.charge,2);assert.equal(s.build.claims[0].power.updatedAt,0);
 s=updateBaseSites(s,{action:'read'},DECAY_MS+10*hour);assert.equal(s.build.claims.length,0);assert.deepEqual(s.storage,{});
 s=updateBaseSites(s,{...snapshot(c),revision:s.revision},DECAY_MS+11*hour);assert.equal(s.build.claims.length,0);assert.equal(s.build.nextId,3);
});
test('revision conflicts and invalid anchors cannot modify account data; fuel debit is atomic',async()=>{
 const store=createMemoryStore(),a=await store.createAccount({email:'a@test.invalid',callsign:'A',passwordHash:'hash'}),b=await store.createAccount({email:'b@test.invalid',callsign:'B',passwordHash:'hash'}),service=createBaseSites({store,now:()=>0});
 let s=await service.command(a.id,snapshot(claim(['uranium-generator'])));
 await assert.rejects(service.command(a.id,{...snapshot(claim()),revision:0}),/changed/);
 const bad=snapshot(claim());bad.build.claims[0].anchor.origin=[0,0,0];bad.revision=s.revision;await assert.rejects(service.command(a.id,bad),/anchor/);
 s=await service.command(a.id,{action:'fuel',claimId:'build-claim-1',item:'uranium-ore',amount:.1,revision:s.revision});assert.equal(s.buffers['build-claim-1']['uranium-ore'],.9);assert.equal(s.storage['build-core-1'].items['uranium-ore'],.9);assert.equal(s.build.claims[0].power.fuel['uranium-ore'],.1);
 await assert.rejects(service.command(a.id,{action:'fuel',claimId:'build-claim-1',item:'uranium-ore',amount:10,revision:s.revision}),/Not enough/);
 const other=await service.command(b.id,{action:'read'});assert.equal(other.build.claims.length,0);
 const read=await service.command(a.id,{action:'read'});assert.equal(read.build.claims[0].power.fuel['uranium-ore'],.1);
});
test('power survives advance boundaries and an expired base never receives later sunlight revival',()=>{
 const c={...claim(['solar-array']),power:{...initialPower(0),charge:0}};
 const a=advancePower(c,100*hour,()=>env());assert.equal(a.power.health,0);const b=advancePower(a,101*hour,()=>env(1));assert.equal(b.power.health,0);
});
test('fuel geology is moon regolith or rare Pyre ore; carving conserves collected mass and grants XP',()=>{
 assert.equal(miningFuelProfile('x','aeon'),null);assert.equal(miningFuelProfile('x','selene',true),null);assert.equal(miningFuelProfile('x','selene').item,'helium-3-regolith');let count=0;for(let i=0;i<80;i++)count+=Boolean(miningFuelProfile(String(i),'pyre'));assert.ok(count>0&&count<30);
 const data=new Map(),store=new MiningStore({getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)}),field=store.state.field.slice();
 assert.equal(store.commitRock(ROCK_ID,{field,yieldVolume:[1,0,0]},0,'pack',miningFuelProfile('x','selene')),true);assert.equal(store.container('pack').items.basalt,.995);assert.equal(store.container('pack').items['helium-3-regolith'],.005);assert.equal(store.mass,1);assert.ok(store.state.progression.mining.xp>0);
});

test('later uploads cannot refill batteries, repair health or move existing pieces',()=>{
 const c=claim();let s=updateBaseSites(null,snapshot(c),0);s=updateBaseSites(s,{action:'read'},12*hour);const health=s.build.claims[0].power.health;
 const upload=snapshot(c);upload.revision=s.revision;upload.build.claims[0].power={...initialPower(12*hour),charge:700};s=updateBaseSites(s,upload,12*hour);assert.equal(s.build.claims[0].power.health,health);assert.equal(s.build.claims[0].power.charge,0);
 const moved=snapshot(claim());moved.revision=s.revision;moved.build.claims[0].pieces[0].position[0]=5;assert.throws(()=>updateBaseSites(s,moved,12*hour),/moved/);assert.equal(s.build.claims[0].pieces[0].position[0],0);
});
