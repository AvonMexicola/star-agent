import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const out=process.env.ROVER_OUTPUT??'/home/cees/projects/.mining-rover-qa';
test('controller Atlas boarding, physical rover access, lift, twin mining, ore bins and return',async({page,browser})=>{
  await mkdir(out,{recursive:true});const errors=[],warnings=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE ERROR',e.message);});page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  await page.addInitScript(()=>{window.roverPad={id:'Burrow standard test controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.roverPad]});});
  const frames=()=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
  const state=()=>page.evaluate(()=>starAgent.state);
  const axes=values=>page.evaluate(values=>roverPad.axes=values,values);
  const driveAxes=(x,y)=>{const length=Math.hypot(x,y),scale=length?(.16+.84*Math.min(1,length))/length:0;return axes([x*scale,y*scale,0,0]);};
  const button=async(i,down)=>{await page.evaluate(({i,down})=>roverPad.buttons[i]={pressed:down,value:+down},{i,down});await frames();};
  const tap=async i=>{await button(i,true);await button(i,false);};
  const stop=async()=>{await axes([0,0,0,0]);await button(6,true);await page.waitForTimeout(250);await button(6,false);};
  async function choose(key){for(let i=0;i<80;i++){if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await tap(0);return;}await tap(13);}throw Error('Controller cannot reach '+key);}
  async function walk(local){
    for(let i=0;i<220;i++){
      const control=await page.evaluate(local=>{const n=starAgent.navigation,d=n.fromShipLocal(n.position.clone().fromArray(local)).sub(n.position).applyQuaternion(n.orientation.clone().invert()),distance=Math.hypot(d.x,d.z);return {distance,axes:distance<.22?[0,0,0,0]:[d.x/distance*.72,d.z/distance*.72,0,0]};},local);
      await axes(control.axes);if(control.distance<.22){await stop();return;}await page.waitForTimeout(100);
    }
    throw Error('Walking did not reach '+local+'; '+JSON.stringify((await state()).shipLocal));
  }
  async function drive(target,reach=1.2){
    for(let i=0;i<500;i++){
      const control=await page.evaluate(({target,reach})=>{const n=starAgent.navigation,r=n.vehicle.physics.state,d=n.position.clone().fromArray(target).sub(r.position).applyQuaternion(r.quaternion.clone().invert()),distance=Math.hypot(d.x,d.z),angle=Math.atan2(d.x,-d.z);return {distance,angle,axes:distance<reach?[0,0,0,0]:[Math.max(-1,Math.min(1,angle*2)), -Math.min(.52,Math.max(.07,(distance-reach)*.14)),0,0],blocked:r.blocked,reason:r.reason};},{target,reach});
      await driveAxes(control.axes[0],control.axes[1]);if(control.distance<reach){await stop();return;}await page.waitForTimeout(100);
      if(i%80===79)console.log('Drive feedback',control,(await state()).rover.local);
    }
    throw Error('Drive did not reach target: '+JSON.stringify((await state()).rover));
  }
  async function parkInAtlas(){
    const local=(await state()).rover.local,route=[];
    for(let i=0;i<=60;i++){const t=i/60;route.push(await shipPoint([local[0]+(-1.6-local[0])*(3*t*t-2*t*t*t),0,local[2]-15*t]));}
    for(let z=local[2]-15-.5;z>5;z-=.5)route.push(await shipPoint([-1.6,0,z]));route.push(await shipPoint([-1.6,0,5]));
    let index=0;
    for(let i=0;i<650;i++){
      const c=await page.evaluate(({route,index})=>{const r=starAgent.navigation.vehicle.physics.state,point=p=>r.position.clone().fromArray(p);let best=index,distance=Infinity;
        for(let j=index;j<Math.min(route.length,index+15);j++){const d=point(route[j]).distanceTo(r.position);if(d<distance){distance=d;best=j;}}
        let k=best;while(k<route.length-1&&point(route[k]).distanceTo(point(route[best]))<2.5)k++;
        const delta=point(route[k]).sub(r.position).applyQuaternion(r.quaternion.clone().invert()),angle=Math.atan2(delta.x,-delta.z),end=point(route.at(-1)).distanceTo(r.position);
        return {index:best,end,steer:Math.max(-1,Math.min(1,Math.atan(2*2.7*Math.sin(angle)/Math.max(1,Math.hypot(delta.x,delta.z)))/.52)),throttle:Math.min(.22,Math.max(.04,end*.11)),blocked:r.blocked,reason:r.reason};
      },{route,index});index=c.index;
      if(c.end<.17){await stop();await page.waitForTimeout(400);return;}
      await driveAxes(c.steer,-c.throttle);await page.waitForTimeout(100);if(i%100===99)console.log('Parking feedback',c,(await state()).rover.local);
    }
    throw Error('Parking route did not complete: '+JSON.stringify((await state()).rover));
  }
  async function aim(target){
    for(let i=0;i<100;i++){
      const c=await page.evaluate(target=>{const n=starAgent.navigation,d=n.position.clone().fromArray(target).sub(n.position).applyQuaternion(n.orientation.clone().invert());return {x:Math.atan2(d.x,-d.z),y:Math.atan2(d.y,Math.hypot(d.x,d.z))};},target);
      if(Math.hypot(c.x,c.y)<.02){await axes([0,0,0,0]);return;}
      const axis=n=>Math.sign(n)*Math.min(.75,Math.max(.22,Math.abs(n)*2));await axes([0,0,axis(c.x),-axis(c.y)]);await page.waitForTimeout(80);
    }
    throw Error('Target lies outside cutter gimbal arc.');
  }
  const shipPoint=local=>page.evaluate(local=>{const n=starAgent.navigation;return n.fromShipLocal(n.position.clone().fromArray(local)).toArray();},local);
  try{
    await page.goto('/?dev=1&intro=0&ship=atlas&start=moon&rover=1&debug=1&seed=7291');
    await page.waitForFunction(()=>window.starAgent?.state.ready,null,{timeout:90000});
    expect((await state()).dev,'Test server needs VITE_DEV_TOOLS=1').not.toBeNull();
    await page.waitForFunction(()=>window.starAgent?.state.ready&&starAgent.state.rover?.spawned&&starAgent.state.controller.armed&&!starAgent.state.transiting,null,{timeout:90000});
    expect((await state()).mode).toBe('landed');expect((await state()).rover.fitsLift).toBe(true);
    await tap(2);await walk([1.5,5.75,-7.7]);await walk([1.5,5.75,5.1]);await walk([.8,5.75,5.1]);
    expect((await state()).rover.near).toBe(true);await page.screenshot({path:out+'/01-atlas-cargo-rover.png'});console.log('Reached rover door');
    // Sample actual player motion through the production boarding state machine.
    await page.evaluate(()=>{window.accessTravel=[];window.recordRoverAccess=true;function sample(){if(!window.recordRoverAccess)return;accessTravel.push(starAgent.state.position);requestAnimationFrame(sample);}sample();});
    await tap(2);await page.waitForFunction(()=>starAgent.state.rover.occupied&&!starAgent.state.rover.busy,null,{timeout:25000});
    const moves=await page.evaluate(()=>{recordRoverAccess=false;return accessTravel;});const maxStep=Math.max(...moves.slice(1).map((p,i)=>Math.hypot(...p.map((n,j)=>n-moves[i][j]))));expect(maxStep).toBeLessThan(.30);
    await page.screenshot({path:out+'/02-enclosed-cockpit.png'});console.log('Physical boarding passed',maxStep);
    await tap(3);await page.waitForFunction(()=>starAgent.state.lifts[0].y===0,null,{timeout:12000});expect((await state()).rover.local[1]).toBeCloseTo(0,3);
    await axes([0,-.8,0,0]);await page.waitForFunction(()=>starAgent.state.rover.local[2]>15.5,null,{timeout:20000});await stop();
    expect((await state()).rover.aboard).toBe(false);expect((await state()).rover.wheels.every(w=>w.source==='terrain')).toBe(true);console.log('Forward unloading passed');
    await button(4,true);await button(5,true);await tap(15);await button(5,false);await button(4,false);await frames();
    await page.screenshot({path:out+'/03-unloaded-selene.png'});
    if(process.env.ROVER_SMOKE==='1'){expect(errors).toEqual([]);return;}
    await drive(await shipPoint([-1.6,0,36]),1);await drive(await shipPoint([-10.8,0,35]),.8);
    const target=(await state()).mining.activePosition;await aim(target);
    const before=(await state()).rover;await button(7,true);
    await page.waitForFunction(()=>starAgent.state.rover.beaming===2&&starAgent.state.rover.mass>0,null,{timeout:20000});
    await page.screenshot({path:out+'/04-twin-cutters.png'});await page.waitForTimeout(10000);await button(7,false);
    let s=await state();expect(s.rover.charge).toBeGreaterThan(.80);expect(s.rover.mass).toBeGreaterThan(before.mass);expect(s.rover.beamPoses.length).toBe(2);
    // Full shared inventory route and held-trigger neutral suppression.
    await tap(8);await expect(page.locator('dialog[open]')).toContainText('Rover mineral bin');await page.screenshot({path:out+'/05-ore-bins.png'});
    const packBefore=(await state()).mining.pack.reduce((a,b)=>a+b,0);
    const oreKey=await page.locator('[data-from="meridian-rover-bin"]').first().getAttribute('data-controller-key');await choose(oreKey);await choose('transfer-one');
    expect((await state()).mining.pack.reduce((a,b)=>a+b,0)).toBeGreaterThan(packBefore);
    expect(await page.evaluate(()=>document.activeElement?.matches('button:not(:disabled)'))).toBe(true);
    await button(7,true);await tap(1);await frames();expect((await state()).rover.beaming).toBe(0);await button(7,false);await frames();
    for(const kind of ['focus','disconnect','replacement','unsupported']){
      await button(7,true);await page.evaluate(kind=>{if(kind==='focus')window.dispatchEvent(new Event('blur'));if(kind==='disconnect')roverPad.connected=false;if(kind==='replacement')roverPad.id+=' replacement';if(kind==='unsupported')roverPad.mapping='';},kind);await frames();
      expect((await state()).rover.beaming).toBe(0);
      await page.evaluate(()=>{roverPad.connected=true;roverPad.mapping='standard';window.dispatchEvent(new Event('focus'));});await frames();expect((await state()).rover.beaming).toBe(0);
      await button(7,false);await page.waitForFunction(()=>starAgent.state.controller.armed);
    }
    // Return through the rear opening, wholly onto the platform, and carry upward.
    await parkInAtlas();
    expect((await state()).rover.fitsLift).toBe(true);await tap(3);await page.waitForFunction(()=>starAgent.state.lifts[0].y===4,null,{timeout:12000});
    await page.screenshot({path:out+'/06-reloaded-atlas.png'});await tap(2);await page.waitForFunction(()=>!starAgent.state.rover.occupied&&!starAgent.state.rover.busy,null,{timeout:25000});
    const entry=(await state()).shipLocal;await walk([entry[0],5.75,-1]);await walk([0,5.75,-1]);await walk([0,5.75,-9.3]);await tap(2);expect((await state()).mode).toBe('landed');
    const parked=(await state()).rover.local;await tap(3);await page.waitForFunction(()=>starAgent.state.mode==='flight');await button(0,true);await page.waitForTimeout(1500);await button(0,false);await tap(6);
    s=await state();expect(s.rover.aboard).toBe(true);expect(Math.hypot(...s.rover.local.map((n,i)=>n-parked[i]))).toBeLessThan(.02);await page.screenshot({path:out+'/07-carried-in-flight.png'});
    expect(errors).toEqual([]);
  }finally{
    await page.screenshot({path:out+'/last-frame.png'}).catch(()=>{});
    const s=await state().catch(()=>null);const gpu=await page.evaluate(()=>{const g=document.querySelector('#viewport')?.getContext('webgl2'),e=g?.getExtension('WEBGL_debug_renderer_info');return e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):null;}).catch(()=>null);
    await writeFile(out+'/journey.json',JSON.stringify({browser:browser.version(),gpu,viewport:page.viewportSize(),errors,warnings,state:s},null,2));
  }
});
