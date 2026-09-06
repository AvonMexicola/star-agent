import {test,expect} from '@playwright/test';
import {Vector3,Quaternion,Matrix4} from 'three';
import {PYRE_EPOCH,pyreFrameAt} from '../src/pyre-world.js';
import {AEON,PYRE,bodySurfacePoint,bodySurfaceNormal,bodyAltitude} from '../src/celestial.js';
import {nearbyConstructionDeposits} from '../src/mining/construction-deposits.js';
import {MiningStore,MINING_KEY,MAX_SAVED_ROCKS} from '../src/mining/store.js';
import {createDensity} from '../src/mining/volume.js';
import {mkdir,writeFile} from 'node:fs/promises';

// Explicit landing and local aiming fixtures; extraction and processing use the
// real cutter and recipe buttons. No resource, loadout or build grants are used.
function outcrop(body){
 for(const direction of [[0,1,0],[0,-1,0],[1,0,0],[.6,.7,.2]]){
  const deposits=nearbyConstructionDeposits(bodySurfacePoint(new Vector3(...direction).normalize(),body,2),760);
  const d=deposits.find(d=>d.dominant==='copper');
  if(d){
   const radial=d.position.clone().sub(new Vector3(...body.center)).normalize(),east=new Vector3(1,0,0).cross(radial).normalize(),north=radial.clone().cross(east);
   let site=null;
   for(let x=-100;x<=100;x+=10)for(let z=-100;z<=100;z+=10){
    if(Math.hypot(x,z)<20)continue;
    const dir=radial.clone().addScaledVector(east,x/body.radius).addScaledVector(north,z/body.radius).normalize(),p=bodySurfacePoint(dir,body),dot=bodySurfaceNormal(p,body).dot(dir);
    if(deposits.some(deposit=>deposit.position.distanceTo(p)<8))continue;
    const zAxis=east.clone().projectOnPlane(dir).normalize(),xAxis=zAxis.clone().negate().cross(dir).normalize();
    const clearances=[-.55,0,.55].flatMap(dx=>[-.35,0,.35].map(dz=>bodyAltitude(p.clone().addScaledVector(xAxis,dx).addScaledVector(zAxis,dz),body)));
    if(clearances.every(h=>h>=-.025&&h<=.3)&&(!site||dot>site.dot))site={dot,position:p.toArray(),up:dir.toArray(),east:east.toArray(),eye:bodySurfacePoint(p.clone().addScaledVector(east,6).sub(new Vector3(...body.center)).normalize(),body,1.65).toArray()};
   }
   if(!site)continue;
   const basalt=deposits.find(a=>a.dominant==='basalt');
   return {position:d.position.toArray(),quaternion:d.quaternion.toArray(),body:body.id,id:d.id,site,basalt:basalt?{position:basalt.position.toArray(),quaternion:basalt.quaternion.toArray(),body:body.id,id:basalt.id}:null};
  }
 }
 throw Error(`No ${body.id} fixture outcrop`);
}
async function pose(page,d,index=0,required=true){
 await page.evaluate(({d,index})=>{
  const a=window.starAgent,n=a.navigation,center=n.position.clone().fromArray(d.position),q=n.orientation.clone().fromArray(d.quaternion);
  const angle=index*Math.PI/4,local=n.position.clone().set(Math.sin(angle)*4.3,.95,Math.cos(angle)*4.3).applyQuaternion(q);
  n.position.copy(center).add(local);n.velocity.set(0,0,0);n.mode='walk';n.insideShip=false;n.autoland=false;n.travel=null;n.enabled=true;n.focused=true;
  n.orientToward(center.clone().add(n.position.clone().set(0,.5,0).applyQuaternion(q)),n.normal);a.setRenderScale(.4);
 },{d,index});
 try{await page.waitForFunction(()=>window.starAgent.state.mining.tool.active&&window.starAgent.state.mining.tool.hit,null,{timeout:required?45000:1500});return true;}catch(error){if(required)throw error;return false;}
}
test('browser quota accepts the complete bounded exact-density ledger with room for a base',async({page})=>{
 const data=new Map(),storage={getItem:id=>data.get(id)??null,setItem:(id,raw)=>data.set(id,raw)},store=new MiningStore(storage),field=createDensity();
 for(let i=0;i<MAX_SAVED_ROCKS;i++){const id=`quota-fixture-${i}`;store.getRock(id,field);expect(store.commitRock(id,{field,yieldVolume:[0,0,0]},0)).toBe(true);}
 await page.route('**/storage-budget',route=>route.fulfill({contentType:'text/html',body:'<title>Storage budget fixture</title>'}));await page.goto('/storage-budget');
 const raw=storage.getItem(MINING_KEY);
 const result=await page.evaluate(({raw,key})=>{try{localStorage.setItem(key,raw);localStorage.setItem('base-reserve','x'.repeat(250000));return {ok:localStorage.getItem(key)===raw,characters:raw.length};}catch(error){return {ok:false,error:error.message,characters:raw.length};}},{raw,key:MINING_KEY});
 console.log('Browser exact ledger quota',result);expect(result.ok,JSON.stringify(result)).toBe(true);
});
for(const body of [AEON,PYRE])test(`${body.name} landing fixture mines finite local material and processes real core inputs`,async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(`/?intro=0&debug=1&seed=7291&epoch=${PYRE_EPOCH}`);await page.waitForFunction(()=>window.starAgent?.state.ready);console.log(body.id,'world ready');const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});console.log(body.id,gpu);
 const d=outcrop(body);await pose(page,d);console.log(body.id,'cutter ready');
 // The prototype's visible Add box control supplies empty capacity, never ore.
 await page.keyboard.press('i');await expect(page.locator('#cargo-dialog')).toBeVisible();
 await page.locator('[data-container="pack"] [data-add-box]').click();await page.keyboard.press('Escape');
 for(let i=0;i<24;i++){
  const current=await page.evaluate(()=>window.starAgent.state.mining.pack);if(current[0]>=7&&current[1]>=3)break;
  const target=current[1]>=3&&d.basalt?d.basalt:d;
  if(!await pose(page,target,i%8,false))continue;await page.keyboard.down('t');await page.waitForTimeout(3200);await page.keyboard.up('t');console.log(body.id,'cut',i,await page.evaluate(()=>window.starAgent.state.mining.pack));
 }
 await page.waitForFunction(()=>!window.starAgent.state.mining.pending);console.log(body.id,'mining cycles complete');const mined=await page.evaluate(()=>({pack:window.starAgent.state.mining.pack,revision:window.starAgent.state.mining.activeRevision,error:window.starAgent.state.mining.error}));
 expect(mined.pack[0],JSON.stringify(mined)).toBeGreaterThanOrEqual(7);expect(mined.pack[1],JSON.stringify(mined)).toBeGreaterThanOrEqual(3);
 await page.keyboard.press('b');await expect(page.locator('#build-dialog')).toBeVisible();await page.locator('[data-controller-key="build-tab-recipes"]').click();
 for(const [id,count] of [['metal-stock',5],['conductor',3],['glass',2]])for(let i=0;i<count;i++)await page.locator(`[data-controller-key="recipe-${id}"]`).click();
 const processed=await page.evaluate(()=>window.starAgent.state.build.materials);
 expect(processed['metal-stock']).toBe(5);expect(processed.conductor).toBe(3);expect(processed.glass).toBe(2);
 expect(processed.basalt).toBeCloseTo(mined.pack[0]-7,6);expect(processed.copper).toBeCloseTo(mined.pack[1]-3,6);
 await page.locator('[data-controller-key="build-close"]').click();
 await page.evaluate(site=>{
  const n=window.starAgent.navigation,target=n.position.clone().fromArray(site.position),up=n.position.clone().fromArray(site.up),east=n.position.clone().fromArray(site.east);
  n.position.fromArray(site.eye);n.velocity.set(0,0,0);n.orientToward(target,up);
 },d.site);
 await page.keyboard.press('b');await page.locator('[data-controller-key="build-piece-mainframe"]').click();
 await page.waitForFunction(()=>window.starAgent.state.build.preview,null,{timeout:5000});const preview=await page.evaluate(()=>window.starAgent.state.build.preview);expect(preview.valid,JSON.stringify(preview)).toBe(true);
 console.log(body.id,'core preview valid');await page.keyboard.press('Enter');await page.waitForFunction(()=>window.starAgent.state.build.pieceCount===1);
 const built=await page.evaluate(()=>window.starAgent.state.build);expect(built.materials['metal-stock']).toBe(0);expect(built.materials.conductor).toBe(0);expect(built.materials.glass).toBe(0);
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.starAgent.state.build.assetsReady,null,{timeout:45000});
 await mkdir('/tmp/star-agent-materials-gameplay',{recursive:true});await page.screenshot({path:`/tmp/star-agent-materials-gameplay/${body.id}-mined-core.png`});let reloaded=null;
 if(body.id==='pyre'){
  const later=PYRE_EPOCH+86400000,original=built.claims[0],frame=pyreFrameAt(later),a=original.anchor;
  const expected=new Vector3(...frame.position).addScaledVector(new Vector3(...frame.x),a.origin[0]).addScaledVector(new Vector3(...frame.y),a.origin[1]).addScaledVector(new Vector3(...frame.z),a.origin[2]);
  const expectedRotation=new Quaternion().setFromRotationMatrix(new Matrix4().makeBasis(new Vector3(...frame.x),new Vector3(...frame.y),new Vector3(...frame.z))).multiply(new Quaternion(...a.quaternion)).normalize();
  await page.goto(`/?intro=0&debug=1&seed=7291&epoch=${later}`);await page.waitForFunction(()=>window.starAgent?.state.ready);
  reloaded=await page.evaluate(()=>window.starAgent.state.build);expect(reloaded.pieceCount).toBe(1);expect(reloaded.claims[0].pieces).toEqual(original.pieces);expect(reloaded.claims[0].anchor).toEqual(a);expect(reloaded.materials).toEqual(built.materials);
  expect(new Vector3(...reloaded.claims[0].origin).distanceTo(expected)).toBeLessThan(.00001);expect(new Quaternion(...reloaded.claims[0].quaternion).angleTo(expectedRotation)).toBeLessThan(1e-7);
  console.log('Pyre next-day reload retained core, costs and canonical body-fixed anchor');
 }
 await writeFile(`/tmp/star-agent-materials-gameplay/${body.id}-evidence.json`,JSON.stringify({gpu,viewport:{width:1280,height:800},epoch:PYRE_EPOCH,fixture:d,mined,processed,pieceCount:built.pieceCount,reloaded,errors},null,2));expect(errors).toEqual([]);
});

