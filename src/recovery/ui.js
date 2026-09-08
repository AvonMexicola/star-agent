import {RECOVERY_JOBS,recoveryJob,recoveryRequired,recoveryCargo} from './catalog.js';
import {capacitySBU,usedSBU,validGrid,placeCrate} from '../cargo/grid.js';
const para=(text,cls='')=>{const p=document.createElement('p');p.textContent=text;p.className=cls;return p;};
function gridNotice(ship,j,m){
  const count=recoveryRequired(m,j);let crates=[...(ship?.crates??[])],fits=Boolean(ship);
  for(let i=0;i<count&&fits;i++){const next=placeCrate(ship.hull,crates,{id:`recovery-preview-${i}`,sbu:j.sbu,resource:j.resource});if(next)crates.push(next);else fits=false;}
  return para(`Required grid: ${count*j.sbu} SBU · ${count===1?'one container':'each container'} 0.6 × 0.6 × 1.2 m. Selected ship: ${capacitySBU(ship?.hull)-usedSBU(ship?.crates??[])} SBU free.${fits?'':' The mission container does not fit yet. You can still accept; unload cargo or bring another ship.'}`,'trade-reason');
}
export function renderRecovery({content,selection,button,s,api,ship,terminal,near,dock,busy,run,tractor,track}){
  selection.append(para('DEEP SPACE · Solo salvage contracts','freight-caption'));
  if(s.online){content.append(para('Deep-space recovery uses solo ship encounters. Leave the shared session to accept a recovery contract. Your online freight contracts remain in Freight.'));return;}
  const f=s.account?.recovery,m=f?.active,status=api.recoveryState?.();
  if(m){
    const j=recoveryJob(m.job),aboard=ship?.crates.filter(c=>c.recovery?.id===m.id&&recoveryCargo(c))??[],count=recoveryRequired(m,j),all=aboard.length===count;
    const card=document.createElement('article');card.className='freight-card';const title=document.createElement('h3');title.textContent=j.name;card.append(title);
    card.append(para(`${j.difficulty} · ${j.reward} CR · ${aboard.length} / ${count} mission containers aboard selected ship`,'freight-stage'));
    card.append(para(`Required: ${j.container}${m.crates.length?' · '+m.crates.join(', '):''}. ${m.loot?`${j.crates-1} other containers are optional bonus loot.`:'This earlier accepted contract retains its original manifest.'}`));
    if(!all)card.append(gridNotice(ship,j,m));
    card.append(para(m.phase==='accepted'?'1 · Track the Atlas distress signal and fly to it. The freighter is disabled in deep space.':!m.cleared?'2 · Clear the defending flight. Cargo recovery is locked while hostiles remain.':all?'4 · Return to Greenbank Supply on Aeon. Park this ship and deposit the mission container through its terminal.':'3 · EVA to the open aft bay. Tractor the marked mission container into your hold and secure it.'));
    card.append(para('Both Atlas ramps are open. Brake your ship to a complete stop, exit physically and use the tractor at up to 12 m. These crates are too large to carry by hand.'));
    if(m.loot)card.append(para('Optional loot is yours to keep or sell once secured. Secure it before completing or abandoning recovery. Load bonus loot below the mission container, or unload anything stacked above it before delivery.'));
    const actions=document.createElement('div');actions.className='freight-actions';
    actions.append(button('Track disabled Atlas','recovery-track',()=>track(`wreck-${m.id}`),busy||Boolean(api.nav.travel)),button('Track delivery terminal','recovery-delivery',()=>track(j.destination),busy||Boolean(api.nav.travel)));
    if(m.cleared&&m.phase==='recover')actions.append(button('Equip tractor beam','recovery-tractor',tractor,busy||!['walk','eva'].includes(api.nav.mode)||Boolean(api.nav.travel)||Boolean(s.account.carried)));
    actions.append(button(`Deposit mission cargo · ${j.reward} CR`,'recovery-deposit',()=>run({op:'recovery-deposit',mission:m.id,revision:s.revision}),busy||!m.cleared||!all||!near||!dock||terminal!==j.destination||!validGrid(ship?.hull,ship?.crates.filter(c=>c.recovery?.id!==m.id||c.recovery.optional)??[])));
    actions.append(button('Abandon recovery','recovery-abandon',()=>run({op:'recovery-abandon',mission:m.id,revision:s.revision}),busy));card.append(actions);content.append(card);
    if(status?.error)content.append(para(status.error,'trade-reason'));
    if(!m.cleared)content.append(para('Switch to Combat mode in Menu → Ship before firing with RT. Stay in your armed ship until the flight is cleared. Leaving combat or reloading before clearance lets the defenders regroup. Completed clearance is saved.','trade-reason'));
    return;
  }
  content.append(para('Retrieve one specific mission container from a disabled Atlas with alarm lights and open ramps. Other containers are optional loot. Only the marked original earns the mission payment.'));
  for(const j of RECOVERY_JOBS){
    const row=document.createElement('article'),text=document.createElement('div'),title=document.createElement('h3');title.textContent=j.name;text.append(title,para(`${j.difficulty} · ${j.reward} CR · ${j.container}`),para(j.brief),gridNotice(ship,j),para(`Optional loot: ${j.crates-1} × ${j.sbu} SBU containers. No extra cargo is required for completion.`));
    row.append(text,button('Accept',`recovery-accept-${j.id}`,()=>run({op:'recovery-accept',job:j.id,revision:s.revision}),busy||ship?.owner!==s.owner||!api.recoveryCanAccept?.(j,ship)));content.append(row);
  }
  content.append(para('Cargo space is a planning notice, not an acceptance requirement. Guarded recoveries require an armed Nomad or Atlas. Delivery: Greenbank Supply, Aeon.','trade-reason'));
  if(f?.completed)content.append(para(`${f.completed} recoveries completed · ${f.earned} CR earned. Last recovery: ${recoveryJob(f.history[0].job).name}.`,'freight-stage'));
}
