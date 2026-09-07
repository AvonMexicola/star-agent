import test from 'node:test';
import assert from 'node:assert/strict';
import {Scene,Vector3,Quaternion,Matrix4} from 'three';
import {BuildSystem} from '../src/build/system.js';
import {validBuild,emptyBuild,planCost,CLAIM_RADIUS} from '../src/build/state.js';
import {PIECES} from '../src/build/definitions.js';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {emptyItems,itemMass} from '../src/inventory/containers.js';
import {MOON_LANDING_DIRECTION,LANDING_FRAME} from '../src/moon-world.js';
import {SELENE,bodySurfacePoint,bodySurfaceNormal} from '../src/celestial.js';
const v=a=>new Vector3(...a);
function setup(){
 const data=new Map(),disk={getItem:id=>data.get(id)??null,setItem:(id,raw)=>data.set(id,raw)},store=new MiningStore(disk);
 const target=bodySurfacePoint(v(MOON_LANDING_DIRECTION),SELENE),normal=bodySurfaceNormal(target,SELENE),east=v(LANDING_FRAME.east);
 const position=target.clone().addScaledVector(east,6).addScaledVector(normal,1.65);
 const shipPosition=target.clone().addScaledVector(east,40);
 const nav={mode:'walk',insideShip:false,dockedAtStation:false,travel:null,altitude:1.65,body:SELENE,position,normal,orientation:new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position,target,normal)),keys:new Set(),gamepad:{suspend(){}},layout:{eyeHeight:1.65},stationDistance:10000,shipPosition,toShipLocal:p=>p.clone().sub(shipPosition),notify(){}};
 const system=new BuildSystem({scene:new Scene(),nav,store,render:false});system.target=()=>target.clone();
 function fund(items,container='pack'){
  const next=store.withItems(store.state,container,{...emptyItems(),...items});assert.equal(store.validContainers(next),true,'fixture fits actual container');assert.equal(store.write(next),true);
 }
 function aim(local){const c=system.claims[0];target.copy(system.toWorld(v(local),c));nav.position.copy(system.toWorld(v([local[0]+5,local[1]+1.65,local[2]+4]),c));}
 function core(){fund(PIECES.mainframe.cost);assert.equal(system.begin('mainframe').ok,true);const result=system.place();assert.equal(result.ok,true,result.message);return system.claims[0];}
 return {data,disk,store,system,nav,target,fund,aim,core};
}
test('wall pieces flip on their socket after any quarter-turn carried from another piece',()=>{
 const f=setup(),claim={pieces:[{type:'foundation',position:[0,.3,0]}]};
 f.system.toLocal=p=>p.clone();
 for(const id of ['wall','window','doorway'])for(const turn of [0,1,2,3])for(const delta of [-1,1]){
  f.system.select('foundation');f.system.turn=0;f.system.rotate(turn);f.system.select(id);
  const before=f.system.candidates(claim,v([0,.3,-2]));f.system.rotate(delta);
  const after=f.system.candidates(claim,v([0,.3,-2]));
  assert.deepEqual(after.map(p=>p.position),before.map(p=>p.position));
  after.forEach((p,i)=>assert.ok(Math.abs(Math.abs(p.rotation-before[i].rotation)-Math.PI)<1e-9,`${id}, carried turn ${turn}, direction ${delta}`));
 }
});
test('core placement consumes exact ingredients and atomically creates one empty local buffer',()=>{
 const f=setup(),beforeLoadout=structuredClone(f.store.state.loadout),beforeField=f.store.state.field;
 f.fund({...PIECES.mainframe.cost,basalt:1});f.system.begin('mainframe');
 assert.equal(f.system.state.preview.valid,true,f.system.state.preview.reason);
 const placed=f.system.place();assert.equal(placed.ok,true,placed.message);
 const items=f.store.container('pack').items;assert.equal(itemMass(items),1);assert.equal(items.basalt,1);
 const c=f.system.claims[0];assert.equal(c.useBuffer,false);assert.equal(c.pieces.length,1);assert.equal(f.system.data.nextId,3);assert.equal(validBuild(f.system.data),true);
 assert.equal(itemMass(f.store.container('build-core-1').items),0);assert.deepEqual(f.store.state.loadout,beforeLoadout);assert.equal(f.store.state.field,beforeField);
 const before=f.store.state;assert.equal(f.system.place().ok,false);assert.equal(f.store.state,before,'duplicate activation neither allocates IDs nor consumes cargo');
 const reload=new MiningStore(f.disk),restored=new BuildSystem({scene:new Scene(),nav:f.nav,store:reload,render:false});assert.equal(restored.blocked,false);assert.deepEqual(restored.data,f.system.data);
});
test('failed core write rolls back materials, piece IDs, claims and remote storage together',()=>{
 const f=setup();f.fund(PIECES.mainframe.cost);f.system.begin('mainframe');
 const before=f.store.state,raw=f.disk.getItem(MINING_KEY);f.disk.setItem=()=>{throw Error('quota');};
 assert.equal(f.system.place().ok,false);assert.equal(f.store.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);assert.equal(f.system.data.nextId,1);assert.equal(f.system.claims.length,0);assert.equal(f.store.container('build-core-1'),null);
 assert.equal(f.system.place().ok,false);assert.equal(f.store.state,before);
});
test('buffer requires explicit nearby opt-in, combines sources once and persists its choice',()=>{
 const f=setup(),c=f.core();f.fund({concrete:12},'build-core-1');f.aim([4,0,0]);f.system.select('foundation');
 assert.equal(f.system.preview.valid,false);assert.deepEqual(f.system.preview.sources,['pack','ship']);
 assert.equal(f.system.setBufferEnabled(c.id,true).ok,false,'distant settings changes rejected');
 f.nav.position.copy(f.system.toWorld(v([0,1.65,2]),c));assert.equal(f.system.setBufferEnabled(c.id,true).ok,true);
 f.aim([4,0,0]);f.system.refreshPreview();assert.deepEqual(f.system.preview.sources,['pack','build-core-1','ship']);
 const placed=f.system.place();assert.equal(placed.ok,true,placed.message);assert.equal(f.store.container('build-core-1').items.concrete,0);
 assert.equal(f.system.data.nextId,4);assert.equal(f.system.claims[0].pieces.length,2);assert.equal(new MiningStore(f.disk).state.build.claims[0].useBuffer,true);
 const cost=planCost(f.store,f.store.withItems(f.store.state,'pack',{concrete:6}),{concrete:12},['pack','pack']);assert.equal(cost.ok,false,'duplicate source identifiers cannot spend the same stack twice');
});
test('placement rejects overlapping claims, complete boundary overflow, player intersection and unsupported upper floors',()=>{
 const f=setup(),c=f.core();
 f.aim([8,0,0]);f.fund(PIECES.mainframe.cost);f.system.select('mainframe');assert.match(f.system.preview.reason,/overlaps/);
 const piece=(type,position)=>({id:'build-piece-99',type,position,rotation:0,doorOpen:false});
 f.nav.position.copy(f.system.toWorld(v([60,1.65,0]),c));assert.match(f.system.validate(c,piece('foundation',[CLAIM_RADIUS-1,.3,0])),/complete piece/);
 f.nav.position.copy(f.system.toWorld(v([4,1.65,0]),c));assert.match(f.system.validate(c,piece('foundation',[4,.3,0])),/Step clear/);
 f.nav.position.copy(f.system.toWorld(v([8,1.65,4]),c));assert.match(f.system.validate(c,piece('floor',[4,3.3,0])),/one supported wall/);
});
test('legacy saves initialize no free structures and malformed build extensions are retained and paused',()=>{
 const fresh=setup();assert.deepEqual(fresh.system.data,emptyBuild());assert.equal(fresh.system.blocked,false);
 const f=setup();f.core();const valid=structuredClone(f.store.state.build);
 for(const mutate of [b=>{b.nextId=1;},b=>{b.claims[0].pieces[0].position=[64,0,0];},b=>{b.claims[0].pieces[0].position=[0,NaN,0];},b=>{b.claims[0].quaternion=[0,0,0,0];}]){
  const raw=JSON.parse(f.disk.getItem(MINING_KEY));raw.build=structuredClone(valid);mutate(raw.build);f.disk.setItem(MINING_KEY,JSON.stringify(raw));
  const persisted=f.disk.getItem(MINING_KEY),store=new MiningStore(f.disk),system=new BuildSystem({scene:new Scene(),nav:f.nav,store,render:false});
  assert.equal(system.blocked,true);assert.equal(system.begin().ok,false);assert.equal(f.disk.getItem(MINING_KEY),persisted);
 }
 const raw=JSON.parse(f.disk.getItem(MINING_KEY));raw.build=valid;delete raw.remote['build-core-1'];delete raw.boxes['build-core-1'];f.disk.setItem(MINING_KEY,JSON.stringify(raw));
 const missing=new BuildSystem({scene:new Scene(),nav:f.nav,store:new MiningStore(f.disk),render:false});assert.equal(missing.blocked,true,'a core must have its persisted physical buffer');
});

