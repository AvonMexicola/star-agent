import { test, expect } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

test('character studio renders the suit, animation library and equipment at desktop and phone sizes', async ({ page }) => {
  const out = join(process.env.CHARACTER_EVIDENCE || '/tmp', 'studio'); await mkdir(out, { recursive: true });
  const errors = [], warnings = [], views = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if(m.type()==='error')errors.push(m.text()); if(m.type()==='warning')warnings.push(m.text()); });
  page.on('response', response => { if(response.status()>=400)errors.push(`${response.status()} ${response.url()}`); });
  await page.goto('/dev/avatar-studio.html');
  await page.waitForFunction(()=>window.avatarStudio?.state.ready);
  await expect(page.locator('#avatar-status')).toBeEmpty();
  expect(await page.evaluate(()=>window.avatarStudio.state.missingClips)).toEqual([]);
  const frames = async (count=30) => page.evaluate(async count=>{for(let i=0;i<count;i++)await new Promise(r=>requestAnimationFrame(r));},count);
  const capture = async name => {
    await frames(); await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
    views.push({name,state:await page.evaluate(()=>window.avatarStudio.state)});
  };
  await capture('01-expedition-idle');
  await page.setViewportSize({width:390,height:844}); await capture('01-expedition-idle-phone');
  await page.setViewportSize({width:1440,height:900});
  for(const motion of ['walk','run','crouch','sit','climb','rest']){
    await page.getByLabel('Movement',{exact:true}).selectOption(motion);
    await page.waitForFunction(motion=>window.avatarStudio.state.transition===null&&window.avatarStudio.state.characterState===motion,motion);
    await capture(`motion-${motion}`);
  }
  await page.getByLabel('Movement',{exact:true}).selectOption('idle');
  await page.waitForFunction(()=>window.avatarStudio.state.transition===null);
  await page.getByRole('button',{name:'Wave',exact:true}).click();
  await page.waitForFunction(()=>window.avatarStudio.character.actions.wave.time>1.6);
  await capture('gesture-wave');
  await page.waitForFunction(()=>window.avatarStudio.state.characterState==='idle');
  for(const item of ['rifle-laser','sidearm-pistol','mining-laser-tool']){
    await page.getByLabel('Equipment',{exact:true}).selectOption(item);
    await expect(page.locator('#avatar-fire')).toBeEnabled();
    for(const view of ['Hands','Side','Back']){
      await page.getByRole('button',{name:view,exact:true}).click(); await capture(`${item}-${view.toLowerCase()}`);
    }
    await page.getByLabel('Movement',{exact:true}).selectOption('run');
    await capture(`${item}-running`);
    await page.getByLabel('Movement',{exact:true}).selectOption('idle');
  }
  await page.getByLabel('Equipment',{exact:true}).selectOption('rifle-laser');
  await page.getByRole('button',{name:'Front',exact:true}).click();
  await page.setViewportSize({width:390,height:844});
  await capture('phone-equipment');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
  await page.getByLabel('Character',{exact:true}).selectOption('player-male');
  await page.waitForFunction(()=>window.avatarStudio?.state.ready); await capture('00-previous-suit-phone');
  await page.setViewportSize({width:1440,height:900});
  await capture('00-previous-suit');
  const environment = await page.evaluate(()=>{const gl=document.querySelector('canvas').getContext('webgl2'),ext=gl.getExtension('WEBGL_debug_renderer_info');return {renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),size:[innerWidth,innerHeight]};});
  await writeFile(`${out}/evidence.json`,JSON.stringify({environment,errors,warnings,views},null,2));
  expect(errors).toEqual([]);expect(warnings).toEqual([]);
});
