import { DEV_SHIPS, DEV_LOCATIONS, devLaunchURL } from './dev-launch-options.js';
import { sandboxURL } from './build/sandbox.js';
import './dev-launcher.css';

export function createDevLauncher({nav,options,seed,publicBuild=false,available=()=>true}){
  const trigger=document.createElement('button');trigger.id='dev-launch-button';trigger.type='button';trigger.textContent=publicBuild?'SCENES · SHIP / LOCATION':'DEV · SHIP / LOCATION';trigger.title='Scene options · F2 / Menu → Dev';trigger.disabled=true;
  const dialog=document.createElement('dialog');dialog.id='dev-launcher';dialog.setAttribute('aria-labelledby','dev-launch-title');
  dialog.innerHTML='<header><div><p class="dev-eyebrow">LOCAL DEVELOPMENT / ALL FEATURES</p><h2 id="dev-launch-title">Choose your next test.</h2></div><button type="button" data-controller-key="dev-close" aria-label="Close test launcher">×</button></header><p class="dev-intro">Choose a ship and start anywhere. Each launch starts a fresh test session; your regular save stays separate.</p><div class="dev-choices"><section><h3>01 / Ship</h3><div class="dev-ships"></div><p class="dev-asset-note">Atlas is the 64 m freighter with a cargo deck, front and rear loading ramps, and a crew lift.</p></section><section><h3>02 / Location</h3><div class="dev-locations" data-controller-scroll></div></section></div><footer><div><strong class="dev-selection" role="status"></strong><span class="dev-seed"></span></div><button class="dev-launch" type="button" data-controller-key="dev-launch">Launch test flight ↗</button></footer><div class="dev-footer"><span>D-pad / left stick · Select &nbsp; A · Confirm &nbsp; B · Back<br>F2 reopens this launcher during play.</span><a href="/dev/atlas-mark-ii.html" data-controller-key="dev-atlas-studio">Atlas Mark II studio ↗</a></div>';
  if(publicBuild){dialog.querySelector('.dev-eyebrow').textContent='SOLO EXPLORER / DEVELOPMENT SNAPSHOT';dialog.querySelector('#dev-launch-title').textContent='Choose your next scene.';dialog.querySelector('.dev-intro').textContent='Your machine runs the universe. Choose a ship and a starting point, inspect the content, or test a system. Test sessions stay separate from your regular browser save.';}
  let ship=options.ship,location=options.location,ready=false;
  const exteriorLink=document.createElement('a');
  exteriorLink.textContent='Station exterior · overview ↗';
  exteriorLink.dataset.controllerKey='dev-station-exterior';
  const exteriorURL=new URL(devLaunchURL(window.location.href,{ship:'kestrel',location:'orbit'}));
  for(const [key,value] of Object.entries({dev:'1',intro:'0',ship:'kestrel',start:'orbit',stationExterior:'1',exteriorView:'overview',seed:String(seed)}))exteriorURL.searchParams.set(key,value);
  exteriorLink.href=exteriorURL.href;
  dialog.querySelector('.dev-footer').append(exteriorLink);
  const roverLink=document.createElement('a');roverLink.textContent='Atlas + Burrow mining rover · Selene ↗';roverLink.dataset.controllerKey='dev-mining-rover';const roverURL=new URL(devLaunchURL(window.location.href,{ship:'atlas',location:'moon'}));for(const [key,value] of Object.entries({dev:'1',intro:'0',ship:'atlas',start:'moon',rover:'1',seed:String(seed)}))roverURL.searchParams.set(key,value);roverLink.href=roverURL.href;dialog.querySelector('.dev-footer').append(roverLink);
  const roverSurfaceLink=document.createElement('a');roverSurfaceLink.textContent='Burrow mining — Selene surface ↗';roverSurfaceLink.dataset.controllerKey='dev-rover-surface';
  const roverSurfaceURL=devLaunchURL(window.location.href,{ship,location:'rover-surface'});roverSurfaceLink.href=roverSurfaceURL;dialog.querySelector('.dev-footer').prepend(roverSurfaceLink);
  const reviews=document.createElement('section');reviews.className='dev-review-list';reviews.hidden=true;reviews.setAttribute('aria-label','Content review pages');
  for(const [label,href,key] of [
    ['Burrow mining — Selene surface',roverSurfaceURL,'rover-surface'],
    ['Atlas + Burrow mining rover · Selene',roverURL.href,'rover'],
    ['Expedition character · animation studio','/dev/avatar-studio.html','character'],
    ['Atlas · 64 m asset studio','/dev/atlas-mark-ii.html','atlas'],
    ['Station exterior · overview',exteriorURL.href,'station'],
    ['Construction sandbox · saved supply bank',sandboxURL(window.location.href),'construction'],
    ['Kestrel counter prop · scale viewer','/dev/props.html?only=kestrel-maintenance-roll','props'],
    ['Sound studio · engines, flybys & effects','/tests/gameplay-audio.html','sound'],
  ]){const link=document.createElement('a');link.textContent=label;link.href=href;link.dataset.controllerKey='dev-review-'+key;reviews.append(link);}
  dialog.append(reviews);
  const shipButtons=[],locationButtons=[];
  const add=(item,parent,kind,handler)=>{const button=document.createElement('button');button.type='button';button.dataset.controllerKey='dev-'+kind+'-'+item.id;button.dataset[kind]=item.id;const title=document.createElement('strong'),detail=document.createElement('span');title.textContent=item.name;detail.textContent=item.detail;button.append(title,detail);button.addEventListener('click',()=>{handler(item.id);render();});parent.append(button);return button;};
  for(const item of DEV_SHIPS)shipButtons.push(add(item,dialog.querySelector('.dev-ships'),'ship',id=>{ship=id;if(DEV_LOCATIONS.find(s=>s.id===location)?.ship&&DEV_LOCATIONS.find(s=>s.id===location).ship!==id)location='hangar';}));
  for(const item of DEV_LOCATIONS)locationButtons.push(add(item,dialog.querySelector('.dev-locations'),'location',id=>{location=id;ship=DEV_LOCATIONS.find(s=>s.id===id).ship??ship;}));
  function render(){
    for(const b of shipButtons)b.setAttribute('aria-pressed',String(b.dataset.ship===ship));
    for(const b of locationButtons)b.setAttribute('aria-pressed',String(b.dataset.location===location));
    const surface=location==='rover-surface',meadow=location==='atlas-meadow';
    dialog.querySelector('.dev-selection').textContent=surface?'Burrow M-04 → Selene surface':DEV_SHIPS.find(s=>s.id===ship).name+' → '+DEV_LOCATIONS.find(s=>s.id===location).name;
    dialog.querySelector('.dev-seed').textContent=meadow?'Atlas + Burrow · original meadow seed 7291 · fresh test session':surface?'Temporary rover inventory · your selected ship stays at the station':'Shared procedural seed '+seed+' · ship unlocks bypassed in this test session';
    dialog.querySelector('.dev-launch').textContent=meadow?'Start meadow adventure ↗':surface?'Start ground mining ↗':'Launch test flight ↗';
    roverSurfaceLink.href=devLaunchURL(window.location.href,{ship,location:'rover-surface'});
  }
  function suspend(){nav.keys.clear();nav.toolTrigger=0;nav.gamepad.suspend();nav.resetSteering();}
  function open(){
    if(!ready||!available()||document.querySelector('dialog[open]'))return;
    suspend();nav.enabled=false;if(document.pointerLockElement)document.exitPointerLock();
    shipButtons.forEach(b=>b.toggleAttribute('data-controller-focus',b.dataset.ship===ship));render();dialog.showModal();shipButtons.find(b=>b.dataset.ship===ship).focus();
  }
  function resume(){suspend();nav.enabled=!document.querySelector('dialog[open]');if(nav.enabled)nav.canvas.focus({preventScroll:true});}
  trigger.addEventListener('click',open);
  dialog.querySelector('[data-controller-key="dev-close"]').onclick=()=>{dialog.close();resume();};
  dialog.addEventListener('close',resume);
  dialog.querySelector('.dev-launch').onclick=()=>window.location.assign(devLaunchURL(window.location.href,{ship,location}));
  document.addEventListener('keydown',e=>{if(e.code==='F2'&&!e.repeat&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)){e.preventDefault();if(dialog.open){dialog.close();resume();}else open();}});
  document.body.append(trigger,dialog);render();
  return {open,ready(){ready=true;trigger.disabled=false;},get state(){return {ship,location,open:dialog.open,ready};}};
}
