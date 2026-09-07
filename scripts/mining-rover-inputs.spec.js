import {test,expect} from '@playwright/test';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';

const sourceRoot=process.env.ROVER_SOURCE??new URL('..',import.meta.url).pathname;
const output=process.env.ROVER_INPUT_OUTPUT??'/tmp/star-agent-rover-input-review/results';
const BIN='meridian-rover-bin',WHEELBASE=2.7,STEER_LIMIT=.52;
const sourceFiles=['src/mining-rover.js','src/rover-support.js','src/rover-physics.js','src/navigation.js','src/main.js','src/nomad-cabin-controls.js','src/rover-ui.js','src/mining/rock.js','src/mining/store.js','assets/mining-rover/layout.json','public/models/mining-rover.glb'];
const sourceHashes=async()=>Object.fromEntries(await Promise.all(sourceFiles.map(async file=>[file,createHash('sha256').update(await readFile(sourceRoot+'/'+file)).digest('hex')])));
const state=page=>page.evaluate(()=>window.starAgent.state);
const wait=(page,predicate,arg=null,timeout=15000)=>page.waitForFunction(predicate,arg,{timeout,polling:50});
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const keyMap={walkForward:'KeyW',walkBackward:'KeyS',walkLeft:'KeyA',walkRight:'KeyD',forward:'KeyW',reverse:'KeyS',left:'KeyA',right:'KeyD',brake:'KeyX',aimLeft:'ArrowLeft',aimRight:'ArrowRight',up:'ArrowUp',down:'ArrowDown',mine:'KeyT'};
const touchSelector=action=>action.startsWith('walk')?`[data-cabin-key="${keyMap[action]}"]`:`[data-rover-hold="${action}"]`;

class KeyboardInput{
  constructor(page){this.page=page;this.keys=new Set();}
  async hold(actions){const next=new Set(actions.map(a=>keyMap[a]));for(const key of this.keys)if(!next.has(key))await this.page.keyboard.up(key);for(const key of next)if(!this.keys.has(key))await this.page.keyboard.down(key);this.keys=next;}
  async tap(action){await this.page.keyboard.press({seat:'KeyF',entry:'KeyF',lift:'KeyG',cargo:'KeyI',close:'KeyI'}[action]);}
  async repeatMine(){await this.page.keyboard.down('KeyT');}
  async reset(){for(const key of this.keys)await this.page.keyboard.up(key);this.keys.clear();}
}

/** Chromium touch contacts hit real, visible controls; no DOM event dispatch or
 * application action/movement setters. Stable IDs allow simultaneous steering,
 * throttle and a second-finger cargo tap while the trigger remains held. */
class TouchInput{
  constructor(page,session){this.page=page;this.session=session;this.contacts=new Map();this.serial=1;}
  async center(selector){
    const element=this.page.locator(selector);await expect(element).toBeVisible();await expect(element).toBeEnabled();
    const box=await element.boundingBox();expect(box,selector).not.toBeNull();
    const point={x:box.x+box.width/2,y:box.y+box.height/2,id:this.serial++};
    const view=this.page.viewportSize();expect(box.x,selector+' left').toBeGreaterThanOrEqual(0);expect(box.y,selector+' top').toBeGreaterThanOrEqual(0);expect(box.x+box.width,selector+' right').toBeLessThanOrEqual(view.width+.5);expect(box.y+box.height,selector+' bottom').toBeLessThanOrEqual(view.height+.5);
    expect(await element.evaluate((el,p)=>el.contains(document.elementFromPoint(p.x,p.y)),point),selector+' must receive actual touch').toBe(true);
    return point;
  }
  async event(type){await this.session.send('Input.dispatchTouchEvent',{type,touchPoints:[...this.contacts.values()]});}
  async hold(actions){
    const wanted=new Set(actions);
    for(const action of [...this.contacts.keys()])if(!wanted.has(action)){this.contacts.delete(action);await this.event('touchEnd');}
    for(const action of wanted)if(!this.contacts.has(action)){this.contacts.set(action,await this.center(touchSelector(action)));await this.event('touchStart');}
  }
  async tap(action){
    const selector={seat:'[data-cabin-interact]',entry:'[data-rover-action="entry"]',lift:'[data-rover-action="lift"]',cargo:'[data-rover-action="cargo"]',close:'#cargo-dialog .inventory-close'}[action];
    this.contacts.set('tap',await this.center(selector));await this.event('touchStart');await this.page.waitForTimeout(70);this.contacts.delete('tap');await this.event('touchEnd');
  }
  async repeatMine(){/* A held touch produces no new press after focus returns. */}
  async reset(){this.contacts.clear();await this.event('touchCancel');}
}

