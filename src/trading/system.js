import {bodyAt} from '../celestial.js';
import {transportDestination} from '../transport/travel.js';
import {transportPickup} from '../transport/sites.js';
import { settlementMarketId } from '../settlements/catalog.js';
import { createBaseScene } from './base-scene.js';
import { baseTerminalPoint,baseDocked,materializeBase } from './base-site.js';
import { resourceById } from './resources.js';
import { tradeSummary,basePadSummary } from './base-stock.js';
import { createRemoteCargoAccess } from '../cargo/remote-access.js';
import { FreighterSystems } from '../freighter-layout.js';
import { bindCargoMining } from './mining-client.js';
import { walkForeignShips,constrainCargoEVA } from '../cargo/physics.js';
import * as THREE from 'three';
import { LocalTrading,LOCAL_TRADER } from './local.js';
import { createTradingUI } from './ui.js';
import { createCargoVisual,cargoAsset } from '../cargo/visuals.js';
import { shipPose,aboard,nearCrate,nearGrid,aimedGrid } from '../cargo/access.js';
import { crateBounds } from '../cargo/grid.js';
import { constrainShipAttachments } from '../ship-attachment-collision.js';
import { createTradingPads } from './pads.js';
import { onTradePad } from './sites.js';
import { marketIdForTerminal } from './market.js';
import { AEON_STATION_TERMINALS,stationTerminalPoint,stationedForTrade,STATION_TERMINAL_REACH } from './station-terminals.js';
import { createCargoTractor } from '../cargo/tractor-tool.js';
import { tractorContext } from '../cargo/tractor-context.js';
import { tractorWorldClear,constrainLooseCargo } from '../cargo/tractor-physics.js';
import { isHandsFree } from '../station-hub-policy.js';
export function createTradingSystem({scene,nav,station,store,multiplayer,getShip,build,mining,remotePlayers,getMuzzle,settlements,stationMarket=marketIdForTerminal}){
  const resolveMarket=id=>settlementMarketId(id)||stationMarket(id);
  const settlementIds=()=>settlements?.beacons().map(s=>s.id)??[];
  const miningClient=bindCargoMining({multiplayer,mining,nav});
  const local=new LocalTrading(store),visuals=new Map(),accessModels=new Map(),peerLifts=new Map(),carry=new THREE.Group();carry.name='Carried 1 SBU';scene.add(carry);let lastRevision=-1,serial=0;
  cargoAsset(1).then(m=>carry.add(m)).catch(e=>{carry.userData.error=e.message;});
  const snapshot=()=>{if(multiplayer.connected){const s=multiplayer.state.commerce;return {...s,owner:multiplayer.state.ownId,online:true,ships:s?.ships??[],loose:s?.loose??[],players:multiplayer.state.players,terminals:s?.terminals??[]};}const s=local.state;return {...s,ships:Object.values(s.ships),loose:Object.values(s.loose??{}),terminals:Object.values(s.terminals),marketTerminals:Object.fromEntries([...AEON_STATION_TERMINALS.map(t=>t.id),...settlementIds()].map(id=>[id,resolveMarket(id)])),account:{...s.accounts[LOCAL_TRADER],credits:store.state.economy.credits},owner:LOCAL_TRADER,online:false};};
  const pose=s=>{if(s.owner===snapshot().owner)return s.hull===nav.shipId?shipPose(nav):null;const p=multiplayer.state.players.find(p=>p.id===s.owner&&p.shipId===s.hull);return p?.shipPosition?{position:new THREE.Vector3(...p.shipPosition),quaternion:new THREE.Quaternion(...p.shipOrientation)}:null;};
  function terminalPosition(id){
    if(settlementMarketId(id))return settlements?.terminalPosition(id)??null;
    if(id?.startsWith('station:'))return stationTerminalPoint(station,id);
    const t=snapshot().terminals.find(t=>t.id===id);return t?.base?baseTerminalPoint(t):t?new THREE.Vector3(...t.position).add(new THREE.Vector3(0,1.3,0).applyQuaternion(new THREE.Quaternion(...t.quaternion))):null;
  }
  const atTerminal=id=>{const p=terminalPosition(id);return p&&nav.mode==='walk'&&!nav.insideShip&&nav.position.distanceTo(p)<STATION_TERMINAL_REACH;};
  const nearestTerminal=()=>[...AEON_STATION_TERMINALS.map(t=>t.id),...settlementIds(),...snapshot().terminals.map(t=>t.id)].filter(atTerminal).sort((a,b)=>terminalPosition(a).distanceToSquared(nav.position)-terminalPosition(b).distanceToSquared(nav.position))[0]??null;
  const docked=(s,id)=>s.owner===snapshot().owner&&s.hull===nav.shipId&&!nav.cabinFlight&&nav.shipVelocity.length()<1&&!nav.travel&&(settlementMarketId(id)?settlements?.docked(id,pose(s)):id?.startsWith('station:')?stationedForTrade({nav,hangarId:multiplayer.connected?multiplayer.state.hangar?.id:station.parkedPod+1,station},id):nav.shipSpeed<1&&(snapshot().terminals.find(t=>t.id===id)?.base?baseDocked(snapshot().terminals.find(t=>t.id===id),nav):onTradePad(pose(s)?.position,snapshot().terminals.find(t=>t.id===id))));
  const canTake=(s,c)=>{const p=pose(s);return p&&['walk','eva'].includes(nav.mode)&&aboard(nav.position,p,s.hull)&&nearCrate(nav.position,p,s.hull,c);};
  const canStow=s=>{const p=pose(s);return s.owner===snapshot().owner&&p&&nav.mode==='walk'&&aboard(nav.position,p,s.hull)&&nearGrid(nav.position,p,s.hull);};
  const sources=()=>{const a=[{id:'pack',name:'Backpack'}];if(!multiplayer.connected){if(nav.insideShip||nav.shipPosition&&nav.position.distanceTo(nav.shipPosition)<50)a.push({id:'ship',name:'Ship sample lockers'});if(nav.shipId==='stratum'&&store.container('stratum-ore')&&(nav.insideShip||nav.mode==='landed'||nav.mode==='flight'||nav.shipPosition&&nav.position.distanceTo(nav.shipPosition)<50))a.push({id:'stratum-ore',name:'Stratum ore bin'});for(const c of build.claims)if(new THREE.Vector3(...c.origin).distanceTo(nav.position)<20)for(const [id,v]of Object.entries(store.state.remote))if(id.includes(c.id))a.push({id,name:v.name});}return a;};
  const physicalShips=()=>snapshot().ships.filter(s=>pose(s)).map(s=>{const own=s.owner===snapshot().owner,peer=multiplayer.state.players.find(p=>p.id===s.owner);return {...s,pose:pose(s),speed:own?nav.shipSpeed:Math.hypot(...(peer?.shipVelocity??[0,0,0])),open:own?nav.doorProgress>.98:(peer?.doorProgress??0)>.98,systems:own?nav.freighter:peerLifts.get(s.owner)};});
  const worldClear=tractorWorldClear(nav,station,(a,d,r)=>nav.buildingRaycast?.(a,d,r)?.distance);
  const transportAvailable=r=>settlementIds().includes(r.from)&&settlementIds().includes(r.to);
  const api={nav,transportAvailable,localBases:()=>store.state.build?.claims??[],baseActive:t=>!t.base||t.base.shared||!build.power||Boolean(build.claims.find(c=>c.id===t.base?.claim.id)&&build.power.status(build.claims.find(c=>c.id===t.base.claim.id)).powered),callShip:hull=>multiplayer.request('cargoHull',{hull}),snapshot,atTerminal,nearestTerminal,docked,canTake,canStow,sources,
    equipTractor:()=>multiplayer.connected?multiplayer.request('equip',{weapon:'mining-laser-tool'}):Promise.resolve(),
    loose:(source,id)=>multiplayer.connected?((multiplayer.state.inventory?.containers.pack[id]??0)+(snapshot().account?.resources?.[id]??0)):(sources().some(s=>s.id===source)?store.container(source)?.items[id]??0:0),
    async command(m){
      const fields={...m,commandId:`cargo-${Date.now()}-${++serial}`,revision:m.revision??snapshot().revision};
      if(multiplayer.connected){await multiplayer.request('cargo',fields);return {message:m.op.startsWith('tractor-')?'':'Cargo transaction saved on the server.'};}
      return local.command(fields,{nav,transportAvailable,transportPickup:id=>transportPickup(settlements,id,physicalShips(),snapshot().loose),baseActive:api.baseActive,terminal:atTerminal,docked,stationMarket:resolveMarket,resources:id=>api.loose(m.source,id),crate:canTake,grid:canStow,loot:()=>false,tractor:tractorContext({nav,ships:physicalShips,loose:()=>snapshot().loose,worldClear})});
    },
    async deploy(){if(multiplayer.connected){await multiplayer.request('cargo',{op:'deploy',revision:snapshot().revision,commandId:`cargo-${Date.now()}-${++serial}`});return {message:'Shared trading pad built.'};}return local.deploy(nav);},
  };
  const tractor=createCargoTractor({scene,nav,api,ships:physicalShips,worldClear,getMuzzle});api.tractor=tractor;
  const ui=createTradingUI(api,nav),pads=createTradingPads(scene,()=>snapshot().terminals.filter(t=>!t.base));
  nav.transportDriveAvailable=id=>transportDestination(snapshot().account,id);
  nav.transportDrive=id=>api.command({op:'transport-drive',target:id}).catch(e=>nav.notify(e.message));
  nav.openTransport=()=>ui.openView('freight');
  nav.openBaseTrade=claimId=>{const t=snapshot().terminals.find(t=>t.base?.claim.id===claimId&&t.owner===snapshot().owner);return ui.openView(t?'stock':'build',t?.id);};
  const bases=createBaseScene(scene,nav,()=>snapshot().terminals);
  const previousRay=nav.buildingRaycast;nav.buildingRaycast=(...args)=>{const a=previousRay?.(...args),b=bases.raycast(...args);return a&&(!b||a.distance<b.distance)?a:b;};
  const previousLanding=nav.baseLandingSurface;nav.baseLandingSurface=pose=>bases.landingSurface(pose)??previousLanding?.(pose);
  const previousBaseRevision=nav.baseLandingRevision;let baseRevision=null,previousBaseData=null,previousBaseKey='';nav.baseLandingRevision=()=>{const data=previousBaseRevision?.(),key=snapshot().terminals.filter(t=>t.base).map(t=>`${t.id}:${t.base.claim.pieces.length}`).join(',');if(data!==previousBaseData||key!==previousBaseKey){previousBaseData=data;previousBaseKey=key;baseRevision={};}return baseRevision;};
  nav.cargoEVA=(a,b)=>constrainCargoEVA(a,b,snapshot().ships.filter(s=>pose(s)).map(s=>({...s,pose:pose(s),open:s.owner===snapshot().owner?nav.doorProgress>.98:(multiplayer.state.players.find(p=>p.id===s.owner)?.doorProgress??0)>.98,systems:s.owner===snapshot().owner?nav.freighter:peerLifts.get(s.owner)})));
  const oldCargo=nav.cargoConstrain;nav.cargoConstrain=(a,b)=>{const s=snapshot().ships.find(s=>s.owner===snapshot().owner&&s.hull===nav.shipId);return constrainShipAttachments(a,oldCargo?.(a,b)??b,(s?.crates??[]).map(c=>crateBounds(nav.shipId,c)));};
  const oldWalker=nav.cargoWalk;nav.cargoWalk=(a,b)=>{const previous=oldWalker?.(a,b)??{point:b,hit:false};const peers=snapshot().ships.filter(s=>s.owner!==snapshot().owner&&pose(s)).map(s=>({...s,pose:pose(s),open:(multiplayer.state.players.find(p=>p.id===s.owner)?.doorProgress??0)>.98,systems:peerLifts.get(s.owner)}));const foreign=walkForeignShips(a,previous.point,peers);const result=pads.constrain(a,foreign.point,nav.layout.eyeHeight);return {...result,grounded:result.grounded||foreign.grounded,hit:result.hit||previous.hit||result.grounded||foreign.hit};};
  nav.tradeBeacons=()=>{const s=snapshot(),plans=s.online?api.localBases().filter(c=>!s.terminals.some(t=>t.owner===s.owner&&t.base?.claim.id===c.id)).map(c=>({id:`base-plan-${c.id}`,name:c.name,kind:'Your unregistered base plan',summary:'Visit this site · Trade → Build to register',category:'bases',parent:c.body,body:c.body,surface:true,center:c.origin,radius:0})):[];return [...(settlements?.beacons()??[]),...s.loose.filter(c=>c.transport?.owner===s.owner).map(c=>({id:`freight-crate-${c.id}`,name:'Your sealed freight crate',kind:'Personal mission cargo',category:'missions',parent:bodyAt(new THREE.Vector3(...c.position)).id,center:c.position,radius:0})),...plans,...s.terminals.filter(t=>!t.base||t.base.public||t.owner===snapshot().owner).map(t=>({id:`trade-${t.id}`,localClaimId:t.base&&!t.base.shared?t.base.claim.id:undefined,name:t.name,kind:t.base?'Player base':'Player trading pad',summary:api.baseActive(t)===false?'Shop unpowered':tradeSummary(t),sales:[t.padSummary??basePadSummary(t),Object.entries(t.stock).filter(([,n])=>n>0).map(([id,n])=>`${resourceById(id)?.name??id}: ${n} SBU · ${t.prices[id]??resourceById(id)?.buy} CR/SBU`).join(' · ')].filter(Boolean).join(' · '),category:'bases',parent:t.body,body:t.body,surface:true,center:t.base?materializeBase(t).origin:t.origin,radius:0}))];};
  nav.cargoLandingSurface=p=>pads.floorAt(p);
  // Pad poses are immutable after deployment; commerce/stock changes do not move them.
  nav.cargoLandingRevision=()=>multiplayer.connected?`online:${multiplayer.state.commerce?.terminals?.length??0}`:`offline:${Object.keys(local.state.terminals).length}`;
  const eva=nav.cargoEVA,walk=nav.cargoWalk,constrain=nav.cargoConstrain;
  nav.cargoEVA=(a,b)=>{const result=eva(a,b),point=constrainLooseCargo(a,result.point,snapshot().loose,{eva:true});return {...result,point,hit:result.hit||!point.equals(result.point)};};
  nav.cargoWalk=(a,b)=>{const old=walk(a,b),result=bases.constrain(a,old.point),point=constrainLooseCargo(a,result.point,snapshot().loose);return {...result,point,grounded:old.grounded||result.grounded,hit:old.hit||result.hit||!point.equals(result.point)};};
  nav.cargoConstrain=(a,b)=>nav.toShipLocal(constrainLooseCargo(nav.fromShipLocal(a),nav.fromShipLocal(constrain(a,b)),snapshot().loose));
  const nearbyGrid=()=>snapshot().ships.some(s=>{const p=pose(s);return p&&aimedGrid(nav.position,nav.orientation,p,s.hull);});
  nav.cargoInteraction=()=>nav.buildActive?'':tractor.held?(tractor.state.slot?'F / X · Secure tractor crate':'Tractor · Guide crate to your cargo grid'):nearestTerminal()?'F / X · Trade terminal':nearbyGrid()&&nav.mode==='walk'?'F / X · Physical SBU cargo':'';
  nav.cargoAction=()=>{if(tractor.held){if(!tractor.secure())nav.notify('Guide the crate closer to its free slot, or release RT to leave it here.');return true;}if(!nav.cargoInteraction())return false;return ui.openView(nearestTerminal()?'buy':'cargo');};
  return {ui,api,tractor,registerHull:hull=>!multiplayer.connected&&local.registerHull(hull),
    get state(){return {...snapshot(),tractor:tractor.state,error:local.error,carrying:nav.carryingCargo,visuals:[...visuals].map(([id,v])=>({id,objects:v.root.children.length,error:v.root.userData.error??null})),terminal:nearestTerminal()};},
    update(origin,dt=.016){
      const s=snapshot(),ids=new Set();
      const peers=multiplayer.state.players??[];
      for(const peer of peers){
        if(peer.id===s.owner)continue;
        if(peer.shipId==='atlas'){
          let system=peerLifts.get(peer.id);
          if(!system){system=new FreighterSystems();peerLifts.set(peer.id,system);}
          if(system.lastPeer!==peer){system.applySnapshot(peer.freighter);system.lastPeer=peer;}
        }else peerLifts.delete(peer.id);
        // Atlas access is the authored, animated hull in RemotePlayers. Only
        // Nomad needs the separate procedural two-leaf ramp/hatch accessory.
        let access=accessModels.get(peer.id);
        if(access&&(!peer.shipPosition||peer.shipId!=='nomad')){access.dispose();accessModels.delete(peer.id);access=null;}
        if(peer.shipPosition&&peer.shipId==='nomad'){
          if(!access){access=createRemoteCargoAccess('nomad');scene.add(access.root);accessModels.set(peer.id,access);}
          access.root.position.set(...peer.shipPosition).sub(origin);access.root.quaternion.set(...peer.shipOrientation);access.update(peer);
        }
      }
      for(const [id,a] of accessModels)if(!peers.some(p=>p.id===id)){a.dispose();accessModels.delete(id);}
      for(const id of peerLifts.keys())if(!peers.some(p=>p.id===id&&p.shipId==='atlas'))peerLifts.delete(id);
      for(const ship of s.ships){const p=pose(ship);if(!p)continue;ids.add(ship.id);let visual=visuals.get(ship.id);if(!visual){visual=createCargoVisual();scene.add(visual.root);visuals.set(ship.id,visual);}visual.update(ship.hull,ship.crates,nav.position.clone().sub(p.position).applyQuaternion(p.quaternion.clone().invert()));visual.root.position.copy(p.position).sub(origin);visual.root.quaternion.copy(p.quaternion);visual.root.visible=ship.owner===s.owner?getShip().visible:visual.root.position.length()<2000;}
      for(const [id,v]of visuals)if(!ids.has(id)){v.dispose();visuals.delete(id);}
      tractor.update(dt,origin);nav.carryingCargo=Boolean(s.account?.carried||tractor.held);carry.visible=Boolean(s.account?.carried)&&['walk','eva'].includes(nav.mode);carry.position.set(0,-.66,-.9).applyQuaternion(nav.orientation).add(nav.position).sub(origin);carry.quaternion.copy(nav.orientation);
      const uiRevision=`${s.revision}|${isHandsFree(nav)}|${Boolean(nav.travel)}`;
      pads.update(origin);bases.update(origin);miningClient.update();if(lastRevision!==uiRevision){lastRevision=uiRevision;if(ui.open)ui.render();}
    },dispose(){bases.dispose();tractor.dispose();ui.dispose();pads.dispose();for(const v of visuals.values())v.dispose();for(const a of accessModels.values())a.dispose();carry.removeFromParent();},
  };
}
