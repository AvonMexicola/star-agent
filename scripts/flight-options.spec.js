import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {latLonDirection} from '../src/world.js';
const output='/tmp/star-agent-flight-options-evidence';
test('heading drive, real gear and lights, held rifle, and persisted meadow options render',async({page,browser})=>{
  await mkdir(output,{recursive:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?intro=0&debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.8));
  // Controlled orbital fixture for visual/mechanical inspection, not a boarding journey.
  await page.evaluate(()=>{const n=window.starAgent.navigation,up=n.normal;n.orientToward(n.position.clone().add(up),up.clone().set(up.y,up.z,up.x));});
  await page.keyboard.press('4');await page.keyboard.press('g');
  await page.waitForFunction(()=>window.starAgent.state.utilities.gearProgress===0);
  expect((await page.evaluate(()=>window.starAgent.state)).utilities.gearAssemblies).toBe(4);
  await page.screenshot({path:`${output}/nomad-gear-up.png`});
  await page.keyboard.press('g');await page.waitForFunction(()=>window.starAgent.state.utilities.gearProgress===1);
  await page.screenshot({path:`${output}/nomad-gear-down.png`});
  await page.keyboard.press('n');await page.waitForFunction(()=>window.starAgent.state.travel?.phase==='accelerating');
  await page.screenshot({path:`${output}/heading-drive.png`});
  await page.keyboard.press('n');await page.waitForFunction(()=>window.starAgent.state.travel===null);
  expect((await page.evaluate(()=>window.starAgent.state)).speed).toBeLessThan(1);
  await page.keyboard.press('l');await page.waitForFunction(()=>window.starAgent.state.utilities.ship);
  // Known meadow patch, canonical terrain and fixed camera for comparison.
  await page.evaluate(direction=>{const s=window.starAgent,n=s.navigation;n.transit(direction,1.75);n.mode='walk';n.enabled=false;
    const up=n.normal,east=up.clone().set(0,1,0).cross(up).normalize();n.orientToward(n.position.clone().addScaledVector(east,5).addScaledVector(up,-.3),up);
  },latLonDirection(15.74,22.44));
  await page.waitForFunction(()=>window.starAgent.state.vegetation.distantMeadow?.clusters>1000&&window.starAgent.state.terrainDetail.settled,{timeout:90000});
  await page.evaluate(()=>{window.starAgent.navigation.enabled=true;});
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.active);await page.keyboard.press('1');await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='rifle-laser');await page.keyboard.press('4');
  await page.waitForFunction(()=>window.starAgent.state.camera.mode==='third-person'&&window.starAgent.state.mining.tool.attachment==='character-hand');
  await page.keyboard.press('l');await page.waitForFunction(()=>window.starAgent.state.utilities.suit);await page.keyboard.press('l');
  await page.waitForTimeout(1500);await page.screenshot({path:`${output}/character-rifle.png`});
  expect((await page.evaluate(()=>window.starAgent.state)).character.state).toBe('aim-rifle');
  await page.keyboard.press('4');await page.keyboard.press('r');
  await page.evaluate(()=>document.getElementById('graphics-button').click());
  await expect(page.locator('#graphics-settings')).toBeVisible();
  await page.locator('[data-controller-key="grassDistance"]').click();
  expect((await page.evaluate(()=>window.starAgent.state)).graphics.grassDistance).toBe(160);
  await page.screenshot({path:`${output}/graphics-menu.png`});
  await page.getByRole('button',{name:'Close graphics'}).click();
  await page.waitForFunction(()=>window.starAgent.state.vegetation.distantMeadow?.range===160&&window.starAgent.state.vegetation.distantMeadow.pending===0,{timeout:90000});
  await page.screenshot({path:`${output}/meadow-160m.png`});
  const state=await page.evaluate(()=>window.starAgent.state);
  expect(state.vegetation.distantMeadow.clusters).toBeGreaterThan(30000);
  expect(state.vegetation.distantMeadow.middle.clusters).toBeGreaterThan(20000);
  expect(state.vegetation.distantMeadow.middle.pending).toBe(0);
  const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(ext.UNMASKED_RENDERER_WEBGL);});
  await writeFile(`${output}/environment.json`,JSON.stringify({browser:browser.version(),backend,viewport:[1440,900],state,errors},null,2));
  expect(errors).toEqual([]);
  await page.reload();await page.waitForFunction(()=>window.starAgent?.state.ready);
  expect((await page.evaluate(()=>window.starAgent.state)).graphics.grassDistance).toBe(160);
});

