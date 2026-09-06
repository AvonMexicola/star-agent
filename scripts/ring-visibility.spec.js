import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {ringRock,asteroidDescriptor,RING_POPULATION,RING_NORMAL,RING_RADIUS,RING_THICKNESS} from '../src/ring-world.js';
import {MOON_POSITION} from '../src/moon-world.js';
import {SUN_DIRECTION} from '../src/world.js';
const evidence='/tmp/star-agent-ring-visibility-evidence';
const center=new Vector3(...MOON_POSITION),normal=new Vector3(...RING_NORMAL),sun=new Vector3(...SUN_DIRECTION);
const descriptors=Array.from({length:512},(_,i)=>ringRock(i));
const hero=descriptors.filter(r=>!r.mineable&&r.size>=80&&r.size<=250&&new Vector3(...r.position).normalize().dot(sun)>.4).sort((a,b)=>b.size-a.size)[0];

async function place(page,position,target){
  await page.evaluate(({position,target,up})=>{
    const n=window.starAgent.navigation;n.enabled=false;n.mode='flight';n.shipPosition=null;n.insideShip=false;n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);
    n.position.fromArray(position);n.orientToward(n.position.clone().fromArray(target),n.position.clone().fromArray(up));
  },{position:position.toArray(),target:target.toArray(),up:normal.toArray()});
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

