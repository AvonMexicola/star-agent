import {test,expect} from '@playwright/test';

for(const controller of [false,true])test(`${controller?'controller':'keyboard'} hangar reveal hands movement to physical boarding and launch`,async({page})=>{
  if(controller)await page.addInitScript(()=>{
    window.departurePad={id:'Departure pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],
      buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.departurePad]});
  });
  const held=async(key,down)=>{
    if(!controller)return down?page.keyboard.down(key):page.keyboard.up(key);
    await page.evaluate(({key,down})=>{
      const pad=window.departurePad;
      if(['w','s','a','d'].includes(key))pad.axes[['a','d'].includes(key)?0:1]=down?(['w','a'].includes(key)?-1:1):0;
      else {const index={x:1,f:2,b:3}[key];pad.buttons[index]={pressed:down,value:Number(down)};}
    },{key,down});
    if(['x','f','b'].includes(key))await page.waitForFunction(({key,down})=>window.starAgent.navigation.gamepad.previous[{x:1,f:2,b:3}[key]]===down,{key,down});
  };
  const controls={down:key=>held(key,true),up:key=>held(key,false),press:async key=>{await held(key,true);await held(key,false);}};
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  const started=Date.now();
  await page.goto('/?intro=1&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  console.log('Opening ready milliseconds',Date.now()-started);
  const initial=await page.evaluate(()=>window.starAgent.state);
  console.log('Initial opening',initial.opening,initial.station,initial.shipLocal);
  expect(initial.mode).toBe('walk');expect(initial.station.docked).toBe(true);
  expect(initial.doorOpen).toBe(false);expect(initial.audio.created).toBe(false);
  expect(initial.opening.characterReady).toBe(true);
  expect(initial.camera.fov).toBe(45);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  const shot=async name=>{
    await page.evaluate(()=>{window.starAgent.navigation.enabled=false;window.starAgent.setRenderScale(1);});
    await page.waitForFunction(()=>document.getElementById('viewport').width===innerWidth);
    await page.screenshot({path:name});
    await page.evaluate(()=>{window.starAgent.setRenderScale(.55);window.starAgent.navigation.enabled=true;});
  };
  await shot('/tmp/star-agent-opening-0.png');
  await page.waitForFunction(()=>window.starAgent.state.opening.elapsed>=5);
  const restingHands=await page.evaluate(()=>{
    const c=window.starAgent.openingSequence.character;
    c.model.updateMatrixWorld(true);
    const hips=c.model.getObjectByName('Hips').getWorldPosition(c.worldPosition.clone());
    return ['LeftHand','RightHand'].map(name=>c.model.getObjectByName(name)
      .getWorldPosition(c.worldPosition.clone()).sub(hips).dot(c.up));
  });
  // Wrist joints rest at the pelvis line; fingers extend down beside the thighs.
  for(const height of restingHands)expect(height).toBeLessThan(.03);
  await shot('/tmp/star-agent-opening-5.png');
  await page.waitForFunction(()=>window.starAgent.state.opening.elapsed>=10);
  await shot('/tmp/star-agent-opening-10.png');
  expect(await page.evaluate(()=>window.starAgent.state.station.doorsOpen)).toBe(1);
  expect(await page.locator('#hud').evaluate(e=>e.inert)).toBe(true);
  const before=await page.evaluate(()=>window.starAgent.state.position);
  await controls.down('w');
  await page.waitForFunction(()=>window.starAgent.state.opening.phase==='playing');
  expect(await page.locator('#hud').evaluate(e=>e.inert)).toBe(false);
  await page.waitForFunction(()=>window.starAgent.state.speed>0);
  await controls.up('w');
  await controls.press('x');
  expect(await page.evaluate(()=>window.starAgent.state.position)).not.toEqual(before);
  await page.screenshot({path:'/tmp/star-agent-opening-walk.png'});
  if(controller){
    const padFrames=()=>page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));});
    const padButton=async(index,down)=>{await page.evaluate(({index,down})=>{window.departurePad.buttons[index]={pressed:down,value:Number(down)};},{index,down});await padFrames();};
    const tap=async index=>{await padButton(index,true);await padButton(index,false);};
    const chord=async index=>{
      await page.waitForFunction(()=>window.starAgent.state.controller.armed);
      await page.evaluate(()=>{for(const i of [4,5])window.departurePad.buttons[i]={pressed:true,value:1};});await padFrames();
      await tap(index);
      await page.evaluate(()=>{for(const i of [4,5])window.departurePad.buttons[i]={pressed:false,value:0};});await padFrames();
    };
    await page.waitForFunction(()=>window.starAgent.state.controller.armed);await tap(14);
    await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='rifle-laser');
    await chord(15);await page.waitForFunction(()=>window.starAgent.state.mining.tool.attachment==='character-hand');
    const ammo=await page.evaluate(()=>window.starAgent.state.mining.tool.ammo);
    await page.waitForFunction(()=>window.starAgent.state.controller.armed);await padButton(7,true);
    await page.waitForFunction(before=>window.starAgent.state.mining.tool.ammo<before,ammo);
    await page.screenshot({path:'/tmp/star-agent-controller-held-rifle.png'});await padButton(7,false);
    await chord(14);await page.waitForFunction(()=>window.starAgent.state.utilities.suit);
    expect(await page.evaluate(()=>window.starAgent.state.mining.tool.item)).toBe('rifle-laser');
    await page.screenshot({path:'/tmp/star-agent-controller-flashlight.png'});
  }
  // Walk along the starboard side to the aft hatch, then centre on the ramp.
  await controls.down('s');
  await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>7.5);
  await controls.up('s');await controls.press('x');
  await controls.down('a');
  await page.waitForFunction(()=>Math.abs(window.starAgent.state.shipLocal[0])<.25);
  await controls.up('a');await controls.press('x');
  await controls.down('w');
  await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<6);
  await controls.up('w');await controls.press('x');await controls.press('f');
  await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await controls.down('w');
  await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]<-1.6);
  await controls.up('w');await controls.press('x');
  if(controller)await page.waitForFunction(()=>window.starAgent.state.character.state==='idle');
  await controls.press('f');
  await page.waitForFunction(()=>window.starAgent.state.mode==='landed');
  await page.screenshot({path:'/tmp/star-agent-opening-cockpit.png'});
  await controls.press('b');
  await page.waitForFunction(()=>window.starAgent.state.mode==='flight'&&!window.starAgent.state.station.lifting);
  const hover=await page.evaluate(()=>window.starAgent.state.station.deckClearance);
  expect(hover).toBeCloseTo(3.55,3);
  await expect(page.locator('#gear-flight-prompt')).toContainText(controller?'LB+RB + D-PAD ↓':'PRESS G');
  await controls.down('w');
  await page.waitForFunction(()=>window.starAgent.state.speed>19);
  await page.waitForFunction(()=>window.starAgent.state.station.local[2]<-100);
  expect(await page.evaluate(()=>window.starAgent.state.station.deckClearance)).toBeCloseTo(hover,3);
  expect(await page.evaluate(()=>window.starAgent.state.speed)).toBeLessThanOrEqual(35.001);
  await page.screenshot({path:`/tmp/star-agent-gear-down-${controller?'controller':'keyboard'}.png`});
  if(controller){
    const set=async(index,down)=>{await page.evaluate(({index,down})=>{window.departurePad.buttons[index]={pressed:down,value:Number(down)};},{index,down});await page.evaluate(async()=>{for(let i=0;i<3;i++)await new Promise(r=>requestAnimationFrame(r));});};
    await set(4,true);await set(5,true);await set(13,true);await set(13,false);await set(4,false);await set(5,false);
  }else await page.keyboard.press('g');
  await expect(page.locator('#gear-flight-prompt')).toContainText('RETRACTING');
  expect(await page.evaluate(()=>window.starAgent.state.speedProfile.limit)).toBeLessThanOrEqual(35);
  await page.waitForFunction(()=>window.starAgent.state.utilities.gearProgress===0);
  await expect(page.locator('#gear-flight-prompt')).toBeHidden();
  await page.waitForFunction(()=>window.starAgent.state.speed>80);
  expect(await page.evaluate(()=>window.starAgent.state.effects.slipstream)).toBe(0);
  expect(await page.evaluate(()=>window.starAgent.state.tunnel.visible)).toBe(false);
  await controls.up('w');await controls.press('x');
  await page.screenshot({path:`/tmp/star-agent-opening-launch-${controller?'controller':'keyboard'}.png`});
  expect(errors).toEqual([]);
});