async function stop(page,input){await input.hold(['brake']);await wait(page,()=>Math.abs(starAgent.state.rover.speed)<.035);await input.hold([]);}
async function walk(page,input,target){
  for(let i=0;i<360;i++){
    const d=await page.evaluate(target=>{const n=starAgent.navigation,p=n.fromShipLocal(n.position.clone().fromArray(target)).sub(n.position).applyQuaternion(n.orientation.clone().invert());return {x:p.x,z:p.z,distance:Math.hypot(p.x,p.z)};},target);
    if(d.distance<.19){await input.hold([]);await page.waitForTimeout(300);return;}
    // Axis-first walking limits drift near the physical door and cargo pedestal.
    await input.hold(Math.abs(d.x)>Math.abs(d.z)?[d.x>0?'walkRight':'walkLeft']:[d.z>0?'walkBackward':'walkForward']);
    await page.waitForTimeout(60);
  }
  throw Error('Physical walking could not reach '+JSON.stringify(target)+'; '+JSON.stringify((await state(page)).shipLocal));
}

/** Digital steering tracks the desired wheel angle with short real input pulses.
 * Full-throttle pulses are speed-limited by feedback, not a runtime speed setter. */
function drivingControls(control,targetSteer,speed){
  const actions=[];
  if(control.speed<speed-.08)actions.push('forward');
  else if(control.speed>speed+.3)actions.push('brake');
  const actual=-(control.wheelSteer??0),desired=clamp(targetSteer,-1,1)*STEER_LIMIT;
  if(desired>.025&&actual<desired+.025)actions.push('right');
  if(desired<-.025&&actual>desired-.025)actions.push('left');
  return actions;
}
const shipPoint=(page,local)=>page.evaluate(local=>{const n=starAgent.navigation;return n.fromShipLocal(n.position.clone().fromArray(local)).toArray();},local);
const vehicleTarget=(page,target)=>page.evaluate(target=>{const n=starAgent.navigation,r=n.vehicle.physics.state,p=n.position.clone().fromArray(target).sub(r.position).applyQuaternion(r.quaternion.clone().invert());return {distance:Math.hypot(p.x,p.z),angle:Math.atan2(p.x,-p.z),speed:r.speed,wheelSteer:r.wheels[0].steer,blocked:r.blocked,reason:r.reason};},target);

async function driveTo(page,input,target,reach=1){
  let stalled=0;
  for(let i=0;i<1800;i++){
    const c=await vehicleTarget(page,target);
    if(c.distance<reach){await stop(page,input);return;}
    const speed=Math.min(Math.abs(c.angle)>1.1?1.9:3,Math.max(.7,(c.distance-reach)*.8));
    await input.hold(drivingControls(c,c.angle*2,speed));await page.waitForTimeout(50);
    stalled=c.blocked?stalled+1:0;
    if(stalled>45)throw Error('Rover blocked while following real-input approach: '+JSON.stringify(c));
  }
  throw Error('Digital steering did not reach the staging waypoint; '+JSON.stringify((await state(page)).rover));
}

/** Parent-authored CPU route: leave room for a wide physical turn before aiming.
 * These are requested steering goals, never applied vehicle/player positions. */
async function reachMineral(page,input){
  // Freeze the existing nearby deposit before the turn; walking/aim inspection
  // may select a different nearest field while the vehicle changes position.
  const target=(await state(page)).mining.activePosition;
  expect(target?.length,'Actual field must expose its existing target').toBe(3);
  await driveTo(page,input,await shipPoint(page,[-1.6,0,31]),1);
  await driveTo(page,input,await shipPoint(page,[-10.8,0,30]),.8);
  await settleMineralHeading(page,input,target);
  return target;
}

