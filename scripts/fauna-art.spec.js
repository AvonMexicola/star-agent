import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out='test-results/fauna-evidence';
// Deliberate camera/standing fixture for motion and UI inspection. This does not
// establish controller traversal; fauna.spec.js owns the physical journey.
for(const[species,start]of[['pyrebear','pyrebear-habitat'],['suloher','suloher-habitat']])test(`${species}: actual terrain close motion and responsive HUD`,async({page,browser})=>{
 await mkdir(out,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=nomad&start=${start}&intro=0&debug&epoch=1788000000000`);
 await page.waitForFunction(species=>window.starAgent?.state.ready&&!window.starAgent.state.transiting&&window.starAgent.state.fauna.assets[species]?.status==='ready',species);
 const id=await page.evaluate(species=>{
  const n=window.starAgent.navigation,e=window.starAgent.state.fauna.entities.find(e=>e.species===species),up=n.position.clone().fromArray(e.normal),target=n.position.clone().fromArray(e.position),forward=n.position.clone().fromArray(e.forward);
  n.mode='walk';n.insideShip=false;n.enabled=false;n.focused=true;n.autoland=false;n.position.copy(target).addScaledVector(forward,8).addScaledVector(up,1.75);n.velocity.set(0,0,0);n.orientToward(target.clone().addScaledVector(up,species==='pyrebear'?.9:.5),up);return e.id;
 },species);
 await page.evaluate(id=>{function follow(){const n=window.starAgent.navigation,e=window.starAgent.state.fauna.entities.find(e=>e.id===id);if(e){const up=n.position.clone().fromArray(e.normal),feet=n.position.clone().fromArray(e.position),forward=n.position.clone().fromArray(e.forward),target=feet.clone().addScaledVector(up,e.health>0?(e.species==='pyrebear'?.9:.5):.35);n.position.copy(feet).addScaledVector(forward,7).addScaledVector(up,1.75);n.velocity.set(0,0,0);n.orientToward(target,up);}requestAnimationFrame(follow);}follow();},id);
 await page.waitForFunction(species=>{const s=window.starAgent.state;return species==='pyrebear'?s.pyre.ready:s.miasma.ready;},species,{timeout:120000});await page.evaluate(()=>{window.starAgent.navigation.enabled=true;});await page.waitForFunction(()=>window.starAgent.state.mining.tool.active);await page.keyboard.press('1');await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='rifle-laser');
 await page.waitForFunction(()=>!document.querySelector('#fauna-status').hidden);
 const checks=[];
 for(const size of[{width:1440,height:900},{width:390,height:844}]){
  await page.setViewportSize(size);await page.waitForTimeout(150);
  checks.push(await page.evaluate(()=>{const a=document.querySelector('#fauna-status').getBoundingClientRect(),b=document.querySelector('#loadout-bar').getBoundingClientRect();return{size:[innerWidth,innerHeight],hud:[a.x,a.y,a.width,a.height],overlap:Math.max(a.left,b.left)<Math.min(a.right,b.right)&&Math.max(a.top,b.top)<Math.min(a.bottom,b.bottom),within:a.left>=0&&a.right<=innerWidth&&a.top>=0&&a.bottom<=innerHeight};}));
  await page.screenshot({path:`${out}/${species}-${size.width}-hud.png`});
 }
 await page.setViewportSize({width:1280,height:800});
 await page.keyboard.down('t');await page.waitForFunction(id=>window.starAgent.state.fauna.entities.find(e=>e.id===id)?.health===0,id,{timeout:20000});await page.keyboard.up('t');
 await page.screenshot({path:`${out}/${species}-motion-start.png`});
 for(const time of[.5,1,2.2,3.2]){await page.waitForFunction(({id,time})=>window.starAgent.state.fauna.entities.find(e=>e.id===id)?.deathTime>=time,{id,time});await page.screenshot({path:`${out}/${species}-motion-${time}.png`});}
 await writeFile(`${out}/${species}-art.json`,JSON.stringify({browser:browser.version(),fixture:'Debug standing and camera follow at7m for full-body framing; real terrain and ammo-authorized keyboard gunfire, separate from controller journey',checks,state:await page.evaluate(()=>window.starAgent.state),errors},null,2));
 expect(checks.every(c=>c.within&&!c.overlap)).toBe(true);expect(errors).toEqual([]);
});
