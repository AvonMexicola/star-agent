import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.SETTLEMENT_EVIDENCE||'/tmp/star-agent-settlements-01';
const frames=p=>p.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
async function setup(page,site='selene'){
 await mkdir(out,{recursive:true});const errors=[],warnings=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(()=>{window.settlementPad={id:'Settlement standard Gamepad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.settlementDisconnected?[]:[window.settlementPad]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=nomad&start=settlement-${site}&intro=0&debug&seed=7291`);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
 await page.waitForFunction(()=>window.starAgent.state.settlements.ready&&window.starAgent.state.settlements.rendered>0);
 const button=async(i,pressed)=>{await page.evaluate(({i,pressed})=>window.settlementPad.buttons[i]={pressed,value:+pressed},{i,pressed});await frames(page);};
 const tap=async i=>{await button(i,true);await button(i,false);};
 const choose=async key=>{for(let i=0;i<95;i++){if(await page.evaluate(k=>document.activeElement?.dataset.controllerKey===k,key)){await tap(0);return;}await tap(13);}throw Error(`Missing controller action ${key}`);};
 return {tap,button,choose,errors,warnings};
}
// Navigation state is read only. Steering writes only standard Gamepad axes.
async function walk(page,target,frame='site'){
 await page.evaluate(({target,frame})=>{window.settlementWalkDone=false;window.settlementWalkTimer=setInterval(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.body===n.body.id),q=n.shipOrientation.clone().fromArray(s.quaternion),goal=frame==='ship'?n.fromShipLocal(n.position.clone().fromArray(target)):n.position.clone().fromArray(target).applyQuaternion(q).add(n.position.clone().fromArray(s.origin));const delta=goal.sub(n.position).projectOnPlane(n.normal);if(delta.length()<.22){window.settlementPad.axes=[0,0,0,0];window.settlementWalkDone=true;clearInterval(window.settlementWalkTimer);return;}delta.applyQuaternion(n.orientation.clone().invert());window.settlementPad.axes=[Math.max(-1,Math.min(1,delta.x)),Math.max(-1,Math.min(1,delta.z)),0,0];},30);},{target,frame});
 try{await page.waitForFunction(()=>window.settlementWalkDone,undefined,{timeout:35000});}finally{await page.evaluate(()=>{clearInterval(window.settlementWalkTimer);window.settlementPad.axes=[0,0,0,0];});}await frames(page);
}
async function aim(page,target,frame='ship'){
 await page.evaluate(({target,frame})=>{window.settlementAimDone=false;window.settlementAimTimer=setInterval(()=>{const n=window.starAgent.navigation,goal=frame==='ship'?n.fromShipLocal(n.position.clone().fromArray(target)):n.position.clone().fromArray(target),local=goal.sub(n.position).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));if(Math.abs(yaw)<.025&&Math.abs(pitch)<.025){window.settlementPad.axes=[0,0,0,0];window.settlementAimDone=true;clearInterval(window.settlementAimTimer);return;}const a=x=>Math.abs(x)<.015?0:Math.sign(x)*Math.min(1,.19+Math.abs(x)*2);window.settlementPad.axes=[0,0,a(yaw),a(-pitch)];},30);},{target,frame});
 try{await page.waitForFunction(()=>window.settlementAimDone,undefined,{timeout:20000});}finally{await page.evaluate(()=>{clearInterval(window.settlementAimTimer);window.settlementPad.axes=[0,0,0,0];});}await frames(page);
}
async function capture(page,name){await page.screenshot({path:`${out}/${name}.png`});await writeFile(`${out}/${name}.json`,JSON.stringify(await page.evaluate(()=>window.starAgent.state),null,2));}

