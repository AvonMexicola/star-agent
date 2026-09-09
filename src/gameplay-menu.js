import './gameplay-menu.css';

const text=(el,value)=>{if(el.textContent!==value)el.textContent=value;};
const setHidden=(el,value)=>{if(el.hidden!==value)el.hidden=value;};

/** Common chrome around the real gameplay dialogs. A tab switch waits for the
 * old screen's close cleanup before opening the next; there is no second store
 * or copied action implementation. Long lists use explicit, focusable pages. */
export function createGameplayMenu({nav,screens,dev=false}){
  const tabs=screens.filter(s=>!s.dev||dev),records=new Map(),pages=new Map();
  let selected='contracts',switching=false,scheduled=false;
  const active=()=>[...records.keys()].find(d=>d.open);
  const topDialog=()=>[...document.querySelectorAll('dialog[open]')].at(-1);
  const tabFor=d=>d.id==='cargo-dialog'?(d.classList.contains('equipment-view')?'loadout':'inventory'):records.get(d)?.tab;
  async function open(id=selected){
    const tab=tabs.find(t=>t.id===id);if(!tab||switching)return;
    const current=topDialog();
    if(current&&!records.has(current))return;
    switching=true;
    try{
      if(current)await new Promise(resolve=>{current.addEventListener('close',resolve,{once:true});current.close();});
      nav.keys.clear();nav.gamepad.suspend();
      tab.open();
      const next=active();if(next){selected=id;refresh(next);nav.enabled=false;}
    }finally{switching=false;}
  }
  function paginate(root,selector,key,size){
    const items=[...root.querySelectorAll(selector)].filter(el=>!el.dataset.menuExcluded);
    if(!items.length)return;
    let pager=root.querySelector(`:scope > [data-pager="${key}"]`);
    if(!pager){
      pager=document.createElement('nav');pager.className='gameplay-pagination';pager.dataset.pager=key;pager.setAttribute('aria-label',`${key} pages`);
      pager.innerHTML=`<button type="button" data-controller-key="page-${key}-previous" aria-label="Previous ${key} page">‹</button><span role="status"></span><button type="button" data-controller-key="page-${key}-next" aria-label="Next ${key} page">›</button>`;
      const buttons=pager.querySelectorAll('button');
      buttons[0].onclick=()=>{pages.set(key,(pages.get(key)||0)-1);refresh(active());};
      buttons[1].onclick=()=>{pages.set(key,(pages.get(key)||0)+1);refresh(active());};root.append(pager);
    }
    const count=Math.ceil(items.length/size),page=Math.max(0,Math.min(count-1,pages.get(key)||0));pages.set(key,page);
    items.forEach((item,i)=>setHidden(item,i<page*size||i>=(page+1)*size));
    setHidden(pager,count<=1);text(pager.querySelector('span'),`${page+1} / ${count}`);
    // Keep page arrows focusable at the boundaries so controller focus does not
    // jump to a different action when the currently selected page changes.
    const buttons=pager.querySelectorAll('button');buttons[0].setAttribute('aria-disabled',String(page===0));buttons[1].setAttribute('aria-disabled',String(page===count-1));
  }
  function refresh(dialog){
    if(!dialog?.open)return;
    const tab=tabFor(dialog);selected=tab;
    if(dialog.dataset.gameplayTab!==tab)dialog.dataset.gameplayTab=tab;
    for(const button of dialog.querySelectorAll('.gameplay-tabs button')){
      const value=String(button.dataset.tab===tab);if(button.getAttribute('aria-selected')!==value)button.setAttribute('aria-selected',value);
    }
    text(dialog.querySelector('.gameplay-context'),tabs.find(t=>t.id===tab)?.label??'Pilot systems');
    const compact=innerWidth<750||innerHeight<720;
    if(dialog.id==='controller-menu'){
      const list=dialog.querySelector('.controller-command-list');
      paginate(list,':scope > button','ship systems',compact?6:15);
    }
    if(dialog.id==='cargo-dialog'){
      const columns=dialog.querySelector('.inventory-columns');
      for(const c of columns.querySelectorAll('.inventory-container'))paginate(c,'.inventory-box',`boxes-${c.dataset.container}`,1);
      const containers=[...columns.children].filter(el=>el.matches('.inventory-container'));
      const context=columns.querySelector('.inventory-empty-context');if(context)setHidden(context,compact||containers.length>1);
      paginate(columns,':scope > .inventory-container','containers',compact?1:2);
      const grid=dialog.querySelector('.loadout-grid');if(grid)paginate(grid,':scope > button','equipment slots',compact?4:12);
      const candidates=dialog.querySelector('.loadout-candidates');if(candidates)paginate(candidates,':scope > button','available equipment',compact?1:3);
    }
    if(dialog.id==='fleet-dialog')paginate(dialog.querySelector('.fleet-ships'),':scope > article','fleet',compact?1:3);
    if(dialog.id==='station-elevator-dialog')paginate(dialog.querySelector('.station-destinations'),':scope > button','berths',innerHeight<550?2:compact?6:12);
    if(dialog.id==='build-dialog')paginate(dialog.querySelector('.build-content'),':scope > .build-piece,:scope > .build-recipe','construction',2);
    if(dialog.id==='dev-launcher'){
      paginate(dialog.querySelector('.dev-locations'),':scope > button','test locations',compact?4:8);
      const reviews=dialog.querySelector('.dev-review-list');if(reviews)paginate(reviews,':scope > a','content reviews',compact?3:6);
    }
    if(dialog.id==='multiplayer-comms-dialog')paginate(dialog.querySelector('.mp-roster'),':scope > .mp-pilot','pilots',compact?3:6);
    if(dialog.id==='multiplayer-inventory-dialog')paginate(dialog.querySelector('.mp-inventory-list'),':scope > *:not(.gameplay-pagination)','server items',compact?1:3);
    if(dialog.id==='controller-layout'){
      const board=dialog.querySelector('.layout-board');
      paginate(board,'.layout-left > div','left controls',compact?3:8);
      paginate(board,'.layout-right > div','right controls',compact?3:8);
    }
  }
  function schedule(){if(scheduled)return;scheduled=true;requestAnimationFrame(()=>{scheduled=false;refresh(active());});}
  for(const tab of tabs)for(const id of tab.dialogs){
    const dialog=document.getElementById(id);if(!dialog||records.has(dialog))continue;
    records.set(dialog,{tab:tab.id});dialog.classList.add('gameplay-screen');
    const content=document.createElement('div');content.className='gameplay-content';content.id=`gameplay-panel-${id}`;content.setAttribute('role','tabpanel');content.append(...dialog.childNodes);dialog.append(content);
    const header=document.createElement('header');header.className='gameplay-header';
    header.innerHTML=`<div class="gameplay-brand"><span class="gameplay-mark" aria-hidden="true">✧</span><strong>Pilot interface</strong><span class="gameplay-context"></span></div><button type="button" class="gameplay-resume" data-controller-key="gameplay-resume">Resume <kbd>Esc / B</kbd></button><nav class="gameplay-tabs" role="tablist" aria-label="Gameplay screens">${tabs.map(t=>`<button type="button" role="tab" aria-controls="gameplay-panel-${id}" data-tab="${t.id}" data-controller-key="tab-${t.id}" aria-selected="false">${t.label}</button>`).join('')}</nav>`;
    header.querySelector('.gameplay-resume').onclick=()=>dialog.close();
    for(const button of header.querySelectorAll('[data-tab]'))button.onclick=()=>open(button.dataset.tab);
    const footer=document.createElement('footer');footer.className='gameplay-footer';footer.innerHTML='<span><kbd>LB / RB</kbd> Tabs <span class="gameplay-keyboard-tabs">· <kbd>[ / ]</kbd> Keyboard tabs</span></span><span>D-pad selects · A confirms · B resumes</span>';
    if(dialog.id==='build-dialog')footer.firstElementChild.innerHTML='<kbd>LB / RB</kbd> Build tabs · <kbd>[ / ]</kbd> Gameplay tabs';
    dialog.prepend(header);dialog.append(footer);
    const observer=new MutationObserver(schedule);observer.observe(dialog,{attributes:true,attributeFilter:['open','class'],childList:true,subtree:true});
    dialog.addEventListener('close',()=>{nav.gamepad.suspend();if(active())nav.enabled=false;});
  }
  // Commands already represented by top-level screens are removed from the Ship
  // grid; their real handlers remain available to existing contextual shortcuts.
  const commands=document.querySelector('#controller-menu .controller-command-list');
  const shipKeys=new Set(['sentry-deploy','resume','combat-mode','free-drive','gear','lights','camera-view','wave','combat-target','power','fleet','crash-recover','weapon-pulse','weapon-laser','weapon-void','build','build-sandbox','sandbox-exit','recipes','tool']);
  if(commands)for(const button of commands.children)if(!shipKeys.has(button.dataset.controllerKey)){button.dataset.menuExcluded='true';button.hidden=true;}
  document.addEventListener('keydown',event=>{
    if(event.repeat||event.target.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"])'))return;
    if(event.code==='Tab'&&!event.shiftKey&&!event.altKey&&!event.ctrlKey&&!event.metaKey&&!document.querySelector('dialog[open]')&&nav.enabled&&nav.focused&&!nav.openingActive&&nav.mode!=='destroyed'){event.preventDefault();open('contracts');return;}
    if(event.code==='Escape'&&!document.querySelector('dialog[open]')&&nav.enabled&&!nav.openingActive&&nav.mode!=='destroyed'){event.preventDefault();open();return;}
    if(!active()||topDialog()!==active())return;
    if(['BracketLeft','BracketRight'].includes(event.code)){event.preventDefault();step(event.code==='BracketLeft'?-1:1);}
  });
  window.addEventListener('resize',schedule);
  function step(direction){const id=tabFor(active()),index=tabs.findIndex(t=>t.id===id);open(tabs[(index+direction+tabs.length)%tabs.length].id);}
  return {open,get active(){return Boolean(active());},controller(pad){
    if(!active()||topDialog()!==active())return false;
    if(pad.ui?.pressed.has(4)||pad.ui?.pressed.has(5)){
      // The build wheel owns these edges for its piece categories. Let the
      // shared dialog router apply its action and neutral-input gate first.
      if(active()?.controllerAction)return false;
      step(pad.ui.pressed.has(4)?-1:1);return true;
    }
    return switching;
  }};
}
