import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';

const out='/tmp/star-agent-elevator-qa';
const state=page=>page.evaluate(()=>starAgent.state);
const frames=page=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(requestAnimationFrame);});
async function press(page,index){
  await page.evaluate(i=>elevatorPad.buttons[i]={pressed:true,value:1},index);await frames(page);
  await page.evaluate(i=>elevatorPad.buttons[i]={pressed:false,value:0},index);await frames(page);
}
async function start(page,controller){
  await page.addInitScript(connected=>{
    window.elevatorPad={id:'Elevator standard controller',index:0,connected,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>elevatorPad.connected?[elevatorPad]:[]});
  },controller);
  await page.goto('/?debug=1&dev=1&ship=nomad&start=hangar&intro=0&seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.navigation.enabled&&starAgent.state.mode==='landed',null,{timeout:90000});
  await frames(page);
}
async function walk(page,x,z,controller,ship=false){
  let held=null,last;
  const keyUp=async key=>page.elevatorTouch?page.elevatorTouch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}):page.keyboard.up(key);
  const keyDown=async key=>{
    if(!page.elevatorTouch)return page.keyboard.down(key);
    const b=await page.locator(`[data-cabin-key="${key}"]`).boundingBox();expect(b).toBeTruthy();
    return page.elevatorTouch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:b.x+b.width/2,y:b.y+b.height/2,id:1,radiusX:5,radiusY:5,force:1}]});
  };
  try{
    for(let i=0;i<650;i++){
      const c=await page.evaluate(({x,z,ship})=>{
        const n=starAgent.navigation,f=n.station.frame,p=ship?n.toShipLocal():f.toLocal(n.position,n.position.clone());
        const target=p.clone().set(x,p.y,z),world=ship?n.fromShipLocal(target):f.toWorld(target,target.clone());
        const d=world.sub(n.position).applyQuaternion(n.orientation.clone().invert());
        return {local:p.toArray(),dx:d.x,dz:d.z,distance:Math.hypot(d.x,d.z),mode:n.mode,inside:n.insideShip};
      },{x,z,ship});last=c;
      if(c.distance<.16)return;
      if(controller){const s=Math.min(.8,Math.max(.28,c.distance*.7));await page.evaluate(a=>elevatorPad.axes=a,[c.dx/c.distance*s,c.dz/c.distance*s,0,0]);}
      else{
        const key=Math.abs(c.dx)>Math.abs(c.dz)?c.dx>0?'KeyD':'KeyA':c.dz>0?'KeyS':'KeyW';
        // Walking retains momentum after release. Settle, then take short real
        // input steps near controls instead of overshooting into their housing.
        if(c.distance<.85){
          if(held){await keyUp(held);held=null;}
          else{await keyDown(key);await page.waitForTimeout(35);await keyUp(key);}
          await page.waitForTimeout(200);continue;
        }
        if(key!==held){if(held)await keyUp(held);await keyDown(key);held=key;}
      }
      await page.waitForTimeout(55);
    }
    throw Error('Physical walking blocked '+JSON.stringify({target:[x,z],ship,last}));
  }finally{
    if(controller)await page.evaluate(()=>elevatorPad.axes=[0,0,0,0]);
    else if(held)await keyUp(held);
    await page.waitForTimeout(180);await frames(page);
  }
}
async function choose(page,controller,key){
  const target=page.locator(`[data-controller-key="${key}"]`);await expect(target).toBeEnabled();
  if(!controller){if(page.elevatorTouch)await target.tap();else await target.click();return;}
  for(let i=0;i<40;i++){
    if(await target.evaluate(e=>document.activeElement===e)){await press(page,0);return;}
    await press(page,13);
  }
  throw Error('Controller cannot reach '+key);
}

async function lookAt(page,x,z,controller){
  // Use the actual aim inputs; orientation is only read for steering feedback.
  for(let i=0;i<160;i++){
    const yaw=await page.evaluate(({x,z})=>{const n=starAgent.navigation,p=n.station.toLocal(n.position,n.position.clone());
      const d=n.station.toWorld(p.set(x,p.y,z),p.clone()).sub(n.position).applyQuaternion(n.orientation.clone().invert());return Math.atan2(-d.x,-d.z);},{x,z});
    if(Math.abs(yaw)<.025)break;
    if(controller){await page.evaluate(v=>elevatorPad.axes=[0,0,v,0],-Math.sign(yaw)*Math.min(.65,Math.max(.22,Math.abs(yaw))));await page.waitForTimeout(50);}
    else{const key=yaw>0?'ArrowLeft':'ArrowRight';await page.keyboard.down(key);await page.waitForTimeout(40);await page.keyboard.up(key);}
  }
  if(controller)await page.evaluate(()=>elevatorPad.axes=[0,0,0,0]);
  await frames(page);
}

test('matched hangar entrance before and after the vestibule correction',async({page})=>{
  const inspect=async name=>{
    await start(page,false);
    // Fixed poses are only for matched visual evidence; journeys below use input.
    await page.evaluate(()=>{const n=starAgent.navigation,s=n.station,p=n.position.clone().set(5.6,-6.25,17.3);
      n.mode='walk';n.insideShip=false;s.toWorld(p,n.position);n.orientToward(s.toWorld(p.clone().set(0,-6.4,23),p.clone()),s.up);});
    await page.waitForTimeout(1000);await page.screenshot({path:`${out}/${name}.png`});
  };
  const baseline=execFileSync('git',['show','c766544b5c9beb98ec3c66b50595e4c974b461f3:public/models/station.glb'],{cwd:new URL('..',import.meta.url),maxBuffer:8e6});
  await page.route('**/models/station.glb*',route=>route.fulfill({body:baseline,contentType:'model/gltf-binary'}));
  await inspect('before');await page.unroute('**/models/station.glb*');await inspect('after');
});