test('controller selects settlement, lands, walks to exchange, buys/sells cargo and returns to flight',async({page,browser})=>{
 const {tap,button,choose,errors,warnings}=await setup(page);
 await capture(page,'selene-approach');
 await tap(9);await choose('tab-map');await choose('map-body-aeon');await choose('map-body-selene');await choose('map-view-locations');await choose('map-signal-settlement-selene');
 await expect(page.locator('#map-target-name')).toHaveText('Stillwater Exchange');await capture(page,'map-desktop');await tap(1);await frames(page);
 await button(4,true);await button(5,true);await tap(13);await button(5,false);await button(4,false);
 await page.waitForFunction(()=>window.starAgent.state.landingGear.progress>.98);await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:60000});
 await capture(page,'landed');await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
 await walk(page,[0,2.75,3],'ship');await aim(page,[0,2.75,7]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);await walk(page,[0,1.75,8],'ship');
 // Leave via the actual ramp, skirt the hull, then approach the exchange door.
 await walk(page,[9,0,30]);await walk(page,[9,0,-12]);await walk(page,[-2,0,-12]);await walk(page,[-2,0,-19.8]);
 const terminal=await page.evaluate(()=>window.starAgent.state.settlements.sites.find(s=>s.body==='selene').terminal);await aim(page,terminal,'world');await capture(page,'exchange-entrance');
 await tap(2);await expect(page.locator('#trading-dialog')).toBeVisible();await expect(page.locator('.trade-place')).toHaveText('Stillwater Exchange');
 const before=await page.evaluate(()=>({stock:window.starAgent.state.trading.markets['settlement-selene'].stock.ice,credits:window.starAgent.state.trading.account.credits}));
 await choose('purchase-ice');await expect(page.locator('.trade-feedback')).toContainText('Loaded 1 SBU');
 const after=await page.evaluate(()=>window.starAgent.state.trading);expect(after.markets['settlement-selene'].stock.ice).toBe(before.stock-1);expect(after.account.credits).toBeLessThan(before.credits);
 await choose('view-cargo');await capture(page,'cargo-desktop');
 for(const size of [{width:390,height:844},{width:1440,height:900}]){await page.setViewportSize(size);await frames(page);await capture(page,`cargo-${size.width}`);expect(await page.locator('#trading-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2)).toBe(true);}
 const crate=after.ships.find(s=>s.hull==='nomad').crates[0];await choose(`sell-${crate.id}`);await expect(page.locator('.trade-feedback')).toContainText('Sold 1 SBU');
 await button(7,true);await tap(1);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 // Held translation cannot replay after focus or disconnect transitions.
 for(const kind of ['focus','disconnect']){await button(7,true);await page.evaluate(kind=>kind==='focus'?window.dispatchEvent(new Event('blur')):window.settlementDisconnected=true,kind);await frames(page);await page.evaluate(kind=>kind==='focus'?window.dispatchEvent(new Event('focus')):window.settlementDisconnected=false,kind);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);}
 await walk(page,[-2,0,-12]);await walk(page,[9,0,-12]);await walk(page,[9,0,30]);await walk(page,[0,1.75,8],'ship');await aim(page,[0,2.75,0]);await walk(page,[0,2.75,3],'ship');await walk(page,[0,2.75,0],'ship');await aim(page,[0,2.75,-3]);await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='landed');await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='flight');
 await capture(page,'returned-to-flight');expect(errors).toEqual([]);await writeFile(`${out}/controller.json`,JSON.stringify({browser:browser.version(),errors,warnings,physicalController:false,start:'Explicit development approach at 65 m; all subsequent navigation input from injected standard Gamepad.',state:await page.evaluate(()=>window.starAgent.state)},null,2));
});

test('all four settlement layouts render in the game and appear on the phone map',async({page,browser})=>{
 const {errors,warnings}=await setup(page,'aeon');
 for(const body of ['aeon','selene','pyre','miasma']){
  if(body!=='aeon'){await page.goto(`/?dev=1&ship=nomad&start=settlement-${body}&intro=0&debug&seed=7291`);await page.waitForFunction(()=>window.starAgent?.state.ready&&!window.starAgent.state.transiting&&window.starAgent.state.settlements.ready&&window.starAgent.state.settlements.rendered>0,undefined,{timeout:90000});}
  // Art-only viewpoint fixture; separate from the controller journey above.
  await page.evaluate(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.body===n.body.id),q=n.orientation.clone().fromArray(s.quaternion),origin=n.position.clone().fromArray(s.origin),up=n.normal.clone();n.position.copy(n.position.clone().set(83,65,92).applyQuaternion(q).add(origin));n.orientToward(n.position.clone().set(0,5,4).applyQuaternion(q).add(origin),up);n.velocity.set(0,0,0);});await frames(page);await page.waitForTimeout(2500);await capture(page,`${body}-overview`);
 }
 await page.keyboard.press('m');await page.locator('[data-travel-target="pyre"]').click();await page.locator('[data-travel-target="miasma"]').click();await page.setViewportSize({width:390,height:844});await frames(page);await page.locator('[data-map-view="locations"]').click();await capture(page,'map-phone');
 expect(errors).toEqual([]);await writeFile(`${out}/visual-tour.json`,JSON.stringify({browser:browser.version(),errors,warnings,viewpointFixture:true},null,2));
});
