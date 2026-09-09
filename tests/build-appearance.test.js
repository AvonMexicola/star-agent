import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Scene,Vector3,Quaternion,Matrix4,Group,Mesh,BoxGeometry,MeshStandardMaterial,Texture,Color} from 'three';
import {BuildSystem} from '../src/build/system.js';
import {validBuild} from '../src/build/state.js';
import {initialPower} from '../src/build/power.js';
import {MiningStore} from '../src/mining/store.js';
import {SELENE,bodySurfacePoint,bodySurfaceNormal} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
import {updateBaseSites} from '../server/base-sites.js';
import {setBuildOpacity,setBuildAppearance,disposeBuildVisual} from '../src/build/visuals.js';
import {BUILD_FINISHES,appearanceFor,recolourBuild} from '../src/build/appearance.js';
import {getLocalColliders} from '../src/build/definitions.js';
import {createSettlementLayouts} from '../src/settlements/layout.js';
import {SETTLEMENTS} from '../src/settlements/catalog.js';
import {createWallPrint,printResources,MERIDIAN_PATHS} from '../src/factions/graphics.js';
const piece=(id,type,position)=>({id:`build-piece-${id}`,type,position,rotation:0,doorOpen:false});
function fixture(){
 const map=new Map(),disk={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v)},store=new MiningStore(disk),origin=bodySurfacePoint(new Vector3(...MOON_LANDING_DIRECTION),SELENE),normal=bodySurfaceNormal(origin,SELENE);
 const nav={mode:'walk',insideShip:false,body:SELENE,altitude:1.65,position:origin.clone(),normal,orientation:new Quaternion(),keys:new Set(),gamepad:{suspend(){}}};
 const build=new BuildSystem({scene:new Scene(),nav,store,render:false}),claim=build.newClaim(origin);claim.pieces=[piece(2,'mainframe',[0,0,0]),piece(3,'crate',[4,0,0]),piece(4,'foundation',[-4,.3,0]),piece(5,'wall',[-4,.3,-2])];claim.power=initialPower(Date.now());
 store.registerContainer({id:'build-core-1',name:'Core',kind:'base',boxes:2});store.registerContainer({id:'build-crate-3',name:'Crate',kind:'base',boxes:2});store.write({...store.state,build:{version:1,nextId:6,claims:[claim]}});
 function aim(p){nav.position.copy(build.toWorld(new Vector3(p.position[0],p.position[1]+1.65,p.position[2]+4),claim));const target=build.toWorld(new Vector3(...p.position).add(new Vector3(0,.7,0)),claim);nav.orientation.setFromRotationMatrix(new Matrix4().lookAt(nav.position,target,normal));}
 return {build,store,disk,claim,nav,aim};
}

