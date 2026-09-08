import {recoveryJob,recoveryCratePose} from './catalog.js';
import {validGrid,capacitySBU,usedSBU} from '../cargo/grid.js';
const check=(ok,message)=>{if(!ok)throw new Error(message);};
const record=x=>x&&typeof x==='object'&&!Array.isArray(x);
const integer=n=>Number.isSafeInteger(n)&&n>=0&&n<=1e9;
const vector=(x,n)=>Array.isArray(x)&&x.length===n&&x.every(v=>Number.isFinite(v)&&Math.abs(v)<1e14);
const locations=s=>[...Object.values(s.ships).flatMap(ship=>ship.crates.map(crate=>({crate,ship,owner:ship.owner}))),...Object.entries(s.accounts).flatMap(([owner,a])=>a.carried?[{crate:a.carried,owner,carried:a}]:[]),...Object.values(s.loose??{}).map(crate=>({crate,loose:true}))];

/** Optional solo ledger; exact crate identities survive ordinary tractor/grid
 * movement. Missing freight is invalid, never repaired by spawning replacements. */
export function validRecoveries(s){
  try{
    const all=locations(s),missions=new Set();
    for(const [owner,a] of Object.entries(s.accounts)){
      if(!Object.hasOwn(a,'recovery'))continue;
      const f=a.recovery;check(record(f)&&f.version===1&&integer(f.completed)&&integer(f.earned)&&Array.isArray(f.history)&&f.history.length<=8&&f.history.length===Math.min(8,f.completed),'recovery ledger');
      check(f.history.every(h=>record(h)&&recoveryJob(h.job)&&typeof h.id==='string'&&h.paid===recoveryJob(h.job).reward),'recovery history');
      if(f.active===null)continue;
      const m=f.active,j=recoveryJob(m?.job);check(record(m)&&j&&/^recovery-[1-9][0-9]*$/.test(m.id)&&!missions.has(m.id)&&['accepted','recover'].includes(m.phase)&&typeof m.cleared==='boolean','recovery mission');missions.add(m.id);
      check(vector(m.position,3)&&vector(m.quaternion,4)&&Math.abs(Math.hypot(...m.quaternion)-1)<1e-5&&Array.isArray(m.crates)&&new Set(m.crates).size===m.crates.length,'recovery pose');
      const found=all.filter(({crate:c})=>c.recovery?.id===m.id);
      if(m.phase==='accepted'){check(!m.crates.length&&!found.length,'unissued recovery');continue;}
      check(m.crates.length===j.crates&&found.length===j.crates,'original recovery crates');
      for(const {crate:c,owner:holder} of found)check(m.crates.includes(c.id)&&c.recovery.owner===owner&&(!holder||holder===owner)&&(!c.holder||c.holder===owner)&&c.sbu===j.sbu&&c.resource===j.resource&&!c.transport,'recovery seal');
    }
    for(const {crate:c} of all){if(!Object.hasOwn(c,'recovery'))continue;const seal=c.recovery;check(record(seal)&&Object.keys(seal).length===2&&Object.hasOwn(s.accounts,seal.owner),'recovery owner');const m=s.accounts[seal.owner].recovery?.active;check(m?.phase==='recover'&&m.id===seal.id&&m.crates.includes(c.id),'orphan recovery cargo');}
    return true;
  }catch{return false;}
}
export function recoveryCommand(s,owner,command,ctx){
  check(ctx.recovery?.available?.(),'Recovery contracts are available in solo flight.');
  const a=s.accounts[owner];a.recovery??={version:1,active:null,completed:0,earned:0,history:[]};
  const f=a.recovery,m=f.active;
  if(command.op==='recovery-accept'){
    const j=recoveryJob(command.job),ship=s.ships[command.ship];check(j,'Choose a recovery contract.');check(!m,'Complete or abandon your current recovery first.');
    check(ship?.owner===owner&&capacitySBU(ship.hull)-usedSBU(ship.crates)>=j.sbu*j.crates,'Choose a cargo ship with enough grid capacity.');
    check(ctx.recovery.canAccept?.(j,ship),'Finish your active security sortie or choose a supported armed ship first.');
    const pose=ctx.recovery.pose(j);check(pose,'Recovery signal unavailable.');
    f.active={id:`recovery-${s.nextId++}`,job:j.id,phase:'accepted',cleared:!j.guards.length,crates:[],...pose};return 'Recovery accepted. Track the disabled Atlas in Map → Missions. Fly there; no cargo has been issued yet.';
  }
  check(m&&m.id===command.mission,'This recovery contract is not yours or is no longer active.');const j=recoveryJob(m.job);
  if(command.op==='recovery-arrive'){
    check(m.phase==='accepted','The original recovery crates have already been located.');check(ctx.recovery.atWreck?.(m),'Fly to the disabled Atlas before locating its cargo.');
    s.loose??={};for(let i=0;i<j.crates;i++){const id=`sbu-${s.nextId++}`;m.crates.push(id);s.loose[id]={id,sbu:j.sbu,resource:j.resource,recovery:{id:m.id,owner},...recoveryCratePose(m,i),holder:null,until:0,movedAt:Math.floor(ctx.now?.()??Date.now())};}
    m.phase='recover';return m.cleared?'Cargo located inside the open aft bay. EVA and tractor each marked crate into your own hold.':'Cargo located. Clear the defending ships before engaging the recovery tractor.';
  }
  if(command.op==='recovery-clear'){
    check(m.phase==='recover'&&!m.cleared&&ctx.recovery.defeated?.(m),'The defending flight is not cleared.');m.cleared=true;return 'Defending flight cleared. Recovery authorized: EVA to the open Atlas cargo bay.';
  }
  check(['recovery-abandon','recovery-deposit'].includes(command.op),'Unknown recovery command.');
  const abandon=command.op==='recovery-abandon',found=locations(s).filter(({crate:c})=>c.recovery?.id===m.id);
  if(!abandon){const ship=s.ships[command.ship];check(m.phase==='recover'&&m.cleared,'Locate the cargo and clear any defenders first.');check(command.terminal===j.destination&&ctx.terminal?.(command.terminal),'Walk to Greenbank Supply’s delivery terminal.');check(ship?.owner===owner&&ctx.docked?.(ship,command.terminal),'Park your selected cargo ship on the delivery pad.');check(m.crates.every(id=>ship.crates.some(c=>c.id===id&&c.recovery?.id===m.id)),'Secure every original recovery crate on the selected ship’s cargo grid.');check(integer(a.credits+j.reward)&&integer(f.earned+j.reward)&&integer(f.completed+1),'Recovery credit limit reached.');}
  // Remove the entire contract together, so its own upper crates do not block
  // its lower crates. Unrelated cargo must remain physically supported.
  for(const ship of Object.values(s.ships)){const next=ship.crates.filter(c=>c.recovery?.id!==m.id);check(validGrid(ship.hull,next),'Unload other cargo stacked above recovery crates first.');ship.crates=next;}
  for(const item of found){if(item.loose)delete s.loose[item.crate.id];if(item.carried)item.carried.carried=null;}
  if(!abandon){a.credits+=j.reward;f.completed++;f.earned+=j.reward;f.history.unshift({id:m.id,job:j.id,paid:j.reward});f.history.length=Math.min(8,f.history.length);}
  f.active=null;return abandon?'Recovery abandoned. Your marked crates were recalled; no payment issued.':`Recovery complete · ${j.crates} crates deposited · ${j.reward} CR paid.`;
}