test('default intro accepts controller movement and intro=0 keeps orbital boot',async({page})=>{
  await page.addInitScript(()=>{
    const raf=window.requestAnimationFrame.bind(window);
    window.openingFrameOffset=0;
    window.requestAnimationFrame=callback=>raf(time=>callback(time+window.openingFrameOffset));
    window.openingPad={id:'Opening test pad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],
      buttons:Array.from({length:17},()=>({pressed:false,value:0}))};
    Object.defineProperty(navigator,'getGamepads',{value:()=>[window.openingPad]});
  });
  await page.goto('/?debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.55));
  const elapsedBefore=await page.evaluate(()=>{
    const elapsed=window.starAgent.state.opening.elapsed;
    Object.defineProperty(document,'hidden',{configurable:true,value:true});
    document.dispatchEvent(new Event('visibilitychange'));
    window.openingFrameOffset+=30000;
    Object.defineProperty(document,'hidden',{configurable:true,value:false});
    document.dispatchEvent(new Event('visibilitychange'));
    return elapsed;
  });
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  expect(await page.evaluate(()=>window.starAgent.state.opening.elapsed)).toBeLessThan(elapsedBefore+10);
  const start=await page.evaluate(()=>window.starAgent.state.position);
  await page.evaluate(()=>window.openingPad.axes[1]=-.7);
  await page.waitForFunction(()=>window.starAgent.state.opening.phase==='playing');
  await page.waitForFunction(()=>window.starAgent.state.speed>0);
  await page.evaluate(()=>window.openingPad.axes[1]=0);
  expect(await page.evaluate(()=>window.starAgent.state.position)).not.toEqual(start);
  // Gamepad polling does not create audio outside a browser user gesture.
  expect(await page.evaluate(()=>window.starAgent.state.audio.created)).toBe(false);
  await page.goto('/?intro=0&debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  expect(await page.evaluate(()=>window.starAgent.state.opening.phase)).toBe('skipped');
  expect(await page.evaluate(()=>window.starAgent.state.mode)).toBe('flight');
});

test('hangar floor remains clear while the camera origin moves at eye height',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto('/?debug');
  await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.keyboard.press('w');
  await page.waitForFunction(()=>window.starAgent.state.opening.phase==='playing');
  await page.evaluate(()=>{
    const app=window.starAgent,nav=app.navigation,station=nav.station;nav.enabled=false;
    const local=nav.position.clone().set(-6,station.interiorBox.min.y+1.75,0);
    nav.position.copy(station.toWorld(local,local.clone()));
    const target=station.toWorld(local.clone().set(2,station.interiorBox.min.y,-3),local.clone());
    nav.orientToward(target,station.up);
    document.querySelectorAll('body > :not(canvas):not(script)').forEach(e=>e.style.visibility='hidden');
  });
  for(const scale of [1,.55]){
    await page.evaluate(scale=>window.starAgent.setRenderScale(scale),scale);
    for(let step=0;step<8;step++){
      await page.evaluate(()=>{
        const nav=window.starAgent.navigation;
        nav.position.add(nav.position.clone().set(.015,0,.01).applyQuaternion(nav.station.quaternion));
        return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
      });
      expect(await page.evaluate(()=>window.starAgent.state.station.deckClearance)).toBeCloseTo(1.75,5);
      if(step===0||step===7)await page.screenshot({path:`/tmp/star-agent-floor-fixed-${scale}-${step}.png`});
    }
  }
  expect(errors).toEqual([]);
});