test('accepted mining awards persisted XP and shows the backpack skill bar',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(['error','warning'].includes(m.type()))errors.push(m.text());});
 await page.goto(`/?intro=0&debug=1&seed=7291&epoch=${PYRE_EPOCH}`);await page.waitForFunction(()=>window.starAgent?.state.ready);
 const before=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)||'null'),MINING_KEY);
 expect(before?.progression?.mining?.xp??0).toBe(0);
 const d=outcrop(AEON);await pose(page,d);
 await page.keyboard.down('t');try{await page.waitForFunction(()=>window.starAgent.state.mining.pack.reduce((a,b)=>a+b,0)>=.1,null,{timeout:20000});}finally{await page.keyboard.up('t');}
 await page.waitForFunction(()=>!window.starAgent.state.mining.pending);
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),MINING_KEY),mass=saved.pack.reduce((a,b)=>a+b,0);
 expect(mass).toBeGreaterThanOrEqual(.1);expect(saved.progression.mining.xp).toBeCloseTo(mass*100,7);expect(saved.boxes.pack).toBe(1);
 await page.keyboard.press('i');await expect(page.locator('#cargo-dialog')).toBeVisible();
 const skill=page.locator('.inventory-mining-skill');await expect(skill).toContainText('Mining · Level 1');expect(await skill.locator('progress').evaluate(p=>p.value)).toBeGreaterThan(0);
 const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);});
 await mkdir('/tmp/star-agent-materials-gameplay',{recursive:true});await page.screenshot({path:'/tmp/star-agent-materials-gameplay/mining-skill.png'});
 await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready);
 const after=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)),MINING_KEY);
 expect(after.progression).toEqual(saved.progression);expect(after.pack).toEqual(saved.pack);expect(after.rocks).toEqual(saved.rocks);
 await writeFile('/tmp/star-agent-materials-gameplay/mining-skill-evidence.json',JSON.stringify({gpu,viewport:{width:1280,height:800},renderScale:.4,fixture:d.id,mass,xp:saved.progression.mining.xp,capacity:48,reloadPreserved:true,errors},null,2));expect(errors).toEqual([]);
});