test('a physical crate spends its own cost once and allocates a distinct persisted empty container',()=>{
 const f=setup();f.core();f.fund(PIECES.crate.cost);f.aim([4,0,0]);f.system.select('crate');
 const placed=f.system.place();assert.equal(placed.ok,true,placed.message);assert.equal(placed.pieceId,'build-piece-3');
 assert.equal(f.store.container('pack').items['metal-stock'],0);assert.equal(itemMass(f.store.container('build-crate-3').items),0);
 assert.notEqual(f.store.container('build-crate-3').id,f.store.container('build-core-1').id);
 const before=f.store.state;assert.equal(f.system.place().ok,false);assert.equal(f.store.state,before);
 assert.equal(new MiningStore(f.disk).container('build-crate-3').kind,'base');
});
test('stale external writes and failed buffer-setting writes preserve the last complete base',()=>{
 const f=setup(),c=f.core();f.nav.position.copy(f.system.toWorld(v([0,1.65,2]),c));
 const before=f.store.state,raw=f.disk.getItem(MINING_KEY);f.disk.setItem=()=>{throw Error('quota');};
 assert.equal(f.system.setBufferEnabled(c.id,true).ok,false);assert.equal(f.store.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);assert.equal(f.system.claims[0].useBuffer,false);
 const other=setup();other.core();other.fund(PIECES.crate.cost);other.aim([4,0,0]);other.system.select('crate');
 const original=other.store.state;other.disk.setItem(MINING_KEY,'changed externally');assert.equal(other.system.place().ok,false);assert.equal(other.store.state,original);assert.equal(other.store.state.build.nextId,3);assert.equal(other.store.container('build-crate-3'),null);
});