async function settleMineralHeading(page,input,target){
  let blocked=0;
  for(let i=0;i<200;i++){
    const c=await vehicleTarget(page,target);
    if(Math.abs(c.angle)<=.18){await stop(page,input);return;}
    // Slow forward/right or forward/left real inputs, chosen from target bearing.
    await input.hold(drivingControls(c,Math.sign(c.angle),.8));
    await page.waitForTimeout(50);
    blocked=c.blocked?blocked+1:0;
    if(blocked>12)throw Error('Heading correction blocked: '+JSON.stringify(c));
  }
  throw Error('Heading correction did not put the mineral inside the cutter margin.');
}

async function reverseToReturnStaging(page,input){
  // Five 50 ms brake samples in the CPU probe remove residual steering. A single
  // real 250 ms brake hold does the same through the normal production substeps.
  await input.hold(['brake']);await page.waitForTimeout(250);
  let blocked=0;
  for(let i=0;i<600;i++){
    const r=(await state(page)).rover;
    if(r.local[2]>=34){await stop(page,input);return;}
    await input.hold(r.speed>-.9?['reverse']:r.speed<-1.2?['brake']:[]);
    await page.waitForTimeout(50);
    blocked=r.blocked?blocked+1:0;
    if(blocked>12)throw Error('Reverse staging blocked: '+JSON.stringify(r));
  }
  throw Error('Reverse staging did not reach ship-local Z34.');
}


async function aim(page,input,target){
  for(let i=0;i<180;i++){
    const c=await page.evaluate(target=>{const n=starAgent.navigation,d=n.position.clone().fromArray(target).sub(n.position).applyQuaternion(n.orientation.clone().invert());return {x:Math.atan2(d.x,-d.z),y:Math.atan2(d.y,Math.hypot(d.x,d.z))};},target);
    if(Math.hypot(c.x,c.y)<.025){await input.hold([]);return;}
    await input.hold([...(Math.abs(c.x)>.015?[c.x>0?'aimRight':'aimLeft']:[]),...(Math.abs(c.y)>.015?[c.y>0?'up':'down']:[])]);await page.waitForTimeout(45);
  }
  throw Error('Actual mineral target remains outside the usable cutter aim arc.');
}

/** Optional complete return route shared with root's controller plan. A smooth
 * lane change avoids asking a car-like rover to spin toward a point behind it. */
async function returnToAtlas(page,input){
  await reverseToReturnStaging(page,input);
  const local=(await state(page)).rover.local,path=[];
  for(let i=0;i<=60;i++){const t=i/60;path.push([local[0]+(-1.6-local[0])*(3*t*t-2*t*t*t),0,local[2]-15*t]);}
  for(let z=path.at(-1)[2]-.5;z>5;z-=.5)path.push([-1.6,0,z]);path.push([-1.6,0,5]);
  let index=0,blocked=0;
  for(let i=0;i<2200;i++){
    const s=(await state(page)).rover,p=s.local;
    if(Math.hypot(p[0]+1.6,p[2]-5)<.32){await stop(page,input);expect((await state(page)).rover.fitsLift).toBe(true);return;}
    let best=index,distance=Infinity;
    for(let j=index;j<Math.min(path.length,index+16);j++){const d=Math.hypot(path[j][0]-p[0],path[j][2]-p[2]);if(d<distance){distance=d;best=j;}}
    index=best;let look=index;
    while(look<path.length-1&&Math.hypot(path[look][0]-p[0],path[look][2]-p[2])<2.5)look++;
    const c=await vehicleTarget(page,await shipPoint(page,path[look]));
    const steer=Math.atan(2*WHEELBASE*Math.sin(c.angle)/Math.max(1,c.distance))/STEER_LIMIT;
    const remaining=Math.hypot(p[0]+1.6,p[2]-5),speed=Math.min(1.9,Math.max(.45,remaining*.55));
    await input.hold(drivingControls(c,steer,speed));await page.waitForTimeout(50);
    blocked=c.blocked?blocked+1:0;if(blocked>45)throw Error('Return path collided: '+JSON.stringify(c));
  }
  throw Error('Digital pure-pursuit return did not park inside Atlas.');
}

