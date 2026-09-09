import {transportRoute} from './transport/catalog.js';
import {recoveryJob} from './recovery/catalog.js';

/** One actionable destination per active cargo contract; optional loot stays on the map. */
export function navigationObjectiveIds({account,ships=[],loose=[],owner}) {
  const ids=[],owned=ships.filter(ship=>ship.owner===owner);
  const freight=account?.transport?.active,route=transportRoute(freight?.route);
  if(route){
    if(freight.phase==='accepted')ids.push(route.from);
    else if(loose.some(crate=>crate.id===freight.crate))ids.push(`freight-crate-${freight.crate}`);
    else if(owned.some(ship=>ship.crates.some(crate=>crate.id===freight.crate)))ids.push(route.to);
    else if(account.carried?.id===freight.crate)ids.push('your-ship');
  }
  const recovery=account?.recovery?.active,job=recoveryJob(recovery?.job);
  if(job){
    if(recovery.phase==='accepted'||!recovery.cleared)ids.push(`wreck-${recovery.id}`);
    else {
      const next=recovery.crates.find(id=>loose.some(crate=>crate.id===id));
      if(next)ids.push(`recovery-crate-${next}`);
      else if(recovery.crates.length&&owned.some(ship=>recovery.crates.every(id=>ship.crates.some(crate=>crate.id===id))))ids.push(job.destination);
      else ids.push('your-ship');
    }
  }
  return ids;
}
