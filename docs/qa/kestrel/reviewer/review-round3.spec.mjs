import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const OUT='/tmp/star-agent-kestrel/docs/qa/kestrel/reviewer/round-3';
const notes={captures:[],mechanisms:[],console:[]};
async function open(page){
 page.on('pageerror',e=>notes.console.push({type:'pageerror',text:String(e)}));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))notes.console.push({type:m.type(),text:m.text()});});
 await page.goto('/dev/kestrel.html');await page.evaluate(()=>window.kestrelStudio.ready);
 await expect(page.locator('#studio-status')).toBeHidden();
 await page.waitForFunction(()=>window.kestrelStudio.snapshot().frames>8);
}
async function capture(page,name){
 const before=await page.evaluate(()=>window.kestrelStudio.snapshot());
 await page.screenshot({path:`${OUT}/${name}.png`,fullPage:true});
 const after=await page.evaluate(()=>window.kestrelStudio.snapshot());
 notes.captures.push({name,before,after});
}
async function progress(page,key,value){await page.waitForFunction(({key,value})=>window.kestrelStudio.snapshot().progress[key]>=value,{key,value},{timeout:30000});}
async function endpoint(page,key,value){await expect.poll(()=>page.evaluate(k=>window.kestrelStudio.snapshot().progress[k],key),{timeout:30000}).toBeCloseTo(value,3);notes.mechanisms.push({key,value,snapshot:await page.evaluate(()=>window.kestrelStudio.snapshot())});}
async function screenProjection(page){return page.evaluate(()=>{
 const rig=window.kestrelStudio,rect=rig.renderer.domElement.getBoundingClientRect();
 const rows=[1,2,3,4].map(i=>{const o=rig.asset.getNode('MFD_'+i);o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
  const p=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){const v=rig.camera.position.clone().set(x,y,b.max.z).applyMatrix4(o.matrixWorld).project(rig.camera);p.push({x:rect.left+(v.x*.5+.5)*rect.width,y:rect.top+(-v.y*.5+.5)*rect.height,z:v.z});}
  return {name:o.name,corners:p};});
 return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},controlsTop:document.querySelector('.studio-controls').getBoundingClientRect().top,screens:rows};
});}

