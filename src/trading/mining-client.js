import { createDensity,decodeDensity } from '../mining/volume.js';
/** Session-only authoritative fields; never write another player's cuts into
 * the solo save. Mesh and collision rebuild through the existing worker. */
export function bindCargoMining({multiplayer,mining,nav}){
  const fields=new Map(),requested=new Set(),originalGet=mining.store.getRock.bind(mining.store);let pending=false,nextTime=0;
  mining.store.getRock=(id,initial)=>multiplayer.connected?(fields.get(id)??{field:initial??createDensity(),revision:0}):originalGet(id,initial);
  multiplayer.onEvent(event=>{if(event.event!=='cargoRock')return;const r=event.rock;fields.set(r.id,{field:decodeDensity(r.field),revision:r.revision});requested.delete(r.id);});
  nav.mineCargo=data=>{
    if(!multiplayer.connected)return false;
    const id=data.target?.rockId;if(!id||pending||performance.now()<nextTime)return true;
    pending=true;nextTime=performance.now()+500;
    multiplayer.request('cargo',{op:'mine',rock:id}).catch(e=>nav.notify(e.message)).finally(()=>{pending=false;});return true;
  };
  return {update(){
    if(!multiplayer.connected)return;
    for(const r of multiplayer.state.commerce?.rocks??[])if((fields.get(r.id)?.revision??0)<r.revision&&!requested.has(r.id)){requested.add(r.id);multiplayer.request('cargo',{op:'inspectRock',rock:r.id}).catch(()=>requested.delete(r.id));}
    for(const rock of mining.regionalRocks.values())if(!rock.pending&&rock.job?.revision!==rock.snapshot.revision)rock.request();
  }};
}
