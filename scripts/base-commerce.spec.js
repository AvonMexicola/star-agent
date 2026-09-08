import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {baseFixture} from '../tests/helpers/base-commerce.js';
const out='/tmp/star-agent-base-commerce-evidence';
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
async function press(page,i,down){await page.evaluate(({i,down})=>window.tradePad.buttons[i]={pressed:down,value:Number(down)},{i,down});await frames(page);}
async function tap(page,i){await press(page,i,true);await press(page,i,false);}
async function choose(page,key){for(let i=0;i<90;i++){if(await page.evaluate(k=>document.activeElement?.dataset.controllerKey===k,key)){await tap(page,0);return;}await tap(page,13);}throw Error(`Controller action missing: ${key}`);}
async function aim(page,target){
 for(let i=0;i<130;i++){const errors=await page.evaluate(target=>{const n=window.starAgent.navigation,d=n.position.clone().fromArray(target).sub(n.position).applyQuaternion(n.orientation.clone().invert());return [Math.atan2(d.x,-d.z),Math.atan2(d.y,Math.hypot(d.x,d.z))];},target);
 if(errors.every(v=>Math.abs(v)<.025)){await page.evaluate(()=>window.tradePad.axes.fill(0));return;}
 await page.evaluate(e=>window.tradePad.axes=[0,0,...[e[0],-e[1]].map(v=>Math.sign(v)*Math.min(.8,.17+Math.abs(v)*1.6))],errors);await page.waitForTimeout(70);
 }throw Error('Controller aiming did not converge');
}
async function walk(page,target){
 await page.evaluate(target=>{window.tradeWalkDone=false;window.tradeWalk=setInterval(()=>{const n=window.starAgent.navigation,d=n.position.clone().fromArray(target).sub(n.position).projectOnPlane(n.normal);if(d.length()<.25){window.tradePad.axes.fill(0);window.tradeWalkDone=true;clearInterval(window.tradeWalk);return;}d.applyQuaternion(n.orientation.clone().invert());window.tradePad.axes=[Math.max(-1,Math.min(1,d.x)),Math.max(-1,Math.min(1,d.z)),0,0];},30);},target);
 try{await page.waitForFunction(()=>window.tradeWalkDone,null,{timeout:30000});}finally{await page.evaluate(()=>{clearInterval(window.tradeWalk);window.tradePad.axes.fill(0);});}await frames(page);
}
const shipPoint=(page,p)=>page.evaluate(p=>window.starAgent.navigation.fromShipLocal(window.starAgent.navigation.position.clone().fromArray(p)).toArray(),p);
async function setup(page,entries=[]){
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await mkdir(out,{recursive:true});
 await page.addInitScript(entries=>{window.__starAgentCargoTestSeed=entries;window.tradePad={id:'Base trade standard controller',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>window.tradePad.connected?[window.tradePad]:[];},entries);
 return errors;
}
async function leaveShip(page){
 await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');await walk(page,await shipPoint(page,[0,2.75,3]));await aim(page,await shipPoint(page,[0,2.75,7]));await tap(page,2);await page.waitForFunction(()=>window.starAgent.state.doorProgress>.98);await walk(page,await shipPoint(page,[0,1.75,13.5]));
}
async function fit(page){const sizes=await page.locator('#trading-dialog').evaluate(d=>{const r=d.getBoundingClientRect();return {width:[d.clientWidth,d.scrollWidth],buttons:[...d.querySelectorAll('button')].filter(b=>b.getClientRects().length).filter(b=>{const rect=b.getBoundingClientRect();return rect.left<r.left-2||rect.right>r.right+2;}).map(b=>b.textContent)};});expect(sizes.buttons).toEqual([]);expect(sizes.width[1]).toBeLessThanOrEqual(sizes.width[0]+2);}
test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){await mkdir(out,{recursive:true});await page.screenshot({path:`${out}/failure.png`});await writeFile(`${out}/failure.json`,JSON.stringify(await page.evaluate(()=>window.starAgent?.state),null,2));}});