test('mixed claim corners and unsupported saved structural islands are rejected on reload',()=>{
 const f=setup(),c=f.core();
 f.nav.position.copy(f.system.toWorld(v([45,1.65,-40]),c));
 const crossing={id:'build-piece-3',type:'foundation',position:[45,.3,-45],rotation:0,doorOpen:false};
 assert.match(f.system.validate(c,crossing),/complete piece/);
 const saved=structuredClone(f.system.data);saved.nextId=8;saved.claims[0].pieces.push(crossing);assert.equal(validBuild(saved),false);
 const piece=(id,type,position)=>({id:`build-piece-${id}`,type,position,rotation:0,doorOpen:false});
 const base=structuredClone(f.system.data);base.nextId=8;
 base.claims[0].pieces.push(piece(3,'foundation',[4,.3,0]),piece(4,'wall',[4,.3,2]),piece(5,'wall',[4,.3,-2]),piece(6,'floor',[4,3.3,0]));
 assert.equal(validBuild(base),true,'a grounded support chain is restored');
 base.claims[0].pieces=base.claims[0].pieces.filter(p=>p.id!=='build-piece-3');
 assert.equal(validBuild(base),false,'two walls and a roof cannot float after their foundation is lost');
});
test('nearby mainframe configuration still requires physical on-foot access',()=>{
 const f=setup(),c=f.core();f.nav.position.copy(f.system.toWorld(v([0,1.65,2]),c));
 f.nav.mode='flight';assert.equal(f.system.setBufferEnabled(c.id,true).ok,false);
 f.nav.mode='walk';f.nav.insideShip=true;assert.equal(f.system.setBufferEnabled(c.id,true).ok,false);
 assert.equal(f.system.claims[0].useBuffer,false);
});

