import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MINING_KEY} from '../src/mining/store.js';
import {SANDBOX_PREFIX} from '../src/build/sandbox.js';
const out='/home/cees/.cache/star-agent-base-power-evidence';
async function tap(page,i){await page.evaluate(i=>window.testPad.buttons[i]={pressed:true,value:1},i);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],i);await page.evaluate(i=>window.testPad.buttons[i]={pressed:false,value:0},i);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],i);}
async function choose(page,key,navigates=false){const el=page.locator(`[data-controller-key="${key}"]`);for(let i=0;i<100;i++){if(await el.evaluate(e=>e===document.activeElement))break;await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await tap(page,13);}await expect(el).toBeFocused();if(navigates)await page.evaluate(()=>window.testPad.buttons[0]={pressed:true,value:1});else await tap(page,0);}
const ready=page=>page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,null,{timeout:90000});
const saved=page=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)),SANDBOX_PREFIX+MINING_KEY);
test.afterEach(async({page},info)=>{if(info.status===info.expectedStatus)return;await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/failure.json`,JSON.stringify(await page.evaluate(()=>window.starAgent?.state),null,2));});
async function aimAt(page,point){for(let i=0;i<140;i++){const error=await page.evaluate(point=>{const n=window.starAgent.navigation,local=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(local.x,-local.z),Math.atan2(local.y,Math.hypot(local.x,local.z))];},point);if(error.every(v=>Math.abs(v)<.03)){await page.evaluate(()=>window.testPad.axes.fill(0));return;}await page.evaluate(e=>window.testPad.axes=[0,0,...[e[0],-e[1]].map(v=>Math.sign(v)*Math.min(.7,.2+Math.abs(v)))],error);await page.waitForTimeout(90);}throw Error('Controller aim did not converge');}
const worldPoint=(page,p)=>page.evaluate(p=>{const c=window.starAgent.state.build.claims[0],n=window.starAgent.navigation;return n.position.clone().fromArray(p).applyQuaternion(n.orientation.clone().fromArray(c.quaternion)).add(n.position.clone().fromArray(c.origin)).toArray();},p);
async function selectBuild(page,id,tab){await tap(page,1);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);for(let i=0;i<6&&!(await page.locator(`[data-controller-key="build-tab-${tab}"]`).getAttribute('aria-pressed')==='true');i++){await tap(page,5);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);}await choose(page,`build-piece-${id}`);await ready(page);}
async function buildPiece(page,id,tab,point){await aimAt(page,await worldPoint(page,point));await selectBuild(page,id,tab);await page.waitForFunction(()=>window.starAgent.state.build.preview?.valid,null,{timeout:10000});const before=await page.evaluate(()=>window.starAgent.state.build.pieceCount);await tap(page,0);await page.waitForFunction(n=>window.starAgent.state.build.pieceCount===n+1,before);await tap(page,2);}

async function walkTo(page,point){await aimAt(page,point);await page.evaluate(()=>window.testPad.axes=[0,-.5,0,0]);await page.waitForFunction(point=>{const n=window.starAgent.navigation,c=window.starAgent.state.build.claims[0],delta=n.position.clone().fromArray(point).sub(n.position).applyQuaternion(n.orientation.clone().fromArray(c.quaternion).invert());return Math.hypot(delta.x,delta.z)<.45;},point,{timeout:45000});await page.evaluate(()=>window.testPad.axes.fill(0));}

test('controller installs solar and storage, reads live power, and returns to a saved base',async({page})=>{
 test.setTimeout(300000);await mkdir(out,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{window.testPad={id:'Base power controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];});
 await page.goto('/?sandbox=build&intro=0&debug&seed=7291');await ready(page);await page.waitForFunction(()=>window.starAgent.state.build.assetsReady);
 await buildPiece(page,'solar-array','power',[0,.3,2]);await buildPiece(page,'battery','power',[3,.3,2]);
 await page.waitForFunction(()=>window.starAgent.state.build.claims[0].power?.charge>2.001,null,{timeout:40000});
 await page.screenshot({path:`${out}/solar-battery-built.png`});
 await walkTo(page,await worldPoint(page,[6,2.05,5]));
 const core=await page.evaluate(()=>window.starAgent.state.build.claims[0].pieces.find(p=>p.type==='mainframe').position);
 await walkTo(page,await worldPoint(page,[core[0]-2,core[1]+1.75,core[2]+1]));await aimAt(page,await worldPoint(page,[core[0],core[1]+.8,core[2]]));await tap(page,2);await expect(page.locator('[data-base-power]')).toContainText('POWERED');await expect(page.locator('[data-base-power]')).toContainText('14 kWh');
 await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await choose(page,'power-fuel-uranium');await expect(page.locator('.build-feedback')).toContainText('matching generator');
 await page.screenshot({path:`${out}/mainframe-power.png`});await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/power-phone.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await tap(page,1);await ready(page);const before=await saved(page);await page.reload();await ready(page);const after=await saved(page);expect(after.build.claims[0].pieces).toEqual(before.build.claims[0].pieces);expect(after.build.claims[0].power.charge).toBeGreaterThanOrEqual(before.build.claims[0].power.charge);expect(errors).toEqual([]);
 await writeFile(`${out}/journey.json`,JSON.stringify({input:'Injected Gamepad only; production sandbox spawn and materials',pieces:after.build.claims[0].pieces.map(p=>p.type),power:after.build.claims[0].power,errors},null,2));
});
