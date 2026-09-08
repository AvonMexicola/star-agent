import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const OUT='/tmp/star-agent-kestrel/docs/qa/kestrel/reviewer/s2-followup';
const ASSET='/tmp/star-agent-kestrel/assets/kestrel/kestrel.glb';
const hash=async()=>crypto.createHash('sha256').update(await fs.readFile(ASSET)).digest('hex');
test('independent desktop and phone S2 socket label follow-up',async({browser,page})=>{
 const notes={browser:browser.version(),assetSha256:await hash(),console:[],captures:[]};
 async function capture(p,name){
  p.on('pageerror',e=>notes.console.push({type:'pageerror',text:String(e)}));
  p.on('console',m=>{if(['error','warning'].includes(m.type()))notes.console.push({type:m.type(),text:m.text()});});
  await p.goto('/dev/kestrel.html');await p.evaluate(()=>window.kestrelStudio.ready);
  await expect(p.locator('#studio-status')).toBeHidden();
  await expect(p.locator('#hardpoint-spec')).toHaveText('4 × S2 hardpoints');
  await expect(p.locator('#hardpoint-spec')).toBeVisible();
  await p.waitForFunction(()=>window.kestrelStudio.snapshot().frames>8);
  const state=await p.evaluate(()=>{
   const rig=window.kestrelStudio,label=document.querySelector('#hardpoint-spec'),rect=label.getBoundingClientRect();
   return {...rig.snapshot(),cameraPosition:rig.camera.position.toArray(),label:{text:label.textContent,x:rect.x,y:rect.y,width:rect.width,height:rect.height},window:{width:innerWidth,height:innerHeight}};
  });
  expect(state.hardpoints).toHaveLength(4);
  expect(state.hardpoints.map(x=>x.node).sort()).toEqual(['HP_Belly','HP_Nose','HP_WingL','HP_WingR']);
  for(const mount of state.hardpoints){expect(mount.size).toBe(2);expect(mount.mount).toBe('fixed');expect(mount.installedWeapon).toBeNull();}
  expect(state.label.x).toBeGreaterThanOrEqual(0);expect(state.label.x+state.label.width).toBeLessThanOrEqual(state.window.width);
  await p.screenshot({path:`${OUT}/${name}.png`,fullPage:true});notes.captures.push({name,state});
 }
 try{
  await capture(page,'desktop-exterior');
  const mobile=await browser.newContext({viewport:{width:390,height:844},hasTouch:true});
  const phone=await mobile.newPage();await capture(phone,'phone-exterior');await mobile.close();
 }finally{notes.assetUnchanged=notes.assetSha256===await hash();await fs.writeFile(`${OUT}/browser-evidence.json`,JSON.stringify(notes,null,2)+'\n');}
 expect(notes.assetSha256).toBe('c48ed4e94b823f1f585e5d389ba8c88776731034025a7620162c8c3a5eb13b8a');
 expect(notes.assetUnchanged).toBe(true);expect(notes.console).toEqual([]);
});
