import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-tool-visual-evidence';
function delta(a,b,rect){let count=0,total=0,max=0;for(let y=rect[1];y<rect[3];y++)for(let x=rect[0];x<rect[2];x++){const i=(y*1000+x)*4,d=Math.max(...[0,1,2].map(c=>Math.abs(a[i+c]-b[i+c])));if(d>12)count++;total+=d;max=Math.max(max,d);}return {count,total,max};}
test('HDR log-depth shows textured tool and beam ending at target with correct occlusion',async({page,browser})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mkdir(evidence,{recursive:true});await page.goto('/tests/tool-visual/fixture.html');await page.waitForFunction(()=>window.visualReady);
  const flat=await page.evaluate(()=>window.visual.render({flat:true}));
  const off=await page.evaluate(()=>window.visual.render());await page.screenshot({path:`${evidence}/tool-textured-off.png`});
  const on=await page.evaluate(()=>window.visual.render({fire:true,beamOnly:true}));await page.screenshot({path:`${evidence}/beam-only-on.png`});
  const materialDiff=delta(flat,off,[600,380,1000,700]),beamDiff=delta(off,on,[480,310,760,610]);
  expect(materialDiff.count).toBeGreaterThan(150);expect(beamDiff.count).toBeGreaterThan(80);
  const behindOff=await page.evaluate(()=>window.visual.render({block:true})),behindOn=await page.evaluate(()=>window.visual.render({fire:true,block:true,beamOnly:true}));
  const blocked=delta(behindOff,behindOn,[485,330,535,370]);expect(blocked.count).toBe(0);
  await page.evaluate(()=>window.visual.render({fire:true}));await page.screenshot({path:`${evidence}/tool-firing-hdr.png`});
  const meta=await page.evaluate(()=>window.visual.meta());expect(meta.logDepth).toBe(true);expect(meta.textures).toBe(1);
  expect(Math.hypot(...meta.beamEnd.map((v,i)=>v-meta.target[i]))).toBeLessThan(.00001);
  await page.evaluate(()=>window.visual.render({fire:true,hasHit:false}));
  expect(await page.evaluate(()=>window.visual.equipment._beamMesh.visible&&!window.visual.equipment._impact.visible&&!window.visual.equipment._impactLight.visible)).toBe(true);
  await writeFile(`${evidence}/evidence.json`,JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),meta,materialDiff,beamDiff,blocked,errors},null,2));expect(errors).toEqual([]);
});
