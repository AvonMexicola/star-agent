import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
test('repaired deer skin and graceful walk render and scrub in Three',async({page,browser})=>{
 const out='test-results/fauna-evidence',errors=[];await mkdir(out,{recursive:true});page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(`${m.text()} ${m.location().url}`);});
 await page.goto('/scripts/fixtures/creature-rig.html?model=deer');await page.waitForFunction(()=>window.creatureReview?.state.ready);expect(await page.evaluate(()=>window.creatureReview.state.clips.some(c=>c.name==='walk'))).toBe(true);
 await page.waitForTimeout(2000);await page.locator('#play').click();
 const states=[];for(const phase of[0,.25,.5,.75,1]){await page.locator('#time').evaluate((el,value)=>{el.value=value;el.dispatchEvent(new Event('input',{bubbles:true}));},String(phase));await page.waitForTimeout(100);states.push(await page.evaluate(()=>window.creatureReview.state));await page.screenshot({path:`${out}/deer-walk-${phase}.png`});}
 await page.locator('#play').click();await page.waitForTimeout(3000);await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/deer-mobile.png`});
 const backend=await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return gl.getParameter(e.UNMASKED_RENDERER_WEBGL);});
 await writeFile(`${out}/deer-browser.json`,JSON.stringify({browser:browser.version(),backend,states,errors},null,2));expect(errors).toEqual([]);
});
