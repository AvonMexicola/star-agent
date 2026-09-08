import {TRANSPORT_ROUTES,transportRoute,transportSiteName} from './catalog.js';
import {capacitySBU,canRemoveCrate} from '../cargo/grid.js';
import {resourceById} from '../trading/resources.js';
import './ui.css';
const para=(text,cls='')=>{const p=document.createElement('p');p.textContent=text;p.className=cls;return p;};

/** Render into the existing trade dialog; its native focus/async/router owns all
 * actions. No second input polling, hidden inventory grant or client authority. */
export function renderTransport({content,selection,button,s,api,ship,terminal,near,dock,page,busy,run,tractor}){
  const f=s.account?.transport,m=f?.active;
  selection.append(para('SEALED FREIGHT · Your personal contracts','freight-caption'));
  if(m){
    const r=transportRoute(m.route),crate=ship?.crates.find(c=>c.id===m.crate),loose=(s.loose??[]).find(c=>c.id===m.crate),aboard=s.ships.find(h=>h.crates.some(c=>c.id===m.crate));
    const card=document.createElement('article');card.className='freight-card';
    const title=document.createElement('h3');title.textContent=r.name;card.append(title);
    const stage=m.phase==='accepted'?'1 · Fly to pickup':crate?'3 · Fly to destination':aboard?'3 · Select the ship carrying your crate':'2 · Load your crate';
    card.append(para(`${stage} · ${r.reward} CR on delivery`,'freight-stage'));
    card.append(para(`Pickup: ${transportSiteName(r.from)} · Delivery: ${transportSiteName(r.to)}. Sealed ${r.sbu} SBU of ${resourceById(r.resource).name}.`));
    card.append(para(m.phase==='accepted'?'Land at pickup, walk to the terminal and order. Nothing is spawned before you order.':loose?'Your crate is on the apron or where you last released it. Equip the tractor, hold RT / T to guide it into your ship, then X / F to secure.':s.account.carried?.id===m.crate?'You are carrying the sealed crate. Stow it in your ship before departure.':`Crate ${m.crate} secured aboard ${aboard?.hull??'your ship'}. Fly to delivery, land and use its terminal to deposit.`));
    const actions=document.createElement('div');actions.className='freight-actions';
    if(m.phase==='accepted')actions.append(button('Order my crate','transport-order',()=>run({op:'transport-order',mission:m.id,revision:s.revision}),busy||!near||!dock||terminal!==r.from||ship?.owner!==s.owner));
    else{
      if(loose)actions.append(button('Equip tractor beam','transport-tractor',tractor,busy||!['walk','eva'].includes(api.nav.mode)||Boolean(api.nav.travel)||Boolean(s.account.carried)));
      actions.append(button(`Deposit crate · ${r.reward} CR`,'transport-deposit',()=>run({op:'transport-deposit',mission:m.id,crate:m.crate,revision:s.revision}),busy||!near||!dock||terminal!==r.to||!crate||!canRemoveCrate(ship.hull,ship.crates,m.crate)));
    }
    actions.append(button('Abandon contract','transport-abandon',()=>run({op:'transport-abandon',mission:m.id,revision:s.revision}),busy));card.append(actions);content.append(card);
    if(m.phase==='accepted'&&(!near||terminal!==r.from))content.append(para('Order is available only at your contracted pickup terminal. Use Map → Locations to track the settlement. Climb to 20 km, aim at its marker, then engage the drive. If the world blocks the route, fly around its limb.','trade-reason'));
    else if(m.phase==='issued'&&terminal!==r.to)content.append(para('Deposit is available only at your contracted destination terminal, with the crate aboard your parked ship.','trade-reason'));
    else if(!dock)content.append(para('Land the selected cargo ship on this site’s pad.','trade-reason'));
    if(f.history.length)content.append(para(`Last delivery: ${transportRoute(f.history[0].route).name} · ${f.history[0].paid} CR paid.`));
    return 1;
  }
  content.append(para('Accept one contract, fly to pickup, order and load your crate, then fly to delivery and deposit at its terminal. Only your accepted contract can issue your crate.'));
  const routes=TRANSPORT_ROUTES.filter(r=>api.transportAvailable(r)),pages=Math.max(1,Math.ceil(routes.length/3));
  for(const r of routes.slice(page*3,page*3+3)){
    const row=document.createElement('article'),text=document.createElement('div'),title=document.createElement('h3');title.textContent=r.name;text.append(title,para(`1 sealed SBU · ${resourceById(r.resource).name} · ${r.reward} CR`));
    row.append(text,button('Accept',`transport-accept-${r.id}`,()=>run({op:'transport-accept',route:r.id,revision:s.revision}),busy||capacitySBU(ship?.hull)<1||ship?.owner!==s.owner));content.append(row);
  }
  if(!routes.length)content.append(para('Transport settlements are unavailable in this world.','trade-reason'));
  if(capacitySBU(ship?.hull)<1)content.append(para('Select a cargo ship: Nomad, Atlas, Stratum or Gannet. Kestrel has no cargo hold.','trade-reason'));
  if(f?.completed)content.append(para(`${f.completed} deliveries completed · ${f.earned} CR earned. Last delivery: ${transportRoute(f.history[0].route).name}.`,'freight-stage'));
  return pages;
}
