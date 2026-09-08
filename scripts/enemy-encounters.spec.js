import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.ENCOUNTER_EVIDENCE||'/tmp/star-agent-encounters';
const routes=[['orbit','aeon','standard'],['pyre','pyre','easy'],['miasma','miasma','hard'],['moon','selene','easy'],['ring','belt','standard']];
for(const [start,region,tier] of routes)test(`${region} ${tier}: controller dispatch, physical approach, combat and report`,async({page,browser},testInfo)=>{
 const evidence=process.env.ENCOUNTER_EVIDENCE?`${output}/${region}-${tier}`:testInfo.outputPath('evidence');await mkdir(evidence,{recursive:true});const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(()=>{
  window.encounterPad={id:'Encounter standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
  Object.defineProperty(navigator,'getGamepads',{value:()=>[window.encounterPad]});
 });
 const frames=()=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
 const button=async(i,down)=>{await page.evaluate(({i,down})=>window.encounterPad.buttons[i]={pressed:down,value:+down},{i,down});await frames();};
 const tap=async i=>{await button(i,true);await button(i,false);};
 const armed=()=>page.waitForFunction(()=>window.starAgent.state.controller.armed);
 async function choose(key){
  const tab=key.startsWith('patrol-')?'contracts':key.startsWith('weapon-')||key==='combat-target'?'ship':null;
  if(tab&&await page.locator('dialog[open].gameplay-screen').count())for(let i=0;i<8&&await page.locator('dialog[open]').getAttribute('data-gameplay-tab')!==tab;i++)await tap(5);
  for(let i=0;i<80;i++){
   const focus=await page.evaluate(key=>{const active=document.activeElement,target=[...document.querySelectorAll('dialog[open] [data-controller-key]')].find(el=>el.dataset.controllerKey===key);return {key:active?.dataset.controllerKey,visible:Boolean(target?.getClientRects().length),page:active?.dataset.controllerKey?.startsWith('page-'),available:active?.getAttribute('aria-disabled')!=='true'};},key);
   if(focus.key===key){await tap(0);return;}
   if(!focus.visible&&focus.page&&focus.available){await tap(0);continue;}
   await tap(13);
  }
  throw Error(`Controller could not focus ${key}`);
 }
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=kestrel&start=${start}&intro=0&debug&seed=7291`);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.mode==='flight'&&!window.starAgent.state.transiting,{},{timeout:90000});await armed();
 await tap(9);await choose('weapon-laser');await armed();
 await tap(9);await choose(`patrol-${tier}`);
 await expect(page.locator(`[data-difficulty="${tier}"]`)).toHaveAttribute('aria-pressed','true');
 // Focus stays on the real rerendered difficulty button; no synthetic click or pose write.
 expect(await page.evaluate(()=>document.activeElement?.dataset.controllerKey)).toBe(`patrol-${tier}`);
 await page.screenshot({path:`${evidence}/brief.png`});
 await choose('patrol-accept');await page.waitForFunction(()=>window.starAgent.state.combat.phase==='transit');
 expect(await page.evaluate(()=>window.starAgent.state.combat.contract.id)).toBe(`${region}-${tier}`);
 await expect(page.locator('[data-difficulty="easy"]')).toBeDisabled();
 await tap(1);await armed();
 // Only standard controller input drives the ship. Debug navigation is read-only steering feedback.
 await page.evaluate(()=>{
  window.encounterPilot=setInterval(()=>{
   const s=window.starAgent.state,n=window.starAgent.navigation,pad=window.encounterPad;
   const neutral=()=>{pad.axes=[0,0,0,0];pad.buttons[7]={pressed:false,value:0};pad.buttons[6]={pressed:false,value:0};};
   if(!s.enabled||!['transit','engage'].includes(s.combat.phase)){neutral();return;}
   const enemy=s.combat.enemies.find(e=>e.id===s.combat.targetId&&e.hull>0);
   const destination=s.combat.phase==='transit'?s.combat.point:enemy?.position;
   if(!destination){neutral();pad.buttons[6]={pressed:true,value:1};return;}
   const local=n.position.clone().fromArray(destination).sub(n.position).applyQuaternion(n.orientation.clone().invert());
   const yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z)),distance=local.length();
   const command=value=>Math.abs(value)<.003?0:Math.sign(value)*Math.min(1,.18+Math.abs(value)*2.5);
   pad.axes[2]=command(yaw);pad.axes[3]=command(-pitch);
   if(s.combat.phase==='transit'){
    pad.axes[0]=0;pad.axes[1]=Math.abs(yaw)<.15&&Math.abs(pitch)<.15?-.9:0;
    pad.buttons[6]={pressed:false,value:0};pad.buttons[7]={pressed:false,value:0};
   }else{
    pad.axes[0]=Math.sin(performance.now()/1800)*.55;pad.axes[1]=distance>1000?-.4:.2;
    pad.buttons[6]={pressed:s.speed>100,value:s.speed>100?1:0};
    const fire=Math.abs(yaw)<.045&&Math.abs(pitch)<.045;pad.buttons[7]={pressed:fire,value:+fire};
   }
  },35);
 });
 await page.waitForFunction(()=>window.starAgent.state.combat.phase==='engage',undefined,{timeout:240000});
 await page.waitForFunction(()=>window.starAgent.state.combat.hits>0,undefined,{timeout:60000});
 await page.screenshot({path:`${evidence}/engagement.png`});
 if(tier==='hard'){
  await page.waitForFunction(()=>window.starAgent.state.combat.reinforcementIn>0,undefined,{timeout:120000});
  await page.screenshot({path:`${evidence}/reinforcements.png`});
  expect(await page.evaluate(()=>window.starAgent.state.combat.completed)).toBe(0);
  await page.waitForFunction(()=>window.starAgent.state.combat.wave===2,undefined,{timeout:30000});
 }
 await page.waitForFunction(()=>['complete','failed','aborted'].includes(window.starAgent.state.combat.phase),undefined,{timeout:180000});
 await page.evaluate(()=>{clearInterval(window.encounterPilot);const p=window.encounterPad;p.axes=[0,0,0,0];p.buttons[6]={pressed:false,value:0};p.buttons[7]={pressed:false,value:0};});await frames();
 await writeFile(`${evidence}/combat.json`,JSON.stringify(await page.evaluate(()=>window.starAgent.state.combat),null,2));
 expect(await page.evaluate(()=>window.starAgent.state.combat.phase)).toBe('complete');await armed();
 await tap(9);await choose('patrol-debrief');
 const report=await page.evaluate(()=>window.starAgent.state.combat.reports[0]);expect(report.contractId).toBe(`${region}-${tier}`);expect(report.kills).toBe(tier==='hard'?5:tier==='easy'?1:2);
 await expect(page.locator('.patrol-reports')).toContainText(`${report.kills} kills`);
 await page.screenshot({path:`${evidence}/report.png`});
 await page.setViewportSize({width:390,height:844});await frames();
 const scroll=page.locator('#patrol-console .gameplay-content');expect(await scroll.evaluate(el=>el.scrollHeight>el.clientHeight)).toBe(true);
 await page.evaluate(()=>{window.encounterPad.axes[3]=-1;});await page.waitForFunction(()=>document.querySelector('#patrol-console .gameplay-content').scrollTop<1);
 await page.evaluate(()=>{window.encounterPad.axes[3]=1;});await page.waitForFunction(()=>{const el=document.querySelector('#patrol-console .gameplay-content');return el.scrollTop>=el.scrollHeight-el.clientHeight-2;});
 await page.evaluate(()=>{window.encounterPad.axes[3]=0;});await frames();await page.screenshot({path:`${evidence}/phone-report.png`});
 await tap(1);await armed();await page.setViewportSize({width:1440,height:900});
 // No held RT is replayed after a mission menu, focus loss or controller replacement.
 await tap(9);await button(7,true);await tap(1);await frames();
 let shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);await frames();expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(shots);
 await button(7,false);await armed();
 const blank=await page.context().newPage(),gameCDP=await page.context().newCDPSession(page),blankCDP=await page.context().newCDPSession(blank);
 try{
  await blank.goto('about:blank');await gameCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});await blankCDP.send('Emulation.setFocusEmulationEnabled',{enabled:false});
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&window.starAgent.state.focused);await armed();
  const beforeFocus=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);await button(7,true);await page.waitForFunction(before=>window.starAgent.state.effects.weaponShots>before,beforeFocus);
  await blank.bringToFront();await page.waitForFunction(()=>!window.starAgent.state.focused,null,{polling:100});
  expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);
  await page.bringToFront();await page.waitForFunction(()=>document.hasFocus()&&window.starAgent.state.focused);await frames();await frames();
  expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots),'held RT after native tab focus').toBe(shots);
  expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await armed();
 }finally{await gameCDP.send('Emulation.setFocusEmulationEnabled',{enabled:true});await blankCDP.send('Emulation.setFocusEmulationEnabled',{enabled:true});await gameCDP.detach();await blankCDP.detach();await blank.close();await page.bringToFront();}
 for(const kind of ['disconnect','replacement','unsupported']){
  await button(7,true);await page.evaluate(kind=>{const p=window.encounterPad;if(kind==='disconnect')p.connected=false;if(kind==='replacement')p.id+=' replacement';if(kind==='unsupported')p.mapping='';},kind);await frames();
  shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);
  await page.evaluate(()=>{window.encounterPad.connected=true;window.encounterPad.mapping='standard';});await frames();await frames();
  expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots),`held RT after ${kind}`).toBe(shots);await button(7,false);await armed();
 }
 const backend=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unavailable';});
 await writeFile(`${evidence}/receipt.json`,JSON.stringify({browser:browser.version(),backend,viewport:[1440,900],report,errors,warnings,physicalController:false},null,2));expect(errors).toEqual([]);
});

test('keyboard and native touch select difficulties, abandon and return at phone width',async({page},testInfo)=>{
 await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
 const evidence=process.env.ENCOUNTER_EVIDENCE?`${output}/interface`:testInfo.outputPath('evidence');await mkdir(evidence,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto('/?dev=1&ship=kestrel&start=orbit&intro=0&debug&seed=7291');
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&!window.starAgent.state.transiting,{},{timeout:90000});
 await page.keyboard.press('Escape');await page.locator('dialog[open] [data-tab="contracts"]').click();
 await page.locator('[data-difficulty="hard"]').focus();await page.keyboard.press('Enter');
 await expect(page.locator('.patrol-goal')).toContainText('5 hostiles');
 await page.locator('[data-controller-key="patrol-accept"]').focus();await page.keyboard.press('Enter');
 await page.waitForFunction(()=>window.starAgent.state.combat.phase==='transit');
 await page.locator('[data-controller-key="patrol-abort"]').focus();await page.keyboard.press('Enter');
 expect(await page.evaluate(()=>window.starAgent.state.combat.phase)).toBe('aborted');
 await page.setViewportSize({width:390,height:844});
 const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:1});
 const touch=async selector=>{const el=page.locator(selector);await el.scrollIntoViewIfNeeded();const b=await el.boundingBox();await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2}]});await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});};
 await touch('[data-difficulty="easy"]');await expect(page.locator('.patrol-goal')).toContainText('1 hostile');
 expect(await page.locator('#patrol-console').evaluate(el=>el.scrollWidth<=el.clientWidth+1)).toBe(true);
 await page.screenshot({path:`${evidence}/phone-brief.png`});
 await touch('[data-controller-key="patrol-accept"]');await page.waitForFunction(()=>window.starAgent.state.combat.phase==='transit');
 await touch('[data-controller-key="patrol-abort"]');expect(await page.evaluate(()=>window.starAgent.state.combat.phase)).toBe('aborted');
 await touch('#patrol-console .gameplay-resume');await page.waitForFunction(()=>window.starAgent.state.enabled&&!document.querySelector('dialog[open]'));
 expect(errors).toEqual([]);
});
