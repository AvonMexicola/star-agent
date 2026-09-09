import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.CHARACTER_TURN_OUT||'/tmp/star-agent-character-turn-evidence';
test('controller turns faster while walking and in EVA, retains fine aiming and returns through the ship',async({page,browser})=>{
 await mkdir(out,{recursive:true});const errors=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{window.turnPad={id:'Character turn standard controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.turnPad]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 const frames=()=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
 const button=async(i,down)=>{await page.evaluate(({i,down})=>window.turnPad.buttons[i]={pressed:down,value:+down},{i,down});await frames();};
 const tap=async i=>{await button(i,true);await button(i,false);};
 const axis=values=>page.evaluate(values=>window.turnPad.axes=values,values);
 async function measure(amount){
  const result=await page.evaluate(async amount=>{
   const n=window.starAgent.navigation,q=n.orientation.clone(),start=performance.now();window.turnPad.axes[2]=amount;
   while(performance.now()-start<800)await new Promise(r=>requestAnimationFrame(r));
   window.turnPad.axes[2]=0;
   return {mode:n.mode,amount,rate:n.orientation.angleTo(q)/((performance.now()-start)/1000),restore:q.toArray()};
  },amount);
  await page.evaluate(q=>{window.turnAligned=false;window.turnPilot=setInterval(()=>{
   const n=window.starAgent.navigation,p=n.position.clone().set(0,0,-1).applyQuaternion(n.orientation.clone().fromArray(q)).applyQuaternion(n.orientation.clone().invert());
   const yaw=Math.atan2(p.x,-p.z),pitch=-Math.atan2(p.y,Math.hypot(p.x,p.z)),command=x=>Math.abs(x)<.003?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2);
   window.turnPad.axes=[0,0,command(yaw),command(pitch)];window.turnAligned=Math.abs(yaw)<.003&&Math.abs(pitch)<.003;
  },20);},result.restore);
  try{await page.waitForFunction(()=>window.turnAligned,null,{timeout:25000});}
  finally{await page.evaluate(()=>{clearInterval(window.turnPilot);window.turnPad.axes=[0,0,0,0];});}
  delete result.restore;return result;
 }
 await page.goto('/?dev=1&ship=nomad&start=orbit&intro=0&debug&seed=7291');
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed&&window.starAgent.state.enabled&&!window.starAgent.state.transiting,null,{timeout:90000});
 await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk'&&window.starAgent.navigation.spaceParked);
 const rates=[await measure(1),await measure(.58)];
 // A held faster look stick is still suppressed across focus/device gates.
 for(const kind of ['focus','disconnect','replacement']){
  await page.evaluate(kind=>{if(kind==='focus')window.dispatchEvent(new Event('blur'));if(kind==='disconnect')window.turnPad.connected=false;if(kind==='replacement')window.turnPad.id+=' replacement';window.turnPad.axes[2]=1;},kind);await frames();
  const q=await page.evaluate(()=>window.starAgent.navigation.orientation.toArray());
  await page.evaluate(()=>{window.turnPad.connected=true;window.dispatchEvent(new Event('focus'));});await frames();
  expect(await page.evaluate(q=>window.starAgent.navigation.orientation.angleTo(window.starAgent.navigation.orientation.clone().fromArray(q)),q)).toBeLessThan(.01);
  await axis([0,0,0,0]);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 }
 await axis([0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axis([0,0,0,0]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.99);
 await axis([0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.mode==='eva'&&window.starAgent.state.shipLocal[2]>18);await axis([0,0,0,0]);await button(6,true);await page.waitForFunction(()=>window.starAgent.state.speed<.01);await button(6,false);
 rates.push(await measure(1),await measure(.58));await page.screenshot({path:`${out}/eva-look.png`});
 for(const result of rates)expect(result.rate).toBeGreaterThan(result.amount===1?1.35:.60);
 for(const result of rates)expect(result.rate).toBeLessThan(result.amount===1?1.65:.90);
 // Brief reverse thrust, then coast slowly back to the ramp's physical capture.
 await axis([0,1,0,0]);await page.waitForTimeout(400);await axis([0,0,0,0]);await page.waitForFunction(()=>window.starAgent.state.mode==='walk',null,{timeout:45000});
 await axis([0,1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.4);await axis([0,0,0,0]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='flight');
 await page.screenshot({path:`${out}/returned-to-seat.png`});
 const renderer=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2'),e=gl.getExtension('WEBGL_debug_renderer_info');return e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):'unknown';});
 await writeFile(`${out}/journey.json`,JSON.stringify({browser:browser.version(),renderer,physicalController:false,rates,finalMode:await page.evaluate(()=>window.starAgent.state.mode),errors},null,2));expect(errors).toEqual([]);
});
