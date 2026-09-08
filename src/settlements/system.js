import {Vector3,Quaternion} from 'three';
import {BuildSystem} from '../build/system.js';
import {emptyBuild} from '../build/state.js';
import {createSettlementLayouts,settlementLayoutErrors} from './layout.js';
const v=a=>new Vector3(...a);

/** Authored world content uses the construction renderer/collision directly.
 * It never enters the player's save, claim allowance, storage or removal tools. */
export function createSettlements({scene,nav,enabled=()=>!nav.multiplayer?.connected,render=true}){
  const layouts=createSettlementLayouts();
  const store={state:{build:emptyBuild()},container:()=>null};
  const buildings=new BuildSystem({scene,nav,store,render});
  const collisionStore={state:{build:emptyBuild()},container:()=>null};
  const collision=new BuildSystem({scene,nav,store:collisionStore,render:false});
  collisionStore.state.build={...emptyBuild(),claims:layouts.map(s=>s.claim)};
  const active=()=>enabled()?layouts:[];
  let visibleKey='';
  const point=(s,p)=>buildings.toWorld(v(p),s.claim);
  const terminal=id=>active().find(s=>s.id===id);
  const api={
    layouts,buildings,nav,
    get claims(){return active().map(s=>s.claim);},
    get grounded(){return enabled()&&collision.grounded;},
    terminalPosition(id){const s=terminal(id);return s?point(s,s.terminalPiece.position).add(new Vector3(0,1.2,0).applyQuaternion(new Quaternion(...s.claim.quaternion))):null;},
    docked(id,pose){
      const s=terminal(id);if(!s||!pose)return false;
      const local=collision.toLocal(pose.position,s.claim),surface=collision.landingSurface(pose);
      return surface&&Math.abs(local.y-s.pad.position[1])<.6&&Math.abs(local.x)<24&&Math.abs(local.z-20)<36;
    },
    beacons(){return active().map(s=>({id:s.id,name:s.name,kind:`Trade settlement · ${s.role} · Large pad`,category:'trade',parent:s.body,body:s.body,surface:true,center:point(s,s.pad.position).toArray(),radius:0}));},
    constrainWalker(a,b){return enabled()?collision.constrainWalker(a,b):{point:b,hit:false,grounded:false};},
    raycast(...args){return enabled()?collision.raycast(...args):null;},
    landingSurface(pose){return enabled()?collision.landingSurface(pose):null;},
    update(dt,origin){
      const nearby=active().filter(s=>v(s.claim.origin).distanceTo(nav.position)<2400),key=nearby.map(s=>s.id).join('|');
      if(key!==visibleKey){visibleKey=key;store.state.build={...emptyBuild(),claims:nearby.map(s=>s.claim)};}
      buildings.update(dt,origin);
    },
    /** Explicit development approach, followed by real landing and boarding. */
    approach(id){
      const s=terminal(id);if(!s)return false;
      const target=point(s,[0,s.pad.position[1]+65,20]);
      nav.orbit();nav.position.copy(target);nav.orientation.fromArray(s.claim.quaternion);
      nav.velocity.set(0,0,0);nav.angularVelocity.set(0,0,0);nav.keys.clear();nav.gamepad.suspend();nav.resetSteering();
      return true;
    },
    get state(){return {available:enabled(),sites:active().map(s=>({id:s.id,name:s.name,body:s.body,origin:s.claim.origin,quaternion:s.claim.quaternion,pad:point(s,s.pad.position).toArray(),terminal:api.terminalPosition(s.id).toArray(),pieces:s.claim.pieces.length,terrain:s.terrain})),error:[buildings.error,...settlementLayoutErrors].filter(Boolean).join(' '),rendered:buildings.models.size,ready:[...buildings.models.values()].every(m=>m.ready)};},
    dispose(){buildings.dispose();collision.dispose();},
  };
  return api;
}
