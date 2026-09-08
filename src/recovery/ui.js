import {RECOVERY_JOBS,recoveryJob} from './catalog.js';
import {capacitySBU,usedSBU,validGrid} from '../cargo/grid.js';
const para=(text,cls='')=>{const p=document.createElement('p');p.textContent=text;p.className=cls;return p;};
export function renderRecovery({content,selection,button,s,api,ship,terminal,near,dock,busy,run,tractor,track}){
  selection.append(para('DEEP SPACE · Solo salvage contracts','freight-caption'));
  if(s.online){content.append(para('Deep-space recovery uses solo ship encounters. Leave the shared session to accept a recovery contract. Your online freight contracts remain in Freight.'));return;}
  const f=s.account?.recovery,m=f?.active,status=api.recoveryState?.();
  if(m){
    const j=recoveryJob(m.job),aboard=ship?.crates.filter(c=>c.recovery?.id===m.id)??[],all=aboard.length===j.crates;
    const card=document.createElement('article');card.className='freight-card';const title=document.createElement('h3');title.textContent=j.name;card.append(title);
    card.append(para(`${j.difficulty} · ${j.reward} CR · ${aboard.length} / ${j.crates} crates aboard selected ship`,'freight-stage'));
    card.append(para(m.phase==='accepted'?'1 · Track the Atlas distress signal and fly to it. The freighter is disabled in deep space.':!m.cleared?'2 · Clear the defending flight. Cargo recovery is locked while hostiles remain.':all?'4 · Return to Greenbank Supply on Aeon. Park this ship and deposit through its terminal.':'3 · EVA to the open aft bay. Tractor each marked 2 SBU crate into your hold and secure it.'));
    card.append(para('Both Atlas ramps are open. Brake your ship to a complete stop, exit physically and use the tractor at up to 12 m. These crates are too large to carry by hand.'));
    const actions=document.createElement('div');actions.className='freight-actions';
    actions.append(button('Track disabled Atlas','recovery-track',()=>track(`wreck-${m.id}`),busy||Boolean(api.nav.travel)),button('Track delivery terminal','recovery-delivery',()=>track(j.destination),busy||Boolean(api.nav.travel)));
    if(m.cleared&&m.phase==='recover'&&!all)actions.append(button('Equip tractor beam','recovery-tractor',tractor,busy||!['walk','eva'].includes(api.nav.mode)||Boolean(api.nav.travel)||Boolean(s.account.carried)));
    actions.append(button(`Deposit all · ${j.reward} CR`,'recovery-deposit',()=>run({op:'recovery-deposit',mission:m.id,revision:s.revision}),busy||!m.cleared||!all||!near||!dock||terminal!==j.destination||!validGrid(ship?.hull,ship?.crates.filter(c=>c.recovery?.id!==m.id)??[])));
    actions.append(button('Abandon recovery','recovery-abandon',()=>run({op:'recovery-abandon',mission:m.id,revision:s.revision}),busy));card.append(actions);content.append(card);
    if(status?.error)content.append(para(status.error,'trade-reason'));
    if(!m.cleared)content.append(para('Switch to Combat mode in Menu → Ship before firing with RT. Stay in your armed ship until the flight is cleared. Leaving combat or reloading before clearance lets the defenders regroup. Completed clearance is saved.','trade-reason'));
    return;
  }
  content.append(para('Recover sealed cargo from a disabled Atlas with emergency lights and open loading ramps. Your marked crates are personal; ordinary cargo cannot replace them.'));
  for(const j of RECOVERY_JOBS){
    const row=document.createElement('article'),text=document.createElement('div'),title=document.createElement('h3');title.textContent=j.name;text.append(title,para(`${j.difficulty} · ${j.crates} × 2 SBU · ${j.reward} CR`),para(j.brief));
    const compatible=ship?.owner===s.owner&&capacitySBU(ship?.hull)-usedSBU(ship?.crates??[])>=j.crates*j.sbu&&(!j.guards.length||['nomad','atlas'].includes(ship?.hull));
    row.append(text,button('Accept',`recovery-accept-${j.id}`,()=>run({op:'recovery-accept',job:j.id,revision:s.revision}),busy||!compatible||!api.recoveryCanAccept?.(j,ship)));content.append(row);
  }
  content.append(para('Allow 4 SBU free for recovery or raider contracts, 6 SBU for the blockade. Guarded recoveries require an armed Nomad or Atlas. Delivery: Greenbank Supply, Aeon.','trade-reason'));
  if(f?.completed)content.append(para(`${f.completed} recoveries completed · ${f.earned} CR earned. Last recovery: ${recoveryJob(f.history[0].job).name}.`,'freight-stage'));
}
