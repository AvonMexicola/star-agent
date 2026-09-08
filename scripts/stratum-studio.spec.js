import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Start the separate production studio and acquire the shared GPU queue before
// invoking this file. This is actual studio UI/asset evidence, not game flight.
for (const device of [{name:'desktop',width:1440,height:900,touch:false},{name:'phone',width:390,height:844,touch:true}]) {
  test(`Stratum native ${device.name} views and real mechanism controls`, async ({browser,baseURL},info) => {
    const context=await browser.newContext({viewport:{width:device.width,height:device.height},hasTouch:device.touch,isMobile:device.touch,
      recordVideo:{dir:info.outputPath('video'),size:{width:device.width,height:device.height}}});
    await context.addInitScript(() => {
      window.stratumInputReceipt=[];
      for (const type of ['pointerdown','pointerup','pointercancel','input','click']) document.addEventListener(type,event => {
        if (window.stratumInputReceipt.length<800) window.stratumInputReceipt.push({type,trusted:event.isTrusted,pointerType:event.pointerType??null,
          target:event.target.id||event.target.dataset?.lookMfd||event.target.dataset?.view||event.target.tagName,value:event.target.value??null,time:performance.now()});
      },true);
    });
    const page=await context.newPage(),errors=[],warnings=[],record={device,started:new Date().toISOString(),scope:'authored studio; no flight/mining/persistence or hardware controller claim',views:[]};
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
    page.on('response',response=>{if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`);});
    const activate=async locator=>device.touch?locator.tap():locator.click();
    const snapshot=()=>page.evaluate(()=>window.stratumStudio.snapshot());
    const cdp=device.touch?await context.newCDPSession(page):null;let contactId=40;
    async function capture(name) {
      await page.screenshot({path:info.outputPath(name+'.png')});record.views.push({name,...await snapshot()});
    }
    async function drag(from,to,steps=20) {
      const id=++contactId;
      if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...from,id}]});
      else{await page.mouse.move(from.x,from.y);await page.mouse.down();}
      try{
        for(let step=1;step<=steps;step++){
          const point={x:from.x+(to.x-from.x)*step/steps,y:from.y+(to.y-from.y)*step/steps};
          if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,id}]});
          else await page.mouse.move(point.x,point.y);
          await page.waitForTimeout(28);
        }
      }finally{
        if(cdp)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        else await page.mouse.up();
      }
    }
    async function rangeTo(id,value) {
      const locator=page.locator('#'+id),box=await locator.boundingBox();expect(box).not.toBeNull();
      const spec=await locator.evaluate(input=>({min:Number(input.min),max:Number(input.max),value:Number(input.value)}));
      const x=v=>box.x+8+(box.width-16)*(v-spec.min)/(spec.max-spec.min),y=box.y+box.height/2;
      // These are native pointer drags through the real HTML range controls.
      // Sampled motion stays in the original recording, including both limits.
      await drag({x:x(spec.value),y},{x:value===spec.min?box.x+1:value===spec.max?box.x+box.width-1:x(value),y});
      await expect.poll(async()=>Number(await locator.inputValue())).toBe(value);
      await page.waitForTimeout(100);
    }
    async function assertFixedEye() {
      const s=await snapshot();expect(s.camera.position).toEqual([0,2.9,-5.8]);expect(s.camera.fov).toBe(72);expect(s.camera.fixedEye).toBe(true);
      return s;
    }
    async function inspectDisplays() {
      await assertFixedEye();
      const canvas=await page.locator('#viewport canvas').boundingBox(),before=(await snapshot()).camera.quaternion;
      await drag({x:canvas.x+canvas.width*.55,y:canvas.y+canvas.height*.50},{x:canvas.x+canvas.width*.55+22,y:canvas.y+canvas.height*.50-12},8);
      const looked=await assertFixedEye();expect(looked.camera.quaternion).not.toEqual(before);
      for(let index=1;index<=4;index++){
        await activate(page.locator(`[data-look-mfd="MFD_${index}"]`));await page.waitForTimeout(120);
        const s=await assertFixedEye(),display=s.displayFrames.find(d=>d.name===`MFD_${index}`);
        expect(display.ndc.length).toBeGreaterThanOrEqual(4);
        for(const [x,y,z] of display.ndc){expect(Math.abs(x)).toBeLessThan(.93);expect(Math.abs(y)).toBeLessThan(.90);expect(z).toBeGreaterThan(-1);expect(z).toBeLessThan(1);}
        await capture(`04${String.fromCharCode(96+index)}-pilot-mfd-${index}`);
      }
    }
    try {
      await page.goto(new URL('/public/dev/stratum.html',baseURL).href,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.stratumStudio?.snapshot().assetStatus==='ready');
      await page.waitForFunction(()=>window.stratumStudio.snapshot().frames>=10);
      record.browser=browser.version();record.initial=await snapshot();
      expect(record.initial.backend).not.toMatch(/SwiftShader|llvmpipe|software/i);
      for(const [view,name] of [['exterior','01-exterior'],['side','02-side'],['top','03-top'],['cockpit','04-pilot'],['cabin','05-cabin'],['bores','06-mining-heads']]){
        await activate(page.locator(`[data-view="${view}"]`));await page.waitForTimeout(120);await capture(name);
        if(view==='cockpit')await inspectDisplays();
      }
      record.controls=await page.locator('.controls').evaluate(element=>({horizontalOverflow:document.documentElement.scrollWidth>innerWidth,
        buttons:Array.from(element.querySelectorAll('button')).filter(b=>b.getClientRects().length).map(b=>({id:b.id||b.dataset.view||b.dataset.lookMfd,width:b.getBoundingClientRect().width,height:b.getBoundingClientRect().height}))}));
      expect(record.controls.horizontalOverflow).toBe(false);for(const b of record.controls.buttons)expect(b.height).toBeGreaterThanOrEqual(44);
      await activate(page.locator('[data-view="rear"]'));await activate(page.locator('#ramp-toggle'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().rampProgress>.18&&window.stratumStudio.snapshot().rampProgress<.65);
      await capture('07-ramp-moving');await page.waitForFunction(()=>window.stratumStudio.snapshot().rampReady);await capture('08-ramp-deployed');
      await activate(page.locator('#gear-toggle'));await expect(page.locator('#mechanism-status')).toContainText('Close and stow');expect((await snapshot()).gearProgress).toBe(1);
      await activate(page.locator('#ramp-toggle'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().rampProgress>.25&&window.stratumStudio.snapshot().rampProgress<.70);
      await capture('08b-ramp-closing');await page.waitForFunction(()=>window.stratumStudio.snapshot().secured);
      await activate(page.locator('[data-view="belly"]'));await capture('09a-gear-down-before');await activate(page.locator('#gear-toggle'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().gearProgress<.75&&window.stratumStudio.snapshot().gearProgress>.15);
      await capture('09-gear-moving');await page.waitForFunction(()=>window.stratumStudio.snapshot().gearProgress===0);await capture('10-gear-stowed');
      await activate(page.locator('#gear-toggle'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().gearProgress>.25&&window.stratumStudio.snapshot().gearProgress<.75);
      await capture('10b-gear-extending');await page.waitForFunction(()=>window.stratumStudio.snapshot().gearProgress===1);await capture('11-gear-deployed');
      await activate(page.locator('[data-view="bores"]'));await capture('12-heads-neutral-before');
      await rangeTo('yaw',-.20);await rangeTo('pitch',-.12);await capture('13-heads-negative-low');
      await rangeTo('yaw',.20);await capture('14-heads-positive-low');
      await rangeTo('pitch',.14);await capture('15-heads-positive-high');
      await rangeTo('yaw',-.20);await capture('16-heads-negative-high');
      await activate(page.locator('[data-view="exterior"]'));await capture('16b-heads-complete-pair');
      await activate(page.locator('#heads-neutral'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().aim.every(p=>p.yaw===0&&p.pitch===0));
      await activate(page.locator('[data-view="bores"]'));await capture('17-heads-neutral-return');
      const native=await page.evaluate(()=>window.stratumInputReceipt);
      expect(native.filter(e=>e.type==='input'&&(e.target==='yaw'||e.target==='pitch')).length).toBeGreaterThan(20);
      expect(native.every(e=>e.trusted)).toBe(true);expect(errors).toEqual([]);record.complete=true;
    } finally {
      record.errors=errors;record.warnings=warnings;record.finished=new Date().toISOString();record.last=await snapshot().catch(()=>null);
      record.inputEvents=await page.evaluate(()=>window.stratumInputReceipt).catch(()=>[]);
      await fs.mkdir(path.dirname(info.outputPath('capture.json')),{recursive:true});
      await fs.writeFile(info.outputPath('capture.json'),JSON.stringify(record,null,2)+'\n');await cdp?.detach();await context.close();
    }
  });
}