test('paint changes only private surface materials and can restore the exact original finish',()=>{
 const root=new Group(),geometry=new BoxGeometry(),texture=new Texture();
 for(const name of ['MineralConcrete','WhiteArmour','MintStatus','EdgeSteel','WindowGlass']){const material=new MeshStandardMaterial({color:0x748986,map:texture});material.name=name;root.add(new Mesh(geometry,material));}
 const other=root.clone(true),source=root.children.map(o=>o.material);setBuildOpacity(root,1);setBuildOpacity(other,1);
 const before=source.map(m=>m.color.toArray());setBuildAppearance(root,{type:'wall',finish:'crimson'});
 assert.equal(root.children[0].material.color.getHex(),new Color(BUILD_FINISHES.crimson.concrete).getHex());
 for(let i=0;i<5;i++){assert.deepEqual(other.children[i].material.color.toArray(),before[i]);assert.equal(root.children[i].material.map,texture);assert.equal(root.children[i].geometry,geometry);if(i>1)assert.deepEqual(root.children[i].material.color.toArray(),before[i]);}
 setBuildOpacity(root,.2);assert.equal(root.children[0].material.userData.buildFadeUniform.value,.2);setBuildAppearance(root,{type:'wall'});root.children.forEach((o,i)=>assert.deepEqual(o.material.color.toArray(),before[i]));disposeBuildVisual(root);disposeBuildVisual(other);
});
test('actual reticle recolouring is atomic, conserves cargo/structure/power and survives reload',()=>{
 const f=fixture(),wall=f.claim.pieces[3];f.aim(wall);const before=structuredClone(f.store.state),bounds=getLocalColliders(wall);f.build.setAppearance('crimson','crimson');assert.ok(f.build.beginDecoration().ok);assert.equal(f.build.preview.piece.id,wall.id);assert.ok(f.build.place().ok);
 const after=f.store.state,painted=after.build.claims[0].pieces[3];assert.equal(painted.finish,'crimson');assert.equal(painted.graphic,'crimson');assert.deepEqual(getLocalColliders(painted),bounds);assert.deepEqual(after.remote,before.remote);assert.deepEqual(after.build.claims[0].power,before.build.claims[0].power);assert.equal(after.build.nextId,before.build.nextId);assert.equal(after.build.claims[0].pieces.length,before.build.claims[0].pieces.length);assert.deepEqual(new MiningStore(f.disk).state.build,after.build);assert.equal(f.build.lastToolAction.kind,'paint');assert.equal(f.build.place().ok,false,'duplicate confirmation cannot rewrite the same finish');
 f.build.setAppearance('mineral','none');assert.ok(f.build.place().ok);assert.deepEqual(f.store.state.build,before.build);f.build.dispose();
});
test('failed durable paint write leaves the last complete save and confirmation intact',()=>{
 const f=fixture();f.aim(f.claim.pieces[3]);f.build.setAppearance('petrol','tidemark');f.build.beginDecoration();const before=f.store.state;f.disk.setItem=()=>{throw Error('quota');};assert.equal(f.build.place().ok,false);assert.equal(f.store.state,before);assert.equal(f.build.lastToolAction,undefined);f.build.dispose();
});
test('paint requires actual reach, solo exterior access and local ownership',()=>{
 const f=fixture();f.build.setAppearance('crimson','crimson');f.aim(f.claim.pieces[3]);f.build.beginDecoration();f.nav.position.addScaledVector(f.nav.normal,40);assert.equal(f.build.place().ok,false);f.aim(f.claim.pieces[3]);f.nav.insideShip=true;assert.equal(f.build.place().ok,false);f.nav.insideShip=false;f.nav.multiplayer={connected:true};assert.equal(f.build.place().ok,false);
 const foreign=structuredClone(f.store.state.build);foreign.claims[0].owner='Settlement authority';assert.equal(recolourBuild(foreign,f.claim.id,'build-piece-5','crimson','crimson').ok,false);f.build.dispose();
});
test('optional appearance fields preserve legacy saves and reject malformed/prototype/unbounded values',()=>{
 const f=fixture(),before=f.store.state.build;assert.ok(validBuild(before));
 for(const patch of [{finish:'constructor'},{finish:[]},{finish:['crimson']},{finish:{toString:null}},{finish:'#ffffff'},{finish:'x'.repeat(10000)},{graphic:'__proto__'},{graphic:{}},{graphic:['crimson']},{graphic:{toString:null}},{graphic:null}]){const next=structuredClone(before);Object.assign(next.claims[0].pieces[3],patch);assert.equal(validBuild(next),false,JSON.stringify(patch).slice(0,70));}
 const wrong=structuredClone(before);wrong.claims[0].pieces[0].graphic='crimson';assert.equal(validBuild(wrong),false,'posters cannot occlude a working terminal');
 assert.deepEqual(appearanceFor('window','crimson','airlock'),{finish:'crimson'});f.build.dispose();
});
test('server base save retains bounded cosmetics and stale changes cannot erase another paint operation',()=>{
 const f=fixture(),snapshot={action:'save',revision:0,build:f.store.state.build,storage:Object.fromEntries(Object.entries(f.store.state.remote).map(([id,c])=>[id,{...c,boxes:2}]))};let state=updateBaseSites(null,snapshot,0);
 const painted=recolourBuild(state.build,f.claim.id,'build-piece-5','crimson','helmet');assert.ok(painted.ok);state=updateBaseSites(state,{...snapshot,revision:state.revision,build:painted.build},0);const read=updateBaseSites(state,{action:'read'},0);assert.equal(read.build.claims[0].pieces[3].graphic,'helmet');assert.deepEqual(read.storage,state.storage);assert.throws(()=>updateBaseSites(state,{...snapshot,revision:0},0),/session|revision|changed/i);
 const malformed=structuredClone(read.build);malformed.claims[0].pieces[3].graphic='https://foreign.invalid/image';assert.throws(()=>updateBaseSites(state,{...snapshot,revision:state.revision,build:malformed},0),/Invalid/);f.build.dispose();
});
test('original Meridian emblem is preserved exactly',()=>{
 const svg=readFileSync(new URL('../assets/brands/meridian-shipworks/emblem.svg',import.meta.url),'utf8');assert.deepEqual([...svg.matchAll(/<path d="([^"]+)"/g)].map(m=>m[1]),MERIDIAN_PATHS);
});
test('four public sites have distinct corporate marks without changing economic IDs or garage access',()=>{
 const layouts=createSettlementLayouts();assert.equal(layouts.length,4);assert.equal(new Set(layouts.map(s=>s.faction)).size,4);
 for(const site of layouts){assert.equal(site.id,SETTLEMENTS.find(s=>s.body===site.body).id);assert.ok(site.operator);assert.ok(site.garage);assert.equal(site.pad.graphic,site.faction);assert.ok(site.claim.pieces.some(p=>p.type==='wall'&&p.graphic===site.faction));assert.ok(site.claim.pieces.filter(p=>p.type==='hangar-door').every(p=>!p.graphic));}
});
test('rigid wall print fits actual panel faces; shared textures release when their last instance leaves',()=>{
 const previous=globalThis.document,previousPath=globalThis.Path2D;
 const context=new Proxy({},{get:(o,k)=>o[k]??(()=>{}),set:(o,k,v)=>(o[k]=v,true)});globalThis.document={createElement:()=>({getContext:()=>context})};globalThis.Path2D=class{};
 try{const one=createWallPrint('crimson'),two=createWallPrint('crimson');assert.equal(one.material.map,two.material.map);assert.equal(printResources().textures,1);const bytes=readFileSync(new URL('../public/models/base/wall.glb',import.meta.url));const json=JSON.parse(bytes.subarray(20,20+bytes.readUInt32LE(12)));let min=Infinity,max=-Infinity;for(const mesh of json.meshes)for(const p of mesh.primitives){const a=json.accessors[p.attributes.POSITION];if(a.min)min=Math.min(min,a.min[2]);if(a.max)max=Math.max(max,a.max[2]);}assert.ok(min>=-.165&&max<=.165);
 for(const mesh of one.group.children){assert.ok(Math.abs(mesh.position.z)>Math.max(Math.abs(min),Math.abs(max)));assert.equal(mesh.castShadow,false);assert.equal(mesh.material.emissive.getHex(),0);assert.equal(mesh.material.transparent,false);}
 let disposed=0;one.material.map.addEventListener('dispose',()=>disposed++);one.dispose();assert.equal(disposed,0);two.dispose();assert.equal(disposed,1);assert.equal(printResources().textures,0);
 }finally{globalThis.document=previous;globalThis.Path2D=previousPath;}
});
