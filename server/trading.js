import {planTransportDrive} from '../src/transport/travel.js';
import {attachTransportSites} from '../src/transport/server-sites.js';
import {transportPickup} from '../src/transport/sites.js';
import {cargoVisibleTo} from '../src/transport/catalog.js';
import {settlementMarketId,SETTLEMENTS} from '../src/settlements/catalog.js';
import { createBaseScene } from '../src/trading/base-scene.js';
import { registerBase,baseTerminalPoint,baseDocked,materializeBase } from '../src/trading/base-site.js';
import { publicBaseTerminal } from '../src/trading/base-stock.js';
import { mineCargoRock,cargoDeposit } from './cargo-mining.js';
import { createTradingPads } from '../src/trading/pads.js';
import { walkForeignShips,constrainCargoEVA } from '../src/cargo/physics.js';
import * as THREE from 'three';
import { emptyCommerce,ensureAccount,normalizeSettlementMarkets,commerceCommand,shipKey } from '../src/trading/model.js';
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
  let state=emptyCommerce();const layoutVersions=new WeakMap(),settlements=new WeakMap();
  const pads=createTradingPads(null,()=>Object.values(state.terminals).filter(t=>!t.base));
  const pose=s=>{const p=players.get(s.owner);return p&&p.nav.shipId===s.hull?shipPose(p.nav):null;};
  const station=world.station??world;
  const resolveMarket=id=>settlementMarketId(id)||stationMarket(id);
  const marketTerminals=()=>Object.fromEntries([...AEON_STATION_TERMINALS,...SETTLEMENTS].map(t=>[t.id,resolveMarket(t.id)]));
  const terminalPoint=(id,ledger=state)=>{
    if(id.startsWith('station:'))return stationTerminalPoint(station,id);
    if(ledger.terminals[id]?.base)return baseTerminalPoint(ledger.terminals[id]);
    return ledger.terminals[id]?new THREE.Vector3(...ledger.terminals[id].position).add(new THREE.Vector3(0,1.3,0).applyQuaternion(new THREE.Quaternion(...ledger.terminals[id].quaternion))):null;
  };
  const physicalShips=(ledger=state)=>Object.values(ledger.ships).filter(s=>pose(s)).map(s=>({...s,pose:pose(s),speed:players.get(s.owner).nav.shipSpeed,open:players.get(s.owner).nav.doorProgress>.98,systems:players.get(s.owner).nav.freighter}));
  const loose=(ledger=state)=>Object.values(ledger.loose??{});
  const terminalReach=(p,id,ledger=state)=>{const point=settlementMarketId(id)?settlements.get(p)?.terminalPosition(id):terminalPoint(id,ledger);return point&&p.health>0&&p.nav.mode==='walk'&&!p.nav.insideShip&&p.nav.position.distanceTo(point)<STATION_TERMINAL_REACH;};
  function context(p,ledger){const privateLoose=()=>loose(ledger).filter(c=>cargoVisibleTo(c,p.id));const privateShips=()=>physicalShips(ledger).map(s=>({...s,crates:s.crates.filter(c=>cargoVisibleTo(c,p.id))}));return {
    transportAvailable:r=>Boolean(settlements.get(p)?.terminalPosition(r.from)&&settlements.get(p)?.terminalPosition(r.to)),
    transportPickup:id=>transportPickup(settlements.get(p),id,privateShips(),privateLoose()),
    now,registerBase:(state,owner,command)=>{const origin=command.claim?.origin;if(Array.isArray(origin)&&settlements.get(p)?.claims.some(c=>new THREE.Vector3(...c.origin).distanceTo(new THREE.Vector3(...origin))<c.radius+(command.claim.radius??96)))fail('Keep player bases clear of public transport settlements.');return registerBase(state,owner,command,{nav:p.nav,shared:true,now});},
    tractor:tractorContext({nav:p.nav,ships:privateShips,loose:privateLoose,worldClear:tractorWorldClear(p.nav,world.station,(a,d,r)=>{const distances=[world.occludes?.(a,d,r),p.nav.buildingRaycast?.(a,d,r)?.distance].filter(Number.isFinite);return distances.length?Math.min(...distances):null;}),enabled:()=>p.weapon==='mining-laser-tool'&&canTractor(p)}),
    terminal:id=>terminalReach(p,id,ledger),stationMarket:resolveMarket,
    docked:(s,id)=>{const n=players.get(s.owner)?.nav;return s.owner===p.id&&n&&n.shipId===s.hull&&!n.cabinFlight&&n.shipVelocity.length()<1&&!n.travel&&(settlementMarketId(id)?settlements.get(p)?.docked(id,pose(s)):id.startsWith('station:')?stationedForTrade({nav:n,hangarId:p.hangarId,station},id):n.shipSpeed<1&&(ledger.terminals[id]?.base?baseDocked(ledger.terminals[id],n):onTradePad(pose(s)?.position,ledger.terminals[id])));},
    resources:id=>(ledger.accounts[p.id]?.resources?.[id]??0)+(p.inventory.containers.pack[id]??0),
    crate:(s,c)=>{const t=pose(s);return t&&['walk','eva'].includes(p.nav.mode)&&aboard(p.nav.position,t,s.hull)&&nearCrate(p.nav.position,t,s.hull,c);},
    grid:s=>{const t=pose(s);return t&&p.nav.mode==='walk'&&aboard(p.nav.position,t,s.hull)&&nearGrid(p.nav.position,t,s.hull);},
    loot:s=>{const other=players.get(s.owner),t=pose(s);return other&&t&&(other.shipHealth<=0||aboard(p.nav.position,t,s.hull));},
    haul:(s,to,c)=>{const t=pose(s),dest=pose(to),other=players.get(s.owner);return t&&dest&&p.nav.mode==='walk'&&other.nav.shipSpeed<1&&p.nav.shipSpeed<1&&dest.position.distanceTo(t.position)<40&&nearCrate(p.nav.position,t,s.hull,c,6)&&(other.shipHealth<=0||aboard(p.nav.position,t,s.hull));},
  };}
  return {
    get state(){return state;},
    async join(p){
      const result=await store.transactCommerce(current=>{const next=normalizeSettlementMarkets(current??emptyCommerce());ensureAccount(next,p.id);return {state:next};});state=result.state;
    },
    snapshot(p){
      const near=t=>new THREE.Vector3(...materializeBase(t).origin).distanceTo(p.nav.position)<20000;
      const visible=Object.values(state.terminals).filter(t=>!t.base||t.base.public||t.owner===p.id||near(t));
      const full=visible.filter(t=>t.base&&(t.owner===p.id||near(t))),key=full.map(t=>t.id).join(',');
      const baseLayouts=layoutVersions.get(p)===key?null:full.map(t=>({id:t.id,claim:materializeBase(t)}));layoutVersions.set(p,key);
      const terminals=visible.map(t=>{const value=publicBaseTerminal(t,p.id);return value.base?{...value,base:{...value.base,claim:{...value.base.claim,pieces:[]}}}:value;});
      // Credits only for self. Manifests are physical public cargo, never account details.
      return {version:state.version,revision:state.revision,account:state.accounts[p.id],ships:Object.values(state.ships).filter(s=>s.owner===p.id||players.has(s.owner)).map(s=>({...s,crates:s.crates.filter(c=>cargoVisibleTo(c,p.id))})),loose:loose().filter(c=>cargoVisibleTo(c,p.id)&&(c.transport?.owner===p.id||p.nav.position.distanceTo(new THREE.Vector3(...c.position))<2000)),terminals,...(baseLayouts?{baseLayouts}:{}),markets:state.markets,marketTerminals:marketTerminals(),rocks:Object.entries(state.rocks??{}).filter(([,r])=>p.nav.position.distanceTo(new THREE.Vector3(...r.position))<40).map(([id,r])=>({id,revision:r.revision}))};
    },
    attach(p){
      const sites=attachTransportSites(p.nav);settlements.set(p,sites);
      const privateLoose=()=>loose().filter(c=>cargoVisibleTo(c,p.id));
      const privateShips=()=>physicalShips().map(s=>({...s,crates:s.crates.filter(c=>cargoVisibleTo(c,p.id))}));
      const bases=createBaseScene(null,p.nav,()=>Object.values(state.terminals));
      const previousRay=p.nav.buildingRaycast;p.nav.buildingRaycast=(...args)=>{return [previousRay?.(...args),bases.raycast(...args),sites.raycast(...args)].filter(Boolean).sort((a,b)=>a.distance-b.distance)[0]??null;};
      p.nav.baseLandingSurface=pose=>bases.landingSurface(pose)??sites.landingSurface(pose);p.nav.baseLandingRevision=()=>Object.keys(state.terminals).join(',');
      Object.defineProperty(p.nav,'carryingCargo',{configurable:true,get:()=>Boolean(state.accounts[p.id]?.carried||loose().some(c=>c.holder===p.id&&c.until>now()))});
      p.nav.cargoEVA=(a,b)=>{const hit=constrainCargoEVA(a,b,privateShips());const point=constrainLooseCargo(a,hit.point,privateLoose(),{eva:true});return {point,hit:hit.hit||!point.equals(hit.point)};};
      p.nav.cargoLandingSurface=position=>pads.floorAt(position);
      // Pad poses are immutable after deployment; ignore unrelated ledger changes.
      p.nav.cargoLandingRevision=()=>Object.keys(state.terminals).length;
      p.nav.cargoWalk=(a,b)=>{const ships=privateShips().filter(s=>s.owner!==p.id);const foreign=walkForeignShips(a,b,ships);const pad=pads.constrain(a,foreign.point),base=bases.constrain(a,pad.point),point=constrainLooseCargo(a,base.point,privateLoose());return {...base,point,grounded:base.grounded||pad.grounded||foreign.grounded,hit:base.hit||pad.hit||pad.grounded||foreign.hit||!point.equals(base.point)};};
      p.nav.cargoConstrain=(previous,proposed)=>{const constrained=constrainShipAttachments(previous,proposed,(state.ships[shipKey(p.id,p.nav.shipId)]?.crates??[]).map(c=>crateBounds(p.nav.shipId,c)));return p.nav.toShipLocal(constrainLooseCargo(p.nav.fromShipLocal(previous),p.nav.fromShipLocal(constrained),privateLoose()));};},
    async request(p,m){
      if(p.health<=0)fail('Respawn before handling cargo.');
      await flushWrites(p);
      const result=await store.transactCommerce(current=>{
        const ledger=normalizeSettlementMarkets(current??state);ensureAccount(ledger,p.id);
        if(m.op==='transport-drive'){const result=planTransportDrive(ledger,p.id,m.target,p.nav,settlements.get(p),station);if(!result.ok)fail(result.reason);return {state:ledger,transportPlan:result.plan,transportTarget:result.target};}
        if(m.op==='inspectRock'){const rock=ledger.rocks?.[m.rock];if(!rock||!cargoDeposit(p.nav.position,m.rock))fail('Deposit out of reach.');return {state:ledger,rock:{id:m.rock,...rock}};}
        if(m.op==='mine')return mineCargoRock(ledger,p,m.rock,now(),world);
        if(m.op==='deploy'){
          if(m.revision!==ledger.revision)fail('Cargo changed.');
          if(p.nav.mode!=='walk'||p.nav.insideShip||p.nav.dockedAtStation)fail('Stand on the ground to build a trading pad.');
          if(ledger.accounts[p.id].credits<POST_COST)fail(`A trade terminal and pad cost ${POST_COST} credits.`);
          if(Object.values(ledger.terminals).filter(t=>t.owner===p.id).length>=4)fail('Four trading pads per owner.');
          const site=tradeSite(p.nav.position,new THREE.Vector3(0,0,-1).applyQuaternion(p.nav.orientation));
          if(settlements.get(p)?.claims.some(c=>new THREE.Vector3(...c.origin).distanceTo(new THREE.Vector3(...site.origin))<c.radius+30))fail('Keep trading pads clear of public transport settlements.');
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
      state=result.state;if(result.transportPlan){const n=p.nav,plan={...result.transportPlan};for(const key of ['start','end','direction'])plan[key]=new THREE.Vector3().copy(plan[key]);n.travel={plan,elapsed:result.transportPlan.spoolSeconds,targeted:true,targetId:result.transportTarget.id,targetName:result.transportTarget.name};n.travelTarget=result.transportTarget.id;n.velocity.set(0,0,0);n.angularVelocity.set(0,0,0);n.combatMode=false;n.flightAssist=true;n.keys.clear();return 'Transport drive engaged. Automatic arrival braking; LT / X aborts.';}if(result.rock){for(const peer of players.values())if(peer.nav.position.distanceTo(new THREE.Vector3(...result.rock.position))<40)peer.send({type:'event',event:'cargoRock',rock:result.rock});}if(result.inventory)p.inventory=result.inventory;return result.message;
    },
  };
}
