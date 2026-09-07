import {test,expect} from '@playwright/test';import {mkdir,writeFile} from 'node:fs/promises';
const out='/home/cees/.cache/star-agent-base-power-evidence';
test('power machines render their actual authored geometry at player scale',async({page,browser})=>{
 await mkdir(out,{recursive:true});const errors=[],stats=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 for(const name of ['solar-array','wind-turbine','battery','uranium-generator','helium-generator']){await page.goto(`/dev/build.html?only=${name}`);await page.waitForFunction(()=>window.__buildStudio?.ready);await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}.png`});stats.push(await page.evaluate(name=>{const r=window.__buildStudio.renderer,gl=r.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');return {name,draws:r.info.render.calls,triangles:r.info.render.triangles,backend:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):null};},name));}
 expect(errors).toEqual([]);await writeFile(`${out}/assets.json`,JSON.stringify({browser:browser.version(),viewport:'1440x900',stats,errors},null,2));
});
