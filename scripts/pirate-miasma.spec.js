import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {SceneryClearance} from '../src/scenery-clearance.js';
import {pirateLayout} from '../src/pirate-compound/layout.js';
import {createSettlementLayouts} from '../src/settlements/layout.js';
import {MIASMA_POSITION} from '../src/miasma-world.js';
import {FLORA_SPECIES,floraCanopyRadius} from '../src/miasma-flora.js';
import {out,frames,setup,capture,graphics,pirateControllerJourney} from './pirate-fixtures.js';
async function sceneryReceipt(page){
 const scene=await page.evaluate(center=>{const scene=window.starAgent.navigation.station.scene,origin=window.starAgent.navigation.position.clone().fromArray(window.starAgent.state.camera.position),read=name=>{const group=scene.getObjectByName(name),instances=[];if(group?.visible)group.traverse(mesh=>{if(!mesh.isInstancedMesh)return;const m=mesh.matrixWorld.clone(),p=origin.clone(),scale=origin.clone();for(let i=0;i<mesh.count;i++){mesh.getMatrixAt(i,m);m.premultiply(mesh.matrixWorld);p.setFromMatrixPosition(m).add(origin).sub(origin.clone().fromArray(center));scale.setFromMatrixScale(m);instances.push({name:mesh.name,point:p.toArray(),size:scale.x});}});return instances;};return {flora:read('Miasma alien flora'),fragments:read('Miasma mineral fragments')};},MIASMA_POSITION);
 const veil=pirateLayout('pirate-veil'),clearance=new SceneryClearance(MIASMA_POSITION);clearance.update([...createSettlementLayouts().map(s=>s.claim),veil.claim,veil.outerClaim].filter(c=>c.body==='miasma'));
 const overlaps=scene.flora.filter(p=>clearance.excludes(new Vector3(...p.point),floraCanopyRadius(FLORA_SPECIES.indexOf(p.name),p.size)-.001)),fragmentOverlaps=scene.fragments.filter(p=>clearance.excludes(new Vector3(...p.point),.399));expect(overlaps).toEqual([]);expect(fragmentOverlaps).toEqual([]);expect(scene.flora.length).toBeGreaterThan(0);return {floraInstances:scene.flora.length,fragmentInstances:scene.fragments.length,overlaps,fragmentOverlaps,source:'Actual renderer instance transforms, double camera origin restored; compared with authored construction footprints.'};
}

test.afterEach(async({page},info)=>{if(info.status!==info.expectedStatus){try{await capture(page,'failure-'+info.title.replace(/[^a-z0-9]+/gi,'-'));}catch{}}});

test('Miasma controller lands, walks the ground route, isolates, traverses both doors, trades and returns',({page,browser})=>pirateControllerJourney({page,browser},'pirate-veil'));