test('controller-only orbital heading, utilities and graphics menu return safely to play',async({page})=>{
  await page.addInitScript(()=>{
    window.optionPad={id:'Flight options controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.optionPad]});
  });
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const frames=()=>page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));});
  const button=async(index,down)=>{await page.evaluate(({index,down})=>{window.optionPad.buttons[index]={pressed:down,value:Number(down)};},{index,down});await frames();};
  const tap=async i=>{await button(i,true);await button(i,false);};
  const chord=async index=>{
    await page.waitForFunction(()=>window.starAgent.state.controller.armed);
    await page.evaluate(()=>{for(const i of [4,5])window.optionPad.buttons[i]={pressed:true,value:1};});await frames();
    await tap(index);
    await page.evaluate(()=>{for(const i of [4,5])window.optionPad.buttons[i]={pressed:false,value:0};});await frames();
  };
  // Start through the supported orbital entry; no debug positioning or navigation calls.
  await page.goto('/?intro=0&debug&seed=7291');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed);
  // Aim away using only the right stick. Read orientation solely as steering feedback.
  await page.evaluate(()=>{window.optionPad.axes[2]=1;});
  await page.waitForFunction(()=>{const n=window.starAgent.navigation,q=n.orientation,up=n.normal;return -(2*(q.x*q.z+q.w*q.y)*up.x+2*(q.y*q.z-q.w*q.x)*up.y+(1-2*(q.x*q.x+q.y*q.y))*up.z)>.2;});
  await page.evaluate(()=>{window.optionPad.axes[2]=0;});await frames();
  const throttle=await page.evaluate(()=>window.starAgent.navigation.speedScale);
  await chord(13);await page.waitForFunction(()=>!window.starAgent.state.utilities.gearDeployed);
  expect(await page.evaluate(()=>window.starAgent.navigation.speedScale)).toBe(throttle);
  await chord(15);await page.waitForFunction(()=>window.starAgent.state.camera.mode==='external');
  await page.evaluate(()=>{for(const i of [4,5])window.optionPad.buttons[i]={pressed:true,value:1};});await frames();
  await expect(page.locator('#controller-hints')).toContainText('DRIVE ON / OFF');
  await page.screenshot({path:`${output}/controller-utility-shortcuts.png`});
  await page.evaluate(()=>{for(const i of [4,5])window.optionPad.buttons[i]={pressed:false,value:0};});await frames();
  await chord(14);await page.waitForFunction(()=>window.starAgent.state.utilities.ship);
  expect((await page.evaluate(()=>window.starAgent.state)).mapOpen).toBe(false);
  await expect(page.locator('#controller-menu')).not.toBeVisible();
  for(const interruption of ['focus','disconnect','replacement']){
    await page.evaluate(()=>{for(const i of [4,5,14])window.optionPad.buttons[i]={pressed:true,value:1};});await frames();
    const lit=await page.evaluate(()=>window.starAgent.state.utilities.ship);
    if(interruption==='focus')await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
    if(interruption==='disconnect')await page.evaluate(()=>{window.optionPad.connected=false;});
    if(interruption==='replacement')await page.evaluate(()=>{window.optionPad.id+=' replacement';});
    await frames();
    await page.evaluate(()=>{window.optionPad.connected=true;window.dispatchEvent(new Event('focus'));});await frames();
    await tap(14);expect(await page.evaluate(()=>window.starAgent.state.utilities.ship)).toBe(lit);
    expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
    await page.evaluate(()=>{for(const i of [4,5,14])window.optionPad.buttons[i]={pressed:false,value:0};});await frames();
    await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  }
  await chord(12);await page.waitForFunction(()=>window.starAgent.state.travel?.manual);
  await page.waitForFunction(()=>window.starAgent.state.travel?.phase==='accelerating');
  await page.screenshot({path:`${output}/controller-heading-drive.png`});
  await chord(12);await page.waitForFunction(()=>window.starAgent.state.travel?.aborting||window.starAgent.state.travel===null);
  await page.waitForFunction(()=>window.starAgent.state.travel===null);
  await chord(9);await expect(page.locator('#graphics-settings')).toBeVisible();
  await frames();expect(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)).toBe('grassDistance');
  await tap(0);expect((await page.evaluate(()=>window.starAgent.state)).graphics.grassDistance).toBe(160);
  await tap(13);await tap(0);expect((await page.evaluate(()=>window.starAgent.state)).graphics.grassDensity).toBe(1);
  await page.screenshot({path:`${output}/controller-graphics-focus.png`});
  // Held ascent across modal closure must not replay until neutral is restored.
  const lightBeforeClose=await page.evaluate(()=>window.starAgent.state.utilities.ship);
  await page.evaluate(()=>{for(const i of [4,5,14])window.optionPad.buttons[i]={pressed:true,value:1};});await frames();
  await button(7,true);await tap(1);await frames();
  expect(await page.evaluate(()=>window.starAgent.state.utilities.ship)).toBe(lightBeforeClose);
  expect((await page.evaluate(()=>window.starAgent.state)).speed).toBeLessThan(1);
  expect((await page.evaluate(()=>window.starAgent.state)).controller.armed).toBe(false);
  await button(7,false);await page.evaluate(()=>{for(const i of [4,5,14])window.optionPad.buttons[i]={pressed:false,value:0};});await frames();await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  await button(7,true);await page.waitForFunction(()=>window.starAgent.state.speed>1);await button(7,false);await tap(1);
  await chord(13);await page.waitForFunction(()=>window.starAgent.state.utilities.gearDeployed);
  expect(errors).toEqual([]);
});
