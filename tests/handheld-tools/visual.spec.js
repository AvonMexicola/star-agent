import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const out=process.env.TOOL_ART_EVIDENCE;
const items=['rifle-laser','sidearm-pistol','mining-laser-tool','tractor-beam-tool'];
test('four real GLBs render before/after and keep calibrated hands in motion',async({page,browser})=>{
  await mkdir(out,{recursive:true});const errors=[],warnings=[],views=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());if(m.type()==='warning')warnings.push(m.text());});
  for(const item of items){
    await page.route(`**/models/props/${item}.glb`,async route=>route.fulfill({contentType:'model/gltf-binary',body:await readFile(`/home/cees/.cache/star-agent-tool-art/before/${item}.glb`)}));
    await page.goto(`/tests/handheld-tools/fixture.html?item=${item}&baseline`);await page.waitForFunction(()=>window.toolReady);
    await page.screenshot({path:`${out}/${item}-before.png`});
    await page.unroute(`**/models/props/${item}.glb`);
    await page.goto(`/tests/handheld-tools/fixture.html?item=${item}`);await page.waitForFunction(()=>window.toolReady);
    const meta=await page.evaluate(()=>window.toolQA.meta());expect(meta.textures).toBe(3);expect(meta.textured).toBeGreaterThan(0);expect(meta.calls).toBeLessThanOrEqual(item==='mining-laser-tool'?6:4);
    views.push({item,...meta});await page.screenshot({path:`${out}/${item}-after.png`});
  }
  await page.goto('/dev/avatar-studio.html');await page.waitForFunction(()=>window.avatarStudio?.state.ready);
  for(const item of items){
    await page.getByLabel('Equipment',{exact:true}).selectOption(item);
    await page.waitForFunction(item=>window.avatarStudio.equipment._items.has(item),item);
    await page.getByRole('button',{name:'Hands',exact:true}).click();
    await page.evaluate(async()=>{for(let i=0;i<20;i++)await new Promise(requestAnimationFrame);});
    await page.screenshot({path:`${out}/${item}-hands.png`});
    await page.getByRole('button',{name:'Side',exact:true}).click();
    await page.getByLabel('Movement',{exact:true}).selectOption('walk');
    await page.evaluate(async()=>{for(let i=0;i<30;i++)await new Promise(requestAnimationFrame);});
    await page.screenshot({path:`${out}/${item}-side.png`});
    await page.getByLabel('Movement',{exact:true}).selectOption('idle');
  }
  const shared=await page.evaluate(()=>{const groups=[...window.avatarStudio.equipment._items.values()],maps=new Set();for(const e of groups)e.root.traverse(o=>{if(o.isMesh)for(const m of [o.material].flat())if(m.userData.handheldFinish===1)for(const k of ['map','normalMap','roughnessMap','metalnessMap'])maps.add(m[k]);});return maps.size;});
  expect(shared).toBe(4); // Mk1 yellow basecolor; normal/ORM remain shared.
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:`${out}/tractor-rig-phone.png`});
  expect(errors).toEqual([]);await writeFile(`${out}/materials-and-rig.json`,JSON.stringify({browser:browser.version(),views,errors,warnings,sharedMaps:shared,physicalController:false},null,2));
});

test('controller lands on Selene, exits the ship and uses all three textured field tools',async({page,browser})=>{
  await mkdir(out,{recursive:true});const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
  await page.addInitScript(()=>{window.artPad={id:'Handheld QA standard Gamepad',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.artPad]});});
  const button=(i,down)=>page.evaluate(({i,down})=>window.artPad.buttons[i]={pressed:down,value:Number(down)},{i,down});
  const tap=async i=>{await button(i,true);await page.waitForFunction(i=>window.starAgent.navigation.gamepad.previous[i],i);await button(i,false);await page.waitForFunction(i=>!window.starAgent.navigation.gamepad.previous[i],i);};
  const axes=values=>page.evaluate(values=>window.artPad.axes=values,values);
  await page.goto('/?dev=1&ship=nomad&start=moon&intro=0&debug&seed=7291');
  await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&window.starAgent.state.controller.armed&&!window.starAgent.state.transiting,undefined,{timeout:90000});
  await tap(3);await page.waitForFunction(()=>window.starAgent.state.mode==='landed',undefined,{timeout:60000});
  await tap(2);await page.waitForFunction(()=>window.starAgent.state.mode==='walk');
  await axes([0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>2.3);await axes([0,0,0,0]);
  await tap(2);await page.waitForFunction(()=>window.starAgent.state.doorProgress===1);
  await axes([0,-1,0,0]);await page.waitForFunction(()=>window.starAgent.state.shipLocal[2]>12);await axes([0,0,0,0]);
  expect(await page.evaluate(()=>window.starAgent.state.insideShip)).toBe(false);
  // Aim at the real nearest deposit using standard right-stick input only.
  await page.evaluate(()=>{window.artAimDone=false;window.artAim=setInterval(()=>{const n=window.starAgent.navigation,local=n.position.clone().fromArray(window.starAgent.state.mining.activePosition).sub(n.position).applyQuaternion(n.orientation.clone().invert()),yaw=Math.atan2(local.x,-local.z),pitch=Math.atan2(local.y,Math.hypot(local.x,local.z));if(Math.abs(yaw)<.02&&Math.abs(pitch)<.02){window.artPad.axes=[0,0,0,0];window.artAimDone=true;clearInterval(window.artAim);return;}const a=x=>Math.sign(x)*Math.min(1,.2+Math.abs(x)*1.5);window.artPad.axes=[0,0,a(yaw),a(-pitch)];},30);});
  await page.waitForFunction(()=>window.artAimDone,undefined,{timeout:20000});
  await axes([0,-1,0,0]);await page.waitForFunction(()=>{const s=window.starAgent.state;return Math.hypot(...s.position.map((x,i)=>x-s.mining.activePosition[i]))<5;},undefined,{timeout:25000});await axes([0,0,0,0]);
  await tap(15);await page.waitForFunction(()=>!window.starAgent.state.mining.tool.selected);
  await tap(15); // Holster and re-equip the default cutter.
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.item==='mining-laser-tool'&&window.starAgent.state.mining.tool.hit);
  const revision=await page.evaluate(()=>window.starAgent.state.mining.activeRevision);
  await button(7,true);await page.waitForFunction(r=>window.starAgent.state.mining.activeRevision>r,revision);
  await page.screenshot({path:`${out}/game-cutter.png`});await button(7,false);
  for(const item of ['rifle-laser','sidearm-pistol']){
    await tap(14);await page.waitForFunction(item=>window.starAgent.state.mining.tool.item===item,item);
    const shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);
    await button(7,true);await page.waitForFunction(n=>window.starAgent.state.effects.weaponShots>n,shots);
    await page.screenshot({path:`${out}/game-${item}.png`});await button(7,false);
  }
  // Shared camera shortcut: same model/calibration in third person.
  await button(4,true);await button(5,true);await tap(15);await button(5,false);await button(4,false);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.attachment==='character-hand');
  await page.screenshot({path:`${out}/game-third-person.png`});
  expect(errors).toEqual([]);await writeFile(`${out}/field-controller.json`,JSON.stringify({browser:browser.version(),errors,state:await page.evaluate(()=>window.starAgent.state),input:'Injected standard Gamepad: land, stand, walk, open ramp, aim, mine, fire, camera. No pose writes.'},null,2));
});
