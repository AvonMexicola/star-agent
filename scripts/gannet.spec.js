import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
const output=process.env.GANNET_EVIDENCE??resolve(tmpdir(),'star-agent-gannet-browser-evidence');
test('authored hull, full access cycle and real camera views on desktop and phone',async({page})=>{
  const diagnostics=[],framing=[];
  async function frameCheck(label,mfds=[]){
    const state=await page.evaluate(names=>{
      const {camera,ship,renderer}=window.gannetStudio;
      camera.updateMatrixWorld(true);ship.updateMatrixWorld(true);
      const rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,height:r.height};};
      const canvas=rect(renderer.domElement),chrome=[...document.querySelectorAll('header,.views,#pilot-look,.mechanisms,footer')]
        .filter(element=>element.getClientRects().length).map(element=>({name:element.id||element.className||element.tagName,...rect(element)}));
      const overlap=chrome.filter(r=>Math.min(r.right,canvas.right)-Math.max(r.x,canvas.x)>.5&&Math.min(r.bottom,canvas.bottom)-Math.max(r.y,canvas.y)>.5);
      const corners=names.map(name=>{
        const target=ship.assetNode(name),points=[];
        target?.traverse(mesh=>{if(mesh.isMesh)for(let i=0;i<mesh.geometry.attributes.position.count;i++){
          const p=camera.position.clone().fromBufferAttribute(mesh.geometry.attributes.position,i).applyMatrix4(mesh.matrixWorld).project(camera);points.push(p.toArray());
        }});
        return{name,points};
      });
      const eye=ship.assetNode('PilotEye').getWorldPosition(camera.position.clone());
      return{canvas,chrome,overlap,corners,fov:camera.fov,eye:eye.toArray(),camera:camera.position.toArray(),eyeError:camera.position.distanceTo(eye),viewport:[innerWidth,innerHeight]};
    },mfds);
    framing.push({label,...state});
    expect(state.overlap,`${label}: inspection chrome covers the canvas`).toEqual([]);
    expect(state.canvas.width).toBeGreaterThan(0);expect(state.canvas.height).toBeGreaterThan(0);
    expect(state.canvas.x).toBeGreaterThanOrEqual(0);expect(state.canvas.y).toBeGreaterThanOrEqual(0);
    expect(state.canvas.right).toBeLessThanOrEqual(state.viewport[0]+1);expect(state.canvas.bottom).toBeLessThanOrEqual(state.viewport[1]+1);
    if(mfds.length){
      expect(state.fov,`${label}: actual gameplay projection`).toBe(60);
      expect(state.eyeError,`${label}: keep the authored pilot eye`).toBeLessThan(.00001);
      for(const face of state.corners){
        expect(face.points.length,`${label}: ${face.name} actual vertices`).toBeGreaterThanOrEqual(4);
        for(const [x,y,z] of face.points){expect(Math.abs(x),`${label}: ${face.name} horizontal crop`).toBeLessThan(.97);expect(Math.abs(y),`${label}: ${face.name} vertical crop`).toBeLessThan(.97);expect(z).toBeGreaterThan(-1);expect(z).toBeLessThan(1);}
      }
    }
  }
  page.on('pageerror',e=>diagnostics.push(`page: ${e.message}`));
  page.on('console',m=>{if(m.type()==='error')diagnostics.push(`console: ${m.text()}`);});
  await mkdir(output,{recursive:true});await page.goto('/');
  await page.evaluate(async()=>{await window.gannetStudio.ready;});
  await expect(page.locator('#asset-state')).toContainText('geometry loaded');
  for(const name of ['exterior','rear','side','top','underside','cockpit']){
    await page.locator(`[data-view=${name}]`).click();await page.waitForTimeout(300);
    await frameCheck(`desktop-${name}`,name==='cockpit'?['MFD_1','MFD_2','MFD_3','MFD_4']:[]);
    await page.screenshot({path:resolve(output,`desktop-${name}.png`)});
  }
  await page.locator('[data-view=rear]').click();await page.waitForTimeout(300);
  await page.locator('[data-command=open]').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.gannetStudio.systems.hatch.progress)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.gannetStudio.systems.hatch.progress)).toBeLessThan(1);
  await page.screenshot({path:resolve(output,'desktop-hatch-opening.png')});
  await expect.poll(()=>page.evaluate(()=>window.gannetStudio.systems.hatch.progress)).toBe(1);
  await page.screenshot({path:resolve(output,'desktop-hatch-open.png')});
  await page.locator('[data-view=bay]').click();
  await page.locator('#rover').click();
  await expect(page.locator('#rover')).toHaveAttribute('aria-pressed','true');
  await page.screenshot({path:resolve(output,'desktop-bay-burrow.png')});
  await page.locator('[data-command=lower]').click();
  await expect.poll(()=>page.evaluate(()=>window.gannetStudio.systems.lift.y)).toBe(0);
  await page.locator('[data-view=rear]').click();await page.screenshot({path:resolve(output,'desktop-lowered.png')});
  await page.locator('[data-command=raise]').click();
  await expect.poll(()=>page.evaluate(()=>window.gannetStudio.systems.lift.y)).toBe(1.4);
  await page.locator('[data-view=cabin]').click();await page.screenshot({path:resolve(output,'desktop-cabin.png')});
  await page.locator('[data-view=rear]').click();await page.waitForTimeout(300);
  await page.locator('[data-command=close]').click();
  await page.waitForTimeout(250);
  expect(await page.evaluate(()=>window.gannetStudio.systems.hatch.progress)).toBeGreaterThan(0);
  expect(await page.evaluate(()=>window.gannetStudio.systems.hatch.progress)).toBeLessThan(1);
  await page.screenshot({path:resolve(output,'desktop-hatch-closing.png')});
  await expect.poll(()=>page.evaluate(()=>window.gannetStudio.systems.secured)).toBe(true);
  await page.locator('[data-view=underside]').click();await page.waitForTimeout(300);
  const gearHeight=()=>page.evaluate(()=>window.gannetStudio.ship.assetNode('Gear_Port_Fore').position.y);
  await page.locator('#gear').click();await page.waitForTimeout(250);
  expect(await gearHeight()).toBeGreaterThan(.1);expect(await gearHeight()).toBeLessThan(1.9);
  await page.screenshot({path:resolve(output,'desktop-gear-retracting.png')});
  await page.waitForTimeout(2000);
  expect(await gearHeight()).toBeCloseTo(1.9,5);
  await page.locator('[data-view=underside]').click();await page.screenshot({path:resolve(output,'desktop-gear-stowed.png')});
  await page.locator('#gear').click();await page.waitForTimeout(250);
  expect(await gearHeight()).toBeGreaterThan(.1);expect(await gearHeight()).toBeLessThan(1.9);
  await page.screenshot({path:resolve(output,'desktop-gear-deploying.png')});
  await expect.poll(gearHeight).toBeCloseTo(.1,5);
  await page.screenshot({path:resolve(output,'desktop-gear-deployed.png')});
  // Retain the original portrait evidence's stowed-gear pose after documenting
  // the full return cycle in a view that actually shows the mechanism.
  await page.locator('#gear').click();await expect.poll(gearHeight).toBeCloseTo(1.9,5);
  await page.setViewportSize({width:390,height:844});
  for(const name of ['exterior','top','cockpit']){
    await page.locator(`[data-view=${name}]`).click();await page.waitForTimeout(300);
    await frameCheck(`phone-${name}`,name==='cockpit'?['MFD_2','MFD_3']:[]);
    await page.screenshot({path:resolve(output,`phone-${name}.png`)});
  }
  for(const [direction,display] of [['left','MFD_1'],['right','MFD_4']]){
    await page.locator(`[data-pilot-look=${direction}]`).click();await page.waitForTimeout(150);
    await frameCheck(`phone-cockpit-${direction}`,[display]);
    await page.screenshot({path:resolve(output,`phone-cockpit-${direction}.png`)});
  }
  await page.locator('[data-pilot-look=center]').click();await frameCheck('phone-cockpit-return',['MFD_2','MFD_3']);
  const state=await page.evaluate(()=>{const {renderer,ship,systems}=window.gannetStudio;const gl=renderer.getContext();const ext=gl.getExtension('WEBGL_debug_renderer_info');return{status:ship.userData.assetStatus,displayState:ship.displayState(),secured:systems.secured,renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),draws:renderer.info.render.calls,triangles:renderer.info.render.triangles};});
  await writeFile(resolve(output,'state.json'),JSON.stringify({state,diagnostics,framing,scope:'Studio and injected pointer inspection only; no flight/carrier/controller gameplay or FPS acceptance'},null,2)+'\n');
  expect(state.status).toBe('ready');expect(diagnostics).toEqual([]);
});