test('placement reserves the complete foundation footprint beside a ship',()=>{
 const f=setup(),c=f.core();f.aim([12,0,0]);
 f.nav.shipPosition=f.system.toWorld(v([4,.3,0]),c);
 f.nav.toShipLocal=point=>f.system.toLocal(point,c).sub(v([4,.3,0]));
 const p={id:'build-piece-3',type:'foundation',position:[12,.3,0],rotation:0,doorOpen:false};
 assert.match(f.system.validate(c,p),/ship and boarding/,'pivot8m clear but footprint edge6m intersects the7m ship reservation');
});
test('mainframe front faces its placer and radial-pole claims retain an orthonormal frame',()=>{
 const f=setup(),c=f.core(),core=c.pieces[0];
 const front=v([0,0,-1]).applyAxisAngle(v([0,1,0]),core.rotation).applyQuaternion(new Quaternion(...c.quaternion));
 assert.ok(front.dot(f.nav.position.clone().sub(v(c.origin)).normalize())>.9);
 const point=bodySurfacePoint(v([0,0,1]),SELENE);
 f.nav.orientation.setFromUnitVectors(v([0,0,-1]),v([0,0,-1]));
 const polar=f.system.newClaim(point),rotation=new Quaternion(...polar.quaternion);
 assert.ok(Math.abs(rotation.length()-1)<1e-8);
 assert.ok(v([0,1,0]).applyQuaternion(rotation).distanceTo(v([0,0,1]))<1e-8);
});

test('floor level selection remains on whole storeys at its lower boundary',()=>{
 const f=setup();f.system.pieceId='floor';f.system.adjustHeight(-.25);assert.equal(f.system.height,0);
 f.system.adjustHeight(.25);assert.equal(f.system.height,3);f.system.adjustHeight(-.25);assert.equal(f.system.height,0);
 f.system.pieceId='foundation';f.system.adjustHeight(-.25);assert.equal(f.system.height,-.2);
});

test('malformed claim and piece entries pause building without crashing game initialization',()=>{
 const f=setup();f.core();const saved=structuredClone(f.system.data);
 for(const mutate of [b=>b.claims[0]=null,b=>b.claims[0].pieces.push(null),b=>b.claims[0].pieces.push({id:'build-piece-3',type:'constructor',position:[4,0,0],rotation:0,doorOpen:false})]){
  const malformed=structuredClone(saved);malformed.nextId=4;mutate(malformed);assert.equal(validBuild(malformed),false);
  const raw=JSON.parse(f.disk.getItem(MINING_KEY));raw.build=malformed;f.disk.setItem(MINING_KEY,JSON.stringify(raw));const before=f.disk.getItem(MINING_KEY);
  const store=new MiningStore(f.disk),system=new BuildSystem({scene:new Scene(),nav:f.nav,store,render:false});assert.equal(system.blocked,true);assert.equal(system.begin().ok,false);assert.equal(f.disk.getItem(MINING_KEY),before);
 }
});

