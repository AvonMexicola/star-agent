import { mineCargoRock,cargoDeposit } from './cargo-mining.js';
import { createTradingPads } from '../src/trading/pads.js';
import { walkForeignShips,constrainCargoEVA } from '../src/cargo/physics.js';
import * as THREE from 'three';
import { emptyCommerce,ensureAccount,normalizeCommerce,commerceCommand,shipKey } from '../src/trading/model.js';
import { marketIdForTerminal } from '../src/trading/market.js';
import { AEON_STATION_TERMINALS,stationTerminalPoint,stationedForTrade,STATION_TERMINAL_REACH } from '../src/trading/station-terminals.js';
import { tradeSite,onTradePad,POST_COST } from '../src/trading/sites.js';
import { shipPose,aboard,nearCrate,nearGrid } from '../src/cargo/access.js';
import { crateBounds } from '../src/cargo/grid.js';
import { constrainShipAttachments } from '../src/ship-attachment-collision.js';
import { tractorContext } from '../src/cargo/tractor-context.js';
import { tractorWorldClear,constrainLooseCargo } from '../src/cargo/tractor-physics.js';
const fail=message=>{throw new Error(message);};
/** One durable world ledger. All money/cargo/stock writes and loose-resource
 * deductions share a database transaction; publish only after COMMIT. */
