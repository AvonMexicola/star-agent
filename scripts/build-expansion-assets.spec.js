import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='/home/cees/.cache/star-agent-expansion-evidence';
test('new authored kit, hangar clearance and pad-size markings render with ship scale references',async({page,browser})=>{
 test.setTimeout(180000);await mkdir(out,{recursive:true});await page.setViewportSize({width:1440,height:900});const errors=[],stats=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const [name,query]of [['workshop','expansion'],['curved-window','only=window-quarter'],['triangle','only=foundation-triangle'],['rack','only=rack'],['terminal','only=terminal'],['hangar-closed','only=hangar-door'],['hangar-open','only=hangar-door&open'],['pad-small','only=foundation-pad-small&ship'],['pad-medium','only=foundation-pad-medium&ship'],['pad-large','only=foundation-pad-large&ship']]){
  await page.goto(`/dev/build.html?${query}`);await page.waitForFunction(()=>window.__buildStudio?.ready);await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}.png`});stats.push(await page.evaluate(name=>{const {renderer}=window.__buildStudio,gl=renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');return {name,draws:renderer.info.render.calls,triangles:renderer.info.render.triangles,backend:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null};},name));
 }
 expect(errors).toEqual([]);await writeFile(`${out}/assets.json`,JSON.stringify({browser:browser.version(),viewport:'1440x900',purpose:'Authored asset inspection, not a gameplay journey; large ship is a 2x linear Atlas scale reference',stats,errors},null,2));
});