test('independent preliminary Kestrel appearance and mechanism review',async({browser,page})=>{
 await fs.mkdir(OUT,{recursive:true});
 const asset=await fs.readFile('/tmp/star-agent-kestrel/assets/kestrel/kestrel.glb');notes.assetSha256=crypto.createHash('sha256').update(asset).digest('hex');
 notes.browser=browser.version();await open(page);
 for(const [name,label] of [['exterior','Exterior'],['rear','Engines'],['top','Planform'],['cockpit','Pilot seat'],['boarding','Boarding'],['belly','Underside']]){
  await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(160);await capture(page,'desktop-'+name);
  if(name==='cockpit')notes.desktopScreens=await screenProjection(page);
 }
 await page.getByRole('button',{name:'Boarding',exact:true}).click();
 await page.getByRole('button',{name:'Deploy ladder',exact:true}).click();
 notes.interlockClosed=await page.locator('#mechanism-status').textContent();
 await page.keyboard.press('c');await progress(page,'canopy',.25);await capture(page,'canopy-25');await progress(page,'canopy',.60);await capture(page,'canopy-60');await endpoint(page,'canopy',1);await capture(page,'canopy-open');
 await page.keyboard.press('l');await progress(page,'ladder',.25);await capture(page,'ladder-25');await progress(page,'ladder',.60);await capture(page,'ladder-60');await endpoint(page,'ladder',1);await capture(page,'ladder-deployed');
 await page.keyboard.press('c');notes.canopyBlocked=await page.locator('#mechanism-status').textContent();
 await page.keyboard.press('l');await endpoint(page,'ladder',0);await page.keyboard.press('c');await endpoint(page,'canopy',0);
 await page.getByRole('button',{name:'Underside',exact:true}).click();
 await page.keyboard.press('g');await page.waitForFunction(()=>window.kestrelStudio.snapshot().progress.gear<.75);await capture(page,'gear-retracting');await endpoint(page,'gear',0);await capture(page,'gear-stowed');
 await page.keyboard.press('g');await endpoint(page,'gear',1);
 await page.getByRole('button',{name:'Engines',exact:true}).click();await capture(page,'engine-idle');
 await page.locator('#throttle').focus();await page.keyboard.press('End');await page.waitForTimeout(250);await capture(page,'engine-full');
 const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const phone=await mobile.newPage();await open(phone);
 for(const [name,label] of [['exterior','Exterior'],['rear','Engines'],['top','Planform'],['cockpit','Pilot seat'],['boarding','Boarding'],['belly','Underside']]){
  await phone.getByRole('button',{name:label,exact:true}).tap();await phone.waitForTimeout(160);await capture(phone,'phone-'+name);
  if(name==='cockpit')notes.phoneScreens=await screenProjection(phone);
 }
 await phone.getByRole('button',{name:'Boarding',exact:true}).tap();await phone.getByRole('button',{name:'Open canopy',exact:true}).tap();await endpoint(phone,'canopy',1);await phone.getByRole('button',{name:'Deploy ladder',exact:true}).tap();await endpoint(phone,'ladder',1);await capture(phone,'phone-deployed');
 await mobile.close();
 notes.assetUnchanged=notes.assetSha256===crypto.createHash('sha256').update(await fs.readFile('/tmp/star-agent-kestrel/assets/kestrel/kestrel.glb')).digest('hex');
 await fs.writeFile(`${OUT}/browser-evidence.json`,JSON.stringify(notes,null,2)+'\n');
 expect(notes.console).toEqual([]);expect(notes.assetUnchanged).toBe(true);
});

test('diagnostic shadow and engine throat captures',async({page})=>{
 await fs.mkdir(OUT,{recursive:true});await open(page);
 await page.getByRole('button',{name:'Engines',exact:true}).click();
 await page.evaluate(()=>{window.kestrelStudio.camera.position.set(-4,3.1,11.8);});await page.waitForTimeout(180);await capture(page,'diagnostic-rear-detail');
 await page.evaluate(()=>{const rig=window.kestrelStudio;rig.renderer.shadowMap.enabled=false;rig.asset.parent.traverse(o=>{if(o.isLight)o.castShadow=false;});});
 await page.waitForTimeout(180);await capture(page,'diagnostic-shadows-off');
 await page.evaluate(()=>{window.kestrelStudio.asset.traverse(o=>{if(o.isMesh&&o.material.normalMap){o.material.normalMap=null;o.material.aoMap=null;o.material.needsUpdate=true;}});});
 await page.waitForTimeout(180);await capture(page,'diagnostic-normal-ao-off');
 await page.evaluate(()=>{window.kestrelStudio.asset.traverse(o=>{if(o.isMesh&&o.material.map&&o.material.name.includes('baked')){o.material.map=null;o.material.needsUpdate=true;}});});
 await page.waitForTimeout(180);await capture(page,'diagnostic-basecolor-off');
 await page.reload();await page.evaluate(()=>window.kestrelStudio.ready);await page.getByRole('button',{name:'Engines',exact:true}).click();
 await page.evaluate(()=>{window.kestrelStudio.camera.position.set(0,2.6,15);});await page.waitForTimeout(180);await capture(page,'diagnostic-straight-rear-idle');
 await page.locator('#throttle').focus();await page.keyboard.press('End');await page.waitForTimeout(180);await capture(page,'diagnostic-straight-rear-full');
 await fs.writeFile(`${OUT}/diagnostic-evidence.json`,JSON.stringify(notes,null,2)+'\n');expect(notes.console).toEqual([]);
});