export function createTrading({store,players,world,persistent,flushWrites,now=Date.now,stationMarket=marketIdForTerminal,canTractor=()=>true}){
  let state=emptyCommerce();
  const pads=createTradingPads(null,()=>Object.values(state.terminals));
  const pose=s=>{const p=players.get(s.owner);return p&&p.nav.shipId===s.hull?shipPose(p.nav):null;};
  const station=world.station??world;
  const marketTerminals=()=>Object.fromEntries(AEON_STATION_TERMINALS.map(t=>[t.id,stationMarket(t.id)]));
  const terminalPoint=(id,ledger=state)=>{
    if(id.startsWith('station:'))return stationTerminalPoint(station,id);
    return ledger.terminals[id]?new THREE.Vector3(...ledger.terminals[id].position).add(new THREE.Vector3(0,1.3,0).applyQuaternion(new THREE.Quaternion(...ledger.terminals[id].quaternion))):null;
  };
  const physicalShips=(ledger=state)=>Object.values(ledger.ships).filter(s=>pose(s)).map(s=>({...s,pose:pose(s),speed:players.get(s.owner).nav.shipSpeed,open:players.get(s.owner).nav.doorProgress>.98,systems:players.get(s.owner).nav.freighter}));
  const loose=(ledger=state)=>Object.values(ledger.loose??{});
  const terminalReach=(p,id,ledger=state)=>{const point=terminalPoint(id,ledger);return point&&p.health>0&&p.nav.mode==='walk'&&!p.nav.insideShip&&p.nav.position.distanceTo(point)<STATION_TERMINAL_REACH;};
  function context(p,ledger){return {
    now,
    tractor:tractorContext({nav:p.nav,ships:()=>physicalShips(ledger),loose:()=>loose(ledger),worldClear:tractorWorldClear(p.nav,world.station,world.occludes),enabled:()=>p.weapon==='mining-laser-tool'&&canTractor(p)}),
    terminal:id=>terminalReach(p,id,ledger),stationMarket,
    docked:(s,id)=>{const n=players.get(s.owner)?.nav;return s.owner===p.id&&n&&n.shipId===s.hull&&!n.cabinFlight&&n.shipVelocity.length()<1&&!n.travel&&(id.startsWith('station:')?stationedForTrade({nav:n,hangarId:p.hangarId,station},id):n.shipSpeed<1&&onTradePad(pose(s)?.position,ledger.terminals[id]));},
    resources:id=>(ledger.accounts[p.id]?.resources?.[id]??0)+(p.inventory.containers.pack[id]??0),
    crate:(s,c)=>{const t=pose(s);return t&&['walk','eva'].includes(p.nav.mode)&&aboard(p.nav.position,t,s.hull)&&nearCrate(p.nav.position,t,s.hull,c);},
    grid:s=>{const t=pose(s);return t&&p.nav.mode==='walk'&&aboard(p.nav.position,t,s.hull)&&nearGrid(p.nav.position,t,s.hull);},
    loot:s=>{const other=players.get(s.owner),t=pose(s);return other&&t&&(other.shipHealth<=0||aboard(p.nav.position,t,s.hull));},
    haul:(s,to,c)=>{const t=pose(s),dest=pose(to),other=players.get(s.owner);return t&&dest&&p.nav.mode==='walk'&&other.nav.shipSpeed<1&&p.nav.shipSpeed<1&&dest.position.distanceTo(t.position)<40&&nearCrate(p.nav.position,t,s.hull,c,6)&&(other.shipHealth<=0||aboard(p.nav.position,t,s.hull));},
  };}
  return {
    get state(){return state;},
    async join(p){
      const result=await store.transactCommerce(current=>{const next=normalizeCommerce(current??emptyCommerce());ensureAccount(next,p.id);return {state:next};});state=result.state;
    },
    snapshot(p){
      // Credits only for self. Manifests are physical public cargo, never account details.
      return {version:state.version,revision:state.revision,account:state.accounts[p.id],ships:Object.values(state.ships).filter(s=>s.owner===p.id||players.has(s.owner)),loose:loose().filter(c=>p.nav.position.distanceTo(new THREE.Vector3(...c.position))<2000),terminals:Object.values(state.terminals),markets:state.markets,marketTerminals:marketTerminals(),rocks:Object.entries(state.rocks??{}).filter(([,r])=>p.nav.position.distanceTo(new THREE.Vector3(...r.position))<40).map(([id,r])=>({id,revision:r.revision}))};
    },
    attach(p){
      Object.defineProperty(p.nav,'carryingCargo',{configurable:true,get:()=>Boolean(state.accounts[p.id]?.carried||loose().some(c=>c.holder===p.id&&c.until>now()))});
      p.nav.cargoEVA=(a,b)=>{const hit=constrainCargoEVA(a,b,physicalShips());const point=constrainLooseCargo(a,hit.point,loose(),{eva:true});return {point,hit:hit.hit||!point.equals(hit.point)};};
      p.nav.cargoLandingSurface=position=>pads.floorAt(position);
      p.nav.cargoWalk=(a,b)=>{const ships=physicalShips().filter(s=>s.owner!==p.id);const foreign=walkForeignShips(a,b,ships);const pad=pads.constrain(a,foreign.point),point=constrainLooseCargo(a,pad.point,loose());return {...pad,point,grounded:pad.grounded||foreign.grounded,hit:pad.hit||pad.grounded||foreign.hit||!point.equals(pad.point)};};
      p.nav.cargoConstrain=(previous,proposed)=>{const constrained=constrainShipAttachments(previous,proposed,(state.ships[shipKey(p.id,p.nav.shipId)]?.crates??[]).map(c=>crateBounds(p.nav.shipId,c)));return p.nav.toShipLocal(constrainLooseCargo(p.nav.fromShipLocal(previous),p.nav.fromShipLocal(constrained),loose()));};},
    async request(p,m){
      if(p.health<=0)fail('Respawn before handling cargo.');
      await flushWrites(p);
      const result=await store.transactCommerce(current=>{
        const ledger=normalizeCommerce(current??state);ensureAccount(ledger,p.id);
        if(m.op==='inspectRock'){const rock=ledger.rocks?.[m.rock];if(!rock||!cargoDeposit(p.nav.position,m.rock))fail('Deposit out of reach.');return {state:ledger,rock:{id:m.rock,...rock}};}
        if(m.op==='mine')return mineCargoRock(ledger,p,m.rock,now(),world);
        if(m.op==='deploy'){
          if(m.revision!==ledger.revision)fail('Cargo changed.');
          if(p.nav.mode!=='walk'||p.nav.insideShip||p.nav.dockedAtStation)fail('Stand on the ground to build a trading pad.');
          if(ledger.accounts[p.id].credits<POST_COST)fail(`A trade terminal and pad cost ${POST_COST} credits.`);
          if(Object.values(ledger.terminals).filter(t=>t.owner===p.id).length>=4)fail('Four trading pads per owner.');
          const site=tradeSite(p.nav.position,new THREE.Vector3(0,0,-1).applyQuaternion(p.nav.orientation));
          if(Object.values(ledger.terminals).some(t=>new THREE.Vector3(...t.origin).distanceTo(new THREE.Vector3(...site.origin))<100))fail('Keep100m between trading pads.');
          const next=structuredClone(ledger),id=`trade-${next.nextId++}`;
          next.accounts[p.id].credits-=POST_COST;next.terminals[id]={id,owner:p.id,name:`${p.account.callsign} trading pad`,...site,stock:{},prices:{}};next.revision++;
          return {state:next,message:'Trading pad built. Land centrally, then deposit cargo at its terminal.'};
        }
        const result=commerceCommand(ledger,p.id,m,context(p,ledger));
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
