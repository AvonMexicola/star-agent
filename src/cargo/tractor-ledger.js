import { canRemoveCrate } from './grid.js';
import { TRACTOR_LEASE_MS } from './tractor-physics.js';
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const vector=(a,n)=>Array.isArray(a)&&a.length===n&&a.every(v=>Number.isFinite(v)&&Math.abs(v)<1e14);
export function validLooseCargo(loose){
  return loose&&typeof loose==='object'&&!Array.isArray(loose)&&Object.keys(loose).length<=2048&&Object.entries(loose).every(([id,c])=>c?.id===id&&vector(c.position,3)&&vector(c.quaternion,4)&&Math.abs(Math.hypot(...c.quaternion)-1)<1e-5&&(c.holder===null||typeof c.holder==='string')&&Number.isSafeInteger(c.until)&&c.until>=0&&Number.isSafeInteger(c.movedAt)&&c.movedAt>=0);
}
/** Called inside the same transaction as normal purchases and grid changes.
 * The context supplies server-derived transforms, never a submitted position. */
export function tractorCommand(state,owner,m,ctx){
  const now=Math.floor(ctx.now?.()??Date.now()),loose=state.loose??={},account=state.accounts[owner];state.loose=loose;
  check(!account.carried,'Stow your hand-carried crate first.');
  const held=()=>Object.values(loose).find(c=>c.holder===owner&&c.until>now);
  if(m.op==='tractor-grab'){
    check(!held(),'Release or secure your current tractor crate first.');
    let c=loose[m.crate];
    if(c){check(!c.holder||c.until<=now,'Another pilot has a tractor lock on this crate.');check(ctx.tractor?.grab(c,null),'Aim the tractor at a reachable crate.');}
    else{
      const ship=state.ships[m.ship],source=ship?.crates.find(c=>c.id===m.crate);check(source,'Crate no longer present.');
      check(canRemoveCrate(ship.hull,ship.crates,source.id),'Remove the crates above this one first.');
      check(ship.owner===owner||ctx.loot?.(ship,source),'Board the ship or disable it before taking cargo.');
      const pose=ctx.tractor?.grab(source,ship);check(pose,'Aim within 12 m through an open cargo access. Both ships must be stationary.');
      c={id:source.id,sbu:source.sbu,resource:source.resource,...pose};ship.crates=ship.crates.filter(x=>x.id!==c.id);loose[c.id]=c;
    }
    c.holder=owner;c.until=now+TRACTOR_LEASE_MS;c.movedAt=now;return `Tractor locked · ${c.sbu} SBU. Hold RT / T to guide; F / X secures a grid.`;
  }
  const c=loose[m.crate];check(c&&c.holder===owner,'No tractor lock on that crate.');
  if(m.op==='tractor-release'){c.holder=null;c.until=0;return 'Beam released. Crate arrested at its last safe position.';}
  check(c.until>now,'Tractor lock expired. Aim and engage again.');
  if(m.op==='tractor-align'){
    const ship=state.ships[m.ship];check(ship?.owner===owner,'Choose your receiving ship.');
    const rotation=ctx.tractor?.align(c,ship);check(rotation,'Move clear of walls and cargo before aligning to your nearby ship.');c.quaternion=rotation;c.until=now+TRACTOR_LEASE_MS;return 'Crate aligned to your cargo grid.';
  }
  if(m.op==='tractor-move'){
    const position=ctx.tractor?.move(c,m.distance,(now-c.movedAt)/1000);check(position,'Tractor line blocked or out of range. Release and reposition.');
    check(vector(position,3),'Invalid tractor movement.');c.position=position;c.movedAt=now;c.until=now+TRACTOR_LEASE_MS;return '';
  }
  if(m.op==='tractor-stow'){
    const ship=state.ships[m.ship];check(ship?.owner===owner,'Choose your receiving ship.');
    const placed=ctx.tractor?.stow(c,ship);check(placed,'Guide the crate to the marked free slot on your stationary ship.');
    ship.crates.push(placed);delete loose[c.id];return `${c.sbu} SBU secured on ${ship.hull}'s cargo grid.`;
  }
  throw new Error('Unknown tractor command.');
}
