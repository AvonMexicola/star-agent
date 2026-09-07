import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const OUT='/tmp/star-agent-kestrel/docs/qa/kestrel/reviewer/round-4';
const ASSET='/tmp/star-agent-kestrel/assets/kestrel/kestrel.glb';
test('independent scoped underside framing follow-up',async({page,browser})=>{
 const notes={browser:browser.version(),console:[]};
 const hash=async()=>crypto.createHash('sha256').update(await fs.readFile(ASSET)).digest('hex');
 notes.assetSha256=await hash();
 page.on('pageerror',e=>notes.console.push({type:'pageerror',text:String(e)}));
 page.on('console',m=>{if(['error','warning'].includes(m.type()))notes.console.push({type:m.type(),text:m.text()});});
 await page.goto('/dev/kestrel.html');await page.evaluate(()=>window.kestrelStudio.ready);
 await expect(page.locator('#studio-status')).toBeHidden();
 await page.getByRole('button',{name:'Underside',exact:true}).click();await page.waitForTimeout(180);
 notes.projection=await page.evaluate(()=>{
  const rig=window.kestrelStudio,canvas=rig.renderer.domElement.getBoundingClientRect(),controls=document.querySelector('.studio-controls').getBoundingClientRect();
  const bounds={minX:Infinity,minY:Infinity,maxX:-Infinity,maxY:-Infinity};let count=0,topVertex=null;
  rig.asset.updateMatrixWorld(true);rig.camera.updateMatrixWorld(true);
  rig.asset.traverseVisible(o=>{if(!o.isMesh)return;const vertices=o.geometry.getAttribute('position'),v=rig.camera.position.clone();
   for(let i=0;i<vertices.count;i++){v.fromBufferAttribute(vertices,i).applyMatrix4(o.matrixWorld).project(rig.camera);const x=canvas.left+(v.x*.5+.5)*canvas.width,y=canvas.top+(.5-v.y*.5)*canvas.height;
    if(y<bounds.minY)topVertex={mesh:o.name,index:i,x,y};bounds.minX=Math.min(bounds.minX,x);bounds.maxX=Math.max(bounds.maxX,x);bounds.minY=Math.min(bounds.minY,y);bounds.maxY=Math.max(bounds.maxY,y);count++;
   }
  });
  return {snapshot:rig.snapshot(),cameraPosition:rig.camera.position.toArray(),cameraView:rig.camera.view,canvas:{x:canvas.x,y:canvas.y,width:canvas.width,height:canvas.height},controlsTop:controls.top,bounds,topVertex,vertices:count};
 });
 await page.screenshot({path:OUT+'/desktop-belly-followup.png',fullPage:true});
 notes.assetUnchanged=notes.assetSha256===await hash();await fs.writeFile(OUT+'/underside-followup-evidence.json',JSON.stringify(notes,null,2)+'\n');
 expect(notes.assetSha256).toBe('2fa436d32c089b6d7ed705925ad013a1306e8e30ce56568c07604405610503b0');
 expect(notes.assetUnchanged).toBe(true);expect(notes.console).toEqual([]);
 expect(notes.projection.bounds.minY).toBeGreaterThanOrEqual(20);
 expect(notes.projection.bounds.maxY).toBeLessThanOrEqual(notes.projection.controlsTop-20);
 expect(notes.projection.bounds.minX).toBeGreaterThanOrEqual(18);
 expect(notes.projection.bounds.maxX).toBeLessThanOrEqual(notes.projection.canvas.width-18);
});
