import { test, expect } from '@playwright/test';
import { ringRock, RING_NORMAL } from '../src/moon-rings.js';
import { mkdir, writeFile } from 'node:fs/promises';

const evidence='/tmp/star-agent-lunar-landscape-evidence';
test('Selene landing, ramp exploration, lunar jump, reboarding and launch render correctly',async({page,browser})=>{
  test.setTimeout(300000);
  const errors=[];page.on('pageerror',error=>errors.push(error.message));
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  await mkdir(evidence,{recursive:true});
  await page.keyboard.press('Tab');await page.screenshot({path:`${evidence}/orbit.png`});await page.keyboard.press('Tab');
  const before=await page.evaluate(()=>window.starAgent.state.position);
  await page.locator('[data-destination="moon"]').click({modifiers:['Shift']});
  await expect(page.locator('#course-guidance')).toContainText('Selene');
  expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(before);
  await page.locator('[data-destination="moon"]').click();
  await page.waitForFunction(()=>!window.starAgent.state.transiting&&Number(getComputedStyle(document.getElementById('transit')).opacity)===0);
  await expect(page.locator('#mode-label')).toHaveText('LUNAR FLIGHT');
  await expect(page.locator('#altitude-reference')).toHaveText('ABOVE SELENE');
  expect(await page.evaluate(()=>window.starAgent.state.altitude)).toBeCloseTo(180,5);
  await page.keyboard.press('l');
  await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:90000});
  await page.waitForFunction(()=>window.starAgent.state.moon.lod>=14);
  const landed=await page.evaluate(()=>window.starAgent.state);
  await expect(page.locator('#biome')).toHaveText('SELENE · CRESCENT RIM');
  expect(landed.moon.effects.generatorVersion).toBe(4);expect(landed.body).toBe('selene');expect(landed.biome).toBe('SELENE · CRESCENT RIM');expect(landed.atmosphereFraction).toBe(0);
  await page.keyboard.press('f');
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await page.keyboard.up('w');await page.keyboard.press('x');
  await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await page.keyboard.down('w');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await page.keyboard.up('w');await page.keyboard.press('x');
  const outside=await page.evaluate(()=>window.starAgent.state);
  expect(outside.moon.effects.ringAsteroids).toBe(14_336);expect(outside.moon.effects.iceParticles).toBeGreaterThan(0);expect(outside.insideShip).toBe(false);expect(outside.altitude).toBeCloseTo(1.75,5);
  await expect(page.locator('#mode-label')).toHaveText('LUNAR EXPLORATION');
  await page.keyboard.press('Tab');await page.screenshot({path:`${evidence}/surface.png`});
  await page.keyboard.down('Space');await page.waitForFunction(()=>window.starAgent.navigation.jumpHeight>.1);await page.keyboard.up('Space');
  await page.waitForFunction(()=>window.starAgent.navigation.jumpHeight>2);
  await page.waitForFunction(()=>window.starAgent.navigation.jumpHeight===0,null,{timeout:60000});
  const orientation=await page.evaluate(()=>window.starAgent.navigation.orientation.toArray());
  await page.evaluate(()=>{const nav=window.starAgent.navigation;nav.orientToward(nav.position.clone().set(0,0,0),nav.normal);});
  await page.waitForTimeout(400);await page.screenshot({path:`${evidence}/aeon-from-surface.png`});
  await page.evaluate(()=>{const nav=window.starAgent.navigation;nav.orientToward(nav.shipPosition.clone().addScaledVector(nav.normal,2),nav.normal);});
  await page.waitForTimeout(400);await page.screenshot({path:`${evidence}/ship-on-selene.png`});
  await page.evaluate(value=>window.starAgent.navigation.orientation.fromArray(value),orientation);
  await page.keyboard.down('s');await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.4);await page.keyboard.up('s');await page.keyboard.press('x');
  await page.keyboard.press('f');await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await page.keyboard.press('l');expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('flight');
  expect(await page.evaluate(()=>window.starAgent.state.altitude)).toBeGreaterThan(10);
  await page.keyboard.press('o');await page.waitForFunction(()=>!window.starAgent.state.transiting);
  expect(await page.evaluate(()=>window.starAgent.state.body)).toBe('aeon');
  const gpu=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight]};});
  await writeFile(`${evidence}/environment.json`,JSON.stringify({browser:browser.version(),...gpu,landed,outside,errors},null,2));
  expect(errors).toEqual([]);
});


