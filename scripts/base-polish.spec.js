import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {bodySurfacePoint,SELENE} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
import {SUN_DIRECTION} from '../src/world.js';
import {addBuildContainer,validBuild} from '../src/build/state.js';
const out=process.env.BASE_POLISH_EVIDENCE||'/tmp/star-agent-base-polish';
const rows=[['mainframe',[8,0,0],Math.PI],['foundation',[0,.3,0]],['foundation',[0,.3,-4]],['foundation',[-4,.3,0]],['stairs',[0,.3,0]],['wall',[-2,.3,-4],Math.PI/2],['window',[2,.3,-4],Math.PI/2],['doorway',[0,.3,-6]],['floor',[0,3.3,-4]],['crate',[-4,.3,0]]];
function fixture(){
 const disk=new Map(),store=new MiningStore({getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)});
 const claims=[new THREE.Vector3(...MOON_LANDING_DIRECTION),new THREE.Vector3(...SUN_DIRECTION).negate().normalize()].map((up,i)=>{
  const east=new THREE.Vector3(0,1,0).cross(up).normalize(),north=east.clone().cross(up).normalize();
  return {id:`build-claim-${i*20+1}`,body:'selene',name:i?'Polish night fixture':'Polish day fixture',owner:'local-player',useBuffer:false,radius:64,origin:bodySurfacePoint(up,SELENE).toArray(),quaternion:new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,up,north)).toArray(),pieces:rows.map(([type,position,rotation=0],j)=>({id:`build-piece-${i*20+j+2}`,type,position,rotation,doorOpen:false}))};
 });
 const build={version:1,nextId:32,claims};if(!validBuild(build))throw Error('Invalid polish fixture');
 let state={...store.state,build,starterConstruction:{version:1,claimed:true}};
 for(let i=0;i<2;i++){state=addBuildContainer(state,`build-core-${i*20+1}`,'Polish supplies');state=addBuildContainer(state,`build-crate-${i*20+11}`,'Polish crate');}
 if(!store.write(state))throw Error(store.warning);return {raw:disk.get(MINING_KEY),claims};
}
const world=(c,p)=>new THREE.Vector3(...p).applyQuaternion(new THREE.Quaternion(...c.quaternion)).add(new THREE.Vector3(...c.origin)).toArray();
async function pose(page,c,position,target,mode='walk'){
 await page.evaluate(({position,target,mode})=>{const n=window.starAgent.navigation;n.transitMoon();n.mode=mode;n.insideShip=false;n.shipPosition=null;n.enabled=true;n.position.fromArray(position);n.orientToward(n.position.clone().fromArray(target),n.normal);n.jumpHeight=0;n.jumpVelocity=0;n.velocity.set(0,0,0);n.keys.clear();window.testPad.axes=[0,0,0,0];},{position:world(c,position),target:world(c,target),mode});
 await page.waitForTimeout(250);
}
async function tap(page,index){
 await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await page.evaluate(i=>window.testPad.buttons[i]={pressed:true,value:1},index);
 await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],index);
 await page.evaluate(i=>window.testPad.buttons[i]={pressed:false,value:0},index);
 await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],index);
}
const axes=(page,a)=>page.evaluate(a=>window.testPad.axes=a,a);
const diagnostics=page=>page.evaluate(()=>window.starAgent.state.build.visuals);
test.afterEach(async({page},info)=>{if(info.status===info.expectedStatus)return;await mkdir(out,{recursive:true});await writeFile(`${out}/failure.json`,JSON.stringify(await page.evaluate(()=>({state:window.starAgent?.state,trace:window.polishDoorTrace})).catch(e=>({error:e.message})),null,2));});
test('polished kit renders authored ghosts, continuous doors, night fixtures and claim fade',async({page,browser})=>{
 test.setTimeout(180000);page.setDefaultTimeout(12000);await mkdir(out,{recursive:true});const errors=[],warnings=[],record={};
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 const f=fixture();
 // Explicit two saved bases and camera poses. This is renderer/interaction QA,
 // not construction, a local economy or physical-device controller acceptance.
 await page.addInitScript(({key,raw})=>{if(!localStorage.getItem(key))localStorage.setItem(key,raw);window.testPad={id:'Polish QA injected standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];},{key:MINING_KEY,raw:f.raw});
 await page.goto('/?intro=0&debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.build.assetsReady,null,{timeout:90000});
 await page.evaluate(()=>window.starAgent.setRenderScale(1));
 const day=f.claims[0],night=f.claims[1];
 for(const [name,c]of [['day',day],['night',night]]){
  await pose(page,c,[10,1.75,12],[0,1,-2]);await page.keyboard.press('KeyR');await page.waitForTimeout(750);await page.screenshot({path:`${out}/${name}-kit-walk.png`});
  await pose(page,c,[18,8,24],[0,1,-2],'eva');await page.screenshot({path:`${out}/${name}-kit-30m.png`});
  await pose(page,c,[4,1.75,-2],[0,1.3,-6]);const v=await diagnostics(page);expect(v.lights.active).toBe(2);expect(v.lights.max).toBe(4);record[`${name}Lights`]=v.lights;
  await page.screenshot({path:`${out}/${name}-door-light.png`});
 }
 await pose(page,day,[0,1.95,-8.5],[0,1.3,-4]);
 await page.waitForFunction(()=>window.starAgent.state.interaction.includes('base door'));
 await axes(page,[0,-.5,0,0]);await page.waitForTimeout(800);await axes(page,[0,0,0,0]);
 const localZ=()=>page.evaluate(c=>{const n=window.starAgent.navigation;return n.position.clone().sub(n.position.clone().fromArray(c.origin)).applyQuaternion(n.orientation.clone().fromArray(c.quaternion).invert()).z;},day);
 expect(await localZ()).toBeLessThan(-6.25);
 await page.evaluate(()=>{window.polishDoorTrace=[];const end=performance.now()+1200;const sample=()=>{window.polishDoorTrace.push(structuredClone(window.starAgent.state.build.visuals.doors));if(performance.now()<end)requestAnimationFrame(sample);};requestAnimationFrame(sample);});
 await tap(page,2);
 await page.waitForFunction(()=>{const d=window.starAgent.state.build.visuals.doors.find(d=>d.id==='build-piece-9');return d.fraction>0&&d.fraction<1;});
 await page.screenshot({path:`${out}/door-mid-motion.png`});
 await page.waitForFunction(()=>window.starAgent.state.build.visuals.doors.find(d=>d.id==='build-piece-9').fraction===1);
 await page.screenshot({path:`${out}/door-open-outside.png`});
 await axes(page,[0,-.5,0,0]);await page.waitForFunction(c=>{const n=window.starAgent.navigation;return n.position.clone().sub(n.position.clone().fromArray(c.origin)).applyQuaternion(n.orientation.clone().fromArray(c.quaternion).invert()).z>-5.3;},day);await axes(page,[0,0,0,0]);
 record.doorTrace=await page.evaluate(()=>window.polishDoorTrace);
 expect(record.doorTrace.flat().some(d=>d.id==='build-piece-9'&&d.fraction>0&&d.fraction<1)).toBe(true);
 expect(record.doorTrace.flat().every(d=>d.colliderFraction===d.fraction)).toBe(true);
 await pose(page,day,[0,1.95,-6],[0,.8,-6]);await tap(page,2);
 expect(await page.evaluate(()=>window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='doorway').doorOpen)).toBe(true);
 await pose(page,day,[0,1.95,-8.5],[0,1.3,-6]);await tap(page,2);
 await page.waitForFunction(()=>window.starAgent.state.build.visuals.doors.find(d=>d.id==='build-piece-9').fraction===0);
 // Select actual UI cards; preview validity may be false, but silhouette/shader
 // readiness must succeed for every exported kit piece without spending stock.
 record.ghosts={};
 await pose(page,day,[7,1.75,6],[0,.3,0]);
 for(const id of ['mainframe','foundation','wall','doorway','window','stairs','floor','crate']){
  await page.keyboard.press('KeyB');await expect(page.locator('#build-dialog')).toBeVisible();
  await page.locator(`[data-controller-key="build-piece-${id}"]`).click();
  await page.waitForFunction(id=>{const g=window.starAgent.state.build.visuals.ghost;return g.pieceId===id&&g.ready&&g.meshes>0;},id);
  record.ghosts[id]=(await diagnostics(page)).ghost;await page.screenshot({path:`${out}/ghost-${id}.png`});await page.keyboard.press('Escape');
 }
 await pose(page,day,[8,1.75,2.5],[8,1.25,0]);await page.screenshot({path:`${out}/mainframe-status.png`});await tap(page,2);
 await expect(page.locator('#build-dialog')).toBeVisible();await page.screenshot({path:`${out}/mainframe-desktop.png`});
 await page.locator('[data-controller-key="build-tab-recipes"]').click();await page.screenshot({path:`${out}/recipes-desktop.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/recipes-phone.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.locator('[data-controller-key="build-close"]').click();await page.setViewportSize({width:1440,height:900});
 await pose(page,day,[0,15,550],[0,1,0],'eva');
 const faded=(await diagnostics(page)).claims.find(c=>c.id===day.id);expect(faded.opacity).toBeGreaterThan(.3);expect(faded.opacity).toBeLessThan(.7);record.fade=faded;
 await page.screenshot({path:`${out}/claim-mid-fade.png`});
 await pose(page,day,[10,1.75,12],[0,1,-2]);await page.waitForTimeout(1000);
 record.performance=await page.evaluate(async()=>{const times=[];for(let i=0;i<60;i++)await new Promise(resolve=>requestAnimationFrame(t=>{times.push(t);resolve();}));const s=window.starAgent.state,gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {drawCalls:s.drawCalls,triangles:s.triangles,renderScale:s.renderScale,rafMeanMs:(times.at(-1)-times[0])/(times.length-1),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 expect(record.performance.gpu).not.toMatch(/swiftshader|llvmpipe/i);expect(record.performance.renderScale).toBe(1);
 const saved=await page.evaluate(()=>window.starAgent.state.build.claims);await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.build.assetsReady,null,{timeout:90000});
 expect(await page.evaluate(()=>window.starAgent.state.build.claims)).toEqual(saved);
 await writeFile(`${out}/record.json`,JSON.stringify({...record,browser:browser.version(),viewport:{width:1440,height:900},fixture:'Two valid saved bases and debug poses; normal UI piece selection; injected Gamepad door activation and walking; no physical controller',timing:'RAF cadence, not isolated GPU execution time',errors,warnings},null,2));expect(errors).toEqual([]);expect(warnings).toEqual([]);
});