test('controller lands, walks to constructed terminal, selects part of local stock and advertises it',async({page,browser})=>{
 const f=baseFixture();f.store.write(f.store.withItems(f.store.state,'build-crate-5',{...f.store.container('build-crate-5').items,copper:80}));
 const raw=f.disk.getItem('star-agent.selene-mining.v1');
 const errors=await setup(page,[['star-agent.selene-mining.v1',raw]]);await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto('/?dev=1&ship=nomad&start=moon&intro=0&debug&seed=7291&cargo-test=1');
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&window.starAgent.state.controller.armed&&!window.starAgent.state.transiting,null,{timeout:120000});
 await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:30000});await leaveShip(page);
 const approach=f.build.toWorld(new Vector3(14,2.25,14),f.claim).toArray(),terminal=f.build.toWorld(new Vector3(14,1.65,12),f.claim).toArray();
 await walk(page,approach);await aim(page,terminal);await page.screenshot({path:`${out}/physical-terminal.png`});await tap(page,2);await expect(page.locator('#build-dialog')).toBeVisible();
 await choose(page,'base-trade-open');await expect(page.locator('#trading-dialog')).toBeVisible();await choose(page,'base-register-build-claim-1');
 await choose(page,'base-source');await choose(page,'next-page');await expect(page.locator('.base-stock-row')).toContainText('Copper ore');
 await choose(page,'size-2');await choose(page,'base-offer-add');await choose(page,'size-1');await choose(page,'base-offer-add');await choose(page,'base-price-5');await choose(page,'base-public');
 await expect(page.locator('.base-stock-row')).toContainText('For sale: 3 SBU (48 kg)');await expect(page.locator('.base-stock-row')).toContainText('Kept: 32.0 kg');await expect(page.locator('.base-stock-row')).toContainText('53 CR');
 for(const size of [{width:1440,height:900},{width:390,height:844}]){await page.setViewportSize(size);await frames(page);await fit(page);await page.screenshot({path:`${out}/owner-stock-${size.width}.png`});}
 await press(page,7,true);await tap(page,1);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await press(page,7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await press(page,7,true);await page.evaluate(()=>window.tradePad.connected=false);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await page.evaluate(()=>window.tradePad.connected=true);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);await press(page,7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  await tap(page,9);await choose(page,'tab-map');await expect(page.locator('#system-map')).toBeVisible();
 // Marker data is read-only evidence; selection uses the normal controller list.
 await choose(page,'map-view-signals');const id=await page.evaluate(()=>window.starAgent.state.trading.terminals.find(t=>t.base).id);for(let i=0;i<20&&!await page.locator(`[data-controller-key="map-signal-trade-${id}"]`).isVisible();i++)await choose(page,'nav-page-next');await choose(page,`map-signal-trade-${id}`);await expect(page.locator('#map-target-kind')).toContainText('Copper ore');await page.screenshot({path:`${out}/base-map.png`});await tap(page,1);
 const state=await page.evaluate(()=>window.starAgent.state);expect(state.trading.terminals.find(t=>t.base).base.storage['build-crate-5'].items.copper).toBe(80);expect(errors).toEqual([]);
 await writeFile(`${out}/seller.json`,JSON.stringify({browser:browser.version(),physicalController:false,fixture:'Existing constructed base and mined stock seeded before startup; actual controller landing, physical terminal access, reservation, pricing, beacon and return. No pose mutation.',state,errors},null,2));f.build.dispose();
});

