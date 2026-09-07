import {test,expect} from '@playwright/test';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {SHIP_LAYOUT} from '../src/boarding.js';

const out=process.env.NOMAD_STUDIO_OUT??'/tmp/star-agent-nomad-studio-final';
// These are artifact/render inspections. Real input journeys live separately in
// nomad-utility and the independently authored controller review harness.
function inspectAssembly(layout){
  const {ship}=window.shipStudio;
  const bounds=root=>{
    root.updateWorldMatrix(true,true);const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
    root.traverseVisible(mesh=>{if(!mesh.isMesh)return;const p=mesh.geometry.attributes.position,v=mesh.position.clone();
      for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld);for(let a=0;a<3;a++){min[a]=Math.min(min[a],v.getComponent(a));max[a]=Math.max(max[a],v.getComponent(a));}}
    });return {min,max};
  };
  const poses=[];ship.setDoor(false);for(let i=0;i<5;i++)ship.update(.25);
  for(let i=0;i<=20;i++){
    const progress=i/20;ship.updateGear(0,true,progress);
    poses.push({progress,bounds:bounds(ship),feet:layout.gear.legs.map(leg=>bounds(ship.getObjectByName(leg.name)))});
  }
  const ramp=[];ship.setDoor(true);
  for(let i=0;i<=20;i++){
    if(i)ship.update(1.05/20);
    const box=bounds(ship.userData.ramp);
    ramp.push({progress:ship.userData.doorProgress,bounds:box});
  }
  // Actual visible triangle heights under the complete central walk route.
  ship.updateWorldMatrix(true,true);const triangles=[];
  ship.traverseVisible(mesh=>{
    if(!mesh.isMesh||mesh.material.transparent)return;
    const p=mesh.geometry.attributes.position,index=mesh.geometry.index,v=mesh.position.clone();
    for(let i=0;i<(index?.count??p.count);i+=3){const triangle=[];
      for(let j=0;j<3;j++)triangle.push(v.fromBufferAttribute(p,index?index.getX(i+j):i+j).applyMatrix4(mesh.matrixWorld).toArray());
      triangles.push(triangle);
    }
  });
  const floor=[];
  for(let step=0;step<=80;step++){
    const z=-1.2+step*.103,expected=z<=4?1:1-(z-4)/3.2;
    for(const x of [-layout.capsuleRadius,0,layout.capsuleRadius]){
      let height=-Infinity;
      for(const [a,b,c] of triangles){
        const den=(b[2]-c[2])*(a[0]-c[0])+(c[0]-b[0])*(a[2]-c[2]);if(Math.abs(den)<1e-10)continue;
        const u=((b[2]-c[2])*(x-c[0])+(c[0]-b[0])*(z-c[2]))/den;
        const v=((c[2]-a[2])*(x-c[0])+(a[0]-c[0])*(z-c[2]))/den,w=1-u-v;
        if(Math.min(u,v,w)<-1e-6)continue;
        const y=u*a[1]+v*b[1]+w*c[1];if(y<=expected+.08)height=Math.max(height,y);
      }
      floor.push({x,z,expected,height});
    }
  }
  for(let i=0;i<4;i++)window.shipStudio.cargoStore.addBox('ship');
  ship.updateCabin({mode:'landed',gearProgress:1,powered:true},window.shipStudio.cargoStore);
  let triangleCount=0;ship.traverseVisible(mesh=>{if(mesh.isMesh)triangleCount+=(mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;});
  return {poses,ramp,floor,allEightBoxesTriangles:triangleCount,hardpoints:ship.userData.hardpoints};
}

test('Nomad production assembly, moving clearance, PBR and desktop/phone studio',async({page,browser})=>{
  await mkdir(out,{recursive:true});const diagnostics=[];
  page.on('pageerror',error=>diagnostics.push(error.message));
  page.on('console',message=>{if(['error','warning'].includes(message.type()))diagnostics.push(message.text());});
  page.on('response',response=>{if(response.status()>=400)diagnostics.push(`${response.status()} ${response.url()}`);});
  await page.goto('/nomad/');await page.waitForFunction(()=>window.shipStudio?.ship.userData.assetStatus==='ready');
  await expect(page.locator('.studio-eyebrow')).toContainText('MERIDIAN SHIPWORKS');
  const assembly=await page.evaluate(inspectAssembly,SHIP_LAYOUT);
  await writeFile(`${out}/assembly.json`,JSON.stringify(assembly,null,2));
  for(const pose of assembly.poses)for(let axis=0;axis<3;axis++){
    expect(pose.bounds.min[axis]).toBeGreaterThanOrEqual(SHIP_LAYOUT.flightBounds.min[axis]-.001);
    expect(pose.bounds.max[axis]).toBeLessThanOrEqual(SHIP_LAYOUT.flightBounds.max[axis]+.001);
  }
  for(const pose of assembly.ramp){
    // All ramp poses stay beneath the actual sign/cassette face at y=3.5.
    expect(pose.bounds.max[1]).toBeLessThan(3.5);
  }
  for(const point of assembly.floor)expect(Math.abs(point.height-point.expected),JSON.stringify(point)).toBeLessThan(.035);
  expect(assembly.allEightBoxesTriangles).toBeLessThanOrEqual(60000);
  for(const name of ['exterior','rear','side','top','boarding','berth','rack','cockpit','hardpoints']){
    await page.evaluate(name=>window.shipStudio.view(name),name);await page.waitForTimeout(250);await page.screenshot({path:`${out}/${name}.png`});
  }
  await page.locator('#door').click();await page.waitForTimeout(1200);await page.evaluate(()=>window.shipStudio.view('rear'));
  await page.screenshot({path:`${out}/closed-ramp.png`});
  await page.locator('#gear').click();await page.waitForTimeout(700);await page.screenshot({path:`${out}/gear-motion.png`});
  await page.waitForTimeout(1300);await page.evaluate(()=>window.shipStudio.view('side'));await page.screenshot({path:`${out}/gear-stowed.png`});
  const environment=await page.evaluate(()=>{
    const {renderer,ship}=window.shipStudio,gl=renderer.getContext(),debug=gl.getExtension('WEBGL_debug_renderer_info');
    const materials=new Map();ship.traverseVisible(mesh=>{if(mesh.isMesh)for(const material of Array.isArray(mesh.material)?mesh.material:[mesh.material])materials.set(material.uuid,material);});
    return {renderer:debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,canvas:[gl.drawingBufferWidth,gl.drawingBufferHeight],drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,
      mappedMaterials:[...materials.values()].filter(m=>m.map).map(m=>({name:m.name,map:[m.map.image.width,m.map.image.height],normal:m.normalMap?[m.normalMap.image.width,m.normalMap.image.height]:null,authoredSurface:Boolean(m.userData.authoredSurface)}))};
  });
  for(const name of ['exterior','top','cockpit','berth','rack']){
    await page.setViewportSize({width:390,height:844});await page.evaluate(name=>window.shipStudio.view(name),name);await page.waitForTimeout(250);await page.screenshot({path:`${out}/phone-${name}.png`});
  }
  const bytes=await readFile(new URL('../public/models/nomad.glb',import.meta.url));
  await writeFile(`${out}/inspection.json`,JSON.stringify({browser:browser.version(),assetSha256:createHash('sha256').update(bytes).digest('hex'),environment,assembly,diagnostics},null,2));
  expect(diagnostics).toEqual([]);
});
