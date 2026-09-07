import { createRemoteCargoAccess } from '../cargo/remote-access.js';
import { FreighterSystems } from '../freighter-layout.js';
import { bindCargoMining } from './mining-client.js';
import { walkForeignShips } from '../cargo/physics.js';
import * as THREE from 'three';
import { LocalTrading,LOCAL_TRADER } from './local.js';
import { createTradingUI } from './ui.js';
import { createCargoVisual,cargoAsset } from '../cargo/visuals.js';
import { shipPose,aboard,nearCrate,nearGrid,aimedGrid } from '../cargo/access.js';
import { crateBounds } from '../cargo/grid.js';
import { constrainShipAttachments } from '../ship-attachment-collision.js';
import { createTradingPads } from './pads.js';
import { onTradePad } from './sites.js';
export function createTradingSystem({scene,nav,station,store,multiplayer,getShip,build,mining,remotePlayers}){
  const miningClient=bindCargoMining({multiplayer,mining,nav});
  const local=new LocalTrading(store),visuals=new Map(),accessModels=new Map(),peerLifts=new Map(),carry=new THREE.Group();carry.name='Carried 1 SBU';scene.add(carry);let lastRevision=-1,serial=0;
  cargoAsset(1).then(m=>carry.add(m)).catch(e=>{carry.userData.error=e.message;});
  const snapshot=()=>{if(multiplayer.connected){const s=multiplayer.state.commerce;return {...s,owner:multiplayer.state.ownId,online:true,ships:s?.ships??[],terminals:s?.terminals??[]};}const s=local.state;return {...s,ships:Object.values(s.ships),terminals:Object.values(s.terminals),account:{...s.accounts[LOCAL_TRADER],credits:store.state.economy.credits},owner:LOCAL_TRADER,online:false};};
  const pose=s=>{if(s.owner===snapshot().owner)return s.hull===nav.shipId?shipPose(nav):null;const p=multiplayer.state.players.find(p=>p.id===s.owner&&p.shipId===s.hull);return p?.shipPosition?{position:new THREE.Vector3(...p.shipPosition),quaternion:new THREE.Quaternion(...p.shipOrientation)}:null;};
  function terminalPosition(id){
    if(id?.startsWith('station:')){const pod=station.pods.find(p=>`station:${p.id}`===id);return pod?.toWorld(new THREE.Vector3(-12,pod.interiorBox.min.y+1.75,20.7),new THREE.Vector3());}
    const t=snapshot().terminals.find(t=>t.id===id);return t?new THREE.Vector3(...t.position).add(new THREE.Vector3(0,1.3,0).applyQuaternion(new THREE.Quaternion(...t.quaternion))):null;
  }
  const atTerminal=id=>{const p=terminalPosition(id);return p&&nav.mode==='walk'&&!nav.insideShip&&nav.position.distanceTo(p)<2.8;};
  const nearestTerminal=()=>[...station.pods.map(p=>`station:${p.id}`),...snapshot().terminals.map(t=>t.id)].filter(atTerminal).sort((a,b)=>terminalPosition(a).distanceToSquared(nav.position)-terminalPosition(b).distanceToSquared(nav.position))[0]??null;
  const docked=(s,id)=>s.owner===snapshot().owner&&s.hull===nav.shipId&&nav.speed<1&&!nav.travel&&(id?.startsWith('station:')?nav.dockedAtStation&&Number(id.split(':')[1])===(multiplayer.connected?multiplayer.state.hangar?.id:station.parkedPod+1):onTradePad(pose(s)?.position,snapshot().terminals.find(t=>t.id===id)));
  const canTake=(s,c)=>{const p=pose(s);return p&&['walk','eva'].includes(nav.mode)&&aboard(nav.position,p,s.hull)&&nearCrate(nav.position,p,s.hull,c);};
  const canStow=s=>{const p=pose(s);return s.owner===snapshot().owner&&p&&nav.mode==='walk'&&aboard(nav.position,p,s.hull)&&nearGrid(nav.position,p,s.hull);};
  const sources=()=>{const a=[{id:'pack',name:'Backpack'}];if(!multiplayer.connected){if(nav.insideShip||nav.shipPosition&&nav.position.distanceTo(nav.shipPosition)<50)a.push({id:'ship',name:'Ship sample lockers'});for(const c of build.claims)if(new THREE.Vector3(...c.origin).distanceTo(nav.position)<20)for(const [id,v]of Object.entries(store.state.remote))if(id.includes(c.id))a.push({id,name:v.name});}return a;};
  const api={callShip:hull=>multiplayer.request('cargoHull',{hull}),snapshot,atTerminal,nearestTerminal,docked,canTake,canStow,sources,
    loose:(source,id)=>multiplayer.connected?((multiplayer.state.inventory?.containers.pack[id]??0)+(snapshot().account?.resources?.[id]??0)):(sources().some(s=>s.id===source)?store.container(source)?.items[id]??0:0),
    async command(m){
      const fields={...m,commandId:`cargo-${Date.now()}-${++serial}`,revision:snapshot().revision};
      if(multiplayer.connected){await multiplayer.request('cargo',fields);return {message:'Cargo transaction saved on the server.'};}
      return local.command(fields,{terminal:atTerminal,docked,resources:id=>api.loose(m.source,id),crate:canTake,grid:canStow,loot:()=>false});
    },
    async deploy(){if(multiplayer.connected){await multiplayer.request('cargo',{op:'deploy',revision:snapshot().revision,commandId:`cargo-${Date.now()}-${++serial}`});return {message:'Shared trading pad built.'};}return local.deploy(nav);},
  };
  const ui=createTradingUI(api,nav),pads=createTradingPads(scene,()=>snapshot().terminals);
  const oldCargo=nav.cargoConstrain;nav.cargoConstrain=(a,b)=>{const s=snapshot().ships.find(s=>s.owner===snapshot().owner&&s.hull===nav.shipId);return constrainShipAttachments(a,oldCargo?.(a,b)??b,(s?.crates??[]).map(c=>crateBounds(nav.shipId,c)));};
  const oldWalker=nav.cargoWalk;nav.cargoWalk=(a,b)=>{const previous=oldWalker?.(a,b)??{point:b,hit:false};const peers=snapshot().ships.filter(s=>s.owner!==snapshot().owner&&pose(s)).map(s=>({...s,pose:pose(s),open:(multiplayer.state.players.find(p=>p.id===s.owner)?.doorProgress??0)>.98,systems:peerLifts.get(s.owner)}));const foreign=walkForeignShips(a,previous.point,peers);const result=pads.constrain(a,foreign.point,nav.layout.eyeHeight);return {...result,grounded:result.grounded||foreign.grounded,hit:result.hit||previous.hit||result.grounded||foreign.hit};};
  nav.tradeBeacons=()=>snapshot().terminals.map(t=>({id:`trade-${t.id}`,name:t.name,kind:'Player trading pad',category:'bases',parent:t.body,body:t.body,surface:true,center:t.origin,radius:0}));
  nav.cargoLandingSurface=p=>pads.floorAt(p);
  const nearbyGrid=()=>snapshot().ships.some(s=>{const p=pose(s);return p&&aimedGrid(nav.position,nav.orientation,p,s.hull);});
  nav.cargoInteraction=()=>nav.buildActive?'':nearestTerminal()?'F / X · Trade terminal':nearbyGrid()&&nav.mode==='walk'?'F / X · Physical SBU cargo':'';
  nav.cargoAction=()=>{if(!nav.cargoInteraction())return false;return ui.openView(nearestTerminal()?'buy':'cargo');};
  return {ui,api,
    get state(){return {...snapshot(),error:local.error,carrying:nav.carryingCargo,visuals:[...visuals].map(([id,v])=>({id,objects:v.root.children.length,error:v.root.userData.error??null})),terminal:nearestTerminal()};},
    update(origin){
      const s=snapshot(),ids=new Set();
      for(const peer of multiplayer.state.players??[]){if(peer.id===s.owner)continue;if(peer.shipId==='atlas'){let system=peerLifts.get(peer.id);if(!system){system=new FreighterSystems();peerLifts.set(peer.id,system);}for(const v of peer.freighter??[]){const lift=system.lifts.find(l=>l.id===v.id);if(lift){lift.y=v.y;lift.target=v.target;const node=remotePlayers?.peers.get(peer.id)?.shipModel?.getObjectByName(lift.node);if(node)node.position.y=lift.y;}}}if(peer.shipPosition){let access=accessModels.get(peer.id);if(access&&access.hull!==peer.shipId){access.dispose();access=null;}if(!access){access=createRemoteCargoAccess(peer.shipId);scene.add(access.root);accessModels.set(peer.id,access);}access.root.position.set(...peer.shipPosition).sub(origin);access.root.quaternion.set(...peer.shipOrientation);access.update(peer);}}
      for(const [id,a] of accessModels)if(!multiplayer.state.players.some(p=>p.id===id)){a.dispose();accessModels.delete(id);peerLifts.delete(id);}
      for(const ship of s.ships){const p=pose(ship);if(!p)continue;ids.add(ship.id);let visual=visuals.get(ship.id);if(!visual){visual=createCargoVisual();scene.add(visual.root);visuals.set(ship.id,visual);}visual.update(ship.hull,ship.crates,nav.position.clone().sub(p.position).applyQuaternion(p.quaternion.clone().invert()));visual.root.position.copy(p.position).sub(origin);visual.root.quaternion.copy(p.quaternion);visual.root.visible=ship.owner===s.owner?getShip().visible:visual.root.position.length()<2000;}
      for(const [id,v]of visuals)if(!ids.has(id)){v.dispose();visuals.delete(id);}
      nav.carryingCargo=Boolean(s.account?.carried);carry.visible=nav.carryingCargo&&['walk','eva'].includes(nav.mode);carry.position.set(0,-.66,-.9).applyQuaternion(nav.orientation).add(nav.position).sub(origin);carry.quaternion.copy(nav.orientation);
      pads.update(origin);miningClient.update();if(lastRevision!==s.revision){lastRevision=s.revision;if(ui.open)ui.render();}
    },dispose(){ui.dispose();pads.dispose();for(const v of visuals.values())v.dispose();for(const a of accessModels.values())a.dispose();carry.removeFromParent();},
  };
}