test('an upper slab can seat onto its two supporting wall tops without allowing duplicate floors',()=>{
 const f=setup();f.core();const build=structuredClone(f.system.data);build.nextId=6;
 for(const [id,type,position,rotation] of [[3,'foundation',[4,.3,-4],0],[4,'wall',[2,.3,-4],Math.PI/2],[5,'window',[6,.3,-4],Math.PI/2]])build.claims[0].pieces.push({id:`build-piece-${id}`,type,position,rotation,doorOpen:false});
 assert.equal(validBuild(build),true);assert.equal(f.store.write({...f.store.state,build}),true);f.fund(PIECES.floor.cost);f.aim([4,.3,-4]);f.system.select('floor');
 const result=f.system.place();assert.equal(result.ok,true,result.message);assert.equal(f.system.claims[0].pieces.at(-1).type,'floor');assert.equal(f.store.container('pack').items.concrete,0);
 const floor=f.system.claims[0].pieces.at(-1);assert.match(f.system.validate(f.system.claims[0],{...floor,id:'build-piece-99'}),/occupied/);
});

test('the opening cinematic cannot enter construction or spend a mainframe kit',()=>{
 const f=setup();f.fund(PIECES.mainframe.cost);const before=f.store.state;f.nav.openingActive=true;
 assert.equal(f.system.begin('mainframe').ok,false);assert.equal(f.system.active,false);assert.equal(f.store.state,before);
});

test('nearby ship pays exact core costs and placement rechecks access after preview',()=>{
 const f=setup();f.fund(PIECES.mainframe.cost,'ship');f.system.begin('mainframe');
 assert.equal(f.system.preview.valid,true,f.system.preview.reason);
 const before=f.store.state,raw=f.disk.getItem(MINING_KEY);
 const originalShip=f.nav.shipPosition.clone();f.nav.shipPosition.addScalar(100);
 assert.equal(f.system.place().ok,false);assert.equal(f.store.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);
 assert.deepEqual(f.system.preview.sources,['pack']);
 f.nav.shipPosition.copy(originalShip);
 assert.equal(f.system.place().ok,true);assert.equal(itemMass(f.store.container('ship').items),0);
 assert.equal(f.system.claims[0].pieces.length,1);
});
test('mixed pack and nearby ship payment rolls back together on failed save',()=>{
 const f=setup();f.fund({'metal-stock':2});f.fund({'metal-stock':3,conductor:3,glass:2},'ship');
 f.system.begin('mainframe');assert.equal(f.system.preview.valid,true,f.system.preview.reason);
 const before=f.store.state,raw=f.disk.getItem(MINING_KEY);f.disk.setItem=()=>{throw Error('quota');};
 assert.equal(f.system.place().ok,false);assert.equal(f.store.state,before);assert.equal(f.disk.getItem(MINING_KEY),raw);
 assert.equal(f.system.claims.length,0);
});


test('placement sound fires once after committed material spend, never for preview or failed save',()=>{
 const f=setup(),sounds=[];f.system.onSound=event=>{assert.equal(f.system.claims.length,1);sounds.push(event);};
 f.system.begin('mainframe');f.system.refreshPreview();assert.equal(sounds.length,0);
 assert.equal(f.system.place().ok,false);assert.equal(sounds.length,0);
 f.fund(PIECES.mainframe.cost);f.system.begin('mainframe');
 const write=f.store.write.bind(f.store);f.store.write=()=>false;
 assert.equal(f.system.place().ok,false);assert.equal(sounds.length,0);
 f.store.write=write;const placed=f.system.place();assert.equal(placed.ok,true,placed.message);
 assert.equal(sounds.length,1);assert.equal(sounds[0].type,'building-placement');
 assert.equal(sounds[0].pieceId,placed.pieceId);assert.equal(sounds[0].claimId,placed.claimId);
 assert.ok(sounds[0].point.distanceTo(f.system.toWorld(v(f.system.claims[0].pieces[0].position),f.system.claims[0]))<.001);
 f.system.sync();assert.equal(sounds.length,1,'reload/sync does not replay placement');
});

