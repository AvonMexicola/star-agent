import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import * as THREE from 'three';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {bodySurfacePoint,SELENE} from '../src/celestial.js';
import {MOON_LANDING_DIRECTION} from '../src/moon-world.js';
import {addBuildContainer,validBuild} from '../src/build/state.js';
const out=process.env.BASE_SCENE_EVIDENCE||'/tmp/star-agent-base-scene';
test.afterEach(async({page},info)=>{if(info.status===info.expectedStatus)return;await writeFile(`${out}/failure-state.json`,JSON.stringify(await page.evaluate(()=>({state:window.starAgent?.state,interaction:window.starAgent?.navigation?.interaction})).catch(e=>({error:e.message})),null,2));});
const up=new THREE.Vector3(...MOON_LANDING_DIRECTION),east=new THREE.Vector3(0,1,0).cross(up).normalize(),north=east.clone().cross(up).normalize();
const origin=bodySurfacePoint(up,SELENE),quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(east,up,north));
const world=point=>new THREE.Vector3(...point).applyQuaternion(quaternion).add(origin).toArray();
function fixture(){
 const disk=new Map(),storage={getItem:k=>disk.get(k)??null,setItem:(k,v)=>disk.set(k,v)},store=new MiningStore(storage);
 const rows=[['mainframe',[8,0,0],Math.PI],['foundation',[0,.3,0]],['foundation',[0,.3,-4]],['foundation',[-4,.3,0]],['stairs',[0,.3,0]],['wall',[-2,.3,-4],Math.PI/2],['window',[2,.3,-4],Math.PI/2],['doorway',[0,.3,-6]],['floor',[0,3.3,-4]],['crate',[-4,.3,0]]];
 const c={id:'build-claim-1',body:'selene',name:'Crescent construction test',owner:'local-player',useBuffer:false,radius:64,origin:origin.toArray(),quaternion:quaternion.toArray(),pieces:rows.map(([type,position,rotation=0],i)=>({id:`build-piece-${i+2}`,type,position,rotation,doorOpen:false}))};
 const build={version:1,nextId:rows.length+2,claims:[c]};if(!validBuild(build))throw Error('Review fixture violates build schema');
 let state={...store.state,build};state=addBuildContainer(state,'build-core-1','Crescent mainframe supplies');state=addBuildContainer(state,'build-crate-11','Crescent physical crate');
 if(!store.write(state))throw Error(store.warning);return {raw:disk.get(MINING_KEY),c};
}
const at=async(page,position,target)=>page.evaluate(({position,target})=>{const n=window.starAgent.navigation;n.transitMoon();n.mode='walk';n.insideShip=false;n.shipPosition=null;n.position.fromArray(position);n.orientToward(n.position.clone().fromArray(target),n.normal);n.jumpHeight=0;n.jumpVelocity=0;n.velocity.set(0,0,0);}, {position:world(position),target:world(target)});
test('authored base in game: full kit, physical doorway, mainframe and accessible phone UI',async({page,browser})=>{
 test.setTimeout(180000);page.setDefaultTimeout(20000);await mkdir(out,{recursive:true});const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 const f=fixture();await page.addInitScript(({key,raw})=>localStorage.setItem(key,raw),{key:MINING_KEY,raw:f.raw});
 await page.goto('/?intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.build.assetsReady,null,{timeout:90000});
 // Explicit saved-base/position fixture for renderer, collision and interaction.
 // Actual controller construction/hauling is a separate input-only journey.
 await at(page,[10,1.75,12],[0,1,-2]);await page.waitForTimeout(1000);await page.screenshot({path:`${out}/base-exterior.png`});
 const performance=await page.evaluate(async()=>{const frames=[];for(let i=0;i<90;i++)await new Promise(resolve=>requestAnimationFrame(time=>{frames.push(time);resolve();}));const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info'),s=window.starAgent.state;return {draws:s.drawCalls,triangles:s.triangles,renderScale:s.renderScale,meanFrameMs:(frames.at(-1)-frames[0])/(frames.length-1),gpu:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER)};});
 await writeFile(`${out}/partial-scene.json`,JSON.stringify({performance,fixture:'Saved base; interaction assertions still in progress'},null,2));
 await at(page,[0,2.05,-8.5],[0,1.8,-4]);await page.keyboard.down('KeyW');await page.waitForTimeout(1200);await page.keyboard.up('KeyW');
 console.log('at closed door',await page.evaluate(()=>({position:window.starAgent.state.position,interaction:window.starAgent.state.interaction})));
 const closed=await page.evaluate(()=>window.starAgent.state.position);const localClosed=new THREE.Vector3(...closed).sub(origin).applyQuaternion(quaternion.clone().invert());expect(localClosed.z).toBeLessThan(-6.3);
 await page.waitForTimeout(200);await page.keyboard.press('KeyF');await page.waitForFunction(()=>window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='doorway').doorOpen);
 await page.keyboard.down('KeyW');await page.waitForFunction(({origin,quaternion})=>{const n=window.starAgent.navigation;return n.position.clone().sub(n.position.clone().fromArray(origin)).applyQuaternion(n.orientation.clone().fromArray(quaternion).invert()).z>-5.5;},{origin:origin.toArray(),quaternion:quaternion.toArray()});await page.keyboard.up('KeyW');
 await page.screenshot({path:`${out}/doorway-open.png`});
 await at(page,[8,1.75,2.5],[8,.8,0]);await page.keyboard.press('KeyF');await expect(page.locator('#build-dialog')).toBeVisible();await expect(page.locator('.build-overview')).toContainText('Local owner');
 await page.locator('[data-controller-key="build-buffer-toggle"]').click();expect(await page.evaluate(()=>window.starAgent.state.build.claims[0].useBuffer)).toBe(true);
 await page.screenshot({path:`${out}/mainframe-desktop.png`});
 await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/mainframe-phone.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 console.log('opening supplies');await page.locator('[data-controller-key="build-supplies"]').click();console.log('supplies click returned');await expect(page.locator('#cargo-dialog')).toBeVisible({timeout:10000});await expect(page.locator('[data-container="build-core-1"]')).toBeVisible({timeout:10000});console.log('supplies verified');
 await writeFile(`${out}/scene.json`,JSON.stringify({browser:browser.version(),fixture:'Saved valid base and debug starting poses; real keyboard movement, doorway and mainframe interactions',performance,closedPosition:localClosed.toArray(),errors,warnings},null,2));expect(errors).toEqual([]);
});
