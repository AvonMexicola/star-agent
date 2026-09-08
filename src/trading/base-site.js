import { Vector3,Quaternion } from 'three';
import { validBuild,LOCAL_OWNER } from '../build/state.js';
import { restoreBuildAnchors,validClaimAnchor } from '../build/anchors.js';
import { PIECES } from '../build/definitions.js';
import { bodyAt,bodyAltitude,bodyOffset } from '../celestial.js';
import { BuildSystem } from '../build/system.js';
import { baseStorage,validBaseStock } from './base-stock.js';
import { POST_COST } from './sites.js';
const check=(ok,message)=>{if(!ok)throw Error(message);};
export const BASE_COMMISSION_COST=POST_COST;
export function baseBuild(claim){return {version:1,nextId:1+Math.max(...[claim.id,...claim.pieces.map(p=>p.id)].map(id=>Number(id.split('-').at(-1)))),claims:[claim]};}
export function materializeBase(t){return restoreBuildAnchors(baseBuild(t.base.claim)).build.claims[0];}
/** Use the existing construction collision, landing and raycast implementation. */
export function baseGeometry(claim,nav){
  const system=Object.create(BuildSystem.prototype);
  Object.assign(system,{store:{state:{build:{claims:[claim]}}},nav,blocked:false,assetsLoaded:true});
  Object.defineProperty(system,'claims',{get:()=>system.store.state.build.claims});system.doorFraction=p=>Number(p.doorOpen);return system;
}
export function baseTerminalPoint(t){
  const c=materializeBase(t),p=c.pieces.find(p=>p.id===t.base.terminalPiece);
  return p?new Vector3(...p.position).add(new Vector3(0,1.15,0)).applyQuaternion(new Quaternion(...c.quaternion)).add(new Vector3(...c.origin)):null;
}
export function baseDocked(t,nav){
  if(!t?.base||nav.mode!=='walk'||nav.insideShip||nav.cabinFlight||nav.travel||nav.shipVelocity?.length()>1)return false;
  const surface=baseGeometry(materializeBase(t),nav).landingSurface({position:nav.shipPosition,orientation:nav.shipOrientation});
  return Boolean(surface&&Math.abs(surface.clearance)<1);
}
export function validBaseTerminal(t){
  try{const b=t.base;check(validBuild(baseBuild(b.claim))&&validClaimAnchor(b.claim),'layout');check(b.claim.pieces.some(p=>p.id===b.terminalPiece&&p.type==='terminal'),'terminal');return validBaseStock(t);}catch{return false;}
}
export function registerBase(source,owner,command,{nav,getContainer,shared=false,now=Date.now}){
  const {claim:incoming,terminalPiece}=command;
  check(incoming&&validBuild(baseBuild(incoming))&&validClaimAnchor(incoming),'Choose a valid constructed base.');
  const restored=restoreBuildAnchors(baseBuild(incoming));check(restored.ok,'Base anchor unavailable.');
  const raw=restored.build.claims[0];
  const claim={id:raw.id,name:raw.name,body:raw.body,owner:LOCAL_OWNER,useBuffer:false,origin:raw.origin,quaternion:raw.quaternion,anchor:raw.anchor,radius:raw.radius,...(!shared&&raw.power?{power:structuredClone(raw.power)}:{}),pieces:raw.pieces.map(p=>({id:p.id,type:p.type,position:[...p.position],rotation:p.rotation,doorOpen:p.doorOpen,...(p.supportDepth!==undefined?{supportDepth:p.supportDepth}:{}),...(p.landingPad!==undefined?{landingPad:p.landingPad}:{}),...(p.lightOn!==undefined?{lightOn:p.lightOn}:{})}))};
  check(claim.pieces.some(p=>p.id===terminalPiece&&p.type==='terminal'),'Build an inventory terminal at this base first.');
  check(claim.pieces.some(p=>p.landingPad&&PIECES[p.type].padSize),'Designate a landing pad at this base first.');
  check(nav.mode==='walk'&&!nav.insideShip&&!nav.dockedAtStation&&!nav.travel,'Walk up to the base terminal.');
  const point=new Vector3(...claim.pieces.find(p=>p.id===terminalPiece).position).add(new Vector3(0,1.15,0)).applyQuaternion(new Quaternion(...claim.quaternion)).add(new Vector3(...claim.origin));
  check(nav.position.distanceTo(point)<3.5,'Walk within reach of this base terminal.');
  check(bodyAt(nav.position).id===claim.body&&bodyAltitude(new Vector3(...claim.origin),nav.body??bodyAt(nav.position))>=-.1,'The base must be on its canonical surface.');
  check(Object.values(source.terminals).filter(t=>t.owner===owner&&t.base).length<4,'Four registered base shops per owner.');
  check(!Object.values(source.terminals).some(t=>t.owner===owner&&t.base?.claim.id===claim.id),'This base already has a trade terminal.');
  if(shared){
    check(claim.pieces.length<=64,'Shared trade bases support up to 64 pieces.');
    check(source.accounts[owner].credits>=BASE_COMMISSION_COST,`Registering a shared base costs ${BASE_COMMISSION_COST} CR.`);
    check(nav.stationDistance===undefined||nav.stationDistance>300,'Keep shared bases clear of the station.');
    check(Object.values(source.terminals).every(t=>new Vector3(...(t.base?materializeBase(t).origin:t.origin)).distanceTo(new Vector3(...claim.origin))>claim.radius+(t.base?.claim.radius??30)),'Another trading site overlaps this base.');
    // Validate every piece using canonical construction rules. The survey is at
    // each piece, while registration reach above uses the actual player pose.
    const partial={...claim,pieces:[]};const validator=baseGeometry(partial,nav);validator.store.state.build.claims=[];validator.canBuild=()=>true;
    for(const piece of claim.pieces){
      const survey=validator.toWorld(new Vector3(...piece.position).add(new Vector3(0,10,0)),claim);
      validator.nav={...nav,position:survey,body:bodyAt(survey),stationDistance:nav.stationDistance,shipPosition:null,layout:nav.layout};
      const reason=validator.validate(partial,piece);check(!reason,`Invalid shared layout: ${reason}`);partial.pieces.push(piece);
    }
    // Shared commissioning creates empty server storage and fresh utility state;
    // client-authored inventories, power buffers and free sandbox material never cross.
    delete claim.power;
    for(const p of claim.pieces)if(PIECES[p.type].door)p.doorOpen=true;
  }
  const s=structuredClone(source),id=`base-shop-${s.nextId++}`;
  s.terminals[id]={id,owner,name:claim.name,body:claim.body,origin:claim.origin,quaternion:claim.quaternion,position:point.toArray(),stock:{},prices:{},base:{version:1,shared,claim,terminalPiece,public:false,open:true,storage:baseStorage(claim,shared?null:getContainer),offers:{}}};
  if(shared)s.accounts[owner].credits-=BASE_COMMISSION_COST;
  check(validBaseTerminal(s.terminals[id]),'Invalid base storage; original stock retained.');
  return {state:s,terminal:id,message:shared?'Shared base registered with empty storage. Deposit server cargo to stock it.':'Trade terminal linked to this base’s local stock.'};
}