test('controller build shortcut requires on-foot access within an owned mainframe radius',()=>{
 const f=setup();assert.equal(f.system.controllerAvailable,false);const c=f.core(),core=c.pieces.find(p=>p.type==='mainframe');
 const center=f.system.toWorld(v(core.position),c);f.nav.position.copy(center).addScaledVector(f.nav.normal,1.65);assert.equal(f.system.controllerAvailable,true);
 for(const mode of ['flight','landed','eva']){f.nav.mode=mode;assert.equal(f.system.controllerAvailable,false);}f.nav.mode='walk';
 f.nav.insideShip=true;assert.equal(f.system.controllerAvailable,false);f.nav.insideShip=false;
 f.nav.position.copy(center).addScaledVector(v(LANDING_FRAME.east),63.9);assert.equal(f.system.controllerAvailable,true);
 f.nav.position.copy(center).addScaledVector(v(LANDING_FRAME.east),64.1);assert.equal(f.system.controllerAvailable,false);
 f.nav.position.copy(center);f.nav.dockedAtStation=true;assert.equal(f.system.controllerAvailable,false);f.nav.dockedAtStation=false;
 f.store.blocked=true;assert.equal(f.system.controllerAvailable,false);
});

test('one wall supports an open roof and two adjacent panels, but no floating chain',()=>{
 const f=setup(),c=f.core(),p=(id,type,position)=>({id:`build-piece-${id}`,type,position,rotation:0,doorOpen:false});
 c.pieces.push(p(3,'foundation',[4,.3,0]),p(4,'wall',[4,.3,2]));
 for(const [id,x]of [[5,4],[6,8],[7,12]]){const roof=p(id,'floor',[x,3.3,0]);f.nav.shipPosition=null;f.nav.position.copy(f.system.toWorld(v([x,1.95,4]),c));assert.equal(f.system.validate(c,roof),null);c.pieces.push(roof);}
 const unsupported=p(8,'floor',[16,3.3,0]);assert.match(f.system.validate(c,unsupported),/two panels/);
 const save={version:1,nextId:9,claims:[c]};assert.equal(validBuild(save),true);c.pieces=c.pieces.filter(p=>p.type!=='wall');assert.equal(validBuild(save),false);
});
test('crate targeting uses the aimed floor behind stairs instead of the roof above',()=>{
 const f=setup(),c=f.core(),p=(id,type,position)=>({id:`build-piece-${id}`,type,position,rotation:0,doorOpen:false});
 c.pieces.push(p(3,'foundation',[4,.3,0]),p(4,'stairs',[4,.3,0]),p(5,'foundation',[4,.3,-4]),p(6,'wall',[4,.3,-6]),p(7,'floor',[4,3.3,-4]));
 f.nav.shipPosition=null;f.fund(PIECES.crate.cost);f.aim([4,.3,-3.5]);f.system.select('crate');
 assert.equal(f.system.preview.piece.position[1],.3);assert.equal(f.system.preview.valid,true,f.system.preview.reason);
 const occupied={...f.system.preview.piece,position:[4,.3,-1.5]};assert.match(f.system.validate(c,occupied),/occupied/,'the actual solid stair still blocks a crate');
});

test('rack capacity, terminal access and landing-pad designations persist through the shared store',()=>{
 const f=setup(),c=f.core();f.fund(PIECES.rack.cost);f.aim([4,0,0]);f.system.select('rack');const rack=f.system.place();assert.equal(rack.ok,true,rack.message);assert.equal(f.store.container('build-crate-3').boxes,8);
 f.fund(PIECES.terminal.cost);f.aim([8,0,0]);f.system.select('terminal');assert.equal(f.system.place().ok,true);
 const claim=f.system.claims[0];f.nav.position.copy(f.system.toWorld(v([8,1.65,2]),claim));assert.ok(f.system.terminalAccess(c),'previously registered storage sees newly built terminal');
 f.nav.position.copy(f.system.toWorld(v([16,1.65,2]),claim));assert.equal(f.system.terminalAccess(c),false);
 // A valid slab fixture isolates designation persistence from terrain leveling.
 const next=structuredClone(f.store.state);next.build.claims[0].pieces.push({id:'build-piece-5',type:'foundation-pad-small',position:[24,.3,0],rotation:0,doorOpen:false});next.build.nextId=6;assert.equal(f.store.write(next),true);
 f.nav.position.copy(f.system.toWorld(v([24,2,0]),claim));assert.equal(f.system.setLandingPad(claim.id,'build-piece-5',true).ok,true);assert.equal(validBuild(f.system.data),true);
 assert.equal(new MiningStore(f.disk).state.build.claims[0].pieces.find(p=>p.id==='build-piece-5').landingPad,true);
 f.system.cancel();assert.match(f.system.interaction,/Landing pad/);
});