test('large ring bodies retain visible geometry through distance bands and cell transitions',async({page,browser})=>{
  test.setTimeout(240000);expect(hero,'a deterministic sunlit large foreground body').toBeTruthy();
  const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await mkdir(evidence,{recursive:true});await page.setViewportSize({width:1440,height:900});await page.goto('/?debug');await page.waitForFunction(()=>window.starAgent?.state.ready);
  await page.evaluate(()=>window.starAgent.setRenderScale(.8));await page.keyboard.press('Tab');
  const anchor=new Vector3(...hero.position).add(center),radial=new Vector3(...hero.position).addScaledVector(normal,-new Vector3(...hero.position).dot(normal)).normalize(),tangent=new Vector3().crossVectors(normal,radial).normalize();
  const frames=[];
  // Actual generated geometry; camera placement is a rendering fixture, not a
  // claim that these distances were flown using controls or a real controller.
  for(const distance of [600,3000,3990,4010,15990,16010,60000]){
    await place(page,anchor.clone().addScaledVector(tangent,-distance),anchor);
    await page.waitForFunction(id=>window.starAgent.state.rings.visibleIds?.includes(id),hero.id,{timeout:15000});
    const state=await page.evaluate(()=>window.starAgent.state.rings);
    expect(state.viewDistance).toBe(80000);expect(state.nearDistance).toBe(4000);expect(state.midDistance).toBe(16000);
    expect(state.visibleIds).toContain(hero.id);expect(state.renderedNear+state.renderedMid+state.renderedFar).toBeGreaterThan(0);
    frames.push({distance,state});
    if([600,3000,60000].includes(distance))await page.screenshot({path:`${evidence}/large-rock-${distance}m.png`});
  }
  const widePosition=anchor.clone().addScaledVector(tangent,-3000).addScaledVector(normal,600),wideTarget=anchor.clone().addScaledVector(tangent,30000);
  await place(page,widePosition,wideTarget);await page.screenshot({path:`${evidence}/belt-depth-wide.png`});
  const wide=await page.evaluate(()=>window.starAgent.state.rings);expect(wide.renderedMid).toBeGreaterThan(0);expect(wide.renderedFar).toBeGreaterThan(0);
  // Cross a 20 km coordinate boundary by two metres. Restrict retained anchors
  // to a 60 km sphere so legitimate 80 km range-edge arrivals are not failures.
  const axis=['x','y','z'].sort((a,b)=>Math.abs(tangent[b])-Math.abs(tangent[a]))[0];
  const offset=(Math.round(anchor[axis]/20000)*20000-anchor[axis])/tangent[axis];
  const boundary=anchor.clone().addScaledVector(tangent,offset);
  const anchors=[];
  for(let id=0;id<RING_POPULATION;id++){
    const rock=asteroidDescriptor(id),d=new Vector3(...rock.position).add(center).distanceTo(boundary);
    if(d>5000&&d<60000)anchors.push(id);
  }
  expect(anchors.length).toBeGreaterThan(10);const snapshots=[];
  for(const side of [-1,1]){
    await place(page,boundary.clone().addScaledVector(tangent,side),boundary.clone().addScaledVector(tangent,30000));
    const state=await page.evaluate(()=>window.starAgent.state.rings),visible=new Set(state.visibleIds);
    const retained=anchors.filter(id=>visible.has(id));expect(retained.length).toBe(anchors.length);snapshots.push({side,retained,state});
  }
  expect(snapshots[1].retained).toEqual(snapshots[0].retained);
  // Micro-ice is measured inside the actual annulus, independent of the nearby
  // hero asteroid. Aim slightly beside the sun for readable scattering on sky.
  const icePosition=center.clone().addScaledVector(radial,RING_RADIUS);
  const iceTarget=icePosition.clone().addScaledVector(sun,1000).addScaledVector(tangent,120);
  await place(page,icePosition,iceTarget);
  await page.waitForFunction(()=>window.starAgent.state.rings.ice?.count>0&&window.starAgent.state.rings.ice.sunlight>.9&&window.starAgent.state.moon.effects.terrainBuilds===0);
  const iceInside=await page.evaluate(()=>window.starAgent.state.rings.ice);
  expect(iceInside.presence).toBeGreaterThan(.99);expect(iceInside.count).toBeLessThanOrEqual(iceInside.capacity);
  const iceOn=await page.screenshot({path:`${evidence}/sunlit-ring-ice.png`});
  // Hide only the real Points draw layer for the comparison, then restore it.
  // Particle generation/positions and shader inputs remain production values.
  await page.evaluate(()=>{const p=window.starAgent.navigation.surfaceObstacles.rings.scene.getObjectByName('Sunlit ring micro-ice');window.iceLayerBefore=p.layers.mask;p.layers.mask=0;});
  await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
  const iceOff=await page.screenshot({path:`${evidence}/sunlit-ring-ice-hidden-comparison.png`});
  await page.evaluate(()=>{window.starAgent.navigation.surfaceObstacles.rings.scene.getObjectByName('Sunlit ring micro-ice').layers.mask=window.iceLayerBefore;});
  const icePixels=await page.evaluate(async({on,off})=>{
    const decode=async data=>{const image=new Image();image.src=`data:image/png;base64,${data}`;await image.decode();const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);return ctx.getImageData(0,0,c.width,c.height).data;};
    const a=await decode(on),b=await decode(off);let brighterPixels=0,maximumIncrease=0;
    for(let i=0;i<a.length;i+=4){const delta=Math.max(a[i]-b[i],a[i+1]-b[i+1],a[i+2]-b[i+2]);if(delta>4)brighterPixels++;maximumIncrease=Math.max(maximumIncrease,delta);}
    return {brighterPixels,maximumIncrease,comparison:'Actual particle layer visible versus hidden; unchanged camera and scene'};
  },{on:iceOn.toString('base64'),off:iceOff.toString('base64')});
  expect(icePixels.brighterPixels,'sunlit ice contributes actual rendered pixels').toBeGreaterThan(4);
  // Cross a real 32m ice hash-cell boundary. Compare common phase identities and
  // world-space positions reconstructed from the actual GPU buffer, allowing
  // only the documented slow animation drift between the captured frames.
  const iceBoundary=icePosition.clone();iceBoundary.x=center.x+Math.round((icePosition.x-center.x)/32)*32;
  const iceBoundaryFrames=[];
  for(const side of [-.25,.25]){
    const at=iceBoundary.clone();at.x+=side;
    await place(page,at,at.clone().addScaledVector(sun,1000));
    iceBoundaryFrames.push(await page.evaluate(()=>{
      const n=window.starAgent.navigation,p=n.surfaceObstacles.rings.scene.getObjectByName('Sunlit ring micro-ice'),positions=p.geometry.attributes.position,parameters=p.geometry.attributes.iceParameters;
      const particles={};for(let i=0;i<p.geometry.drawRange.count;i++)particles[`${parameters.getX(i)}:${parameters.getY(i)}`]=[positions.getX(i)+n.position.x,positions.getY(i)+n.position.y,positions.getZ(i)+n.position.z];
      return {state:window.starAgent.state.rings.ice,time:p.material.uniforms.iceTime.value,particles};
    }));
  }
  expect(iceBoundaryFrames[0].state.cell).not.toBe(iceBoundaryFrames[1].state.cell);
  const common=Object.keys(iceBoundaryFrames[0].particles).filter(id=>iceBoundaryFrames[1].particles[id]);
  expect(common.length).toBeGreaterThan(Math.min(...iceBoundaryFrames.map(f=>f.state.count))*.8);
  const driftLimit=.05+Math.abs(iceBoundaryFrames[1].time-iceBoundaryFrames[0].time)*.05;
  let maximumDrift=0;
  for(const id of common){const a=iceBoundaryFrames[0].particles[id],b=iceBoundaryFrames[1].particles[id];maximumDrift=Math.max(maximumDrift,Math.hypot(...a.map((v,i)=>v-b[i])));}
  expect(maximumDrift,'crossing an ice cell cannot reseed existing particles').toBeLessThan(driftLimit);
  const outsidePosition=icePosition.clone().addScaledVector(normal,RING_THICKNESS/2+250);
  await place(page,outsidePosition,outsidePosition.clone().addScaledVector(tangent,1000));
  await page.waitForFunction(()=>window.starAgent.state.rings.ice.count===0&&window.starAgent.state.rings.ice.presence===0);
  const iceOutside=await page.evaluate(()=>{const p=window.starAgent.navigation.surfaceObstacles.rings.scene.getObjectByName('Sunlit ring micro-ice');return {...window.starAgent.state.rings.ice,visible:p.visible,drawCount:p.geometry.drawRange.count};});
  expect(iceOutside.visible).toBe(false);expect(iceOutside.drawCount).toBe(0);await page.screenshot({path:`${evidence}/outside-ring-no-ice.png`});
  const ice={inside:iceInside,pixels:icePixels,boundaryFrames:iceBoundaryFrames,outside:iceOutside,commonParticles:common.length,maximumDrift,driftLimit};
  const environment=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderScale:window.starAgent.state.renderScale};});
  await writeFile(`${evidence}/evidence.json`,JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),environment,fixture:'Debug camera views of deterministic generated bodies; no synthetic asteroid placement',hero,frames,wide,boundary:boundary.toArray(),snapshots,ice,errors},null,2));expect(errors).toEqual([]);
});
