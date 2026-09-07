import { mineCargoRock,cargoDeposit } from './cargo-mining.js';
import { createTradingPads } from '../src/trading/pads.js';
import { walkForeignShips } from '../src/cargo/physics.js';
import * as THREE from 'three';
import { emptyCommerce,ensureAccount,validCommerce,commerceCommand,shipKey } from '../src/trading/model.js';
import { tradeSite,onTradePad,POST_COST } from '../src/trading/sites.js';
import { shipPose,aboard,nearCrate,nearGrid } from '../src/cargo/access.js';
import { crateBounds } from '../src/cargo/grid.js';
import { constrainShipAttachments } from '../src/ship-attachment-collision.js';
const fail=message=>{throw new Error(message);};
/** One durable world ledger. All money/cargo/stock writes and loose-resource
 * deductions share a database transaction; publish only after COMMIT. */
export function createTrading({store,players,world,persistent,flushWrites,now=Date.now}){
  let state=emptyCommerce();
  const pads=createTradingPads(null,()=>Object.values(state.terminals));
  const pose=s=>{const p=players.get(s.owner);return p&&p.nav.shipId===s.hull?shipPose(p.nav):null;};
  const stationed=(p,id)=>id===`station:${p.hangarId}`&&p.nav.dockedAtStation&&Boolean(p.hangarId);
  const terminalPoint=id=>{
    if(id.startsWith('station:')){const pod=world.pods.find(p=>`station:${p.id}`===id);return pod?.toWorld(new THREE.Vector3(-12,pod.interiorBox.min.y+1.75,20.7),new THREE.Vector3());}
    return state.terminals[id]?new THREE.Vector3(...state.terminals[id].position).add(new THREE.Vector3(0,1.3,0).applyQuaternion(new THREE.Quaternion(...state.terminals[id].quaternion))):null;
  };
  const terminalReach=(p,id)=>{const point=terminalPoint(id);return point&&p.health>0&&p.nav.mode==='walk'&&p.nav.position.distanceTo(point)<2.8;};
  function context(p){return {
    terminal:id=>terminalReach(p,id),
    docked:(s,id)=>{const n=players.get(s.owner)?.nav;return n&&n.shipId===s.hull&&n.speed<1&&!n.travel&&(stationed(p,id)||onTradePad(pose(s)?.position,state.terminals[id]));},
    resources:id=>(state.accounts[p.id]?.resources?.[id]??0)+(p.inventory.containers.pack[id]??0),
    crate:(s,c)=>{const t=pose(s);return t&&['walk','eva'].includes(p.nav.mode)&&aboard(p.nav.position,t,s.hull)&&nearCrate(p.nav.position,t,s.hull,c);},
    grid:s=>{const t=pose(s);return t&&p.nav.mode==='walk'&&aboard(p.nav.position,t,s.hull)&&nearGrid(p.nav.position,t,s.hull);},
    loot:s=>{const other=players.get(s.owner),t=pose(s);return other&&t&&(other.shipHealth<=0||aboard(p.nav.position,t,s.hull));},
    haul:(s,to,c)=>{const t=pose(s),dest=pose(to),other=players.get(s.owner);return t&&dest&&p.nav.mode==='walk'&&other.nav.speed<1&&p.nav.speed<1&&dest.position.distanceTo(t.position)<40&&nearCrate(p.nav.position,t,s.hull,c,6)&&(other.shipHealth<=0||aboard(p.nav.position,t,s.hull));},
  };}
  return {
    get state(){return state;},
    async join(p){
      const result=await store.transactCommerce(current=>{const next=current??emptyCommerce();if(!validCommerce(next))fail('Cargo save invalid.');ensureAccount(next,p.id);return {state:next};});state=result.state;
    },
    snapshot(p){
      // Credits only for self. Manifests are physical public cargo, never account details.
      return {version:state.version,revision:state.revision,account:state.accounts[p.id],ships:Object.values(state.ships).filter(s=>s.owner===p.id||players.has(s.owner)),terminals:Object.values(state.terminals),rocks:Object.entries(state.rocks??{}).filter(([,r])=>p.nav.position.distanceTo(new THREE.Vector3(...r.position))<40).map(([id,r])=>({id,revision:r.revision}))};
    },
    attach(p){
      p.nav.cargoLandingSurface=position=>pads.floorAt(position);
      p.nav.cargoWalk=(a,b)=>{const ships=Object.values(state.ships).filter(s=>s.owner!==p.id&&pose(s)).map(s=>({...s,pose:pose(s),open:players.get(s.owner).nav.doorProgress>.98,systems:players.get(s.owner).nav.freighter}));const foreign=walkForeignShips(a,b,ships);const pad=pads.constrain(a,foreign.point);return {...pad,grounded:pad.grounded||foreign.grounded,hit:pad.hit||pad.grounded||foreign.hit};};
      p.nav.cargoConstrain=(previous,proposed)=>constrainShipAttachments(previous,proposed,(state.ships[shipKey(p.id,p.nav.shipId)]?.crates??[]).map(c=>crateBounds(p.nav.shipId,c)));},
    async request(p,m){
      if(p.health<=0)fail('Respawn before handling cargo.');
      await flushWrites(p);
      const result=await store.transactCommerce(current=>{
        state=current??state;ensureAccount(state,p.id);
        if(m.op==='inspectRock'){const rock=state.rocks?.[m.rock];if(!rock||!cargoDeposit(p.nav.position,m.rock))fail('Deposit out of reach.');return {state,rock:{id:m.rock,...rock}};}
        if(m.op==='mine')return mineCargoRock(state,p,m.rock,now(),world);
        if(m.op==='deploy'){
          if(m.revision!==state.revision)fail('Cargo changed.');
          if(p.nav.mode!=='walk'||p.nav.insideShip||p.nav.dockedAtStation)fail('Stand on the ground to build a trading pad.');
          if(state.accounts[p.id].credits<POST_COST)fail(`A trade terminal and pad cost ${POST_COST} credits.`);
          if(Object.values(state.terminals).filter(t=>t.owner===p.id).length>=4)fail('Four trading pads per owner.');
          const site=tradeSite(p.nav.position,new THREE.Vector3(0,0,-1).applyQuaternion(p.nav.orientation));
          if(Object.values(state.terminals).some(t=>new THREE.Vector3(...t.origin).distanceTo(new THREE.Vector3(...site.origin))<100))fail('Keep100m between trading pads.');
          const next=structuredClone(state),id=`trade-${next.nextId++}`;
          next.accounts[p.id].credits-=POST_COST;next.terminals[id]={id,owner:p.id,name:`${p.account.callsign} trading pad`,...site,stock:{},prices:{}};next.revision++;
          return {state:next,message:'Trading pad built. Land centrally, then deposit cargo at its terminal.'};
        }
        const result=commerceCommand(state,p.id,m,context(p));
        if(result.resourceDelta&&!result.replayed){
          const inventory=structuredClone(p.inventory);const bank=result.state.accounts[p.id].resources??={},fromBank=Math.min(bank[result.resource]??0,-result.resourceDelta);bank[result.resource]=(bank[result.resource]??0)-fromBank;result.state.accounts[p.id].resources=bank;inventory.containers.pack[result.resource]=(inventory.containers.pack[result.resource]??0)+result.resourceDelta+fromBank;inventory.revision++;
          result.inventory=inventory;result.players={[p.id]:persistent(p,inventory)};
        }
        return result;
      });
      state=result.state;if(result.rock){for(const peer of players.values())if(peer.nav.position.distanceTo(new THREE.Vector3(...result.rock.position))<40)peer.send({type:'event',event:'cargoRock',rock:result.rock});}if(result.inventory)p.inventory=result.inventory;return result.message;
    },
  };
}