test('a large pad is aimed from its near edge and expands its claim only with an atomic paid placement',async()=>{
 const {prepareSandbox,SANDBOX_BINS}=await import('../src/build/sandbox.js');const f=setup();assert.equal(prepareSandbox(f.store).ok,true);f.system.supplySources=()=>SANDBOX_BINS.map(b=>b.id);f.nav.shipPosition=null;
 const c=f.system.claims[0];f.target.copy(f.system.toWorld(v([12,.3,-12]),c));f.nav.position.copy(f.system.toWorld(v([2,1.75,-6]),c));f.system.begin('foundation-pad-large');f.system.height=.2;f.system.refreshPreview();
 assert.ok(f.system.preview.piece.position.every((n,i)=>Math.abs(n-[36,.5,-12][i])<1e-7));assert.equal(f.system.preview.claim.radius,96);assert.equal(f.system.preview.valid,true,f.system.preview.reason);
 const before=f.store.state,raw=f.disk.getItem(MINING_KEY),write=f.disk.setItem;f.disk.setItem=()=>{throw Error('quota');};assert.equal(f.system.place().ok,false);assert.equal(f.store.state,before);assert.equal(f.system.claims[0].radius,64);assert.equal(f.disk.getItem(MINING_KEY),raw);f.disk.setItem=write;
 const reloaded=new MiningStore(f.disk),retry=new BuildSystem({scene:new Scene(),nav:f.nav,store:reloaded,render:false,supplySources:()=>SANDBOX_BINS.map(b=>b.id)});retry.target=()=>f.target.clone();retry.begin('foundation-pad-large');retry.height=.2;retry.refreshPreview();assert.equal(retry.place().ok,true,retry.preview.reason);assert.equal(retry.claims[0].radius,96);assert.equal(validBuild(retry.data),true);assert.equal(SANDBOX_BINS.reduce((sum,b)=>sum+(reloaded.container(b.id).items.concrete??0),0),440);
 const restored=new BuildSystem({scene:new Scene(),nav:f.nav,store:new MiningStore(f.disk),render:false});assert.equal(restored.blocked,false);assert.equal(restored.claims[0].radius,96);
});

test('aiming at the terminal takes precedence over a slightly nearer rack beside it',()=>{
 const f=setup(),c=f.core();c.pieces.push({id:'build-piece-3',type:'rack',position:[0,.3,2],rotation:0,doorOpen:false},{id:'build-piece-4',type:'terminal',position:[3,.3,2],rotation:0,doorOpen:false});f.system.cancel();
 f.nav.position.copy(f.system.toWorld(v([1.4,2.05,4]),c));const target=f.system.toWorld(v([3,1.1,2]),c);f.nav.orientation.setFromRotationMatrix(new Matrix4().lookAt(f.nav.position,target,f.nav.normal));assert.equal(f.system.nearbyInteraction().p.type,'terminal');assert.match(f.system.interaction,/Inventory terminal/);
});

test('square roof rotation retains trigger quarter turns after socket selection',()=>{
 const f=setup();f.system.toLocal=p=>p.clone();const claim={pieces:[{type:'foundation',position:[0,.3,0],rotation:0}]};f.system.pieceId='floor';f.system.turn=0;const before=f.system.candidates(claim,v([0,3.3,0]))[0];f.system.rotate(1);const after=f.system.candidates(claim,v([0,3.3,0]))[0];assert.deepEqual(after.position,before.position);assert.ok(Math.abs(after.rotation-before.rotation-Math.PI/2)<1e-9);
});
