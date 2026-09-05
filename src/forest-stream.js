import { forestTilesAround } from './forest-distribution.js';
import { SEED } from './generation.js';

/** One bounded tile per worker request; camera motion reprioritizes pending
 * tiles without throwing away resident content. The renderer consumes arrivals
 * on its own frame boundary, with birth times retained across LOD changes. */
export class ForestStream {
  constructor(worker = new Worker(new URL('./forest.worker.js',import.meta.url),{type:'module'})) {
    this.worker=worker;this.tiles=new Map();this.wanted=new Map();this.queue=[];
    this.arrivals=[];this.active=null;this.sequence=0;this.error=null;this.generated=0;this.disposed=false;
    worker.onmessage=({data})=>{
      if(this.disposed||data.id!==this.active?.id)return;
      const key=this.active.key;this.active=null;
      if(data.error){this.error=data.error;this.queue=[];return;}
      if(this.wanted.has(key)){this.arrivals.push({...data,key});this.generated++;}
      this.dispatch();
    };
    worker.onerror=event=>{this.error=event.message||'Forest worker failed';this.active=null;this.queue=[];};
  }
  plan(direction) {
    if(this.disposed||this.error)return false;
    const wanted=forestTilesAround(direction,1700);
    this.wanted=new Map(wanted.map(tile=>[tile.key,tile]));
    let changed=false;
    for(const key of this.tiles.keys())if(!this.wanted.has(key)){this.tiles.delete(key);changed=true;}
    this.arrivals=this.arrivals.filter(tile=>this.wanted.has(tile.key));
    const incoming=new Set(this.arrivals.map(tile=>tile.key));
    this.queue=wanted.filter(tile=>!this.tiles.has(tile.key)&&!incoming.has(tile.key)&&tile.key!==this.active?.key);
    this.dispatch();return changed;
  }
  dispatch() {
    if(this.disposed||this.active||this.error||!this.queue.length)return;
    const tile=this.queue.shift();this.active={key:tile.key,id:++this.sequence};
    this.worker.postMessage({id:this.active.id,tile,seed:SEED});
  }
  publish(time) {
    if(!this.arrivals.length)return false;
    // Bounded main-thread adoption; records stay Float64 until instance upload.
    for(const tile of this.arrivals.splice(0,4))if(this.wanted.has(tile.key)){
      this.tiles.set(tile.key,{records:tile.records,born:time});
    }
    return true;
  }
  get pending(){return this.queue.length+this.arrivals.length+Number(!!this.active);}
  dispose(){this.disposed=true;this.worker.terminate();this.tiles.clear();this.arrivals=[];this.queue=[];this.active=null;}
}