test('Atlas pilot → physical rover → twin mining → ore bins → resumed play',async({page,browser},testInfo)=>{
  const phone=testInfo.project.name==='touch',dir=output+'/'+testInfo.project.name;
  await mkdir(dir,{recursive:true});
  const errors=[],warnings=[],requests=[],milestones=[],beforeHashes=await sourceHashes();
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)requests.push({status:r.status(),url:r.url()});});
  // Isolate keyboard/touch from any physical controller connected to the host.
  await page.addInitScript(()=>Object.defineProperty(navigator,'getGamepads',{value:()=>[]}));
  const input=phone?new TouchInput(page,await page.context().newCDPSession(page)):new KeyboardInput(page);
  const note=async name=>{const s=await state(page);milestones.push({name,time:new Date().toISOString(),rover:s.rover,mode:s.mode,position:s.position,shipLocal:s.shipLocal,mining:s.mining,containers:s.containers});console.log(testInfo.project.name+': '+name);};
  const shot=async name=>{await page.screenshot({path:dir+'/'+name+'.png'});};
  try{
    await page.goto('/?dev=1&intro=0&ship=atlas&start=moon&rover=1&debug=1&seed=7291');
    await wait(page,()=>window.starAgent?.state.ready&&starAgent.state.rover?.spawned&&!starAgent.state.transiting,null,90000);
    let s=await state(page);expect(s.dev,'Preview must be built with VITE_DEV_TOOLS=1').not.toBeNull();expect(s.mode).toBe('landed');expect(s.rover.fitsLift).toBe(true);expect(s.rover.error).toBeNull();
    await input.tap('seat');await wait(page,()=>starAgent.state.mode==='walk');
    await walk(page,input,[1.5,5.75,-7.7]);await walk(page,input,[1.5,5.75,5.1]);await walk(page,input,[.8,5.75,5.1]);
    expect((await state(page)).rover.near).toBe(true);await shot('01-physical-door-approach');
    await page.evaluate(()=>{window.__roverInputAccess={active:true,points:[]};function record(t){if(!__roverInputAccess.active)return;__roverInputAccess.points.push({t,p:starAgent.state.position});requestAnimationFrame(record);}requestAnimationFrame(record);});
    await input.tap('entry');await wait(page,()=>starAgent.state.rover.occupied&&!starAgent.state.rover.busy,null,25000);
    const access=await page.evaluate(()=>{__roverInputAccess.active=false;return __roverInputAccess.points;});
    const maxStep=Math.max(0,...access.slice(1).map((p,i)=>Math.hypot(...p.p.map((n,j)=>n-access[i].p[j]))));
    expect(maxStep).toBeLessThan(.3);expect((await state(page)).rover.door).toBe(0);await writeFile(dir+'/physical-access.json',JSON.stringify({maxStep,access},null,2));await note('Physical boarding');await shot('02-enclosed-cockpit');
    await input.tap('lift');await wait(page,()=>starAgent.state.lifts[0].y===0,null,12000);
    expect((await state(page)).rover.local[1]).toBeCloseTo(0,3);
    // Straight actual input clears the rear bay and all four support contacts.
    await input.hold(['forward']);await wait(page,()=>starAgent.state.rover.local[2]>18,null,20000);await stop(page,input);
    s=await state(page);expect(s.rover.aboard).toBe(false);expect(s.rover.wheels.every(w=>w.source==='terrain')).toBe(true);await note('Unloaded onto canonical terrain');await shot('03-unloaded');
    const target=await reachMineral(page,input);await aim(page,input,target);await note('Steered into mineral aim arc');
    const before=(await state(page));await input.hold(['mine']);
    await wait(page,mass=>starAgent.state.rover.beaming===2&&starAgent.state.rover.mass>mass+.02,before.rover.mass,25000);
    await shot('04-real-twin-mining');await page.waitForTimeout(10000);await input.hold([]);
    s=await state(page);expect(s.rover.mass).toBeGreaterThan(before.rover.mass+.02);expect(s.rover.charge).toBeGreaterThan(.7);expect(s.rover.beamPoses).toHaveLength(2);
    expect(s.containers.containers.find(c=>c.id==='pack').items).toEqual(before.containers.containers.find(c=>c.id==='pack').items);expect(s.containers.saved).toBe(true);await note('Actual ore saved in rover bins');

    // Cargo opened while mining is held must stop the beams and leave them off
    // after closing, including a repeated keyboard-down or an existing finger.
    await input.hold(['mine']);await wait(page,()=>starAgent.state.rover.beaming===2);
    await input.tap('cargo');await expect(page.locator('#cargo-dialog')).toBeVisible();await expect(page.locator('#cargo-dialog')).toContainText('Rover mineral bin');
    await expect(page.getByRole('button',{name:'Atlas cargo',exact:true})).toBeVisible();expect((await state(page)).containers.target).toBe(BIN);await wait(page,()=>starAgent.state.rover.beaming===0);await shot('05-ore-bin-dialog');
    await expect(page.locator(`[data-from="${BIN}"][data-item]`).first()).toBeVisible();
    await input.tap('close');await expect(page.locator('#cargo-dialog')).not.toBeVisible();await input.repeatMine();await page.waitForTimeout(400);expect((await state(page)).rover.beaming).toBe(0);
    await input.reset();await input.hold(['mine']);await wait(page,()=>starAgent.state.rover.beaming===2);await note('Fresh press required after cargo');

    // Real browser tab focus/visibility transition. No synthetic blur event and
    // no app-state mutation; all waits poll state even while rendering pauses.
    const blank=await page.context().newPage();
    try{await blank.goto('about:blank');await blank.bringToFront();await wait(page,()=>!starAgent.state.focused,null,6000);await wait(page,()=>!starAgent.navigation.vehicle.power.state.active,null,6000);}
    finally{await page.bringToFront();await blank.close();}
    await wait(page,()=>starAgent.state.focused,null,6000);await input.repeatMine();await page.waitForTimeout(400);expect((await state(page)).rover.beaming).toBe(0);
    await input.reset();await input.hold(['mine']);await wait(page,()=>starAgent.state.rover.beaming===2);await input.hold([]);await wait(page,()=>starAgent.state.rover.beaming===0);await note('Held input suppressed across real tab focus');
    expect((await state(page)).enabled).toBe(true);expect((await state(page)).rover.occupied).toBe(true);await shot('06-resumed-play');

    // Root's controller case owns the full loading route. Enable this extension
    // to validate the same smooth lane change with digital/touch controls too.
    if(process.env.ROVER_INPUT_RETURN==='1'){
      await returnToAtlas(page,input);await input.tap('lift');await wait(page,()=>starAgent.state.lifts[0].y===4,null,12000);await shot('07-reloaded-atlas');
      await input.tap('entry');await wait(page,()=>!starAgent.state.rover.occupied&&!starAgent.state.rover.busy,null,25000);await note('Returned to Atlas cargo floor');
      const p=(await state(page)).shipLocal;await walk(page,input,[p[0],5.75,-1]);await walk(page,input,[0,5.75,-1]);await walk(page,input,[0,5.75,-9.3]);await input.tap('seat');expect((await state(page)).mode).toBe('landed');await shot('08-atlas-pilot-return');
    }
    expect(errors).toEqual([]);expect(requests).toEqual([]);
  }finally{
    await input.reset().catch(()=>{});await shot('last-frame').catch(()=>{});
    const final=await state(page).catch(()=>null),afterHashes=await sourceHashes();
    const gpu=await page.evaluate(()=>{const g=document.querySelector('#viewport')?.getContext('webgl2'),e=g?.getExtension('WEBGL_debug_renderer_info');return g?{renderer:g.getParameter(e?e.UNMASKED_RENDERER_WEBGL:g.RENDERER),dpr:devicePixelRatio,renderBuffer:[g.drawingBufferWidth,g.drawingBufferHeight]}:null;}).catch(()=>null);
    await writeFile(dir+'/journey.json',JSON.stringify({input:phone?'Injected Chromium touchscreen on actual native controls; no physical phone tested':'Real Playwright keyboard input; no debug movement/action skips',browser:browser.version(),gpu,viewport:page.viewportSize(),beforeHashes,afterHashes,sourcesStable:JSON.stringify(beforeHashes)===JSON.stringify(afterHashes),errors,warnings,requests,milestones,final,returnExtension:process.env.ROVER_INPUT_RETURN==='1',performanceClaim:false},null,2));
  }
});
