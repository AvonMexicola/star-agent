import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';

const OUT='/tmp/star-agent-kestrel/docs/qa/kestrel/reviewer/round-4';
const ASSET='/tmp/star-agent-kestrel/assets/kestrel/kestrel.glb';
const notes={captures:[],mechanisms:[],console:[]};
const views=[['exterior','Exterior'],['rear','Engines'],['top','Planform'],['cockpit','Pilot seat'],['boarding','Boarding'],['belly','Underside']];

async function open(page){
 page.on('pageerror',e=>notes.console.push({type:'pageerror',text:String(e)}));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))notes.console.push({type:m.type(),text:m.text()});});
 await page.goto('/dev/kestrel.html');await page.evaluate(()=>window.kestrelStudio.ready);
 await expect(page.locator('#studio-status')).toBeHidden();
 await page.waitForFunction(()=>window.kestrelStudio.snapshot().frames>8);
}
async function state(page){return page.evaluate(()=>{
 const rig=window.kestrelStudio;
 const poses=['Ladder','Ladder_Upper','Ladder_Middle','Ladder_Lower','Canopy','Gear_Nose','AB_L','AB_R'].map(name=>{
  const o=rig.asset.getNode(name);if(!o)return {name,missing:true};
  return {name,position:o.position.toArray(),rotation:o.rotation.toArray(),worldPosition:o.getWorldPosition(rig.camera.position.clone()).toArray(),scale:o.scale.toArray(),visible:o.visible,castShadow:o.castShadow};
 });
 const canvas=rig.renderer.domElement.getBoundingClientRect(),controls=document.querySelector('.studio-controls').getBoundingClientRect();
 return {...rig.snapshot(),poses,cameraPosition:rig.camera.position.toArray(),canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},controls:{x:controls.x,y:controls.y,width:controls.width,height:controls.height}};
});}
async function capture(page,name){
 const before=await state(page);await page.screenshot({path:`${OUT}/${name}.png`,fullPage:true});const after=await state(page);
 notes.captures.push({name,before,after});
}
async function progress(page,key,value){await page.waitForFunction(({key,value})=>window.kestrelStudio.snapshot().progress[key]>=value,{key,value},{timeout:30000});}
async function endpoint(page,key,value){
 await expect.poll(()=>page.evaluate(k=>window.kestrelStudio.snapshot().progress[k],key),{timeout:30000}).toBeCloseTo(value,3);
 notes.mechanisms.push({key,value,snapshot:await state(page)});
}
async function throttle(page,value){
 await page.locator('#throttle').focus();await page.keyboard.press('Home');
 for(let n=0;n<Math.round(value*100);n++)await page.keyboard.press('ArrowRight');
 await expect.poll(()=>page.evaluate(()=>window.kestrelStudio.snapshot().throttle)).toBeCloseTo(value,3);
 await page.waitForTimeout(160);
}
async function screenProjection(page){return page.evaluate(()=>{
 const rig=window.kestrelStudio,rect=rig.renderer.domElement.getBoundingClientRect();
 const rows=[1,2,3,4].map(i=>{const o=rig.asset.getNode('MFD_'+i);o.geometry.computeBoundingBox();const b=o.geometry.boundingBox;
  const p=[];for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y]){const v=rig.camera.position.clone().set(x,y,b.max.z).applyMatrix4(o.matrixWorld).project(rig.camera);p.push({x:rect.left+(v.x*.5+.5)*rect.width,y:rect.top+(-v.y*.5+.5)*rect.height,z:v.z});}
  return {name:o.name,corners:p};});
 return {rect:{x:rect.x,y:rect.y,width:rect.width,height:rect.height},controlsTop:document.querySelector('.studio-controls').getBoundingClientRect().top,screens:rows};
});}

test('independent round-4 follow-up of five appearance and mechanism blockers',async({browser,page})=>{
 await fs.mkdir(OUT,{recursive:true});
 notes.assetSha256=crypto.createHash('sha256').update(await fs.readFile(ASSET)).digest('hex');notes.browser=browser.version();
 try {
  await open(page);
  for(const [name,label]of views){
   await page.getByRole('button',{name:label,exact:true}).click();await page.waitForTimeout(160);await capture(page,'desktop-'+name);
   if(name==='cockpit')notes.desktopScreens=await screenProjection(page);
  }
  await page.getByRole('button',{name:'Boarding',exact:true}).click();
  await page.getByRole('button',{name:'Deploy ladder',exact:true}).click();notes.interlockClosed=await page.locator('#mechanism-status').textContent();
  await page.keyboard.press('c');await progress(page,'canopy',.25);await capture(page,'canopy-25');await progress(page,'canopy',.60);await capture(page,'canopy-60');await endpoint(page,'canopy',1);await capture(page,'canopy-open');
  await page.keyboard.press('l');
  for(const [value,name]of [[.18,'bridge-swing'],[.42,'upper-fold'],[.67,'middle-fold'],[.9,'lower-fold']]){await progress(page,'ladder',value);await capture(page,'ladder-'+name);}
  await endpoint(page,'ladder',1);await capture(page,'ladder-deployed');
  await page.keyboard.press('c');notes.canopyBlocked=await page.locator('#mechanism-status').textContent();
  await page.keyboard.press('l');await page.waitForFunction(()=>window.kestrelStudio.snapshot().progress.ladder<.5);await capture(page,'ladder-return');await endpoint(page,'ladder',0);await page.keyboard.press('c');await endpoint(page,'canopy',0);
  await page.getByRole('button',{name:'Underside',exact:true}).click();
  await page.keyboard.press('g');await page.waitForFunction(()=>window.kestrelStudio.snapshot().progress.gear<.75);await capture(page,'gear-retracting');await endpoint(page,'gear',0);await capture(page,'gear-stowed');await page.keyboard.press('g');await endpoint(page,'gear',1);
  await page.getByRole('button',{name:'Engines',exact:true}).click();
  for(const value of [0,.35,.68,1]){await throttle(page,value);await capture(page,'engine-'+Math.round(value*100));}
  await throttle(page,.15);await page.evaluate(()=>{window.kestrelStudio.camera.position.set(-4,3.1,11.8);});await page.waitForTimeout(180);await capture(page,'diagnostic-rear-detail');
  await page.evaluate(()=>{window.kestrelStudio.camera.position.set(0,2.6,15);});await page.waitForTimeout(180);
  for(const value of [0,.35,.68,1]){await throttle(page,value);await capture(page,'diagnostic-straight-rear-'+Math.round(value*100));}
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});const phone=await mobile.newPage();await open(phone);
  for(const [name,label]of views){
   await phone.getByRole('button',{name:label,exact:true}).tap();await phone.waitForTimeout(160);await capture(phone,'phone-'+name);
   if(name==='cockpit')notes.phoneScreens=await screenProjection(phone);
  }
  await phone.getByRole('button',{name:'Boarding',exact:true}).tap();await phone.getByRole('button',{name:'Open canopy',exact:true}).tap();await endpoint(phone,'canopy',1);await phone.getByRole('button',{name:'Deploy ladder',exact:true}).tap();await endpoint(phone,'ladder',1);await capture(phone,'phone-deployed');
  await mobile.close();
 } finally {
  notes.assetUnchanged=notes.assetSha256===crypto.createHash('sha256').update(await fs.readFile(ASSET)).digest('hex');
  await fs.writeFile(`${OUT}/browser-evidence.json`,JSON.stringify(notes,null,2)+'\n');
 }
 expect(notes.console).toEqual([]);expect(notes.assetUnchanged).toBe(true);
});