async function journey({page,browser},mode){
  const controller=mode==='controller';
  if(mode==='touch')page.elevatorTouch=await page.context().newCDPSession(page);
  const errors=[],warnings=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  const interact=()=>controller?press(page,2):page.elevatorTouch?page.locator('[data-cabin-interact]').tap():page.keyboard.press('KeyF');
  await start(page,controller);
  const parked=await page.evaluate(()=>starAgent.navigation.shipPosition.toArray());
  const inventory=(await state(page)).inventory;
  await interact();await page.waitForFunction(()=>starAgent.state.mode==='walk');
  await walk(page,0,3.25,controller,true);await interact();
  await page.waitForFunction(()=>starAgent.state.doorProgress===1);
  await walk(page,0,8,controller,true);await page.waitForFunction(()=>!starAgent.navigation.insideShip);
  const z=(await state(page)).station.local[2];
  await walk(page,8,z,controller);await walk(page,8,19,controller);await walk(page,2.65,19,controller);
  if(mode!=='touch')await lookAt(page,2.65,22.3,controller);
  await walk(page,2.65,21,controller);
  expect((await state(page)).interaction).toMatch(/CALL ELEVATOR/);
  await interact();await page.waitForFunction(()=>starAgent.state.station.elevator===1);
  await page.screenshot({path:`${out}/${mode}-panel-open.png`});
  await walk(page,2.65,20.3,controller);await walk(page,0,20.3,controller);await walk(page,0,24,controller);
  await interact();await expect(page.locator('#station-elevator-dialog')).toBeVisible();
  if(controller){
    // Held interact through the native destination dialog must not replay.
    await page.evaluate(()=>elevatorPad.buttons[2]={pressed:true,value:1});await frames(page);
  }
  await choose(page,controller,'elevator-hub');
  await page.waitForFunction(()=>starAgent.state.station.location==='hub'&&starAgent.navigation.enabled&&starAgent.state.station.elevator===1);
  if(controller){
    expect((await state(page)).controller.armed).toBe(false);
    await expect(page.locator('#station-elevator-dialog')).not.toBeVisible();
    await page.evaluate(()=>elevatorPad.buttons[2]={pressed:false,value:0});await frames(page);
    await page.waitForFunction(()=>starAgent.state.controller.armed);
  }
  await walk(page,0,12,controller);await walk(page,2.65,12,controller);
  if(mode!=='touch')await lookAt(page,0,14.3,controller);
  await page.screenshot({path:`${out}/${mode}-lobby.png`});
  if(controller){
    await page.evaluate(()=>elevatorPad.connected=false);await frames(page);
    await page.evaluate(()=>{elevatorPad.buttons[2]={pressed:true,value:1};elevatorPad.connected=true;});await frames(page);
    expect((await state(page)).controller.armed).toBe(false);
    expect((await state(page)).station.elevator).toBe(1);
    await page.evaluate(()=>elevatorPad.buttons[2]={pressed:false,value:0});await frames(page);
    await page.waitForFunction(()=>starAgent.state.controller.armed);
  }
  await interact();await page.waitForFunction(()=>starAgent.state.station.elevator===0);
  await walk(page,2.65,13,controller);await interact();await page.waitForFunction(()=>starAgent.state.station.elevator===1);
  await walk(page,2.65,12.3,controller);await walk(page,0,12.3,controller);
  // Call while almost touching the CLOSED leaves: only closing is interlocked.
  await interact();await page.waitForFunction(()=>starAgent.state.station.elevator===0);
  await walk(page,0,13.92,controller);await interact();await page.waitForFunction(()=>starAgent.state.station.elevator===1);
  await walk(page,0,15.95,controller);await interact();
  await choose(page,controller,'elevator-1');
  await page.waitForFunction(()=>starAgent.state.station.location==='hangar'&&starAgent.navigation.enabled&&starAgent.state.station.elevator===1);
  await walk(page,0,20.4,controller);await walk(page,8,20.4,controller);await walk(page,8,z,controller);
  await walk(page,0,8,controller,true);await walk(page,0,-1.5,controller,true);await interact();
  await page.waitForFunction(()=>starAgent.state.mode==='landed');
  expect(await page.evaluate(()=>starAgent.navigation.shipPosition.toArray())).toEqual(parked);
  expect((await state(page)).inventory).toEqual(inventory);
  const backend=await page.evaluate(()=>{const gl=document.querySelector('#viewport').getContext('webgl2');return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);});
  await writeFile(`${out}/${mode}.json`,JSON.stringify({browser:browser.version(),backend,viewport:page.viewportSize(),errors,warnings,final:await state(page)},null,2));
  expect(errors).toEqual([]);
}
for(const mode of ['keyboard','controller'])test(`${mode}: leave ship, call elevator from panel, lobby and return`,({page,browser})=>journey({page,browser},mode));
test.describe('phone',()=>{
  test.use({viewport:{width:390,height:844},hasTouch:true,isMobile:true});
  test('touch: leave ship, call elevator, lobby and return',({page,browser})=>journey({page,browser},'touch'));
});
