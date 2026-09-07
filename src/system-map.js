import { Vector3 } from 'three';
import { NAV_FILTERS, NAV_BODIES, BODY_PARENTS, navigationEndpoint } from './navigation-targets.js';
import './system-map.css';

export function formatRange(metres) {
  const km=metres/1000;return km>=1e6?`${(km/1e6).toFixed(2)} M km`:`${Math.round(km).toLocaleString('en-US')} km`;
}
export const travelPhaseLabel=phase=>({spooling:'ALIGNING / SPOOLING',accelerating:'ACCELERATING',cruising:'CRUISING',decelerating:'ARRIVAL BRAKING',cooldown:'DRIVE COOLDOWN',done:'ARRIVED'})[phase]??'STANDBY';

/** Hierarchy and selection only. The actual nose lock engages outside the modal. */
export function createSystemMap(nav,targets) {
  const dialog=document.createElement('dialog');dialog.id='system-map';dialog.className='navigation-map';dialog.setAttribute('aria-labelledby','system-map-title');
  dialog.innerHTML=`<header class="system-map-header dialog-top"><h2 id="system-map-title">Navigation</h2><button id="close-system-map" aria-label="Close system map">✕</button></header>
    <div class="nav-map-layout">
      <nav class="nav-breadcrumbs" aria-label="System hierarchy"></nav>
      <nav class="nav-map-views" aria-label="Navigation views"><button data-map-view="chart">Chart</button><button data-map-view="locations">Locations</button><button data-map-view="signals">Signals</button><button data-map-view="filters">Filters</button></nav>
      <section class="nav-map-chart" aria-label="System relationships"><div class="nav-chart-heading"><h3></h3><span>Relationship chart · orbits not to scale</span></div><div class="nav-orbits"><svg viewBox="0 0 600 400" preserveAspectRatio="none" aria-hidden="true"><ellipse cx="300" cy="200" rx="130" ry="92"/><ellipse cx="300" cy="200" rx="240" ry="160"/></svg><div class="nav-orbit-bodies"></div></div><p class="nav-chart-caption">Select a world to open its moons, station and surface sites.</p></section>
      <section class="nav-map-browser" aria-label="Navigation locations and filters"><h3 id="nav-list-title"></h3><div class="nav-map-list"></div><div class="nav-map-filters"></div><div class="nav-map-pages"><button id="nav-page-previous" aria-label="Previous navigation page">‹</button><span></span><button id="nav-page-next" aria-label="Next navigation page">›</button></div><p class="nav-map-empty"></p></section>
      <section class="nav-map-selection" aria-label="Selected destination"><div><span id="map-target-kind">Navigation target</span><h3 id="map-target-name">Choose a destination</h3><p id="map-route-status">Select a body or signal, then aim at its marker in flight.</p></div><dl><div><dt>Range to arrival</dt><dd id="map-distance">—</dd></div><div><dt>Arrival clearance</dt><dd id="map-approach">20 km</dd></div></dl><div class="nav-map-actions"><button id="map-clear">Clear target</button><button id="map-engage" class="primary-button" disabled>Follow bearing ↗</button></div></section>
    </div><footer class="system-map-footer"><button id="map-return">Return to flight</button><span>Flight held · M / Escape to close</span></footer>`;
  document.body.append(dialog);
  const el=id=>dialog.querySelector(`#${id}`),q=sel=>dialog.querySelector(sel);
  let context='star',view='locations',page=0,wasEnabled=true,returnFocus,timer,signature='',stick=0;
  const compact=()=>matchMedia('(max-width:749px), (max-height:719px)').matches;
  function button(label,key,click){const b=document.createElement('button');b.textContent=label;b.dataset.controllerKey=key;b.addEventListener('click',click);return b;}
  function focusRestore(key){if(key)dialog.querySelectorAll('[data-controller-key]').forEach(b=>{if(b.dataset.controllerKey===key&&!b.hidden)b.focus({preventScroll:true});});}
  function choose(id,{drill=false}={}){
    if(nav.travel)return;
    targets.select(id);
    if(drill&&NAV_BODIES.some(b=>b.id===id)){context=id;page=0;}
    render(true);
  }
  function listValues(all){
    if(view==='signals')return all.filter(t=>t.category!=='bodies'&&targets.filters[t.category]);
    return all.filter(t=>(t.surface||t.category==='bases')&&t.parent===context);
  }
  function render(force=false){
    const all=targets.targets(),selected=targets.selected;
    const currentSignature=JSON.stringify({context,view,page,compact:compact(),selected:selected?.id,filters:targets.filters,list:all.map(t=>[t.id,t.name,t.parent]),travel:Boolean(nav.travel)});
    if(force||currentSignature!==signature){
      signature=currentSignature;const focusKey=document.activeElement?.dataset.controllerKey;
      dialog.dataset.mapView=view;
      const crumbs=q('.nav-breadcrumbs');crumbs.replaceChildren();
      const path=[];let id=context;while(id){path.unshift(id);id=BODY_PARENTS[id];}
      path.forEach(id=>{const body=NAV_BODIES.find(b=>b.id===id);const b=button(body.name,`map-breadcrumb-${id}`,()=>{context=id;page=0;render(true);});b.setAttribute('aria-current',id===context?'location':'false');crumbs.append(b);});
      dialog.querySelectorAll('[data-map-view]').forEach(b=>{b.dataset.controllerKey=`map-view-${b.dataset.mapView}`;b.setAttribute('aria-pressed',String(view===b.dataset.mapView));});
      const central=all.find(t=>t.id===context),children=all.filter(t=>t.parent===context&&(t.category==='bodies'||t.category==='stations'));
      q('.nav-chart-heading h3').textContent=central.name;
      const orbitNodes=q('.nav-orbit-bodies');orbitNodes.replaceChildren();
      [central,...children].forEach((t,i)=>{
        const b=button('',`map-body-${t.id}`,()=>choose(t.id,{drill:true}));b.className='map-body';b.dataset.travelTarget=t.id;b.dataset.kind=t.kind.toLowerCase().replaceAll(' ','-');b.dataset.central=String(i===0);b.setAttribute('aria-label',`Select ${t.name}`);b.setAttribute('aria-pressed',String(t.id===selected?.id));b.disabled=Boolean(nav.travel);
        const dot=document.createElement('i'),label=document.createElement('strong'),kind=document.createElement('small');label.textContent=t.name;kind.textContent=t.kind;b.append(dot,label,kind);
        const slots=[[50,50],[23,29],[80,69],[76,22],[22,78]],pos=slots[i]??[50,85];b.style.left=`${pos[0]}%`;b.style.top=`${pos[1]}%`;orbitNodes.append(b);
      });
      q('.nav-chart-caption').textContent=children.length?'Select a world to explore it; select the centre to track it.':'No charted satellites. Choose a surface site or track the body at centre.';
      el('nav-list-title').textContent=view==='filters'?'Show navigation markers':view==='signals'?'Tracked signals':`${central.name} · surface locations`;
      q('.nav-map-list').replaceChildren();q('.nav-map-filters').replaceChildren();q('.nav-map-empty').textContent='';
      q('.nav-map-filters').hidden=view!=='filters';q('.nav-map-list').hidden=view==='filters';
      if(view==='filters'){
        for(const [id,label] of Object.entries(NAV_FILTERS)){
          const count=all.filter(t=>t.category===id).length;
          const b=button(`${label} · ${count}`,`map-filter-${id}`,()=>{targets.setFilter(id,!targets.filters[id]);render(true);});b.dataset.navFilter=id;b.setAttribute('aria-pressed',String(targets.filters[id]));q('.nav-map-filters').append(b);
        }
        q('.nav-map-empty').textContent='Friends / pilots shows the live Comms roster. Empty categories gain markers when signals exist.';
      }else{
        const values=listValues(all),size=compact()?3:4,pages=Math.max(1,Math.ceil(values.length/size));page=Math.min(page,pages-1);
        for(const t of values.slice(page*size,(page+1)*size)){
          const b=button('',`map-signal-${t.id}`,()=>choose(t.id));b.dataset.navTarget=t.id;b.setAttribute('aria-pressed',String(t.id===selected?.id));b.disabled=Boolean(nav.travel);
          const name=document.createElement('strong'),detail=document.createElement('small');name.textContent=t.name;detail.textContent=`${t.kind} · ${formatRange(nav.position.distanceTo(new Vector3(...t.center)))}`;b.append(name,detail);q('.nav-map-list').append(b);
        }
        q('.nav-map-pages span').textContent=`${page+1} / ${pages}`;el('nav-page-previous').setAttribute('aria-disabled',String(page===0));el('nav-page-next').setAttribute('aria-disabled',String(page===pages-1));
        if(!values.length)q('.nav-map-empty').textContent=view==='signals'?'No signals in the enabled categories. Open Filters to choose what to track.':'No surface sites here. Select a planet or moon in the chart.';
      }
      q('.nav-map-pages').hidden=view==='filters'||listValues(all).length<=(compact()?3:4);
      focusRestore(focusKey);
    }
    el('map-clear').disabled=!selected||Boolean(nav.travel);el('map-engage').disabled=!selected||Boolean(nav.travel);
    if(selected){
      const route=targets.route(selected),end=route.plan?.end??navigationEndpoint(nav.position,selected);
      el('map-target-name').textContent=selected.name;el('map-target-kind').textContent=selected.kind;
      el('map-distance').textContent=formatRange(nav.position.distanceTo(end));el('map-approach').textContent=selected.id==='star'?'500,000 km':'20 km';
      el('map-route-status').textContent=nav.travel?'Drive held. Close the map to resume.':route.ok?'Aim at the marker. Hold for charge, then N / J or LB + RB + ↑.':route.reason;
    }else{el('map-target-name').textContent='Choose a destination';el('map-target-kind').textContent='Navigation target';el('map-distance').textContent='—';el('map-route-status').textContent='Select a body or signal, then aim at its marker in flight.';}
  }
  function close(){if(dialog.open){nav.enabled=wasEnabled;dialog.close();}}
  function open(){
    if(dialog.open||document.querySelector('dialog[open]')||!nav.enabled||nav.openingActive||nav.mode==='destroyed')return;
    wasEnabled=nav.enabled;returnFocus=document.activeElement;stick=0;targets.reset();
    if(document.pointerLockElement)document.exitPointerLock();nav.keys.clear();nav.gamepad.suspend();nav.enabled=false;
    if(compact())view='chart';dialog.showModal();render(true);timer=setInterval(render,300);
  }
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
  dialog.addEventListener('close',()=>{clearInterval(timer);nav.keys.clear();nav.gamepad.suspend();targets.reset();nav.enabled=wasEnabled;returnFocus?.focus?.({preventScroll:true});});
  for(const id of ['close-system-map','map-return','map-engage'])el(id).addEventListener('click',close);
  el('map-clear').dataset.controllerKey='map-clear';el('map-engage').dataset.controllerKey='map-engage';
  el('map-clear').addEventListener('click',()=>{targets.clear();render(true);});
  dialog.querySelectorAll('[data-map-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.mapView;page=0;render(true);}));
  for(const [id,delta] of [['nav-page-previous',-1],['nav-page-next',1]]){el(id).dataset.controllerKey=id;el(id).addEventListener('click',()=>{if(el(id).getAttribute('aria-disabled')==='true')return;page+=delta;render(true);});}
  document.addEventListener('keydown',event=>{if(event.code!=='KeyM'||event.repeat||event.ctrlKey||event.metaKey||event.altKey||/^(INPUT|TEXTAREA|SELECT)$/.test(event.target?.tagName))return;event.preventDefault();dialog.open?close():open();});
  function controllerInput(input){
    if(!dialog.open||!input)return;
    if(input.pressed.has(1)||input.pressed.has(9)){close();return;}
    const direction=Math.abs(input.y)>.5?Math.sign(input.y):Math.abs(input.x)>.5?Math.sign(input.x):0;
    const step=input.pressed.has(12)||input.pressed.has(14)?-1:input.pressed.has(13)||input.pressed.has(15)?1:direction&&direction!==stick?direction:0;stick=direction;
    if(step){const buttons=[...dialog.querySelectorAll('button')].filter(b=>!b.disabled&&b.getClientRects().length);const i=buttons.indexOf(document.activeElement);buttons[(Math.max(0,i)+step+buttons.length)%buttons.length]?.focus({preventScroll:true});}
    if(input.pressed.has(0))document.activeElement?.closest('#system-map button')?.click();
  }
  return {openMap:open,close,refresh:render,controllerInput,get open(){return dialog.open;}};
}
