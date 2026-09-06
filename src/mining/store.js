import { ROCK_ID, ROCK_VERSION, SIDE, createDensity, encodeDensity, decodeDensity } from './volume.js';
export const MINING_KEY='star-agent.selene-mining.v1';
export const POUCH_CAPACITY=12;
// Fixed local transaction: cut field and both resource containers persist in a
// single value. No separate reward write can survive without its matching cut.
export class MiningStore {
  constructor(storage){
    this.storage=storage;this.saved=Boolean(storage);this.warning='';
    this.state={id:ROCK_ID,version:ROCK_VERSION,revision:0,field:createDensity(),pack:[0,0,0],ship:[0,0,0]};
    try{const raw=storage?.getItem(MINING_KEY);if(raw){const d=JSON.parse(raw);if(typeof d.field==='string')d.field=Array.from(decodeDensity(d.field));if(d.id!==ROCK_ID||d.version!==ROCK_VERSION||!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.field)||d.field.length!==SIDE**3||!d.field.every(n=>Number.isFinite(n)&&Math.abs(n)<20)||!['pack','ship'].every(k=>Array.isArray(d[k])&&d[k].length===3&&d[k].every(n=>Number.isFinite(n)&&n>=0))||d.pack.reduce((a,b)=>a+b,0)>POUCH_CAPACITY+.001||d.ship.reduce((a,b)=>a+b,0)>48.001)throw Error('Unrecognized mining save');this.state={...d,field:new Float32Array(d.field)};}}
    catch{this.saved=false;this.warning='Mining save could not be read. Original save retained; mining is paused.';this.blocked=true;}
  }
  get mass(){return this.state.pack.reduce((a,b)=>a+b,0);}
  get free(){return Math.max(0,POUCH_CAPACITY-this.mass);}
  write(next,encodedField){
    if(this.blocked)return false;
    try{if(!this.storage)throw Error('Browser storage unavailable');this.storage.setItem(MINING_KEY,JSON.stringify({...next,field:encodedField??encodeDensity(next.field)}));this.saved=true;this.warning='';}
    catch{this.saved=false;this.blocked=true;this.warning='Mining save unavailable. Previous cuts and cargo retained. Reload to retry.';return false;}
    this.state=next;return true;
  }
  commit(result,revision){
    if(revision!==this.state.revision||!result.yieldVolume?.every(n=>Number.isFinite(n)&&n>=0))return false;
    // 12 kg/m³ is collectible concentrate; discarded bulk regolith is not cargo.
    const added=result.yieldVolume.map(v=>v*12);if(added.reduce((a,b)=>a+b,0)>this.free+1e-7)return false;
    return this.write({...this.state,field:result.field,revision:revision+1,pack:this.state.pack.map((v,i)=>v+added[i])},result.encodedField);
  }
  stow(){if(this.state.ship.reduce((a,b)=>a+b,0)+this.mass>48){this.warning='Sample locker is full.';return false;}return this.write({...this.state,pack:[0,0,0],ship:this.state.ship.map((v,i)=>v+this.state.pack[i])});}
}