test('lunar rings, crater slopes and sunlit ice render from orbit and the surface',async({page,browser})=>{
  test.setTimeout(240000);const errors=[];
  page.on('pageerror',error=>errors.push(error.message));page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.8));await mkdir(evidence,{recursive:true});
  await page.keyboard.press('Tab');
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation,center=nav.position.clone().fromArray(window.starAgent.state.moon.position);
    const direction=nav.position.clone().set(.45,.22,.87).normalize();nav.orbit();
    nav.position.copy(center).addScaledVector(direction,window.starAgent.state.moon.radius*4.7);
    nav.orientToward(center,nav.position.clone().set(0,1,0));
  });
  await page.waitForFunction(()=>window.starAgent.state.moon.lod>=3&&window.starAgent.state.moon.effects.terrainBuilds===0);await page.screenshot({path:`${evidence}/rings-orbit.png`});
  await page.evaluate(()=>window.starAgent.navigation.transitMoon(600));
  await page.waitForFunction(()=>window.starAgent.state.moon.lod>=11&&window.starAgent.state.moon.effects.terrainBuilds===0);await page.waitForTimeout(1200);
  await page.screenshot({path:`${evidence}/crater-approach.png`});
  // Look aft from the landing shelf toward the new impact basin and ring arc.
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation;nav.transitMoon(1.75);nav.enabled=false;
    const up=nav.normal,east=nav.position.clone().set(0,1,0).cross(up).normalize();
    nav.orientToward(nav.position.clone().addScaledVector(east,-1000).addScaledVector(up,120),up);
  });
  await page.waitForFunction(()=>window.starAgent.state.moon.lod>=16&&window.starAgent.state.moon.effects.terrainBuilds===0);await page.waitForTimeout(2500);await page.screenshot({path:`${evidence}/craters-and-ice.png`});
  const a=await page.screenshot();await page.waitForTimeout(1200);const b=await page.screenshot();expect(a.equals(b)).toBe(false);
  const surface=await page.evaluate(()=>window.starAgent.state);expect(surface.moon.effects.iceParticles).toBeGreaterThan(0);
  // A low-flight survey shows the rift, crater floor and distinct mountain districts together.
  await page.evaluate(()=>{
    const nav=window.starAgent.navigation,up=nav.normal.clone(),east=nav.position.clone().set(0,1,0).cross(up).normalize(),north=up.clone().cross(east);
    const shelf=nav.position.clone();nav.position.addScaledVector(up,7000).addScaledVector(east,6500).addScaledVector(north,-7500);
    nav.orientToward(shelf.clone().addScaledVector(east,-1800),up);
  });
  await page.waitForFunction(()=>window.starAgent.state.moon.effects.terrainBuilds===0);await page.waitForTimeout(500);await page.screenshot({path:`${evidence}/geology-survey.png`});
  const rock=ringRock(5);
  await page.evaluate(({rock,normal})=>{
    const nav=window.starAgent.navigation,center=nav.position.clone().fromArray(window.starAgent.state.moon.position),target=center.clone().add(nav.position.clone().fromArray(rock.position));
    nav.orbit();nav.enabled=false;nav.position.copy(target).addScaledVector(target.clone().sub(center).normalize(),rock.size*6).addScaledVector(nav.position.clone().fromArray(normal),rock.size*3);
    nav.orientToward(target,nav.position.clone().fromArray(normal));
  },{rock,normal:RING_NORMAL});
  await page.waitForTimeout(1500);await page.screenshot({path:`${evidence}/asteroid-close.png`});
  await page.evaluate(()=>window.starAgent.transit('coast'));
  await page.waitForFunction(()=>!window.starAgent.state.transiting&&window.starAgent.state.lod>=12);
  await page.waitForTimeout(1500);await page.screenshot({path:`${evidence}/aeon-coast-after-effects.png`});
  const aeon=await page.evaluate(()=>window.starAgent.state);expect(aeon.body).toBe('aeon');expect(aeon.atmosphereFraction).toBeGreaterThan(.9);
  await writeFile(`${evidence}/visual-state.json`,JSON.stringify({browser:browser.version(),surface,errors},null,2));
  expect(errors).toEqual([]);
});
