import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {MiningStore,MINING_KEY} from '../src/mining/store.js';
import {MATERIAL_IDS,emptyItems} from '../src/inventory/containers.js';
const evidence='/tmp/star-agent-deposit-gameplay';
const tap=async(page,index)=>{await page.evaluate(index=>window.testPad.buttons[index]={pressed:true,value:1},index);await page.waitForFunction(index=>window.starAgent.navigation.gamepad.previous[index],index);await page.evaluate(index=>window.testPad.buttons[index]={pressed:false,value:0},index);await page.waitForFunction(index=>!window.starAgent.navigation.gamepad.previous[index],index);};
async function choose(page,key){const el=page.locator(`[data-controller-key="${key}"]`);for(let i=0;i<100;i++){if(await el.evaluate(el=>el===document.activeElement))break;await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await tap(page,13);}await expect(el).toBeFocused();await tap(page,0);}
async function tabTo(page,key){const el=page.locator(`[data-controller-key="${key}"]`);for(let i=0;i<150;i++){if(await el.evaluate(el=>el===document.activeElement))return;await page.keyboard.press('Tab');}throw Error(`Keyboard cannot focus ${key}`);}
async function touch(page,key){const el=page.locator(key.startsWith('#')?key:`[data-controller-key="${key}"]`);await el.scrollIntoViewIfNeeded();const r=await el.boundingBox(),cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+r.width/2,y:r.y+r.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();}
const snapshot=page=>page.evaluate(key=>{const s=JSON.parse(localStorage.getItem(key));return {containers:Object.fromEntries(window.starAgent.state.containers.containers.map(c=>[c.id,c.items])),loadout:s.loadout,progression:s.progression,revision:s.revision};},MINING_KEY);
for(const input of ['controller','keyboard','touch','full-ship'])test(`physical ship Deposit all: ${input}`,async({page,browser})=>{
  test.setTimeout(180000);page.setDefaultTimeout(15000);const errors=[];page.on('pageerror',e=>errors.push(e.message));await mkdir(evidence,{recursive:true});if(input==='touch')await page.setViewportSize({width:390,height:844});
  const memory=new Map(),store=new MiningStore({getItem:k=>memory.get(k)??null,setItem:(k,v)=>memory.set(k,v),removeItem:k=>memory.delete(k)});
  const pack={...store.container('pack').items,basalt:6,copper:2,ice:1,concrete:2,bandage:1,'carbine-charge':5};
  let initial=store.withItems(store.state,'pack',pack);initial=store.withItems(initial,'ship',{...emptyItems(),basalt:input==='full-ship'?store.limits('ship',initial).resources:4});expect(store.validContainers(initial)).toBe(true);expect(store.write(initial)).toBe(true);
  await page.addInitScript(({key,save})=>{if(!sessionStorage.getItem('deposit-fixture')){localStorage.setItem(key,save);sessionStorage.setItem('deposit-fixture','1');}window.testPad={id:'Injected standard deposit controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];},{key:MINING_KEY,save:memory.get(MINING_KEY)});
  await page.goto('/?intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,null,{timeout:90000});
  // Actual starting ship; X leaves the pilot seat and enters the physical cabin.
  // The fixture supplies only finite inventory, never a pose or completed action.
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk'&&window.starAgent.state.insideShip);
  if(input==='keyboard'){await page.keyboard.press('i');await tabTo(page,'location-ship');await page.keyboard.press('Enter');await tabTo(page,'deposit-all');}
  else if(input==='touch'){await touch(page,'#backpack-button');await touch(page,'location-ship');}
  else {await tap(page,8);await choose(page,'location-ship');await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);}
  const action=page.locator('[data-controller-key="deposit-all"]');await expect(action).toBeVisible();await expect(action).toBeEnabled();await expect(page.locator('.inventory-mining-skill')).toContainText('Mining · Level');
  const before=await snapshot(page);await page.screenshot({path:`${evidence}/${input}-before.png`});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(input==='keyboard')await page.keyboard.press('Enter');else if(input==='touch')await touch(page,'deposit-all');else await choose(page,'deposit-all');
  if(input==='full-ship')await expect(page.locator('.cargo-feedback')).toContainText(/full|capacity|slot/);else await expect(page.locator('.cargo-feedback')).toContainText('11.00 kg resources deposited');
  const after=await snapshot(page);expect(after.progression).toEqual(before.progression);expect(after.loadout).toEqual(before.loadout);expect(after.revision).toBe(before.revision);
  if(input==='full-ship')expect(after.containers).toEqual(before.containers);else{
    for(const id of Object.keys(before.containers.pack)){if(MATERIAL_IDS.includes(id)){expect(after.containers.pack[id]).toBe(0);expect(after.containers.ship[id]).toBe(before.containers.ship[id]+before.containers.pack[id]);}else expect(after.containers.pack[id]).toBe(before.containers.pack[id]);}
    await expect(action).toBeDisabled();
  }
  await page.screenshot({path:`${evidence}/${input}-after.png`});await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();await page.waitForFunction(()=>window.starAgent.navigation.enabled);await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,1);
  await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready,null,{timeout:90000});expect(await snapshot(page)).toEqual(after);expect(errors).toEqual([]);
  await writeFile(`${evidence}/${input}.json`,JSON.stringify({browser:browser.version(),input,fixture:'Finite 11kg mixed pack resources plus carried bandage/ammo/rations; starting ship X stand; no pose injection or resource grants during play',before,after,errors},null,2));
});
