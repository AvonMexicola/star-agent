import {test,expect} from '@playwright/test';
import fs from 'node:fs/promises';
const OUT='/tmp/star-agent-kestrel-browser-evidence';

async function open(page){
 const errors=[];page.on('pageerror',e=>errors.push(String(e)));page.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errors.push(`${m.type()}: ${m.text()}`);});
 await page.goto('/dev/kestrel.html');await page.evaluate(()=>window.kestrelStudio.ready);await expect(page.locator('#studio-status')).toBeHidden();await page.waitForFunction(()=>window.kestrelStudio.snapshot().frames>4);return errors;
}
async function settled(page,key,value){await expect.poll(()=>page.evaluate(k=>window.kestrelStudio.snapshot().progress[k],key),{timeout:20000}).toBeCloseTo(value,3);}
async function expectGeometryAboveControls(page,names){
 const bounds=await page.evaluate(names=>{
  const rig=window.kestrelStudio,rect=rig.renderer.domElement.getBoundingClientRect(),limit=Math.min(rect.bottom,document.querySelector('.studio-controls').getBoundingClientRect().top);
  let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
  for(const name of names)rig.asset.getNode(name).traverse(o=>{if(!o.isMesh||!o.visible)return;const p=o.geometry.attributes.position;
   for(let i=0;i<p.count;i++){const v=new rig.camera.position.constructor().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).project(rig.camera),x=rect.left+(v.x*.5+.5)*rect.width,y=rect.top+(.5-v.y*.5)*rect.height;minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}
  });
  return{minX,maxX,minY,maxY,left:rect.left,right:rect.right,top:rect.top,bottom:limit};
 },names);
 expect(bounds.minX).toBeGreaterThan(bounds.left+4);expect(bounds.maxX).toBeLessThan(bounds.right-4);
 expect(bounds.minY).toBeGreaterThan(bounds.top+4);expect(bounds.maxY).toBeLessThan(bounds.bottom-10);
}
test('studio loads and frames the authored fighter from all inspection angles',async({page})=>{
 const errors=await open(page);await fs.mkdir(OUT,{recursive:true});
 await expect(page.locator('#hardpoint-spec')).toHaveText('4 × S2 hardpoints');
 expect(await page.evaluate(()=>window.kestrelStudio.snapshot().hardpoints)).toEqual(
  expect.arrayContaining(['HP_Nose','HP_WingL','HP_WingR','HP_Belly'].map(node=>({node,size:2,mount:'fixed',installedWeapon:null})))
 );
 for(const [name,label] of [['exterior','Exterior'],['rear','Engines'],['top','Planform'],['cockpit','Pilot seat'],['boarding','Boarding'],['belly','Underside']]){
  await page.getByRole('button',{name:label,exact:true}).click();await expect(page.getByRole('button',{name:label,exact:true})).toHaveAttribute('aria-pressed','true');
  const frame=await page.evaluate(()=>window.kestrelStudio.snapshot().frames);await page.waitForFunction(n=>window.kestrelStudio.snapshot().frames>n+1,frame);await page.screenshot({path:`${OUT}/${name}.png`});
  if(['top','belly'].includes(name))await expectGeometryAboveControls(page,['Kestrel']);
  if(name==='cockpit'){
   const screens=await page.evaluate(()=>{
    const rig=window.kestrelStudio,camera=rig.camera,top=document.querySelector('.studio-controls').getBoundingClientRect().top;
    return [1,2,3,4].map(i=>{const s=rig.asset.getNode('MFD_'+i);s.geometry.computeBoundingBox();const p=s.geometry.boundingBox.getCenter(camera.position.clone()).applyMatrix4(s.matrixWorld).project(camera);return{x:(p.x*.5+.5)*innerWidth,y:(-.5*p.y+.5)*innerHeight,top};});
   });
   for(const p of screens){expect(p.x).toBeGreaterThan(0);expect(p.x).toBeLessThan(1600);expect(p.y).toBeGreaterThan(0);expect(p.y).toBeLessThan(p.top-15);}
  }
 }
 const stats=await page.evaluate(()=>window.kestrelStudio.snapshot());await fs.writeFile(`${OUT}/environment.json`,JSON.stringify({browser:page.context().browser().version(),stats,errors},null,2));expect(errors).toEqual([]);
});
test('mechanisms complete reversible cycles, enforce access order and drive engine glow',async({page})=>{
 const errors=await open(page);
 await page.getByRole('button',{name:'Deploy ladder',exact:true}).click();await expect(page.locator('#mechanism-status')).toContainText('open the canopy');
 await page.keyboard.press('c');await settled(page,'canopy',1);
 await page.getByRole('button',{name:'Retract gear',exact:true}).click();await expect(page.locator('#mechanism-status')).toContainText('close the canopy');
 await page.keyboard.press('l');await settled(page,'ladder',1);await page.getByRole('button',{name:'Boarding',exact:true}).click();await page.screenshot({path:`${OUT}/boarding-deployed.png`});
 await expect.poll(()=>page.evaluate(()=>window.kestrelStudio.snapshot().displays[2].values)).toContain('LADDER: DEPLOYED');
 await expectGeometryAboveControls(page,['Canopy','Ladder']);
 await page.keyboard.press('c');expect(await page.evaluate(()=>window.kestrelStudio.snapshot().target.canopy)).toBe(1);
 await page.keyboard.press('l');await settled(page,'ladder',0);await page.keyboard.press('c');await settled(page,'canopy',0);
 await page.keyboard.press('g');await settled(page,'gear',0);await page.getByRole('button',{name:'Underside',exact:true}).click();await page.screenshot({path:`${OUT}/gear-stowed.png`});
 await page.keyboard.press('g');await settled(page,'gear',1);
 await page.locator('#throttle').focus();await page.keyboard.press('End');await page.getByRole('button',{name:'Engines',exact:true}).click();
 await expect.poll(()=>page.evaluate(()=>window.kestrelStudio.asset.getNode('AB_L').visible)).toBe(true);
 expect(await page.evaluate(()=>['L','R'].every(s=>{const o=window.kestrelStudio.asset.getNode('AB_'+s);return !o.castShadow&&o.material.transparent&&!o.material.depthWrite;}))).toBe(true);
 await page.screenshot({path:`${OUT}/engine-glow.png`});
 expect(errors).toEqual([]);
});
test('injected controller waits for neutral, cycles views and reaches mechanism controls',async({page})=>{
 await page.addInitScript(()=>{window.testPad={id:'Kestrel test controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},(_,i)=>({pressed:i===0,touched:i===0,value:i===0?1:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.testPad]});});
 const errors=await open(page);expect(await page.evaluate(()=>window.kestrelStudio.snapshot().target.canopy)).toBe(0);
 async function frames(){const start=await page.evaluate(()=>window.kestrelStudio.snapshot().frames);await page.waitForFunction(n=>window.kestrelStudio.snapshot().frames>=n+2,start);}
 async function pulse(i){await page.evaluate(i=>{window.testPad.buttons[i]={pressed:true,touched:true,value:1};},i);await frames();await page.evaluate(i=>{window.testPad.buttons[i]={pressed:false,touched:false,value:0};},i);await frames();}
 await page.evaluate(()=>{window.testPad.buttons[0]={pressed:false,touched:false,value:0};});await frames();
 await pulse(5);await expect.poll(()=>page.evaluate(()=>window.kestrelStudio.snapshot().view)).toBe('rear');
 for(let i=0;i<7;i++)await pulse(13);
 await expect(page.locator('#canopy-toggle')).toBeFocused();await pulse(0);await settled(page,'canopy',1);
 await page.evaluate(()=>{window.testPad.connected=false;});await page.waitForTimeout(150);expect(errors).toEqual([]);
});
test.describe('touch',()=>{
 test.use({viewport:{width:390,height:844},hasTouch:true});
 test('phone taps operate the canopy and ladder without hiding the controls',async({page})=>{
  const errors=await open(page);await page.getByRole('button',{name:'Open canopy',exact:true}).tap();await settled(page,'canopy',1);
  await page.getByRole('button',{name:'Deploy ladder',exact:true}).tap();await settled(page,'ladder',1);await page.getByRole('button',{name:'Boarding',exact:true}).tap();
  await page.screenshot({path:`${OUT}/phone-boarding.png`,fullPage:true});await expect(page.getByRole('button',{name:'Stow ladder',exact:true})).toBeVisible();expect(errors).toEqual([]);
  await expectGeometryAboveControls(page,['Canopy','Ladder']);
 });
});
test('phone inspection controls remain reachable and keyboard views work',async({page})=>{
 await page.setViewportSize({width:390,height:844});const errors=await open(page);
 await expect(page.locator('#hardpoint-spec')).toHaveText('4 × S2 hardpoints');
 for(const label of ['Exterior','Engines','Planform','Pilot seat','Boarding','Underside']){const button=page.getByRole('button',{name:label,exact:true});await button.click();await expect(button).toHaveAttribute('aria-pressed','true');}
 await page.keyboard.press('1');await expect(page.getByRole('button',{name:'Exterior',exact:true})).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:`${OUT}/phone.png`,fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);expect(errors).toEqual([]);
});
