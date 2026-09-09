import {emptyItems} from '../inventory/containers.js';
/** A camp cache is an ordinary finite, persistent container. Register and fill
 * atomically; an existing empty cache is never restocked after reload. */
export function ensurePirateLoot(store,site){
 const id=`pirate-cache:${site.id}:v1`;
 if(store.container(id))return {ok:true,id};
 const items={...emptyItems(),'carbine-charge':24,'healing-stim':1,'bandage':2};
 const next={...store.state,boxes:{...store.state.boxes,[id]:1},remote:{...store.state.remote,[id]:{name:`${site.name} · recovered cache`,kind:'base',items}}};
 if(!store.validContainers(next))return {ok:false,message:'No room to register this salvage cache.'};
 const ok=store.write(next);return {ok,id,message:ok?'Salvage cache recovered.':store.warning};
}
