import {expect} from '@playwright/test';
import {walk,aim,frames} from './transport-helpers.js';
export async function brake(page,button){await button(6,true);await page.waitForFunction(()=>window.starAgent.state.speed<.2,undefined,{timeout:20000});await button(6,false);}
export async function climb(page,button,altitude){
 await page.evaluate(altitude=>{window.transportClimb=setInterval(()=>{const s=window.starAgent.state,pad=window.transportPad;if(s.altitude>=altitude){pad.buttons[0]={pressed:false,value:0};pad.buttons[6]={pressed:true,value:1};clearInterval(window.transportClimb);return;}pad.buttons[0]={pressed:true,value:1};},20);},altitude);
 try{await page.waitForFunction(altitude=>window.starAgent.state.altitude>=altitude,altitude,{timeout:180000});await brake(page,button);}finally{await page.evaluate(()=>{clearInterval(window.transportClimb);window.transportPad.buttons[0]={pressed:false,value:0};});}
}
export async function steerTarget(page,id){
 await page.evaluate(id=>{window.transportSteer=setInterval(()=>{const n=window.starAgent.navigation,t=window.starAgent.state.navigationTargets.targets.find(t=>t.id===id),p=window.transportPad;if(!t)return;const local=n.position.clone().fromArray(t.center).sub(n.position).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));const axis=x=>Math.abs(x)<.002?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2.5);p.axes=[0,0,axis(yaw),axis(-pitch)];},30);},id);
 try{await page.waitForFunction(id=>{const n=window.starAgent.state.navigationTargets;return n.aimedId===id&&n.ready;},id,{timeout:45000});}finally{await page.evaluate(()=>{clearInterval(window.transportSteer);window.transportPad.axes=[0,0,0,0];});}
}
export async function levelForPad(page,site){
 // Atmospheric vertical thrust follows gravity. Level and brake using the
 // actual look/roll controls before steering the descent in that frame.
 await page.evaluate(site=>{window.transportLevelDone=false;window.transportLevel=setInterval(()=>{
  const n=window.starAgent.navigation,p=window.transportPad,s=window.starAgent.state.settlements.sites.find(s=>s.id===site),q=n.orientation.clone().fromArray(s.quaternion),inverse=n.orientation.clone().invert();
  const forward=n.position.clone().set(0,0,-1).applyQuaternion(q).applyQuaternion(inverse),up=n.normal.clone().applyQuaternion(inverse),yaw=Math.atan2(forward.x,-forward.z),pitch=Math.atan2(forward.y,Math.hypot(forward.x,forward.z)),roll=Math.atan2(up.x,up.y);
  const axis=x=>Math.abs(x)<.012?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2);
  p.axes=[0,0,axis(yaw),axis(-pitch)];p.buttons[4]={pressed:roll<-.03,value:roll<-.03?1:0};p.buttons[5]={pressed:roll>.03,value:roll>.03?1:0};p.buttons[6]={pressed:true,value:1};
  if(Math.abs(yaw)<.025&&Math.abs(pitch)<.025&&Math.abs(roll)<.04){window.transportLevelDone=true;clearInterval(window.transportLevel);}
 },30);},site);
 try{await page.waitForFunction(()=>window.transportLevelDone,undefined,{timeout:45000});}finally{await page.evaluate(()=>{clearInterval(window.transportLevel);window.transportPad.axes=[0,0,0,0];for(const i of [4,5,6])window.transportPad.buttons[i]={pressed:false,value:0};});}
}
export async function flyToPad(page,site){
 // Actual stick-controlled cruise descent. Desired speed falls with stopping
 // distance; orientation aligns to the pad frame before landing assist.
 await page.evaluate(site=>{window.transportApproachDone=false;window.transportApproach=setInterval(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.id===site),pad=window.transportPad,up=n.position.clone().fromArray(s.pad).sub(n.position.clone().fromArray(s.origin)).normalize();const q=n.orientation.clone().fromArray(s.quaternion),siteUp=n.position.clone().set(0,1,0).applyQuaternion(q),goal=n.position.clone().fromArray(s.pad).addScaledVector(siteUp,65),delta=goal.sub(n.position),distance=delta.length();
  const local=delta.clone().applyQuaternion(n.orientation.clone().invert()),speed=Math.min(330,Math.sqrt(Math.max(0,distance-4)*12)),desired=delta.normalize().multiplyScalar(speed),error=desired.sub(n.velocity).applyQuaternion(n.orientation.clone().invert());
  pad.axes[0]=Math.max(-1,Math.min(1,error.x/30));pad.axes[1]=Math.max(-1,Math.min(1,error.z/30));pad.buttons[0]={pressed:error.y>1.5,value:Math.min(1,Math.max(0,error.y/30))};pad.buttons[1]={pressed:error.y< -1.5,value:Math.min(1,Math.max(0,-error.y/30))};
  // Keep a level ship with the settlement's heading using the physical look axes.
  const forward=n.position.clone().set(0,0,-1).applyQuaternion(q).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(forward.x,-forward.z),pitch=Math.atan2(forward.y,Math.hypot(forward.x,forward.z));const axis=x=>Math.abs(x)<.008?0:Math.sign(x)*Math.min(1,.18+Math.abs(x)*2);pad.axes[2]=axis(yaw);pad.axes[3]=axis(-pitch);
  if(distance<6&&n.speed<9){pad.axes=[0,0,0,0];pad.buttons[0]={pressed:false,value:0};pad.buttons[1]={pressed:false,value:0};pad.buttons[6]={pressed:true,value:1};window.transportApproachDone=true;clearInterval(window.transportApproach);}
 },30);},site);
 try{await page.waitForFunction(()=>window.transportApproachDone,undefined,{timeout:200000});}finally{await page.evaluate(()=>{clearInterval(window.transportApproach);window.transportPad.axes=[0,0,0,0];window.transportPad.buttons[0]={pressed:false,value:0};window.transportPad.buttons[1]={pressed:false,value:0};});}
}
export async function exitAndTerminal(page,tap){
 await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');await walk(page,[0,2.75,3],'ship');await aim(page,[0,2.75,7]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);await walk(page,[0,1.75,8],'ship');
 await walk(page,[9,0,30]);await walk(page,[9,0,-12]);await walk(page,[-2,0,-12]);await walk(page,[-2,0,-19.8]);const terminal=await page.evaluate(()=>window.starAgent.state.settlements.sites.find(s=>s.body===window.starAgent.state.body).terminal);await aim(page,terminal,'world');await tap(2);await expect(page.locator('#trading-dialog')).toBeVisible();
}
export async function reboard(page,tap){await walk(page,[0,1.75,8],'ship');await aim(page,[0,2.75,0]);await walk(page,[0,2.75,3],'ship');await walk(page,[0,2.75,-1.65],'ship');await aim(page,[0,2.75,-3]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');}
