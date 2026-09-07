import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const OUT='/tmp/star-agent-kestrel/docs/qa/kestrel/reviewer/round-5';
test('independent Meshy front-surface material diagnostic',async({page,browser})=>{
 const notes={browser:browser.version(),console:[],captures:[]};
 page.on('pageerror',e=>notes.console.push({type:'pageerror',text:String(e)}));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))notes.console.push({type:m.type(),text:m.text()});});
 await page.goto('/dev/kestrel.html');await page.evaluate(()=>window.kestrelStudio.ready);await expect(page.locator('#studio-status')).toBeHidden();
 await page.getByRole('button',{name:'Exterior',exact:true}).click();
 await page.evaluate(()=>{const rig=window.kestrelStudio;rig.camera.position.set(6.8,5.2,-8.6);window.kestrelDiagnostic={materials:[]};rig.asset.traverse(o=>{if(o.isMesh&&o.material.map&&o.material.name.includes('baked')){const m=o.material;if(!window.kestrelDiagnostic.materials.some(x=>x.m===m))window.kestrelDiagnostic.materials.push({m,map:m.map,normalMap:m.normalMap,aoMap:m.aoMap,roughnessMap:m.roughnessMap,metalnessMap:m.metalnessMap,roughness:m.roughness,metalness:m.metalness});}});});
 async function shot(name,override){await page.waitForTimeout(180);await page.screenshot({path:OUT+'/'+name+'.png',fullPage:true});notes.captures.push({name,override,snapshot:await page.evaluate(()=>window.kestrelStudio.snapshot())});}
 await shot('diagnostic-front-material','original exported maps');
 await page.evaluate(()=>{for(const x of window.kestrelDiagnostic.materials){x.m.normalMap=null;x.m.needsUpdate=true;}});
 await shot('diagnostic-front-normal-off','normalMap disabled only; all other original maps retained');
 await page.evaluate(()=>{for(const x of window.kestrelDiagnostic.materials){x.m.normalMap=x.normalMap;x.m.roughnessMap=null;x.m.metalnessMap=null;x.m.roughness=.55;x.m.metalness=0;x.m.needsUpdate=true;}});
 await shot('diagnostic-front-orm-flat','original basecolor/normal/AO; roughness .55 and metalness 0 constants');
 await page.evaluate(()=>{for(const x of window.kestrelDiagnostic.materials){x.m.normalMap=null;x.m.aoMap=null;x.m.needsUpdate=true;}});
 await shot('diagnostic-front-albedo-only','original basecolor with normal/AO disabled and roughness .55 metalness 0 constants');
 await page.evaluate(()=>{for(const x of window.kestrelDiagnostic.materials){x.m.map=null;x.m.needsUpdate=true;}});
 await shot('diagnostic-front-neutral','basecolor/normal/AO maps disabled and roughness .55 metalness 0 constants');
 await fs.writeFile(OUT+'/diagnostic-evidence.json',JSON.stringify(notes,null,2)+'\n');expect(notes.console).toEqual([]);
});
