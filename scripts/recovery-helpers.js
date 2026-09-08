import {mkdir,appendFile} from 'node:fs/promises';
import {frames} from './transport-helpers.js';
export {walk,aim,capture,graphics,focusInterruption,frames} from './transport-helpers.js';
const out=process.env.TRANSPORT_EVIDENCE;
export async function setup(page,site='orbit'){
 await mkdir(out,{recursive:true});const errors=[],warnings=[];
 page.on('requestfailed',r=>{appendFile(`${out}/requests.log`,`${r.url()} ${JSON.stringify(r.failure())}\n`).catch(()=>{});});
 page.on('pageerror',e=>{errors.push(e.message);appendFile(`${out}/diagnostics.log`,e.message+'\n').catch(()=>{});});page.on('console',m=>{if(m.type()==='error'){errors.push(m.text());appendFile(`${out}/diagnostics.log`,m.text()+'\n').catch(()=>{});}if(m.type()==='warning')warnings.push(m.text());});
 await page.addInitScript(()=>{window.transportPad={id:'Settlement standard Gamepad',mapping:'standard',index:0,connected:true,axes:[0,0,0,0],buttons:Array.from({length:17},()=>({pressed:false,value:0}))};Object.defineProperty(navigator,'getGamepads',{value:()=>window.transportDisconnected?[]:[window.transportPad]});});
 await page.route('**/api/auth/session',r=>r.fulfill({json:{account:null}}));
 await page.goto(`/?dev=1&ship=nomad&start=${site}&intro=0&debug&seed=7291`);
 await page.waitForFunction(()=>window.starAgent?.state.ready&&window.starAgent.state.enabled&&!window.starAgent.state.transiting&&window.starAgent.state.controller.armed,undefined,{timeout:90000});
 if(site.startsWith('settlement-'))await page.waitForFunction(()=>window.starAgent.state.settlements.ready&&window.starAgent.state.settlements.rendered>0);
 const button=async(i,pressed)=>{await page.evaluate(({i,pressed})=>window.transportPad.buttons[i]={pressed,value:+pressed},{i,pressed});await frames(page);};
 const tap=async i=>{await button(i,true);await button(i,false);};
 const choose=async key=>{if(key.startsWith('transport-accept-')){for(let p=0;p<4&&!await page.locator(`[data-controller-key="${key}"]`).count();p++)await choose('next-page');}for(let i=0;i<95;i++){if(await page.evaluate(k=>document.activeElement?.dataset.controllerKey===k,key)){await tap(0);return;}await tap(13);}throw Error(`Missing controller action ${key}`);};
 return {tap,button,choose,errors,warnings};
}
