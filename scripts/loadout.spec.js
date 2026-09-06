import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-loadout-evidence';
const setButton=(page,index,down)=>page.evaluate(({index,down})=>window.testPad.buttons[index]={pressed:down,value:Number(down)},{index,down});
const tap=async(page,index)=>{await setButton(page,index,true);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],index,{timeout:5000});await setButton(page,index,false);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],index,{timeout:5000});};
const axes=(page,values)=>page.evaluate(values=>window.testPad.axes=values,values);
async function aimAtDeposit(page) {
  for(let i=0;i<120;i++) {
    const error=await page.evaluate(()=>{
      const n=window.starAgent.navigation;
      const local=n.position.clone().fromArray(window.starAgent.state.mining.activePosition).sub(n.position).applyQuaternion(n.orientation.clone().invert());
      return [Math.atan2(local.x,-local.z),Math.atan2(local.y,Math.hypot(local.x,local.z))];
    });
    if(Math.abs(error[0])<.025&&Math.abs(error[1])<.025){await axes(page,[0,0,0,0]);return;}
    const axis=v=>Math.sign(v)*Math.min(1,.2+Math.abs(v)*1.5);
    await axes(page,[0,0,axis(error[0]),axis(-error[1])]);await page.waitForTimeout(90);
  }
  throw new Error('Controller aim did not converge');
}
for(const destination of ['moon']) test(`${destination}: controller equips both weapons, mines on Selene, fires using ammo slots, uses quick shortcuts and returns to backpack`,async({page,browser})=>{
  test.setTimeout(420000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mkdir(evidence,{recursive:true});
  await page.addInitScript(()=>{window.testPad={id:'Automated standard Xbox',index:0,mapping:'standard',connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.testPad];});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed&&window.starAgent.state.mining.ready);
  const starter=await page.evaluate(()=>window.starAgent.state.loadout);
  expect(starter.slots.weapon1.item).toBe('rifle-laser');expect(starter.slots.tool.item).toBe('mining-laser-tool');
  expect(starter.slots.ammo1).toEqual({item:'carbine-charge',quantity:60});
  // Reads debug state for assertions and steering feedback. No gameplay mutation,
  // teleport helper, keyboard event, mouse click or pointer capture is used.
  await tap(page,9);await expect(page.locator('#controller-menu')).toBeVisible();
  const choose=async selector=>{for(let i=0;i<60;i++){if(await page.locator(selector).evaluate(el=>el===document.activeElement))break;await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await tap(page,13);}await expect(page.locator(selector)).toBeFocused();await tap(page,0);};
  await choose('[data-controller-key="equipment"]');await expect(page.locator('.inventory-equipment')).toBeVisible();
  expect(await page.locator('[data-equipment-slot]').count()).toBe(10);
  await choose('[data-equipment-slot="weapon1"]');await choose('[data-controller-key="stow-weapon1-pack"]');
  await choose('[data-equipment-slot="weapon2"]');await choose('[data-controller-key="assign-weapon2-pack-rifle-laser"]');
  await choose('[data-equipment-slot="weapon1"]');await choose('[data-controller-key="assign-weapon1-pack-sidearm-pistol"]');
  await choose('[data-equipment-slot="quick1"]');await choose('[data-controller-key="stow-quick1-pack"]');
  await choose('[data-equipment-slot="quick3"]');await choose('[data-controller-key="assign-quick3-pack-bandage"]');
  await choose('[data-controller-key="use-quick3"]');await expect(page.locator('.cargo-feedback')).toContainText('Health is full');
  await choose('[data-equipment-slot="ammo1"]');await choose('[data-controller-key="stow-ammo1-pack"]');await choose('[data-controller-key="assign-ammo1-pack-carbine-charge"]');
  const assigned=await page.evaluate(()=>window.starAgent.state.loadout);expect(assigned.slots.weapon1.item).toBe('sidearm-pistol');expect(assigned.slots.weapon2.item).toBe('rifle-laser');expect(assigned.slots.quick3.quantity).toBe(3);
  await page.locator('#cargo-dialog').evaluate(el=>el.scrollTop=0);await page.screenshot({path:`${evidence}/equipment-desktop.png`});
  await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  await tap(page,9);await expect(page.locator('#controller-menu')).toBeVisible();
  for(let i=0;i<36;i++) {if(await page.locator(`[data-controller-key="destination-${destination}"]`).evaluate(el=>el===document.activeElement))break;await tap(page,13);}
  await expect(page.locator(`[data-controller-key="destination-${destination}"]`)).toBeFocused();await tap(page,0);
  await page.waitForFunction(()=>window.starAgent.state.body==='selene'&&!window.starAgent.state.transiting);
  await page.waitForFunction(()=>window.starAgent.state.controller.armed);await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axes(page,[0,0,0,0]);
  await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await axes(page,[0,0,0,0]);
  expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  await aimAtDeposit(page);
  await axes(page,[0,-1,0,0]);await page.waitForFunction(()=>{const n=window.starAgent.navigation;return n.position.distanceTo(n.position.clone().fromArray(window.starAgent.state.mining.activePosition))<5;});await axes(page,[0,0,0,0]);await aimAtDeposit(page);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.hit!==null);
  await tap(page,15);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.selected)).toBe(false);
  await tap(page,15);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.selected)).toBe(true);
  const revision=await page.evaluate(()=>window.starAgent.state.mining.activeRevision);
  await setButton(page,7,true);await page.waitForFunction(({revision,cuts})=>window.starAgent.state.mining.activeRevision>=revision+cuts,{revision,cuts:destination==='moon'?1:4});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming);await page.waitForFunction(()=>{const e=window.starAgent.state.effects;return e.beamVisible&&e.miningContacts>0&&e.collectedBursts>0&&e.particles>0;});
  await page.screenshot({path:`${evidence}/${destination}-controller-held-beam.png`});
  await setButton(page,7,false);await page.waitForFunction(()=>!window.starAgent.state.mining.pending);
  const effects=await page.evaluate(()=>window.starAgent.state.effects);
  const mined=await page.evaluate(()=>window.starAgent.state.mining);expect(mined.pack.reduce((a,b)=>a+b,0)).toBeGreaterThan(0);
  if(destination!=='moon'){expect(mined.pack[1]).toBeGreaterThan(mined.pack[0]);expect(mined.pack[1]).toBeGreaterThan(mined.pack[2]);}
  await page.waitForFunction(()=>window.starAgent.state.controller.armed);await tap(page,14);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='sidearm-pistol');
  await expect(page.locator('.mining-heat')).not.toBeVisible();await expect(page.locator('#controller-hints')).toContainText('FIRE');
  const beforeGun=await page.evaluate(()=>({ammo:window.starAgent.state.loadout.slots.ammo2.quantity,shots:window.starAgent.state.effects.weaponShots,revision:window.starAgent.state.mining.activeRevision}));
  await setButton(page,7,true);await page.waitForFunction(n=>window.starAgent.state.effects.weaponShots>=n+3,beforeGun.shots);await page.screenshot({path:`${evidence}/sidearm-firing.png`});await setButton(page,7,false);
  const afterGun=await page.evaluate(()=>({ammo:window.starAgent.state.loadout.slots.ammo2.quantity,shots:window.starAgent.state.effects.weaponShots,revision:window.starAgent.state.mining.activeRevision}));
  expect(beforeGun.ammo-afterGun.ammo).toBe(afterGun.shots-beforeGun.shots);expect(afterGun.revision).toBe(beforeGun.revision);
  expect(await page.evaluate(()=>window.starAgent.state.effects.lastWeapon)).toBe('pulse');
  await tap(page,14);await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='rifle-laser');
  await expect(page.locator('.mining-target')).toHaveText('LASER RIFLE');
  const beforeRifle=await page.evaluate(()=>({ammo:window.starAgent.state.loadout.slots.ammo1.quantity,shots:window.starAgent.state.effects.weaponShots,impacts:window.starAgent.state.effects.weaponImpacts,revision:window.starAgent.state.mining.activeRevision}));
  await setButton(page,7,true);await page.waitForFunction(n=>{const e=window.starAgent.state.effects;return e.weaponShots>=n+3&&e.lastWeapon==='laser'&&e.lances>0;},beforeRifle.shots);
  await page.screenshot({path:`${evidence}/carbine-firing.png`});
  await setButton(page,7,false);await page.waitForFunction(()=>window.starAgent.navigation.toolTrigger<=.1);
  const afterRifle=await page.evaluate(()=>({ammo:window.starAgent.state.loadout.slots.ammo1.quantity,shots:window.starAgent.state.effects.weaponShots,impacts:window.starAgent.state.effects.weaponImpacts,revision:window.starAgent.state.mining.activeRevision}));
  expect(beforeRifle.ammo-afterRifle.ammo).toBe(afterRifle.shots-beforeRifle.shots);expect(afterRifle.impacts).toBeGreaterThan(beforeRifle.impacts);expect(afterRifle.revision).toBe(beforeRifle.revision);
  await setButton(page,7,true);await page.waitForFunction(n=>window.starAgent.state.effects.weaponShots>n,afterRifle.shots);
  // Opening equipment while RT is held cancels fire; a held trigger cannot replay.
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();
  const paused=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);await page.waitForTimeout(400);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(paused);
  expect(await page.evaluate(()=>window.starAgent.state.effects.lances)).toBe(0);
  await setButton(page,7,false);await page.waitForFunction(()=>window.starAgent.navigation.gamepad.uiArmed);await setButton(page,7,true);await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();await page.waitForTimeout(350);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(paused);
  await setButton(page,7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  await tap(page,12);expect(await page.evaluate(()=>window.starAgent.state.loadout.quickIndex)).toBe(1);await tap(page,13);expect(await page.evaluate(()=>window.starAgent.state.loadout.slots.quick2.quantity)).toBe(2);
  await tap(page,15);await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='mining-laser-tool');
  await tap(page,8);await expect(page.locator('#cargo-dialog')).toBeVisible();await page.screenshot({path:`${evidence}/${destination}-controller-backpack.png`});
  await tap(page,13);expect(await page.locator('#cargo-dialog [data-controller-selected]').count()).toBe(1);
  await tap(page,1);await expect(page.locator('#cargo-dialog')).not.toBeVisible();
  await writeFile(`${evidence}/${destination}-controller-gameplay.json`,JSON.stringify({browser:browser.version(),input:'Injected W3C standard Gamepad; no physical controller used',viewport:page.viewportSize(),starter,assigned,beforeGun,afterGun,beforeRifle,afterRifle,effects,mined,errors},null,2));
  expect(errors).toEqual([]);
});
