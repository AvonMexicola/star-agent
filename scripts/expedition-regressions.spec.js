import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-expedition-regressions';
async function setup(page){
  await page.addInitScript(()=>{window.regressionPad={id:'Standard Xbox regression fixture',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.regressionPad];});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed);await page.evaluate(()=>window.starAgent.setRenderScale(.65));
}
async function button(page,index,down){
  await page.evaluate(({index,down})=>window.regressionPad.buttons[index]={pressed:down,value:Number(down)},{index,down});
  await page.waitForFunction(({index,down})=>Boolean(window.starAgent.navigation.gamepad.previous[index])===down,{index,down});
}
async function tap(page,index){
  await page.waitForFunction(()=>document.querySelector('dialog[open]')?window.starAgent.navigation.gamepad.uiArmed:window.starAgent.state.controller.armed);
  await button(page,index,true);await button(page,index,false);
}
async function menuTransit(page,id){
  await tap(page,9);await expect(page.locator('#controller-menu')).toBeVisible();
  const target=page.locator(`[data-controller-key="destination-${id}"]`);
  for(let i=0;i<24;i++){if(await target.evaluate(el=>el===document.activeElement))break;await tap(page,13);}
  await expect(target).toBeFocused();await tap(page,0);await page.waitForFunction(()=>!window.starAgent.state.transiting&&!document.querySelector('dialog[open]')&&window.starAgent.state.controller.armed);
}
const watchErrors=page=>{const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});return errors;};

test('Xbox equips and fires away from every nearby Selene deposit without awarding empty-space resources',async({page,browser})=>{
  test.setTimeout(180000);const errors=watchErrors(page);await mkdir(evidence,{recursive:true});await setup(page);await menuTransit(page,'moon');
  // Regression fixture only: move the player 350m sideways from the landing
  // deposit and settle on the real terrain. Entry/equip/fire still use Gamepad.
  await page.evaluate(()=>{
    const n=window.starAgent.navigation,center=n.position.clone().fromArray(window.starAgent.state.moon.position),east=n.position.clone().set(0,1,0).cross(n.normal).normalize();
    n.position.addScaledVector(east,350);const radial=n.position.clone().sub(center).normalize();
    const elevation=n.groundHeight;
    n.position.copy(center).addScaledVector(radial,window.starAgent.state.moon.radius+elevation+1.75);
    n.mode='walk';n.shipPosition=null;n.insideShip=false;n.spaceParked=false;n.jumpHeight=0;n.jumpVelocity=0;n.velocity.set(0,0,0);n.enabled=true;
    n.orientToward(n.position.clone().addScaledVector(radial,5).addScaledVector(east,2),radial.clone().cross(east));
  });
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.active&&window.starAgent.state.mining.tool.hit===null);
  const distance=await page.evaluate(()=>{const n=window.starAgent.navigation;return n.position.distanceTo(n.position.clone().fromArray(window.starAgent.state.mining.activePosition));});expect(distance).toBeGreaterThan(100);
  const selected=await page.evaluate(()=>window.starAgent.state.mining.tool.selected);await tap(page,15);expect(await page.evaluate(()=>window.starAgent.state.mining.tool.selected)).toBe(!selected);if(selected)await tap(page,15);
  const before=await page.evaluate(()=>({pack:window.starAgent.state.mining.pack,revision:window.starAgent.state.mining.groundRevision}));
  await button(page,7,true);await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming);await page.screenshot({path:`${evidence}/remote-selene-beam.png`});
  await button(page,7,false);await page.waitForFunction(()=>!window.starAgent.state.mining.tool.beaming);
  const after=await page.evaluate(()=>({pack:window.starAgent.state.mining.pack,revision:window.starAgent.state.mining.groundRevision}));expect(after).toEqual(before);
  await writeFile(`${evidence}/remote-selene.json`,JSON.stringify({browser:browser.version(),fixture:'Debug surface position350m from deposit; actual controller menu/equip/RT',distance,before,after,errors},null,2));expect(errors).toEqual([]);
});

test('ring flight right-stick yaw turns left and right even when the nose points along lunar gravity',async({page,browser})=>{
  test.setTimeout(180000);const errors=watchErrors(page);await mkdir(evidence,{recursive:true});await setup(page);await menuTransit(page,'ring');
  await page.waitForFunction(()=>window.starAgent.state.mode==='flight');const observations=[];
  for(const braking of [false,true])for(const input of [-.8,.8]){
    // Exact pole-facing orientation exposes gravity-axis yaw becoming roll.
    // Only initial orientation is a fixture; live navigation consumes all input.
    const initial=await page.evaluate(()=>{
      const n=window.starAgent.navigation,forward=n.normal,up=n.position.clone().set(0,1,0).addScaledVector(forward,-forward.y).normalize();
      n.orientToward(n.position.clone().add(forward),up);n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);n.flightAssist=true;
      return {q:n.orientation.toArray(),right:n.position.clone().set(1,0,0).applyQuaternion(n.orientation).toArray(),up:up.toArray()};
    });
    await page.waitForFunction(()=>window.starAgent.state.controller.armed);
    if(braking){await button(page,6,true);await button(page,0,true);}
    await page.evaluate(input=>window.regressionPad.axes=[0,0,input,0],input);
    await page.waitForFunction(q=>{const n=window.starAgent.navigation;return n.orientation.angleTo(n.orientation.clone().fromArray(q))>.16;},initial.q,{timeout:15000});
    await page.evaluate(async()=>{window.regressionPad.axes=[0,0,0,0];await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    const result=await page.evaluate(initial=>{const n=window.starAgent.navigation,f=n.position.clone().set(0,0,-1).applyQuaternion(n.orientation);return {speed:n.speed,right:f.dot(n.position.clone().fromArray(initial.right)),pitch:f.dot(n.position.clone().fromArray(initial.up)),orientation:n.orientation.toArray()};},initial);
    expect(result.right*Math.sign(input),'right stick produces yaw rather than roll').toBeGreaterThan(.1);expect(Math.abs(result.pitch),'yaw preserves pitch in the initial ship frame').toBeLessThan(.03);if(braking){expect(result.speed).toBeLessThan(1e-8);await button(page,0,false);await button(page,6,false);}
    observations.push({braking,input,initial,result});
  }
  await page.screenshot({path:`${evidence}/ring-yaw.png`});await writeFile(`${evidence}/ring-yaw.json`,JSON.stringify({browser:browser.version(),fixture:'Debug initial pole-facing camera orientation; actual standard Gamepad flight input',observations,errors},null,2));expect(errors).toEqual([]);
});
