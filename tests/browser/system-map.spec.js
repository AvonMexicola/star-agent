import {test,expect} from '@playwright/test';
import {setupNavigation,frames,evidence,mapBody,fits,record} from './navigation-helpers.js';

test('hierarchy centres stars and planets; sites and filters fit desktop and phone without scrolling',async({page,browser})=>{
 const {errors,requests}=await setupNavigation(page);await page.keyboard.press('m');
 const held=await page.evaluate(()=>({position:window.starAgent.state.position,frames:window.starAgent.state.renderedFrames}));await frames(page);
 expect(await page.evaluate(()=>window.starAgent.state.position)).toEqual(held.position);expect(await page.evaluate(()=>window.starAgent.state.renderedFrames)).toBe(held.frames);
 const findings=[];
 for(const size of [{width:1440,height:900},{width:390,height:844}]){
  await page.setViewportSize(size);await frames(page);
  for(const id of ['star','aeon','selene','pyre','miasma']){
   if(size.width<750)await page.locator('button[data-map-view="chart"]').click();
   await mapBody(page,id);await expect(page.locator(`[data-travel-target="${id}"]`)).toHaveAttribute('data-central','true');
   if(id==='aeon'){await expect(page.locator('[data-travel-target="selene"]')).toBeVisible();await expect(page.locator('[data-travel-target="station-aeon"]')).toBeVisible();}
   findings.push({size,id,view:'chart',...await fits(page)});await page.screenshot({path:`${evidence}/${size.width}-${id}.png`});
   for(const view of ['locations','signals','filters']){await page.locator(`button[data-map-view="${view}"]`).click();await frames(page);findings.push({size,id,view,...await fits(page)});if(id==='aeon'&&view==='locations')await page.screenshot({path:`${evidence}/${size.width}-surface-locations.png`});}
  }
 }
 await page.locator('[data-nav-filter="bases"]').click();await expect(page.locator('[data-nav-filter="bases"]')).toHaveAttribute('aria-pressed','true');
 await page.screenshot({path:`${evidence}/phone-filters.png`});await page.keyboard.press('Escape');
 expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.filters.bases)).toBe(true);
 await record(page,browser,'map-layout',{findings,errors,requests});expect(errors).toEqual([]);
});

test('controller reaches real surface and mission signals, toggles filters and returns safely',async({page,browser})=>{
 const {tap,button,choose,errors,requests}=await setupNavigation(page);await tap(9);await expect(page.locator('#patrol-console')).toBeVisible();await choose('patrol-accept');await tap(1);await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await tap(14);await choose('map-body-aeon');await choose('map-view-locations');await choose('map-signal-site-coast');expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.selectedId)).toBe('site-coast');
 await page.setViewportSize({width:390,height:844});await frames(page);await choose('nav-page-next');await choose('map-signal-site-polar');expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.selectedId)).toBe('site-polar');
 await fits(page);await page.setViewportSize({width:1440,height:900});await frames(page);
 await choose('map-view-filters');await choose('map-filter-missions');expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.filters.missions)).toBe(false);await choose('map-filter-missions');
 await choose('map-view-signals');await choose('map-signal-mission-patrol');expect(await page.evaluate(()=>window.starAgent.state.navigationTargets.selectedId)).toBe('mission-patrol');
 await button(7,true);await tap(1);await frames(page);const shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);await frames(page);expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(shots);await button(7,false);
 await page.waitForFunction(()=>window.starAgent.state.controller.armed);
 await expect(page.locator('#navigation-lock')).toContainText('Patrol signal');
 await page.evaluate(()=>{window.navPad.axes[2]=.7;});for(let i=0;i<12;i++)await frames(page);await page.evaluate(()=>{window.navPad.axes[2]=0;});
 await expect(page.locator('.navigation-marker[data-id="mission-patrol"]')).toBeVisible();await expect(page.locator('.combat-marker.waypoint')).toBeHidden();await page.screenshot({path:`${evidence}/mission-arrow.png`});
 await record(page,browser,'controller-signals',{errors,requests});expect(errors).toEqual([]);
});
