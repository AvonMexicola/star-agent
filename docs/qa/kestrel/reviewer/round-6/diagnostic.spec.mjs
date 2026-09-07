import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const OUT='/tmp/star-agent-kestrel/docs/qa/kestrel/reviewer/round-6';
test('independent refined front-surface close view',async({page,browser})=>{
 const notes={browser:browser.version(),console:[],captures:[]};
 page.on('pageerror',e=>notes.console.push({type:'pageerror',text:String(e)}));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))notes.console.push({type:m.type(),text:m.text()});});
 await page.goto('/dev/kestrel.html');await page.evaluate(()=>window.kestrelStudio.ready);await expect(page.locator('#studio-status')).toBeHidden();
 await page.getByRole('button',{name:'Exterior',exact:true}).click();
 await page.evaluate(()=>{const rig=window.kestrelStudio;rig.camera.position.set(6.8,5.2,-8.6);window.kestrelDiagnostic={materials:[]};rig.asset.traverse(o=>{if(o.isMesh&&o.material.map&&o.material.name.includes('baked')){const m=o.material;if(!window.kestrelDiagnostic.materials.some(x=>x.m===m))window.kestrelDiagnostic.materials.push({m,map:m.map,normalMap:m.normalMap,aoMap:m.aoMap,roughnessMap:m.roughnessMap,metalnessMap:m.metalnessMap,roughness:m.roughness,metalness:m.metalness});}});});
 async function shot(name,override){await page.waitForTimeout(180);await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true});notes.captures.push({name,override,snapshot:await page.evaluate(()=>window.kestrelStudio.snapshot())});}
 await shot('diagnostic-front-material','original exported maps');
 await fs.writeFile(OUT+'/diagnostic-evidence.json',JSON.stringify(notes,null,2)+'\n');expect(notes.console).toEqual([]);
});
