import {test,expect} from '@playwright/test';
import {mkdir,writeFile} from 'node:fs/promises';
const output=process.env.MENU_EVIDENCE||'/tmp/star-agent-menu-evidence';
async function setup(page){
 await page.addInitScript(()=>{window.menuPad={id:'Standard menu controller',index:0,connected:true,mapping:'standard',axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>[window.menuPad]});});
 await page.route('**/api/auth/session',route=>route.fulfill({json:{account:null}}));
 await page.goto('/?dev=1&ship=nomad&start=orbit&intro=0&debug');await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
 const frames=()=>page.evaluate(async()=>{for(let i=0;i<4;i++)await new Promise(r=>requestAnimationFrame(r));});
 const button=async(i,down)=>{await page.evaluate(({i,down})=>window.menuPad.buttons[i]={pressed:down,value:+down},{i,down});await frames();};
 const tap=async i=>{await button(i,true);await button(i,false);};return {frames,button,tap};
}
async function overflow(page){return page.evaluate(()=>{
 const d=document.querySelector('dialog[open]'),c=d.querySelector('.gameplay-content'),r=c.getBoundingClientRect();
 return {dialog:d.id,content:[c.clientHeight,c.scrollHeight,c.clientWidth,c.scrollWidth],clipped:[...c.querySelectorAll('button,a,input')].filter(el=>!el.closest('[hidden]')&&el.getClientRects().length&&getComputedStyle(el).visibility!=='hidden').filter(el=>{const b=el.getBoundingClientRect();return b.top<r.top-2||b.bottom>r.bottom+2||b.left<r.left-2||b.right>r.right+2;}).map(el=>el.dataset.controllerKey||el.id||el.textContent.trim())};
});}

