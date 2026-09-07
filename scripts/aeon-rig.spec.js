import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
for(const [model,name] of [['aeon-amphibian','Tideback'],['aeon-grazer','Mallow']]){
 test(`${name} exported walk and death render in Three`,async({page,browser})=>{
  const out=process.env.AEON_FAUNA_OUT || 'test-results/aeon-fauna-evidence',errors=[];await mkdir(out,{recursive:true});
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(`${m.text()} ${m.location().url}`);});
  await page.goto(`/scripts/fixtures/creature-rig.html?model=${model}`);
  await page.waitForFunction(()=>window.creatureReview?.state.ready);
  expect(await page.evaluate(()=>window.creatureReview.state.clips.map(c=>c.name).sort())).toEqual(['death','walk']);
  await page.waitForTimeout(1500);await page.screenshot({path:`${out}/${model}-studio-walk.png`});
  await page.locator('#clip').selectOption('death');await page.waitForFunction(()=>{const s=window.creatureReview.state;return s.time>=s.clips.find(c=>c.name==='death').duration;},null,{timeout:20000});
  await page.screenshot({path:`${out}/${model}-studio-death.png`});
  const held=await page.evaluate(()=>window.creatureReview.state.time);await page.waitForTimeout(500);
  expect(await page.evaluate(()=>window.creatureReview.state.time)).toBe(held);
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/${model}-studio-mobile.png`});
  const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
  await writeFile(`${out}/${model}-studio.json`,JSON.stringify({browser:browser.version(),backend,state:await page.evaluate(()=>window.creatureReview.state),errors},null,2));
  expect(errors).toEqual([]);
 });
}
