import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {findDestinations} from '../src/world.js';

test('seeded forest groves stream, retain trees during movement and render gradual LODs',async({page,browser})=>{
  const errors=[],captures=[],baseline=!!process.env.FOREST_BASELINE_URL;
  const label=baseline?'before':'after';
  page.on('pageerror',error=>{errors.push(error.message);console.log('PAGE ERROR',error.message);});
  page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto((process.env.FOREST_BASELINE_URL||'')+'/?seed=7291&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  await page.keyboard.press('Tab');
  const forest=findDestinations().forest;
  const pose=async altitude=>{
    await page.evaluate(({forest,altitude})=>{
      const nav=window.starAgent.navigation;nav.transit(forest,altitude);
      const up=nav.normal,east=up.clone().set(0,1,0).cross(up).normalize(),north=up.clone().cross(east).normalize();
      const target=nav.position.clone().addScaledVector(north,100).addScaledVector(east,80).addScaledVector(up,-45);
      nav.orientToward(target,up);
    },{forest,altitude});
    await page.waitForTimeout(1500);
    await page.waitForFunction(baseline=>{
      const s=window.starAgent.state;return s.vegetation.trees>0&&s.pending<5&&(baseline||(s.vegetation.residentTiles>0&&s.vegetation.pendingTiles===0));
    },baseline);
    await page.waitForTimeout(1200);
  };
  await mkdir('/tmp/star-agent-forest',{recursive:true});
  const capture=async name=>{
    await page.evaluate(async()=>{window.starAgent.setRenderScale(1);await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));});
    await page.screenshot({path:`/tmp/star-agent-forest/${label}-${name}.png`});
    captures.push({name,state:await page.evaluate(()=>window.starAgent.state)});
    console.log(label,name,captures.at(-1).state.vegetation);
    expect(errors).toEqual([]);
    await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  };
  await pose(180);await capture('groves');
  if(!baseline){
    expect(captures[0].state.vegetation.trees).toBeLessThan(14000);
    expect(captures[0].state.vegetation.residentTiles).toBeLessThan(250);
    const oldGenerated=captures[0].state.vegetation.generatedTiles;
    await page.evaluate(()=>{
      const nav=window.starAgent.navigation,up=nav.normal,east=up.clone().set(0,1,0).cross(up).normalize();
      nav.position.addScaledVector(east,150);
    });
    await page.waitForTimeout(1200);
    await page.waitForFunction(()=>window.starAgent.state.vegetation.pendingTiles===0);
    const shifted=await page.evaluate(()=>window.starAgent.state.vegetation);
    expect(shifted.trees).toBeGreaterThan(captures[0].state.vegetation.trees*.7);
    expect(shifted.generatedTiles-oldGenerated).toBeLessThan(50);
    expect(shifted.error).toBeNull();
  }
  await pose(3.5);await capture('ground');
  if(!baseline){
    expect(captures.at(-1).state.vegetation.treeLods.every(n=>n>0)).toBe(true);
    expect(captures.at(-1).state.vegetation.grassTufts).toBeLessThan(4000);
  }
  const renderer=await page.evaluate(()=>{
    const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');
    return ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  });
  await writeFile(`/tmp/star-agent-forest/${label}-environment.json`,JSON.stringify({browser:browser.version(),renderer,resolution:[1440,900],captures,errors},null,2));
  expect(errors).toEqual([]);
});
