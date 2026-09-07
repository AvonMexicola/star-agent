import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {fileURLToPath} from 'node:url';
import {SHIPS} from '../../../src/fleet.js';
import {KESTREL_LAYOUT} from '../../../src/kestrel-access.js';
import {SHIP_LAYOUT} from '../../../src/boarding.js';
import {FREIGHTER_LAYOUT} from '../../../src/freighter-layout.js';
const ROOT=fileURLToPath(new URL('../../../',import.meta.url)).replace(/\/$/,'');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const main=await fs.readFile(ROOT+'/src/main.js','utf8');
const start=main.indexOf('const fleetUI=createFleetUI(nav,fleet,async id=>{');
assert.ok(start>=0);const end=main.indexOf('\n  });',start);assert.ok(end>start);
const callback=main.slice(start+'const fleetUI=createFleetUI(nav,fleet,'.length,end).trim();
const makeSelection=new Function('deps',`let {ship,nav,fleet,inventory,mining,shipModels,station,modelFor,configureShip,layoutFor,SHIPS,THREE}=deps;let selectingShip=false;const select=${callback}};return {select,getState:()=>({ship,selectingShip})};`);
const checks=[];
function fixture(){
 const nomad={name:'nomad',visible:true},models=new Map([['nomad',nomad]]);
 const nav={shipId:'nomad',mode:'landed',dockedAtStation:true,shipOrientation:new THREE.Quaternion(),orientation:new THREE.Quaternion(),position:new THREE.Vector3(),velocity:new THREE.Vector3(),angularVelocity:new THREE.Vector3(),fromShipLocal(p){return p.clone().applyQuaternion(this.shipOrientation).add(this.shipPosition);}};
 const fleet={active:'nomad',allows:()=>true,record(){this.writes=(this.writes??0)+1;}};
 const inventory={cargo:0,mass(){return this.cargo;},capacity:{ship:120}},mining={store:{state:{ship:[0,0,0]}}};
 const layoutFor=id=>id==='kestrel'?KESTREL_LAYOUT:id==='atlas'?FREIGHTER_LAYOUT:SHIP_LAYOUT;
 const station={interiorBox:new THREE.Box3(new THREE.Vector3(-40,0,-50),new THREE.Vector3(40,30,50)),quaternion:new THREE.Quaternion(),toWorld(p,target){return target.copy(p);}};
 const deps={ship:nomad,nav,fleet,inventory,mining,shipModels:models,station,modelFor:id=>models.get(id),configureShip:id=>{nav.shipId=id;nav.layout=layoutFor(id);},layoutFor,SHIPS,THREE};
 return {...deps,...makeSelection(deps),nomad};
}
{
 const f=fixture(),failed={userData:{assetStatus:'error'},readyPromise:Promise.reject(new Error('injected GLB load failure')),removeFromParent(){this.removed=true;},dispose(){this.disposed=true;}};f.shipModels.set('kestrel',failed);
 const message=await f.select('kestrel');assert.match(message,/current ship remains selected/);assert.equal(f.getState().ship,f.nomad);assert.equal(f.nav.shipId,'nomad');assert.equal(f.fleet.active,'nomad');assert.equal(f.inventory.capacity.ship,120);assert.equal(f.fleet.writes,undefined);assert.equal(f.getState().selectingShip,false);assert.ok(failed.removed&&failed.disposed);assert.equal(f.shipModels.has('kestrel'),false);
 const next={name:'kestrel',readyPromise:Promise.resolve()};f.shipModels.set('kestrel',next);await f.select('kestrel');assert.equal(f.getState().ship,next);assert.equal(f.nav.shipId,'kestrel');assert.equal(f.fleet.active,'kestrel');assert.equal(f.inventory.capacity.ship,0);assert.ok(f.nav.position.distanceTo(new THREE.Vector3(0,2.49,-1.899))<1e-10);assert.equal(f.nav.gearProgress,1);assert.equal(f.fleet.writes,1);checks.push({check:'Actual main.js selection callback: rejected load preserves current model/selection/capacity/save, cleans failed model, then successful retry selects Kestrel',passed:true,message});
}
for(const change of ['cargo','minerals','depart']){
 const f=fixture();let resolve;const wait=new Promise(r=>resolve=r);f.shipModels.set('kestrel',{readyPromise:wait});const pending=f.select('kestrel');
 if(change==='cargo')f.inventory.cargo=.5;if(change==='minerals')f.mining.store.state.ship[0]=.1;if(change==='depart')f.nav.mode='flight';
 resolve();const message=await pending;assert.equal(f.getState().ship,f.nomad);assert.equal(f.fleet.active,'nomad');assert.equal(f.fleet.writes,undefined);assert.equal(f.getState().selectingShip,false);checks.push({check:'Actual selection callback rechecks '+change+' after awaited model readiness',passed:true,message});
}
// Canvas API is stubbed only for CPU page-data inspection; no raster quality or
// shader compile claim can follow from this harness.
globalThis.document={createElement(tag){assert.equal(tag,'canvas');const context=new Proxy({}, {get:(target,key)=>target[key]??(()=>{}),set:(target,key,value)=>{target[key]=value;return true;}});return {width:0,height:0,getContext:()=>context};}};
globalThis.ProgressEvent??=class{constructor(type,init={}){this.type=type;Object.assign(this,init);}};
const bytes=await fs.readFile(ROOT+'/assets/kestrel/kestrel.glb'),n=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+n)),bin=bytes.subarray(28+n);
doc.buffers[0].uri='data:application/octet-stream;base64,'+bin.toString('base64');
for(const m of doc.materials||[]){delete m.normalTexture;delete m.occlusionTexture;delete m.emissiveTexture;if(m.pbrMetallicRoughness){delete m.pbrMetallicRoughness.baseColorTexture;delete m.pbrMetallicRoughness.metallicRoughnessTexture;}}
const gltf=await new GLTFLoader().parseAsync(JSON.stringify(doc),'');const originalLoad=GLTFLoader.prototype.loadAsync;GLTFLoader.prototype.loadAsync=async url=>{assert.equal(url,'review-original-geometry');return gltf;};
const {createKestrel}=await import(ROOT+'/src/kestrel.js');const ship=createKestrel({url:'review-original-geometry',flight:true});await ship.readyPromise;GLTFLoader.prototype.loadAsync=originalLoad;
const live={powered:true,mode:'flight',gearProgress:.35,gearDeployed:false,kestrelAccess:{canopy:.4,ladder:.6,open:true},engineAcceleration:new THREE.Vector3(0,0,-58),flightEnvironment:{regime:'SPACE',atmosphereFraction:0},normal:new THREE.Vector3(0,1,0),orientation:new THREE.Quaternion(),velocity:new THREE.Vector3(0,0,-31),speed:31,shipSpeed:31,altitude:8750,flightAssist:true};
ship.syncFlight(live);ship.update(.025);ship.updateGear(.025,live.gearDeployed,live.gearProgress);ship.updateDisplays(.2,live,{mass:()=>0,capacity:{ship:0}},null);let snapshot=ship.snapshot();assert.deepEqual(snapshot.progress,{canopy:.4,gear:.35,ladder:.6});assert.equal(snapshot.throttle,1);assert.equal(ship.getNode('AB_L').visible,true);assert.ok(snapshot.displays[0].values.includes('VELOCITY: 31.0 m/s'));assert.ok(snapshot.displays[0].values.includes('ALTITUDE AGL: 8.8 km'));assert.ok(snapshot.displays[2].values.includes('LANDING GEAR: MOVING'));assert.ok(snapshot.displays[3].values.includes('CARGO HOLD: NONE / PILOT BACKPACK'));assert.equal(snapshot.hardpoints.length,4);assert.ok(snapshot.hardpoints.every(h=>h.size===2&&h.installedWeapon===null));
checks.push({check:'Actual GLB adapter uses supplied live mechanism progress, full-thrust authored cones and actual flight MFD data, with four empty S2 mounts',passed:true,snapshot});
live.powered=false;live.engineAcceleration.set(0,0,0);ship.syncFlight(live);ship.update(.01);ship.updateDisplays(.01,live,{mass:()=>0,capacity:{ship:0}},null);snapshot=ship.snapshot();assert.equal(snapshot.throttle,0);assert.equal(ship.getNode('AB_L').visible,false);assert.ok(snapshot.displays[0].values.includes('MAIN POWER: OFF'));assert.ok(snapshot.displays[2].values.includes('DISEMBARK: LANDED / DOCKED ONLY'));assert.ok(snapshot.displays[3].values.includes('CARGO HOLD: NONE'));checks.push({check:'Power-off update immediately removes afterburners and paints truthful emergency/access/no-cargo pages',passed:true,snapshot});
ship.dispose();
const output={method:'CPU source-only review. Actual main.js selection callback extracted without modification; scene/model loading dependencies are controlled fakes for rollback tests. Actual Kestrel adapter loads original GLB geometry with image references removed; canvas context is stubbed for text/page-data checks. No browser/GPU/visual approval.',sourceHashes:Object.fromEntries(await Promise.all(['src/main.js','src/kestrel.js','src/fleet.js','src/test-flight.js','src/navigation.js','src/ship-mfd.js'].map(async path=>[path,hash(await fs.readFile(ROOT+'/'+path))]))),assetSha256:hash(bytes),checks};
await fs.writeFile('/tmp/kestrel-review-integration.json',JSON.stringify(output,null,2)+'\n');console.log(JSON.stringify(output,null,2));
