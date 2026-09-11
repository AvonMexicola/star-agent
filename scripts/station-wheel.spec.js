import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.STATION_WHEEL_OUT||'/tmp/star-agent-station-wheel-evidence';
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
async function flyTo(page,point,cap=180){
 await page.evaluate(({point,cap})=>{
  window.wheelDone=false;window.wheelPilot=setInterval(()=>{
   const n=window.starAgent.navigation,s=n.station,pad=window.wheelPad;
   const goal=n.position.clone().fromArray(point).applyQuaternion(s.baseQuaternion).add(s.centre),offset=goal.sub(n.position),distance=offset.length();
   const local=offset.applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=-Math.atan2(local.y,Math.hypot(local.x,local.z));
   const axis=x=>Math.abs(x)<.004?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2.5);
   const speed=Math.min(cap,Math.sqrt(Math.max(0,distance-6)*20)),forward=Math.abs(yaw)<.05&&Math.abs(pitch)<.05&&distance>=8?speed/n.speedProfile.speed:0;
   pad.axes=[0,forward?-(.16+.84*Math.min(1,forward)):0,axis(yaw),axis(pitch)];
   pad.buttons[6]={pressed:distance<8,value:distance<8?1:0};
   window.wheelSamples.push({local:n.position.clone().sub(s.centre).applyQuaternion(s.baseQuaternion.clone().invert()).toArray(),speed:n.speed,mode:n.mode});
   if(distance<8&&n.speed<.2){pad.axes=[0,0,0,0];window.wheelDone=true;clearInterval(window.wheelPilot);}
  },20);
 },{point,cap});
 try{await page.waitForFunction(()=>window.wheelDone,null,{timeout:100000});}
 catch(error){console.log('Wheel route diagnostics',await page.evaluate(()=>({last:window.wheelSamples.slice(-4),state:window.starAgent.state.controller,mode:window.starAgent.state.mode})));throw error;}
 finally{await page.evaluate(()=>{clearInterval(window.wheelPilot);window.wheelPad.axes=[0,0,0,0];window.wheelPad.buttons[6]={pressed:false,value:0};});}
}
test('controller physically flies through the visible gap between rotating wheel spokes',async({page,browser})=>{
 await mkdir(out,{recursive:true});const errors=[],requests=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});page.on('requestfailed',r=>requests.push({url:r.url(),error:r.failure()?.errorText}));
 await page.addInitScript(()=>{window.wheelPad={id:'Station wheel standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.wheelPad]});window.wheelSamples=[];});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 // Supported exterior launch is the sole setup placement. Every later movement
 // uses the controller; navigation/station objects are read-only feedback.
 await page.goto('/?dev=1&ship=nomad&start=orbit&stationExterior=1&exteriorView=overview&intro=0&debug&seed=7291');
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed&&window.starAgent.state.enabled&&!window.starAgent.state.transiting,null,{timeout:90000});
 expect(await page.evaluate(()=>window.starAgent.state.station.exterior)).toBe('geometry-review');
 const press=async(i,down)=>{await page.evaluate(({i,down})=>window.wheelPad.buttons[i]={pressed:down,value:+down},{i,down});await frames(page);};
 // Held translation after focus loss must wait for neutral before this flight.
 await page.evaluate(()=>{window.dispatchEvent(new Event('blur'));window.wheelPad.axes[1]=-1;});await frames(page);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await frames(page);
 expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);expect(await page.evaluate(()=>window.starAgent.state.speed)).toBeLessThan(.1);
 await page.evaluate(()=>window.wheelPad.axes[1]=0);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await page.screenshot({path:`${out}/exterior-start.png`});
 const gap=[800*Math.cos(Math.PI/6),400];
 await flyTo(page,[-1320,...gap]);await page.screenshot({path:`${out}/wheel-approach.png`});
 const before=await page.evaluate(()=>window.starAgent.state.station.rings);
 await flyTo(page,[-900,...gap],70);await page.screenshot({path:`${out}/through-wheel.png`});
 const after=await page.evaluate(()=>window.starAgent.state.station.rings);expect(after[0]).toBeGreaterThan(before[0]);expect(after[1]).toBeLessThan(before[1]);
 await flyTo(page,[-1320,...gap],70);await page.screenshot({path:`${out}/return-through-wheel.png`});
 await press(6,true);await page.waitForFunction(()=>window.starAgent.state.speed<.1);await press(6,false);
 const result=await page.evaluate(()=>{const n=window.starAgent.navigation,s=n.station,gl=document.querySelector('#viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {ship:n.shipId,mode:n.mode,speed:n.speed,local:n.position.clone().sub(s.centre).applyQuaternion(s.baseQuaternion.clone().invert()).toArray(),crash:n.crash,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',samples:window.wheelSamples};});
 expect(result.mode).toBe('flight');expect(result.crash).toBe(null);expect(result.samples.some(s=>s.local[0]>-920)).toBe(true);expect(result.local[0]).toBeLessThan(-1310);
 await writeFile(`${out}/journey.json`,JSON.stringify({browser:browser.version(),physicalController:false,viewport:[1440,900],before,after,...result,errors,requests},null,2));expect(errors).toEqual([]);expect(requests).toEqual([]);
});
