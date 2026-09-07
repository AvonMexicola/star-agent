import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/tmp/star-agent-effects-v2';
const button=(page,index,down)=>page.evaluate(({index,down})=>window.testPad.buttons[index]={pressed:down,value:Number(down)},{index,down});
const tap=async(page,index)=>{await button(page,index,true);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],index);await button(page,index,false);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],index);};
const axes=(page,values)=>page.evaluate(values=>window.testPad.axes=values,values);
async function command(page,key,{hold=false}={}){
 await tap(page,9);await expect(page.locator('#controller-menu')).toBeVisible();
 for(let i=0;i<45;i++){if(await page.locator(`[data-controller-key="${key}"]`).evaluate(el=>el===document.activeElement))break;await tap(page,13);}
 await expect(page.locator(`[data-controller-key="${key}"]`)).toBeFocused();
 if(hold)await button(page,0,true);else await tap(page,0);
 await expect(page.locator('#controller-menu')).not.toBeVisible();
}
async function aim(page){
 for(let i=0;i<120;i++){
  const error=await page.evaluate(()=>{const n=window.starAgent.navigation,p=n.position.clone().fromArray(window.starAgent.state.mining.activePosition).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(p.x,-p.z),Math.atan2(p.y,Math.hypot(p.x,p.z))];});
  if(Math.abs(error[0])<.025&&Math.abs(error[1])<.025){await axes(page,[0,0,0,0]);return;}
  const axis=v=>Math.sign(v)*Math.min(1,.2+Math.abs(v)*1.5);
  await axes(page,[0,0,axis(error[0]),axis(-error[1])]);await page.waitForTimeout(90);
 }
 throw Error('Controller aim did not converge');
}
test('controller equips ship and ground weapons, walks to target, fires, mines and inspects cargo',async({page,browser})=>{
 test.setTimeout(360000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await mkdir(out,{recursive:true});
 await page.addInitScript(()=>{window.testPad={id:'Effects Xbox acceptance',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];});
 await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed);
 await command(page,'weapon-laser',{hold:true});
 const shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);await page.waitForTimeout(350);
 expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(shots);
 await button(page,0,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await button(page,7,true);await page.waitForFunction(()=>window.starAgent.state.effects.lastWeapon==='laser'&&window.starAgent.state.effects.weaponShots>0);await button(page,7,false);
 await command(page,'destination-moon');await page.waitForFunction(()=>window.starAgent.state.body==='selene'&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed);
 await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axes(page,[0,0,0,0]);await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
 await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await axes(page,[0,0,0,0]);await aim(page);
 await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>{const n=window.starAgent.navigation;return n.position.distanceTo(n.position.clone().fromArray(window.starAgent.state.mining.activePosition))<5;});await axes(page,[0,0,0,0]);await aim(page);
 const before=await page.evaluate(()=>window.starAgent.state.mining);
 for(const item of ['rifle-laser','sidearm-pistol']){
  await command(page,`equip-${item}`);await page.waitForFunction(id=>window.starAgent.state.mining.tool.item===id,item);
  const hits=await page.evaluate(()=>window.starAgent.state.effects.weaponImpacts);
  await button(page,7,true);await page.waitForFunction(n=>window.starAgent.state.effects.weaponImpacts>n,hits);await page.screenshot({path:`${out}/ground-${item}.png`});await button(page,7,false);
  const after=await page.evaluate(()=>window.starAgent.state.mining);expect(after.revision).toBe(before.revision);expect(after.pack).toEqual(before.pack);
 }
 // Keep RT physically down across environmental interruptions. Only neutral
 // recovery followed by a fresh trigger may produce another ground shot.
 await button(page,7,true);await page.waitForTimeout(250);
 await page.evaluate(()=>window.dispatchEvent(new Event('blur')));await page.waitForTimeout(150);
 let stopped=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);
 await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(300);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(stopped);
 await page.evaluate(()=>window.testPad.connected=false);await page.waitForFunction(()=>!window.starAgent.state.controller.connected);
 await page.evaluate(()=>{window.testPad.connected=true;window.testPad.id='Replacement effects Xbox';});await page.waitForTimeout(300);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(stopped);
 await page.evaluate(()=>window.testPad.mapping='');await page.waitForTimeout(150);expect(await page.evaluate(()=>window.starAgent.state.controller.connected)).toBe(false);
 await page.evaluate(()=>window.testPad.mapping='standard');await page.waitForTimeout(200);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(stopped);
 await button(page,7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await command(page,'equip-mining-laser-tool');await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit!==null);
 await button(page,7,true);await page.waitForFunction(n=>window.starAgent.state.mining.revision>n,before.revision);await page.screenshot({path:`${out}/controller-mining.png`});await button(page,7,false);await page.waitForFunction(()=>!window.starAgent.state.mining.pending);
 const mined=await page.evaluate(()=>window.starAgent.state.mining);expect(mined.pack.reduce((a,b)=>a+b,0)).toBeGreaterThan(before.pack.reduce((a,b)=>a+b,0));
 await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await tap(page,13);expect(await page.locator('#cargo-dialog [data-controller-selected]').count()).toBe(1);await page.screenshot({path:`${out}/controller-cargo.png`});await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();
 await writeFile(`${out}/controller.json`,JSON.stringify({browser:browser.version(),input:'Injected standard Gamepad only; debug reads for steering, no gameplay mutations; no physical controller',mined,errors},null,2));expect(errors).toEqual([]);
});