test.describe('native phone and keyboard',()=>{
 test.use({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 test('Hush actual airlock, service and trade handlers fit a native phone',async({page,browser})=>{
  const {errors,warnings}=await setup(page,'pirate-hush');expect(await page.evaluate(()=>matchMedia('(pointer:coarse)').matches&&navigator.maxTouchPoints>0)).toBe(true);
  // Explicit nearby presentation poses; full physical traversal is the separate
  // controller case. Each opening, closing and market result uses real input.
  const pose=async(x,z,reverse=false)=>{await page.evaluate(({x,z,reverse})=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin);n.mode='walk';n.insideShip=false;n.cabinFlight=false;n.enabled=true;n.position.set(x,s.deck+n.layout.eyeHeight,z).applyQuaternion(q).add(o);n.orientation.copy(q);if(reverse)n.orientation.multiply(q.clone().setFromAxisAngle(n.position.clone().set(0,1,0),Math.PI));n.velocity.set(0,0,0);n.shipPosition=n.position.clone().fromArray(s.pad);n.shipOrientation.copy(q);n.shipVelocity.set(0,0,0);},{x,z,reverse});await frames(page);};
  await pose(-16,-5.5);await page.keyboard.press('f');await expect(page.locator('#pirate-service')).toBeVisible();await capture(page,'hush-service-keyboard');await page.keyboard.press('Escape');await expect(page.locator('#pirate-service')).not.toBeVisible();
  await frames(page);await page.locator('.pirate-service-action:visible').tap();await page.locator('#pirate-service [data-isolate]').tap();expect(await page.evaluate(()=>window.starAgent.state.pirateCompound.unlocked)).toBe(true);await capture(page,'hush-service-phone');await page.locator('#pirate-service [data-close]').tap();
  const doors=[],targets=[];
  async function clearTargets(){const state=await page.evaluate(()=>{const action=document.querySelector('.pirate-service-action:not([hidden])'),a=action.getBoundingClientRect(),controls=[...document.querySelectorAll('#nomad-cabin-controls button')].filter(b=>b.getClientRects().length);return {action:a.toJSON(),controls:controls.map(b=>{const r=b.getBoundingClientRect();return {label:b.textContent,rect:r.toJSON(),overlap:Math.min(a.right,r.right)>Math.max(a.left,r.left)&&Math.min(a.bottom,r.bottom)>Math.max(a.top,r.top),hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)===b};})};});expect(state.action.width).toBeGreaterThanOrEqual(44);expect(state.action.height).toBeGreaterThanOrEqual(44);expect(state.controls.every(b=>!b.overlap&&b.hit)).toBe(true);targets.push(state);}

  async function open(side,name){const action=page.locator('.pirate-service-action:visible');await expect(action).toContainText(`Open ${side} airlock door`);await clearTargets();await action.tap();await page.waitForFunction(side=>{const ds=window.starAgent.state.pirateCompound.airlock.doors;return ds.find(d=>d.side===side).fraction>.98&&ds.find(d=>d.side!==side).fraction<.001;},side);doors.push(await page.evaluate(()=>window.starAgent.state.pirateCompound.airlock));await capture(page,name);}
  await pose(6,-1.5);await open('outer','hush-outer-airlock-phone');await pose(6,-9.5);await open('inner','hush-inner-airlock-phone');
  await pose(6,-19.8);await expect(page.locator('[data-cabin-interact]')).toHaveText('Open trade');await page.locator('[data-cabin-interact]').tap();await expect(page.locator('#trading-dialog')).toBeVisible();const before=await page.evaluate(()=>window.starAgent.state.trading.markets['pirate-hush'].stock.ice);await page.locator('[data-controller-key="purchase-ice"]').tap();await expect(page.locator('.trade-feedback')).toContainText('Loaded 1 SBU');expect(await page.evaluate(()=>window.starAgent.state.trading.markets['pirate-hush'].stock.ice)).toBe(before-1);await page.locator('#trading-dialog [data-controller-key="view-cargo"]').tap();await capture(page,'hush-trade-cargo-phone');expect(await page.locator('#trading-dialog').evaluate(d=>d.scrollWidth<=d.clientWidth+2)).toBe(true);await page.locator('#trading-dialog .gameplay-resume').tap();await page.waitForFunction(()=>window.starAgent.state.enabled);
  await pose(6,-14.5,true);await open('inner','hush-exit-inner-phone');await pose(6,-6.5,true);await open('outer','hush-exit-outer-phone');await pose(6,-1.5,true);await capture(page,'hush-return-phone');
  expect(errors).toEqual([]);await writeFile(`${out}/hush-native-phone.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,doors,targets,controlledPose:true,physicalController:false},null,2));
 });
});

test('Miasma weaker turret and both Crimson vacuum habitats render',async({page,browser})=>{
 const receipts=[];
 for(const site of ['pirate-veil','pirate-hush']){
  const {errors,warnings}=await setup(page,site);let balance=null;
  if(site==='pirate-veil'){
   // Controlled flight pose tests the new body's actual targeting/damage path.
   await page.evaluate(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin);n.position.set(0,s.deck+40,100).applyQuaternion(q).add(o);n.velocity.set(0,0,0);n.orientToward(n.position.clone().fromArray(s.tower),n.normal);});
   await page.waitForFunction(()=>window.starAgent.state.pirateCompound.phase==='charge',undefined,{timeout:25000});await capture(page,'veil-charging-tower');const before=await page.evaluate(()=>window.starAgent.state.combat.player);await page.waitForFunction(()=>window.starAgent.state.pirateCompound.shots>=3,undefined,{timeout:15000});const after=await page.evaluate(()=>window.starAgent.state.combat.player);expect(after.hull).toBe(before.hull);expect(after.shield).toBeGreaterThan(0);expect(after.shield).toBeLessThan(before.shield);await capture(page,'veil-survived-burst');
   await page.evaluate(()=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site;n.position.set(0,s.deck+40,350).applyQuaternion(n.orientation.clone().fromArray(s.quaternion)).add(n.position.clone().fromArray(s.origin));n.velocity.set(0,0,0);});const shots=await page.evaluate(()=>window.starAgent.state.pirateCompound.shots);await page.waitForTimeout(2500);expect(await page.evaluate(()=>window.starAgent.state.pirateCompound.shots)).toBe(shots);balance={before,after,retreatShots:shots};
  }
  for(const [name,eye,look] of [['overview',[48,28,61],[0,5,-10]],['crimson-work-yard',[-2,3,24],[-8,1,8]],['airlock-approach',[12,2,7],[6,1.5,-5]],['sealed-exchange',[11,1.8,-17],[6,1.5,-27]],['outer-apron',[34,20,296],[0,1,260]]]){
   await page.evaluate(({eye,look})=>{const n=window.starAgent.navigation,s=window.starAgent.state.pirateCompound.site,q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin),world=a=>n.position.clone().fromArray([a[0],s.deck+a[1],a[2]]).applyQuaternion(q).add(o);n.mode='walk';n.enabled=false;n.insideShip=false;n.position.copy(world(eye));n.orientToward(world(look),n.normal);n.velocity.set(0,0,0);},{eye,look});
   await page.waitForFunction(()=>{const s=window.starAgent.state;return s.pirateCompound.site.body==='miasma'?s.miasma.ready&&s.miasma.pending===0&&s.miasma.flora.loaded:s.moon.pending===0&&s.moon.effects.settled;},undefined,{timeout:60000});await frames(page);await page.addStyleTag({content:'body > :not(canvas) { visibility: hidden !important; }'});await capture(page,`${site.slice(7)}-${name}`);if(site==='pirate-veil')await writeFile(`${out}/${site.slice(7)}-${name}-scenery.json`,JSON.stringify(await sceneryReceipt(page),null,2));
  }
  const performance=await page.evaluate(async()=>{const samples=[],start=performance.now();let previous=start;while(performance.now()-start<3000){await new Promise(r=>requestAnimationFrame(r));const now=performance.now(),s=window.starAgent.state;samples.push({ms:now-previous,draws:s.drawCalls,triangles:s.triangles,scale:s.renderScale});previous=now;}const times=samples.map(s=>s.ms).sort((a,b)=>a-b);return {durationMs:performance.now()-start,samples:samples.length,medianMs:times[Math.floor(times.length*.5)],p95Ms:times[Math.floor(times.length*.95)],first:samples[0],last:samples.at(-1),countsIncludeShadowPasses:true};});
  receipts.push({site,browser:browser.version(),graphics:await graphics(page),errors,warnings,balance,performance,fixture:true,state:await page.evaluate(()=>window.starAgent.state.pirateCompound)});await writeFile(`${out}/vacuum-habitats.json`,JSON.stringify(receipts,null,2));expect(errors).toEqual([]);
 }
 await writeFile(`${out}/vacuum-habitats.json`,JSON.stringify(receipts,null,2));
});


test('Verdigris ordinary compound keeps canonical exterior scenery clear of actual construction',async({page,browser})=>{
 const {errors,warnings}=await setup(page,'settlement-miasma'),views=[];await page.addStyleTag({content:'body > :not(canvas){visibility:hidden!important}'});
 for(const [name,eye,look] of [['approach',[70,42,92],[0,2,12]],['entrance',[8,2,-5],[2,1.5,-16]]]){
  await page.evaluate(({eye,look})=>{const n=window.starAgent.navigation,s=window.starAgent.state.settlements.sites.find(s=>s.body==='miasma'),q=n.orientation.clone().fromArray(s.quaternion),o=n.position.clone().fromArray(s.origin),deck=n.position.clone().fromArray(s.pad).sub(o).applyQuaternion(q.clone().invert()).y,world=a=>n.position.clone().fromArray(a).add(n.position.clone().set(0,deck,0)).applyQuaternion(q).add(o);n.mode='walk';n.insideShip=false;n.enabled=false;n.position.copy(world(eye));n.orientToward(world(look),n.normal);n.velocity.set(0,0,0);},{eye,look});
  await page.waitForFunction(()=>window.starAgent.state.miasma.pending===0&&window.starAgent.state.miasma.morphing===0&&window.starAgent.state.miasma.flora.loaded,undefined,{timeout:60000});await frames(page);await capture(page,`verdigris-${name}`);views.push({name,scenery:await sceneryReceipt(page)});
 }
 await writeFile(`${out}/verdigris-art.json`,JSON.stringify({browser:browser.version(),graphics:await graphics(page),errors,warnings,views,fixture:'Same controlled art cameras as parent corporate baseline; no traversal claim.'},null,2));expect(errors).toEqual([]);
});
