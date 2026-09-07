import {expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
export const evidence=process.env.NAV_EVIDENCE||'/tmp/star-agent-navigation-evidence';
export const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
export async function setupNavigation(page,ship='nomad'){
 await mkdir(evidence,{recursive:true});const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure()?.errorText}));
 await page.addInitScript(()=>{window.navPad={id:'Navigation standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.navPad]});});
 await page.route('**/api/auth/session',route=>route.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=${ship}&start=orbit&intro=0&debug&seed=7291`);await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed&&window.starAgent.state.enabled&&!window.starAgent.state.transiting,undefined,{timeout:90000});
 const button=async(i,down)=>{await page.evaluate(({i,down})=>window.navPad.buttons[i]={pressed:down,value:+down},{i,down});await frames(page);};
 const tap=async i=>{await button(i,true);await button(i,false);};
 async function choose(key){for(let i=0;i<90;i++){if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await tap(0);return;}await tap(13);}throw Error(`Missing controller control: ${key}`);}
 async function drive(){await button(4,true);await button(5,true);await tap(12);await button(5,false);await button(4,false);}
 return {tap,button,choose,drive,errors,requests};
}
export async function steer(page,id,kind='controller'){
 if(kind==='controller'){
  await page.evaluate(id=>{window.navPilot=setInterval(()=>{const n=window.starAgent.navigation,s=window.starAgent.state,t=s.navigationTargets.targets.find(t=>t.id===id),pad=window.navPad;if(!t||s.travel){pad.axes=[0,0,0,0];return;}const local=n.position.clone().fromArray(t.center).sub(n.position).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));const command=x=>Math.abs(x)<.002?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2.5);pad.axes[2]=command(yaw);pad.axes[3]=command(-pitch);},30);},id);
  await page.waitForFunction(id=>window.starAgent.state.navigationTargets.aimedId===id&&window.starAgent.state.navigationTargets.ready,id,{timeout:45000}).catch(async e=>{console.log('Lock failure',await page.evaluate(()=>({nav:window.starAgent.state.navigationTargets,pose:window.starAgent.state.position,mode:window.starAgent.state.mode,focus:window.starAgent.state.focused,gear:window.starAgent.state.landingGear})));throw e;});
  await page.evaluate(()=>{clearInterval(window.navPilot);window.navPad.axes=[0,0,0,0];});await frames(page);
 }else{
  for(let i=0;i<800;i++){
   const a=await page.evaluate(id=>{const n=window.starAgent.navigation,t=window.starAgent.state.navigationTargets.targets.find(t=>t.id===id),p=n.position.clone().fromArray(t.center).sub(n.position).applyQuaternion(n.orientation.clone().invert());return {yaw:Math.atan2(p.x,-p.z),pitch:Math.atan2(p.y,Math.hypot(p.x,p.z)),ready:window.starAgent.state.navigationTargets.ready,aimed:window.starAgent.state.navigationTargets.aimedId};},id);
   if(a.ready&&a.aimed===id)break;
   for(const [key,down] of [['ArrowLeft',a.yaw<-.005],['ArrowRight',a.yaw>.005],['ArrowUp',a.pitch>.005],['ArrowDown',a.pitch<-.005]])await page.keyboard[down?'down':'up'](key);
   await frames(page);
  }
  for(const key of ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'])await page.keyboard.up(key);
  await page.waitForFunction(()=>window.starAgent.state.navigationTargets.ready);
 }
}
export async function mapBody(page,id){
 await page.locator('[data-controller-key="map-breadcrumb-star"]').click();
 if(['selene','miasma'].includes(id))await page.locator(`[data-travel-target="${id==='selene'?'aeon':'pyre'}"]`).click();
 await page.locator(`[data-travel-target="${id}"]`).click();
}
export async function fits(page){
 const result=await page.evaluate(()=>{const d=document.querySelector('#system-map'),c=d.querySelector('.gameplay-content')??d,r=c.getBoundingClientRect();return {scroll:[c.clientWidth,c.scrollWidth,c.clientHeight,c.scrollHeight],clipped:[...c.querySelectorAll('button')].filter(e=>e.getClientRects().length&&!e.closest('[hidden]')).filter(e=>{const b=e.getBoundingClientRect();return b.left<r.left-2||b.right>r.right+2||b.top<r.top-2||b.bottom>r.bottom+2;}).map(e=>e.textContent)};});
 expect(result.scroll[1]).toBeLessThanOrEqual(result.scroll[0]+2);expect(result.scroll[3]).toBeLessThanOrEqual(result.scroll[2]+2);expect(result.clipped).toEqual([]);return result;
}
export async function record(page,browser,name,extra={}){await writeFile(`${evidence}/${name}.json`,JSON.stringify({browser:browser.version(),backend:await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';}),state:await page.evaluate(()=>window.starAgent.state),physicalController:false,...extra},null,2));}