test('controller discovers a shared base, lands and purchases real cargo while the seller is offline',async({page,context,browser})=>{
 const {createWorld}=await import('../server/world.js'),{createRoom}=await import('../server/room.js'),{createMemoryStore}=await import('../server/database.js'),{createServer}=await import('../server/index.js');
 const {emptyCommerce,ensureAccount,commerceCommand}=await import('../src/trading/model.js'),{registerBase}=await import('../src/trading/base-site.js');
 const fixture=baseFixture(),store=createMemoryStore(),seller=await store.createAccount({email:'seller@example.test',callsign:'Ore_Seller',passwordHash:'test-only'});
 let ledger=emptyCommerce();ensureAccount(ledger,seller.id);const registration=registerBase(ledger,seller.id,{claim:fixture.claim,terminalPiece:'build-piece-4'},{nav:fixture.nav,shared:true});ledger=registration.state;const id=registration.terminal;
 // Existing, previously deposited server stock is the starting fixture. The room
 // suite separately exercises commissioning and physical docked cargo deposits.
 ledger.terminals[id].base.storage['build-crate-5'].items.copper=32;
 ledger=commerceCommand(ledger,seller.id,{op:'base-offer',commandId:'fixture-offer',revision:ledger.revision,terminal:id,source:'build-crate-5',resource:'copper',quantity:1,price:53},{terminal:()=>true}).state;
 ledger.terminals[id].base.public=true;await store.transactCommerce(()=>({state:ledger}));
 const world=await createWorld(),makeNavigation=world.createNavigation;
 world.createNavigation=(...args)=>{const n=makeNavigation(...args);n.position.copy(fixture.build.toWorld(new Vector3(0,180,0),fixture.claim));n.orientation.fromArray(fixture.claim.quaternion);n.shipOrientation.copy(n.orientation);n.mode='flight';n.insideShip=false;n.dockedAtStation=false;n.cabinFlight=false;n.stationLift=false;n.shipPosition=null;n.shipVelocity.set(0,0,0);n.velocity.set(0,0,0);n.travel=null;n.powered=true;return n;};
 const room=createRoom({store,world}),app=await createServer({store,room,publicOrigin:'http://127.0.0.1:5610'});await app.listen(8610);
 try{
  const response=await context.request.post('/api/auth/register',{headers:{Origin:'http://127.0.0.1:5610'},data:{email:'buyer@example.test',callsign:'Ore_Buyer',password:'base commerce test password'}});expect(response.status()).toBe(201);const buyer=(await response.json()).account;
  const errors=await setup(page);await page.goto('/?debug&intro=0');await page.waitForFunction(()=>window.starAgent?.state.ready,null,{timeout:120000});
  if(await page.locator('#dev-launcher').isVisible()){await choose(page,'tab-comms');await choose(page,'comms-flight');await choose(page,'comms-account');}
  await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();await choose(page,'join-multiplayer');await page.waitForFunction(()=>window.starAgent.state.multiplayer.connected);await tap(page,1);await page.waitForFunction(()=>window.starAgent.state.controller.armed&&window.starAgent.state.enabled);
  await tap(page,9);await choose(page,'tab-map');await choose(page,'map-view-signals');for(let i=0;i<20&&!await page.locator(`[data-controller-key="map-signal-trade-${id}"]`).isVisible();i++)await choose(page,'nav-page-next');await choose(page,`map-signal-trade-${id}`);await expect(page.locator('#map-target-kind')).toContainText('Copper ore');await page.screenshot({path:`${out}/buyer-map.png`});await tap(page,1);
  await tap(page,3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',null,{timeout:45000});await leaveShip(page);
  await walk(page,fixture.build.toWorld(new Vector3(14,2.25,14),fixture.claim).toArray());await aim(page,fixture.build.toWorld(new Vector3(14,1.65,12),fixture.claim).toArray());await tap(page,2);await expect(page.locator('#trading-dialog')).toBeVisible();
  await choose(page,'purchase-copper');await expect.poll(async()=>((await store.loadCommerce()).ships[`${buyer.id}:nomad`].crates.length)).toBe(1);
  await choose(page,'view-cargo');await expect(page.locator('#trading-dialog')).toContainText('Copper ore');await page.screenshot({path:`${out}/buyer-cargo.png`});await tap(page,1);
  const saved=await store.loadCommerce();expect(saved.terminals[id].stock.copper).toBe(0);expect(saved.terminals[id].base.storage['build-crate-5'].items.copper).toBe(16);expect(saved.accounts[seller.id].credits).toBe(1053);expect(saved.accounts[buyer.id].credits).toBe(1447);expect(errors).toEqual([]);
  await writeFile(`${out}/buyer.json`,JSON.stringify({browser:browser.version(),physicalController:false,fixture:'Existing server base and stock; initial spawn 180 m above its pad. Actual controller map selection, landing, cabin exit, terminal access, purchase, manifest and return. No pose mutation after join.',saved,errors},null,2));
 }finally{await app.close();fixture.build.dispose();}
});