test('every gameplay tab fits desktop and phone with real panels and no scrolling',async({page,browser})=>{
 await mkdir(output,{recursive:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 const {tap,frames}=await setup(page);await tap(9);await expect(page.locator('#patrol-console')).toBeVisible();
 const findings=[];
 for(const size of [{width:1440,height:900},{width:390,height:844}]){
  await page.setViewportSize(size);await frames();
  for(const tab of ['comms','map','contracts','inventory','loadout','ship','settings','dev']){
   await page.locator(`dialog[open] [data-tab="${tab}"]`).click();await expect(page.locator('dialog[open]')).toHaveAttribute('data-gameplay-tab',tab);await frames();
   if(tab==='dev'){await page.locator('[data-dev-page="launch"]').click();await frames();}
   const check=await overflow(page);findings.push({size,tab,...check});await page.screenshot({path:`${output}/${size.width}-${tab}.png`});
  }
  await page.locator('dialog[open] [data-tab="ship"]').click();await page.locator('dialog[open] [data-controller-key="recipes"]').click();await expect(page.locator('#build-dialog')).toBeVisible();await frames();findings.push({size,tab:'recipes',...await overflow(page)});
  await page.locator('dialog[open] [data-tab="ship"]').click();await expect(page.locator('#controller-menu')).toBeVisible();await frames();for(let i=0;i<3&&!await page.locator('dialog[open] [data-controller-key="fleet"]').isVisible();i++)await page.locator('dialog[open] [data-controller-key="page-ship systems-next"]').click();await page.locator('dialog[open] [data-controller-key="fleet"]').click();await frames();findings.push({size,tab:'fleet',...await overflow(page)});
  await page.locator('dialog[open] [data-tab="comms"]').click();await page.locator('[data-controller-key="comms-account"]').click();await expect(page.locator('#multiplayer-account-dialog')).toBeVisible();await frames();findings.push({size,tab:'account',...await overflow(page)});
  await page.locator('[data-controller-key="edit-login-email"]').click();await frames();findings.push({size,tab:'account-keyboard',...await overflow(page)});await page.screenshot({path:`${output}/${size.width}-account-keyboard.png`});
  await page.locator('[data-controller-key="keyboard-done"]').click();await page.locator('dialog[open] [data-tab="dev"]').click();
  await page.locator('[data-dev-page="consoles"]').click();await expect(page.locator('.dev-console-list')).toBeVisible();findings.push({size,tab:'dev-consoles',...await overflow(page)});await page.screenshot({path:`${output}/${size.width}-dev-consoles.png`});
  await page.locator('[data-controller-key="dev-console-settings"]').click();await page.locator('dialog[open] [data-controller-key="controller-layout"]').click();await expect(page.locator('#controller-layout')).toBeVisible();await frames();findings.push({size,tab:'controller-layout',...await overflow(page)});await page.screenshot({path:`${output}/${size.width}-controls.png`});
 }
 await page.keyboard.press('Escape');await page.waitForFunction(()=>window.starAgent.state.enabled);await page.keyboard.press('Escape');await expect(page.locator('dialog[open].gameplay-screen')).toBeVisible();
 await writeFile(`${output}/layout.json`,JSON.stringify({browser:browser.version(),findings,errors},null,2));
 expect(errors).toEqual([]);expect(findings.filter(x=>x.content[1]>x.content[0]+2||x.content[3]>x.content[2]+2||x.clipped.length)).toEqual([]);
});

test('controller tabs transact inventory and loadout, page Dev tools and suppress held input',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));const {tap,button,frames}=await setup(page);
 async function tab(id){for(let i=0;i<8;i++){if(await page.locator('dialog[open]').getAttribute('data-gameplay-tab')===id)return;await tap(5);}throw Error(`Missing tab ${id}`);}
 async function choose(key){for(let i=0;i<90;i++){if(await page.evaluate(key=>document.activeElement?.dataset.controllerKey===key,key)){await tap(0);return;}await tap(13);}throw Error(`Missing control ${key}`);}
 await tap(9);await tab('inventory');await choose('location-ship');
 const before=await page.evaluate(()=>window.starAgent.state.containers.containers.find(c=>c.id==='pack').items['ration']);
 await choose('pack-0');await choose('transfer-one');
 const after=await page.evaluate(()=>window.starAgent.state.containers.containers.find(c=>c.id==='pack').items['ration']);expect(after).toBe(before-1);
 await tab('loadout');await choose('equipment-tool');await choose('stow-tool-pack');await page.waitForFunction(()=>!window.starAgent.state.loadout.slots.tool);
 await choose('assign-tool-pack-mining-laser-tool');await page.waitForFunction(()=>window.starAgent.state.loadout.slots.tool?.item==='mining-laser-tool');
 await page.setViewportSize({width:390,height:844});await frames();
 await choose('page-equipment slots-next');await choose('equipment-quick1');expect(await page.locator('[data-equipment-slot="quick1"]').getAttribute('aria-pressed')).toBe('true');
 expect((await overflow(page)).clipped).toEqual([]);
 await tab('dev');await choose('dev-page-launch');await choose('page-test locations-next');await choose('dev-location-orbit');
 expect(await page.evaluate(()=>window.starAgent.state.dev.location)).toBe('orbit');
 await choose('dev-page-consoles');await choose('dev-console-comms');await expect(page.locator('#multiplayer-comms-dialog')).toBeVisible();
 await tab('contracts');await button(7,true);await tap(1);await frames();
 const shots=await page.evaluate(()=>window.starAgent.state.effects.weaponShots);expect(await page.evaluate(()=>window.starAgent.state.controller.armed)).toBe(false);
 for(const kind of ['focus','disconnect','replacement']){
  await page.evaluate(kind=>{if(kind==='focus')window.dispatchEvent(new Event('blur'));if(kind==='disconnect')window.menuPad.connected=false;if(kind==='replacement')window.menuPad.id+=' replacement';},kind);await frames();
  await page.evaluate(()=>{window.menuPad.connected=true;window.dispatchEvent(new Event('focus'));});await frames();expect(await page.evaluate(()=>window.starAgent.state.effects.weaponShots)).toBe(shots);
 }
 await button(7,false);await page.waitForFunction(()=>window.starAgent.state.controller.armed);await button(7,true);await page.waitForFunction(shots=>window.starAgent.state.effects.weaponShots>shots,shots);await button(7,false);
 expect(await page.evaluate(()=>window.starAgent.state.enabled)).toBe(true);expect(errors).toEqual([]);
});
