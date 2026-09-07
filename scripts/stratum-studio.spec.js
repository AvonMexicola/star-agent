import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';
import path from 'node:path';

// Start the separate production studio and acquire the shared GPU queue before
// invoking this file. It checks the actual UI/asset; no nav/gameplay claims.
for(const device of [{name:'desktop',width:1440,height:900,touch:false},{name:'phone',width:390,height:844,touch:true}]){
  test(`Stratum native ${device.name} views and real mechanism controls`,async({browser,baseURL},info)=>{
    const context=await browser.newContext({viewport:{width:device.width,height:device.height},hasTouch:device.touch,isMobile:device.touch,
      recordVideo:{dir:info.outputPath('video'),size:{width:device.width,height:device.height}}});
    const page=await context.newPage(),errors=[],warnings=[],record={device,started:new Date().toISOString(),scope:'authored studio; no flight/mining/persistence or hardware controller claim',views:[]};
    page.on('pageerror',error=>errors.push(error.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());else if(m.type()==='warning')warnings.push(m.text());});
    const activate=async locator=>device.touch?locator.tap():locator.click();
    const snapshot=()=>page.evaluate(()=>window.stratumStudio.snapshot());
    async function capture(name){await page.screenshot({path:info.outputPath(name+'.png')});record.views.push({name,...await snapshot()});}
    try{
      await page.goto(new URL('/public/dev/stratum.html',baseURL).href,{waitUntil:'networkidle'});
      await page.waitForFunction(()=>window.stratumStudio?.snapshot().assetStatus==='ready');
      await page.waitForFunction(()=>window.stratumStudio.snapshot().frames>=10);
      record.browser=browser.version();record.initial=await snapshot();
      expect(record.initial.backend).not.toMatch(/SwiftShader|llvmpipe|software/i);
      for(const [view,name] of [['exterior','01-exterior'],['side','02-side'],['top','03-top'],['cockpit','04-pilot'],['cabin','05-cabin'],['bores','06-mining-heads']]){
        await activate(page.locator(`[data-view="${view}"]`));await page.waitForTimeout(120);await capture(name);
      }
      await activate(page.locator('[data-view="rear"]'));
      await activate(page.locator('#ramp-toggle'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().rampProgress>.18&&window.stratumStudio.snapshot().rampProgress<.65);
      await capture('07-ramp-moving');
      await page.waitForFunction(()=>window.stratumStudio.snapshot().rampReady);
      await capture('08-ramp-deployed');
      await activate(page.locator('#gear-toggle'));
      await expect(page.locator('#mechanism-status')).toContainText('Close and stow');
      expect((await snapshot()).gearProgress).toBe(1);
      await activate(page.locator('#ramp-toggle'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().secured);
      await activate(page.locator('[data-view="belly"]'));await activate(page.locator('#gear-toggle'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().gearProgress<.75&&window.stratumStudio.snapshot().gearProgress>.15);
      await capture('09-gear-moving');
      await page.waitForFunction(()=>window.stratumStudio.snapshot().gearProgress===0);await capture('10-gear-stowed');
      await activate(page.locator('#gear-toggle'));
      await page.waitForFunction(()=>window.stratumStudio.snapshot().gearProgress===1);await capture('11-gear-deployed');
      const yaw=page.locator('#yaw');await yaw.focus();await page.keyboard.press('ArrowRight');
      await page.waitForFunction(()=>window.stratumStudio.snapshot().aim[0].yaw>0);
      await activate(page.locator('[data-view="exterior"]'));await capture('12-aimed');
      expect(errors).toEqual([]);record.complete=true;
    }finally{
      record.errors=errors;record.warnings=warnings;record.finished=new Date().toISOString();
      record.last=await snapshot().catch(()=>null);await fs.mkdir(path.dirname(info.outputPath('capture.json')),{recursive:true});
      await fs.writeFile(info.outputPath('capture.json'),JSON.stringify(record,null,2)+'\n');await context.close();
    }
  });
}
