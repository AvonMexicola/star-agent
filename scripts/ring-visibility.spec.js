import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
import {Vector3} from 'three';
import {ringRock,asteroidDescriptor,RING_POPULATION,RING_NORMAL} from '../src/ring-world.js';
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
  const environment=await page.evaluate(()=>{const gl=document.getElementById('viewport').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),renderScale:window.starAgent.state.renderScale};});
  await writeFile(`${evidence}/evidence.json`,JSON.stringify({browser:browser.version(),viewport:page.viewportSize(),environment,fixture:'Debug camera views of deterministic generated bodies; no synthetic asteroid placement',hero,frames,wide,boundary:boundary.toArray(),snapshots,errors},null,2));expect(errors).toEqual([]);
});
