import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const evidence='/tmp/star-agent-asteroid-aim-evidence';
async function press(page,index,down){
  await page.evaluate(({index,down})=>window.aimPad.buttons[index]={pressed:down,value:Number(down)},{index,down});
  await page.waitForFunction(({index,down})=>Boolean(window.starAgent.navigation.gamepad.previous[index])===down,{index,down});
}

test('reticle promotes the third generated rock and rejects an actually obstructing large asteroid',async({page,browser})=>{
  test.setTimeout(180000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mkdir(evidence,{recursive:true});
  await page.addInitScript(()=>{window.aimPad={id:'Standard Xbox asteroid aim regression',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};navigator.getGamepads=()=>[window.aimPad];});
  await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed);
  await page.evaluate(()=>window.starAgent.setRenderScale(.65));await page.locator('[data-destination="ring"]').click();
  await page.waitForFunction(()=>!window.starAgent.state.transiting&&window.starAgent.navigation.surfaceObstacles.cache.size>0&&[...window.starAgent.navigation.surfaceObstacles.cache.values()].every(r=>r.ready&&!r.pending));
  // Synthetic arrangement only: the renderer, six generated asteroid family
  // geometries, precise raycasts, bounded worker cache, mining and inventory are
  // production implementations. No fake hit, promotion, cut or cargo is injected.
  const fixture=await page.evaluate(()=>{
    const n=window.starAgent.navigation,field=n.surfaceObstacles,rings=field.rings,origin=n.position.clone();
    for(const id of [...field.cache.keys()])field.releaseSpaceRock(id);
    field.aimedDescriptor=null;field.inspectState=null;field.collisionKey=null;
    const local=origin.clone().sub(rings.center);
    const make=(id,name,family,offset,size,mineable)=>({id,key:`selene-ring-v1-${id}`,name,family,size,mineable,rotation:[0,0,0],position:local.clone().add(origin.clone().fromArray(offset)).toArray()});
    const descriptors=[make(120001,'Near basalt',0,[-3,0,1],1,true),make(120002,'Near ice',2,[3,0,1],1,true),make(120003,'Aimed copper',1,[0,0,7],1,true),make(120004,'Large shale',3,[35,0,20],20,false)];
    window.asteroidFixture={descriptors,origin:origin.toArray()};
    rings.update=function(renderOrigin){
      this.band.visible=false;this.rockOrigin.value.copy(renderOrigin).sub(this.center);
      this.local=descriptors;this.localIds=new Set(descriptors.map(r=>r.id));
      for(const mesh of this.far)mesh.count=0;
      this.publish(descriptors,this.near,renderOrigin);
    };
    n.mode='eva';n.shipPosition=null;n.insideShip=false;n.spaceParked=false;n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);n.enabled=true;
    n.orientToward(origin.clone().add(origin.clone().set(0,0,-1)),origin.clone().set(0,1,0));
    return descriptors;
  });
  await page.waitForFunction(()=>{const c=window.starAgent.navigation.surfaceObstacles.cache;return c.size===2&&c.get(120001)?.ready&&c.get(120002)?.ready;});
  const initialCache=await page.evaluate(()=>[...window.starAgent.navigation.surfaceObstacles.cache.keys()]);expect(initialCache).not.toContain(120003);
  await page.evaluate(()=>{const n=window.starAgent.navigation;n.orientToward(n.position.clone().add(n.position.clone().set(0,0,7)),n.position.clone().set(0,1,0));});
  await page.waitForFunction(()=>window.starAgent.state.mining.inspection?.rockId==='selene-ring-v1-120003'&&window.starAgent.state.mining.inspection.status==='ready'&&window.starAgent.state.mining.tool.hit!==null);
  expect(await page.evaluate(()=>window.starAgent.navigation.surfaceObstacles.cache.size)).toBeLessThanOrEqual(2);
  await page.waitForFunction(()=>window.starAgent.state.controller.armed);
  const before=await page.evaluate(()=>({revision:window.starAgent.state.mining.activeRevision,mass:window.starAgent.state.mining.pack.reduce((a,b)=>a+b,0)}));
  await press(page,7,true);await page.waitForFunction(revision=>window.starAgent.state.mining.activeRevision>=revision+2,before.revision);
  await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming);await page.screenshot({path:`${evidence}/third-rock-controller-mining.png`});
  await press(page,7,false);await page.waitForFunction(()=>[...window.starAgent.navigation.surfaceObstacles.cache.values()].every(r=>!r.pending));
  const mined=await page.evaluate(()=>({revision:window.starAgent.state.mining.activeRevision,mass:window.starAgent.state.mining.pack.reduce((a,b)=>a+b,0),inspection:window.starAgent.state.mining.inspection}));expect(mined.mass).toBeGreaterThan(before.mass);
  // The same shale family now physically intersects the beam, and is too large
  // for hand mining. Its earlier bounding sphere intersected the ray but its
  // visible triangles did not; that must never prevent targeting the third rock.
  await page.evaluate(()=>{const n=window.starAgent.navigation,big=window.asteroidFixture.descriptors[3];big.position=n.position.clone().sub(n.surfaceObstacles.rings.center).add(n.position.clone().set(0,0,4)).toArray();big.size=2;});
  await page.waitForFunction(()=>window.starAgent.state.mining.inspection?.status==='too-large'&&window.starAgent.state.mining.tool.hit===null);
  await expect(page.locator('.mining-guide')).toContainText('Hand mining unavailable');
  await press(page,7,true);await page.waitForFunction(()=>window.starAgent.state.mining.tool.beaming);await page.screenshot({path:`${evidence}/large-asteroid-feedback.png`});await press(page,7,false);
  expect(await page.evaluate(()=>window.starAgent.state.mining.pack.reduce((a,b)=>a+b,0))).toBe(mined.mass);
  await press(page,8,true);await press(page,8,false);await expect(page.locator('#cargo-dialog')).toBeVisible();await page.screenshot({path:`${evidence}/third-rock-backpack.png`});
  const meta=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderScale:window.starAgent.state.renderScale};});
  await writeFile(`${evidence}/evidence.json`,JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),meta,fixture:'Synthetic positions/scales only; real generated meshes, worker promotion, RT carving and backpack',descriptors:fixture,initialCache,before,mined,errors},null,2));expect(errors).toEqual([]);
});
