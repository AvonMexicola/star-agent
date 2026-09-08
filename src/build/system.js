import {mountHeight,mountReason} from './mounts.js';
import {planRemoval} from './removal.js';
import {pruneBaseStorage} from './power-system.js';
import {initialPower,POWER_PARTS} from './power.js';
import {isPanel,footprint,wallOnPanel,wallEdge,wallCandidates,roofCandidates,attachedPanels,structuralReason} from './structure.js';
import {contains,volumesOverlap,rayPrism,distanceToPolygon} from './polygons.js';
import { shipCargoAccess } from '../inventory/ship-access.js';
import * as THREE from 'three';
import { bodyAt, bodyAltitude, bodyOffset, bodySurfacePoint, BODIES } from '../celestial.js';
import { terrainHeight } from '../world.js';
import { PIECES, GRID, STOREY } from './definitions.js';
import { getWorldBoxes, getPlacementBoxes, getPlacementBounds, capsuleIntersectsBox, constrainBuildStep } from './collision.js';
import { setBuildPowered, createBuildVisual, setDoorOpen, createBuildGhost, setBuildGhostValid, disposeBuildGhost, disposeBuildVisual, setBuildOpacity } from './visuals.js';
import { DoorMotion, buildOpacity, serviceLightFade, nightFactor, nearestServiceLights, MAX_SERVICE_LIGHTS } from './motion.js';
import { updateMainframeDisplay } from './mainframe-display.js';
import { withClaimAnchor, restoreBuildAnchors } from './anchors.js';
import { emptyBuild, validBuild, planCost, addBuildContainer, CLAIM_RADIUS, CLAIM_HEIGHT, MAX_CLAIMS, MAX_PIECES, LOCAL_OWNER } from './state.js';

const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,-1);
const v=a=>new THREE.Vector3(...a),q=a=>new THREE.Quaternion(...a);
const close=(a,b,t=.03)=>Math.abs(a-b)<t;
const overlap=volumesOverlap;
const bufferId=(claim,piece)=>piece.type==='mainframe'?`build-core-${claim.id.split('-').at(-1)}`:`build-crate-${piece.id.split('-').at(-1)}`;
export class BuildSystem {
  constructor({scene,nav,store,render=true,supplySources=()=>[]}){
    this.supplySources=supplySources;this.scene=scene;this.nav=nav;this.store=store;this.render=render;this.active=false;this.removing=false;this.removalPending=false;this.pieceId='mainframe';this.turn=0;this.height=0;this.snap=0;
    this.doorMotion=new DoorMotion();this.ghostRequest=0;this.ghostModel=null;this.ghostFactory=createBuildGhost;this.ghostDisposer=disposeBuildGhost;this.disposed=false;this.claimVisibility=[];
    this.groups=new Map();this.models=new Map();this.registered=new Set();this.grounded=false;this.error='';this.preview=null;this.revision=0;
    const restored=store.state.build!==undefined&&!validBuild(store.state.build)?{ok:false,message:'Base save is invalid. Original data retained; construction paused.'}:restoreBuildAnchors(store.state.build);
    this.blocked=!restored.ok||restored.build!==undefined&&(!validBuild(restored.build)||restored.build.claims.some(c=>c.pieces.filter(p=>['mainframe','crate','rack'].includes(p.type)).some(p=>store.container(bufferId(c,p))?.kind!=='base')));
    if(this.blocked)this.error=restored.message||'Base save is invalid. Original data retained; construction paused.';
    else if(restored.build!==undefined)store.state={...store.state,build:restored.build};
    this.ghost=new THREE.Group();this.ghost.name='Construction preview';if(render)scene.add(this.ghost);
    this.removeRoot=new THREE.Group();this.removeOutline=new THREE.Box3Helper(new THREE.Box3(),0xffa36c);this.removeRoot.add(this.removeOutline);this.removeRoot.visible=false;if(render)scene.add(this.removeRoot);
    const ringPoints=Array.from({length:96},(_,i)=>new THREE.Vector3(Math.cos(i*Math.PI/48)*CLAIM_RADIUS,.1,Math.sin(i*Math.PI/48)*CLAIM_RADIUS));
    this.boundary=new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPoints),new THREE.LineBasicMaterial({color:0xb6efd1,transparent:true,opacity:.55,depthWrite:false}));
    this.boundary.visible=false;if(render)scene.add(this.boundary);
    this.workLight=new THREE.SpotLight(0xe9fff6,4,16,.6,.6,2);this.workLight.visible=false;if(render)scene.add(this.workLight,this.workLight.target);
    this.serviceLights=Array.from({length:MAX_SERVICE_LIGHTS},()=>{const light=new THREE.PointLight(0xb6efd1,0,6,2);light.visible=false;if(render)scene.add(light);return light;});
    this.assetsLoaded=!render;
    if(render)Promise.all(Object.keys(PIECES).map(id=>createBuildVisual(id).then(model=>disposeBuildVisual(model)))).then(()=>{this.assetsLoaded=true;}).catch(e=>{this.error=`Building assets unavailable: ${e.message}`;});
    this._origin=new THREE.Vector3();this._lastPreview=0;
  }
  get data(){return this.store.state.build??emptyBuild();}
  get claims(){return this.blocked?[]:this.data.claims;}
  get state(){return {controllerAvailable:this.controllerAvailable,active:this.active,removing:this.removing,pieceId:this.pieceId,preview:this.preview?{pieceId:this.pieceId,valid:this.preview.valid,reason:this.preview.reason,cost:this.preview.cost,sources:this.preview.sources,rotation:this.preview.piece?.rotation,position:this.preview.position,claimId:this.preview.claim?.id??null}:null,claims:structuredClone(this.claims),pieceCount:this.claims.reduce((s,c)=>s+c.pieces.length,0),error:this.error,grounded:this.grounded,visuals:this.visualDiagnostics,assetsReady:this.models.size>0&&[...this.models.values()].every(m=>m.ready),materials:this.store.container('pack')?.items};}
  get visualDiagnostics(){return {doors:[...this.doorMotion.doors].map(([id,d])=>({id,target:Boolean(d.target),fraction:d.fraction,colliderFraction:d.fraction,blocked:d.blocked})),ghost:{pieceId:this.ghost.userData.piece??null,ready:Boolean(this.ghostModel),meshes:this.ghostModel?(()=>{let count=0;this.ghostModel.traverse(o=>{if(o.isMesh)count++;});return count;})():0},claims:this.claimVisibility,lights:{active:this.serviceLights.filter(l=>l.visible).length,fixtures:this.serviceLights.filter(l=>l.visible).map(l=>({id:l.userData.fixtureId,intensity:l.intensity})),max:MAX_SERVICE_LIGHTS,work:this.workLight.visible}};}
  canBuild(){return !this.nav.multiplayer?.connected&&!this.nav.openingActive&&this.nav.mode==='walk'&&!this.nav.insideShip&&!this.nav.dockedAtStation&&!this.nav.travel&&this.nav.altitude<80;}
  get controllerAvailable(){
    if(this.blocked||this.store.blocked||!this.canBuild())return false;
    return this.claims.some(c=>c.owner===LOCAL_OWNER&&c.body===this.nav.body.id&&c.pieces.some(p=>p.type==='mainframe'&&this.nav.position.distanceTo(this.toWorld(v(p.position),c))<=c.radius));
  }
  begin(id=this.pieceId){if(!this.canBuild())return {ok:false,message:'Leave the ship and stand on a planetary surface to build.'};if(this.blocked||this.store.blocked)return {ok:false,message:this.error||this.store.warning};this.active=true;this.nav.buildActive=true;this.nav.keys.clear();this.nav.gamepad.suspend();return this.select(id);}
  select(id){if(!PIECES[id])return {ok:false,message:'Choose a building piece.'};this.removing=false;this.pieceId=id;this.snap=0;this.height=0;this.refreshPreview();return {ok:true};}
  beginRemoval(){const result=this.begin(this.pieceId);if(!result.ok)return result;this.removing=true;this.refreshPreview();return {ok:true};}
  cancel(){this.active=false;this.removing=false;this.nav.buildActive=false;this.preview=null;this.ghost.visible=false;this.removeRoot.visible=false;this.boundary.visible=false;this.workLight.visible=false;this.nav.keys.clear();this.nav.toolTrigger=0;this.nav.gamepad.suspend();}
  rotate(delta){if(this.removing)return;this.turn=((this.turn+delta*(PIECES[this.pieceId].category==='wall'?2:1))%4+4)%4;this.refreshPreview();}
  cycleSnap(){if(this.removing)return;this.snap++;this.refreshPreview();}
  adjustHeight(delta){if(this.removing||PIECES[this.pieceId].mount)return;const foundation=PIECES[this.pieceId].category==='foundation';this.height=THREE.MathUtils.clamp(this.height+(foundation?delta:Math.sign(delta)*STOREY),foundation?-.2:0,24);this.refreshPreview();}
  toLocal(point,c){return point.clone().sub(v(c.origin)).applyQuaternion(q(c.quaternion).invert());}
  toWorld(point,c){return point.clone().applyQuaternion(q(c.quaternion)).add(v(c.origin));}
  nearestClaim(point=this.nav.position){return this.claims.filter(c=>c.body===bodyAt(point).id).map(c=>({c,d:this.toLocal(point,c).length()})).filter(x=>x.d<x.c.radius+15).sort((a,b)=>a.d-b.d)[0]?.c??null;}
  target(){
    const n=this.nav,dir=FORWARD.clone().applyQuaternion(n.orientation),body=n.body;
    const structure=this.raycast(n.position,dir,12);if(structure)return structure.point;
    let last=n.position.clone(),lastH=bodyAltitude(last,body);
    for(let distance=.5;distance<=12;distance+=.5){const point=n.position.clone().addScaledVector(dir,distance),h=bodyAltitude(point,body);if(h<=0&&lastH>0){let a=last,b=point;for(let i=0;i<8;i++){const m=a.clone().add(b).multiplyScalar(.5);if(bodyAltitude(m,body)>0)a=m;else b=m;}return a;}last=point;lastH=h;}
    const planar=dir.projectOnPlane(n.normal);if(planar.lengthSq()<.01)planar.set(1,0,0).projectOnPlane(n.normal);planar.normalize();
    return bodySurfacePoint(bodyOffset(n.position.clone().addScaledVector(planar,6),body).normalize(),body);
  }
  newClaim(point){
    const body=bodyAt(point),up=bodyOffset(point,body).normalize(),forward=FORWARD.clone().applyQuaternion(this.nav.orientation).projectOnPlane(up).normalize();
    if(forward.lengthSq()<.1)forward.set(Math.abs(up.x)<.8?1:0,Math.abs(up.x)<.8?0:1,0).projectOnPlane(up).normalize();
    const right=forward.clone().cross(up).normalize(),quat=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,forward.clone().negate()));
    return withClaimAnchor({id:`build-claim-${this.data.nextId}`,body:body.id,name:`${body.name} outpost ${this.claims.length+1}`,owner:LOCAL_OWNER,useBuffer:false,origin:point.toArray(),quaternion:quat.toArray(),radius:CLAIM_RADIUS,pieces:[]});
  }
  candidates(claim,target){
    const def=PIECES[this.pieceId],local=this.toLocal(target,claim),rotation=this.turn*Math.PI/2;
    const panels=claim.pieces.filter(isPanel),sort=items=>{const unique=new Map(items.map(p=>[[...p.position,p.rotation].map(v=>Math.round(v*10000)).join(','),p]));return [...unique.values()].sort((a,b)=>v(a.position).distanceToSquared(local)-v(b.position).distanceToSquared(local));};
    if(def.mount){return sort(claim.pieces.filter(p=>PIECES[p.type].category==='floor').map(p=>({position:def.mount==='ceiling'?[Math.round(local.x*2)/2,mountHeight(p,def.mount),Math.round(local.z*2)/2]:[p.position[0],mountHeight(p,def.mount),p.position[2]],rotation:['triangle','quarter'].includes(def.shape)?p.rotation:p.rotation+rotation})));}
    if(def.category==='wall'){
      local.y+=this.height;
      const stacked=claim.pieces.filter(p=>PIECES[p.type].category==='wall'&&(PIECES[p.type].shape==='quarter')===(def.shape==='quarter')&&PIECES[p.type].footprint[0]===def.footprint[0]).map(p=>({position:[p.position[0],p.position[1]+PIECES[p.type].height,p.position[2]],rotation:(p.rotation??0)+(def.shape==='quarter'?0:Math.floor(this.turn/2)*Math.PI)}));
      return sort([...wallCandidates(this.pieceId,panels,Math.floor(this.turn/2)),...stacked]);
    }
    if(def.category==='stairs')return sort(panels.filter(p=>!['triangle','quarter'].includes(PIECES[p.type].shape)).map(p=>({position:[...p.position],rotation})));
    if(def.category==='floor'){
      const items=panels.filter(p=>(PIECES[p.type].shape??'square')===(def.shape??'square')).map(p=>({position:[p.position[0],p.position[1]+STOREY+this.height,p.position[2]],rotation:p.rotation??0}));
      items.push(...roofCandidates(this.pieceId,claim.pieces.filter(p=>PIECES[p.type].category==='wall')));
      for(const p of panels.filter(p=>PIECES[p.type].category==='floor'))items.push(...attachedPanels(this.pieceId,p));
      return sort(items.map(p=>({...p,rotation:p.rotation+(def.shape?0:rotation)})));
    }
    if(def.category==='foundation'){
      if(def.shape==='ramp')return sort(wallCandidates('wall',panels).map(edge=>({position:[edge.position[0]-2*Math.sin(edge.rotation),edge.position[1]+this.height,edge.position[2]-2*Math.cos(edge.rotation)],rotation:edge.rotation+Math.PI})));
      if(def.padSize){
        // Large prefabs are aimed at their near edge: their centre lies beyond
        // ordinary tool reach, and the placer must remain outside the slab.
        const actor=this.toLocal(this.nav.position,claim),dx=local.x-actor.x,dz=local.z-actor.z,swapped=Math.abs(Math.sin(rotation))>.5;
        const halfX=def.footprint[swapped?1:0]/2,halfZ=def.footprint[swapped?0:1]/2;
        const x=local.x+(Math.abs(dx)>=Math.abs(dz)?Math.sign(dx)*halfX:0),z=local.z+(Math.abs(dx)<Math.abs(dz)?Math.sign(dz)*halfZ:0);
        return [{position:[Math.round(x/GRID)*GRID,.3+this.height,Math.round(z/GRID)*GRID],rotation}];
      }
      const snapped=panels.filter(p=>PIECES[p.type].category==='foundation').flatMap(p=>attachedPanels(this.pieceId,p,p.position[1]+this.height));
      // Prefer nearby edge sockets; retain a free grid candidate for new islands.
      const free={position:[Math.round(local.x/GRID)*GRID,.3+this.height,Math.round(local.z/GRID)*GRID],rotation};
      return [...sort(snapped).filter(p=>v(p.position).distanceTo(local)<3),free];
    }
    // Pick the floor nearest the aimed height, not the highest roof overhead.
    const x=Math.round(local.x*2)/2,z=Math.round(local.z*2)/2;
    const base=panels.filter(p=>contains(footprint(p),x,z)).sort((a,b)=>Math.abs(a.position[1]-local.y)-Math.abs(b.position[1]-local.y))[0];
    return [{position:[x,base?.position[1]??local.y,z],rotation}];
  }

  refreshPreview(){
    if(!this.active)return;
    if(this.removing)return this.refreshRemoval();
    const target=this.target();let claim=this.pieceId==='mainframe'?this.newClaim(target):this.nearestClaim(target);
    if(claim&&PIECES[this.pieceId].padSize==='L')claim={...claim,radius:96};
    const candidates=claim?(this.pieceId==='mainframe'?[{position:[0,0,0],rotation:(this.turn+2)%4*Math.PI/2}]:this.candidates(claim,target)):[];
    const candidate=candidates[this.snap%Math.max(1,candidates.length)];
    const p={type:this.pieceId,id:`build-piece-${this.data.nextId+(this.pieceId==='mainframe'?1:0)}`,position:candidate?.position??[0,0,0],rotation:candidate?.rotation??0,doorOpen:false};
    const actor=claim?this.toLocal(this.nav.position,claim):null;
    const sources=claim?.useBuffer&&this.pieceId!=='mainframe'&&Math.hypot(actor.x,actor.z)<=claim.radius?['pack',bufferId(claim,claim.pieces.find(p=>p.type==='mainframe'))]:['pack'];
    let reason=!claim?'Place a mainframe to establish building rights.':!candidate?(PIECES[this.pieceId].mount?'Build a supported ceiling first.':'Place a supporting foundation first.'):this.validate(claim,p);
    if(shipCargoAccess(this.nav).available)sources.push('ship');
    sources.push(...this.supplySources());
    const cost=PIECES[p.type].cost,resources=planCost(this.store,this.store.state,cost,sources);
    if(!reason&&!resources.ok)reason=resources.message;
    this.preview={pieceId:p.type,piece:p,claim,position:claim?this.toWorld(v(p.position),claim).toArray():target.toArray(),valid:!reason,reason:reason||'Ready to place',cost,sources,snapCount:candidates.length};
    this.updateGhost();
  }
  validate(c,p){
    if(this.blocked||this.store.blocked)return this.error||this.store.warning;
    if(!this.assetsLoaded)return this.error||'Loading construction models…';
    if(!this.canBuild())return 'Build on foot outside the ship.';
    if(c.owner!==LOCAL_OWNER)return 'Building permission required.';
    if((this.protectedClaims?.()??[]).some(other=>other.body===c.body&&v(other.origin).distanceTo(v(c.origin))<other.radius+c.radius))return 'Keep your claim clear of the public trade settlement.';
    const body=BODIES.find(b=>b.id===c.body),point=this.toWorld(v(p.position),c),localPlayer=this.toLocal(this.nav.position,c),boxes=getPlacementBoxes(p),bounds=getPlacementBounds(p);
    if(Math.hypot(distanceToPolygon(footprint(p),localPlayer.x,localPlayer.z),Math.max(bounds.min[1]-localPlayer.y,0,localPlayer.y-bounds.max[1]))>12)return 'Move within 12 m of the piece.';
    if(c.pieces.length>=MAX_PIECES)return `Prototype limit: ${MAX_PIECES} pieces per site.`;
    if(bounds.min[1]<(PIECES[p.type].padSize?-16:-2)||bounds.max[1]>CLAIM_HEIGHT||[bounds.min[0],bounds.max[0]].some(x=>[bounds.min[2],bounds.max[2]].some(z=>Math.hypot(x,z)>c.radius)))return 'The complete piece must fit inside the claim.';
    if(p.type==='mainframe'){
      if(this.claims.length>=MAX_CLAIMS)return 'Prototype claim limit reached.';
      if(this.claims.some(other=>other.body===c.body&&v(other.origin).distanceTo(point)<other.radius+c.radius))return 'Another mainframe claim overlaps this site.';
    }
    if(c.radius>64&&this.claims.some(other=>other.id!==c.id&&other.body===c.body&&v(other.origin).distanceTo(v(c.origin))<other.radius+c.radius))return 'The larger pad claim would overlap another site.';
    if(this.nav.stationDistance<300)return 'Protected station area.';
    if(this.nav.shipPosition){
      const shipBounds=new THREE.Box3();
      for(const x of [bounds.min[0],bounds.max[0]])for(const y of [bounds.min[1],bounds.max[1]])for(const z of [bounds.min[2],bounds.max[2]])shipBounds.expandByPoint(this.nav.toShipLocal(this.toWorld(v([x,y,z]),c)));
      const width=this.nav.freighter?16:7,length=this.nav.freighter?35:13;
      if(shipBounds.intersectsBox(new THREE.Box3(v([-width,-12,-length]),v([width,12,length]))))return 'Keep the ship and boarding approach clear.';
    }
    const feet=localPlayer.clone().addScaledVector(UP,-(this.nav.layout?.eyeHeight??1.65));
    if(boxes.some(b=>capsuleIntersectsBox(feet,.32,1.8,b)))return 'Step clear of the placement.';
    if(c.pieces.some(old=>{
      const wallPair=PIECES[p.type].category==='wall'&&PIECES[old.type].category==='wall';
      const aEdge=wallPair?wallEdge(p):null,bEdge=wallPair?wallEdge(old):null;
      const corner=wallPair&&close(old.position[1],p.position[1])&&[aEdge.a,aEdge.b].filter(a=>[bEdge.a,bEdge.b].some(b=>Math.hypot(a[0]-b[0],a[1]-b[1])<.04)).length===1;
      const floor=PIECES[p.type].category==='floor'?p:PIECES[old.type].category==='floor'?old:null,wall=PIECES[p.type].category==='wall'?p:PIECES[old.type].category==='wall'?old:null;
      const seated=floor&&wall&&wallOnPanel(wall,floor,true);

      return getPlacementBoxes(old).some(a=>boxes.some(b=>overlap(a,b)&&!((corner||seated)&&a.kind!=='doorSweep'&&b.kind!=='doorSweep')));
    }))return 'That space or socket is occupied.';
    const def=PIECES[p.type];
    if(def.mount)return mountReason(p,c.pieces);
    if(def.category==='foundation'||def.category==='utility'){
      const samples=[...footprint(p),[p.position[0],p.position[2]]];
      for(const [x,z] of samples){
        const sample=this.toWorld(v([x,p.position[1],z]),c),alt=bodyAltitude(sample,body),normal=bodyOffset(sample,body).normalize();
        if(body.water&&terrainHeight(...normal.toArray())<0)return 'Choose dry land.';
        const onPanel=def.category==='utility'&&c.pieces.some(a=>isPanel(a)&&close(a.position[1],p.position[1])&&contains(footprint(a),x,z,.005));
        if(!onPanel&&(alt<-.04||alt>(def.padSize?8:def.category==='foundation'?.6:.35)))return 'Terrain is too uneven. Adjust height or choose a flatter site.';
      }
    }else {const reason=structuralReason(p,c.pieces);if(reason)return reason;}

    return null;
  }
  refreshRemoval(){
    const hit=this.raycast(this.nav.position,FORWARD.clone().applyQuaternion(this.nav.orientation),12),claim=this.claims.find(c=>c.id===hit?.claimId),piece=claim?.pieces.find(p=>p.id===hit.pieceId);
    const key=`${claim?.id}/${piece?.id}`;if(this._removalData!==this.data||this._removalKey!==key){this._removalData=this.data;this._removalKey=key;this._removalPlan=piece?planRemoval(this.data,this.store.state.remote,claim.id,piece.id):{ok:false,message:'Aim at a building piece within 12 m.'};}
    const plan=this._removalPlan;this.preview={removing:true,pieceId:piece?.type??this.pieceId,piece,claim,position:piece?this.toWorld(v(piece.position),claim).toArray():this.nav.position.toArray(),valid:plan.ok&&!this.removalPending,reason:this.removalPending?'Removing…':plan.ok?`Remove ${PIECES[piece.type].label} permanently · no refund`:plan.message,cost:{},sources:[]};
    this.updateGhost();return this.preview;
  }
  async remove(){
    if(this.removalPending)return {ok:false,message:'Removal in progress.'};if(!this.canBuild()||this.blocked||this.store.blocked)return {ok:false,message:'Construction is unavailable.'};
    this._removalData=null;this.refreshRemoval();const preview=this.preview;if(!preview?.valid)return {ok:false,message:preview?.reason};
    this.removalPending=true;let result;try{
      if(this.power?.cloud?.enabled)result=await this.power.cloud.action(preview.claim.id,'remove',preview.piece.id);
      else {const plan=this._removalPlan,ok=this.store.write({...pruneBaseStorage(this.store.state,plan.build.claims),build:plan.build});result={ok,message:ok?plan.message:this.store.warning};}
      if(result.ok){this.revision++;this._syncedData=null;this.sync();}return result;
    }finally{this.removalPending=false;this.nav.gamepad.suspend();if(this.active)this.refreshPreview();}
  }
  place(){
    if(this.removing)return this.remove();
    this.refreshPreview();const preview=this.preview;if(!preview?.valid)return {ok:false,message:preview?.reason??'Enter build mode first.'};
    const c=structuredClone(preview.claim),p=structuredClone(preview.piece),data=structuredClone(this.data);
    const paid=planCost(this.store,this.store.state,preview.cost,preview.sources);if(!paid.ok)return paid;
    c.pieces.push(p);if(p.type==='mainframe'){c.power=initialPower(Date.now());data.claims.push(c);data.nextId+=2;}else{data.claims=data.claims.map(old=>old.id===c.id?c:old);data.nextId++;}
    let next={...paid.next,build:data};
    if(['mainframe','crate','rack'].includes(p.type))next=addBuildContainer(next,bufferId(c,p),p.type==='mainframe'?`${c.name} supplies`:`${c.name} ${PIECES[p.type].label} ${p.id.split('-').at(-1)}`,PIECES[p.type].storageBoxes??2);
    if(!validBuild(data)||!this.store.validContainers(next))return {ok:false,message:'Building or storage limits reached.'};
    if(!this.store.write(next))return {ok:false,message:this.store.warning};
    this.revision++;this.sync();this.refreshPreview();
    this.onSound?.({type:'building-placement',point:this.toWorld(v(p.position),c),pieceId:p.id,claimId:c.id});
    return {ok:true,message:`${PIECES[p.type].label} placed.`,pieceId:p.id,claimId:c.id};
  }
  setBufferEnabled(id,enabled){
    const c=this.claims.find(c=>c.id===id),core=c?.pieces.find(p=>p.type==='mainframe');
    if(!c||this.nav.mode!=='walk'||this.nav.insideShip||typeof enabled!=='boolean'||this.nav.position.distanceTo(this.toWorld(v(core.position),c))>4)return {ok:false,message:'Approach your mainframe to configure supplies.'};
    const data={...this.data,claims:this.data.claims.map(c=>c.id===id?{...c,useBuffer:enabled}:c)};
    if(!this.store.write({...this.store.state,build:data}))return {ok:false,message:this.store.warning};
    this.refreshPreview();return {ok:true,message:enabled?'Local construction buffer enabled.':'Local buffer disabled. Backpack and nearby ship cargo remain available.'};
  }
  sync(){
    if(this.disposed)return;
    if(this._syncedData===this.data)return;this._syncedData=this.data;
    const alive=new Set(this.claims.flatMap(c=>c.pieces.map(p=>p.id)));
    for(const [id,entry] of this.models)if(!alive.has(id)){if(entry.group)disposeBuildVisual(entry.group);this.models.delete(id);this.registered.delete(id);this.doorMotion.doors.delete(id);}
    for(const [id,group] of this.groups)if(!this.claims.some(c=>c.id===id)){group.removeFromParent();this.groups.delete(id);}
    for(const c of this.claims){
      let group=this.groups.get(c.id);if(!group){group=new THREE.Group();group.name=c.name;group.quaternion.fromArray(c.quaternion);this.groups.set(c.id,group);if(this.render)this.scene.add(group);}
      for(const p of c.pieces){
        if(Boolean(PIECES[p.type].door))this.doorMotion.ensure(p.id,p.doorOpen);
        if(this.render&&!this.models.has(p.id)){
          const entry={ready:false,group:null,pieceId:p.id};this.models.set(p.id,entry);
          createBuildVisual(p).then(model=>{if(this.disposed||!this.claims.some(c=>c.pieces.some(p=>p.id===entry.pieceId))){disposeBuildVisual(model);return;}entry.group=model;entry.rotor=model.getObjectByName('TurbineRotor');entry.ready=true;this._syncedData=null;model.position.fromArray(p.position);model.rotation.y=p.rotation;group.add(model);setDoorOpen(model,this.doorFraction(p));}).catch(e=>{this.error=`Building asset unavailable: ${e.message}`;});
        }
        const model=this.models.get(p.id)?.group;if(model){setBuildPowered(model,(!this.power||this.power.status(c).powered)&&(!PIECES[p.type].light||p.lightOn!==false));const markings=model.getObjectByName('LandingPadMarkings');if(markings)markings.visible=Boolean(p.landingPad);setDoorOpen(model,this.doorFraction(p));if(p.type==='mainframe')updateMainframeDisplay(model,c);}
        if(['mainframe','crate','rack'].includes(p.type)&&this.onRegisterContainer&&!this.registered.has(p.id)){
          const id=bufferId(c,p),registered=this.onRegisterContainer({id,name:this.store.container(id)?.name??c.name,kind:'base',boxes:PIECES[p.type].storageBoxes??2,available:()=>this.claims.some(c=>c.pieces.some(piece=>piece.id===p.id))&&this.nav.mode==='walk'&&!this.nav.insideShip&&(this.nav.position.distanceTo(this.toWorld(v(p.position),c))<4||this.terminalAccess(c))});
          if(registered!==false)this.registered.add(p.id);
        }
      }
    }
  }
  doorFraction(piece){return this.doorMotion.fraction(piece.id,piece.doorOpen);}
  livePieces(claim){return claim.pieces.map(p=>Boolean(PIECES[p.type].door)?{...p,doorOpen:this.doorFraction(p)}:p);}
  canCloseDoor(claim,piece,previous,next){
    const feet=this.toLocal(this.nav.position,claim).addScaledVector(UP,-(this.nav.layout?.eyeHeight??1.65));
    const before=getWorldBoxes(piece,previous).filter(b=>b.kind==='door'),after=getWorldBoxes(piece,next).filter(b=>b.kind==='door');
    // Sweep both translating leaves, so even a slow frame cannot tunnel them
    // across a person who entered after the close command was accepted.
    return after.every((box,i)=>{
      const swept={min:box.min.map((n,a)=>Math.min(n,before[i].min[a])),max:box.max.map((n,a)=>Math.max(n,before[i].max[a]))};
      if(['walk','eva'].includes(this.nav.mode)&&!this.nav.insideShip&&capsuleIntersectsBox(feet,.35,1.8,swept))return false;
      if(piece.type==='hangar-door'&&this.nav.shipPosition&&this.nav.layout?.flightBounds){
        const shipBox=new THREE.Box3();for(const x of [swept.min[0],swept.max[0]])for(const y of [swept.min[1],swept.max[1]])for(const z of [swept.min[2],swept.max[2]])shipBox.expandByPoint(this.nav.toShipLocal(this.toWorld(v([x,y,z]),claim)));
        if(shipBox.intersectsBox(new THREE.Box3(v(this.nav.layout.flightBounds.min),v(this.nav.layout.flightBounds.max))))return false;
      }return true;
    });
  }
  updateGhost(){
    if(!this.render||!this.preview||this.disposed)return;
    this.removeRoot.visible=this.active&&this.removing&&Boolean(this.preview.piece);
    if(this.removing){this.ghost.visible=false;this.boundary.visible=false;if(this.preview.piece){const bounds=getPlacementBounds(this.preview.piece);this.removeOutline.box.min.fromArray(bounds.min);this.removeOutline.box.max.fromArray(bounds.max);this.removeOutline.material.color.set(this.preview.valid?0xffa36c:0xf06a74);this.removeRoot.position.fromArray(this.preview.claim.origin).sub(this._origin);this.removeRoot.quaternion.fromArray(this.preview.claim.quaternion);}return;}
    const key=this.pieceId;
    if(this.ghost.userData.piece!==key){
      this.ghost.userData.piece=key;const request=++this.ghostRequest;
      if(this.ghostModel){this.ghost.remove(this.ghostModel);this.ghostDisposer(this.ghostModel);this.ghostModel=null;}
      this.ghost.visible=false;
      this.ghostFactory(this.preview.piece).then(model=>{
        if(this.disposed||request!==this.ghostRequest){this.ghostDisposer(model);return;}
        this.ghostModel=model;this.ghost.add(model);
        if(this.active&&this.preview)this.updateGhost();
      }).catch(error=>{if(request===this.ghostRequest&&!this.disposed)this.error=`Construction preview unavailable: ${error.message}`;});
    }
    this.ghost.visible=this.active&&Boolean(this.ghostModel);this.ghost.position.fromArray(this.preview.position).sub(this._origin);
    this.boundary.visible=this.active&&Boolean(this.preview.claim);if(this.preview.claim){this.boundary.position.fromArray(this.preview.claim.origin).sub(this._origin);this.boundary.quaternion.fromArray(this.preview.claim.quaternion);this.boundary.scale.set(this.preview.claim.radius/CLAIM_RADIUS,1,this.preview.claim.radius/CLAIM_RADIUS);}
    if(this.preview.claim)this.ghost.quaternion.copy(q(this.preview.claim.quaternion)).multiply(new THREE.Quaternion().setFromAxisAngle(UP,this.preview.piece.rotation));
    if(this.ghostModel)setBuildGhostValid(this.ghostModel,this.preview.valid);
  }
  update(dt,origin){
    if(this.disposed)return;
    this._origin.copy(origin);this.sync();this.claimVisibility=[];const fixtures=[];
    for(const c of this.claims){
      const group=this.groups.get(c.id),distance=v(c.origin).distanceTo(this.nav.position),opacity=buildOpacity(distance);group.position.fromArray(c.origin).sub(origin);group.visible=opacity>0;this.claimVisibility.push({id:c.id,distance,opacity});
      if(opacity<=0)continue;
      const powered=!this.power||this.power.status(c).powered;
      for(const p of c.pieces){
        if(Boolean(PIECES[p.type].door)){const wasBlocked=this.doorMotion.doors.get(p.id)?.blocked;this.doorMotion.update(p.id,p.doorOpen,dt,(previous,next)=>this.canCloseDoor(c,p,previous,next));if(!wasBlocked&&this.doorMotion.doors.get(p.id).blocked)this.nav.notify?.('Closing paused · step clear of the doorway.');}
        const model=this.models.get(p.id)?.group;if(model){setBuildPowered(model,powered&&(!PIECES[p.type].light||p.lightOn!==false));const rotor=this.models.get(p.id)?.rotor;if(rotor&&!BODIES.find(b=>b.id===c.body)?.airless)rotor.rotation.y+=dt;if(PIECES[p.type].door)setDoorOpen(model,this.doorFraction(p));if(model.userData.buildOpacity!==opacity){setBuildOpacity(model,opacity);model.userData.buildOpacity=opacity;}}
        if(opacity>0&&powered&&(['doorway','mainframe'].includes(p.type)||PIECES[p.type].light&&p.lightOn!==false)){
          const offset=PIECES[p.type].light?v([0,-.20,0]):Boolean(PIECES[p.type].door)?v([0,2.36,-.30]):v([0,1.50,-.56]),position=this.toWorld(offset.applyAxisAngle(UP,p.rotation).add(v(p.position)),c);
          fixtures.push({id:p.id,type:p.type,position,distance:position.distanceTo(this.nav.position),opacity});
        }
      }
    }
    if(this.active&&!this.canBuild())this.cancel();
    const dark=nightFactor(this.nav.normal&&this.nav.sunDirection?this.nav.normal.dot(this.nav.sunDirection):NaN);
    this.workLight.visible=this.active&&this.nav.enabled&&this.nav.focused&&dark>.01;this.workLight.intensity=4*dark;
    if(this.workLight.visible){this.workLight.position.copy(this.nav.position).sub(origin);this.workLight.target.position.copy(this.workLight.position).add(FORWARD.clone().applyQuaternion(this.nav.orientation).multiplyScalar(8));}
    const selected=nearestServiceLights(fixtures);
    this.serviceLights.forEach((light,i)=>{const fixture=selected[i];light.visible=Boolean(fixture);if(fixture){light.userData.fixtureId=fixture.id;light.position.copy(fixture.position).sub(origin);light.color.set(PIECES[fixture.type]?.light?0xffe5bd:0xb6efd1);light.distance=PIECES[fixture.type]?.light?12:fixture.type==='doorway'?6:4;light.intensity=(PIECES[fixture.type]?.light?18:fixture.type==='doorway'?8:1.25)*(PIECES[fixture.type]?.light?1:.35+.65*dark)*serviceLightFade(fixture.distance)*fixture.opacity;}});
    if(this.active){this._lastPreview+=dt;if(this._lastPreview>.08){this._lastPreview=0;this.refreshPreview();}else this.updateGhost();}
  }
  dispose(){
    this.disposed=true;this.ghostRequest++;if(this.ghostModel)this.ghostDisposer(this.ghostModel);this.ghostModel=null;this.ghost.clear();for(const entry of this.models.values())if(entry.group)disposeBuildVisual(entry.group);this.models.clear();this.removeOutline.geometry.dispose();this.removeOutline.material.dispose();this.scene.remove(this.removeRoot,this.ghost,this.boundary,this.workLight,this.workLight.target,...this.serviceLights,...this.groups.values());this.boundary.geometry.dispose();this.boundary.material.dispose();this.workLight.dispose();this.serviceLights.forEach(l=>l.dispose());
  }
  landingSurface({position=this.nav.position,orientation=this.nav.orientation}={}){
    const nav=this.nav;if(!nav.layout?.flightBounds)return null;
    for(const c of this.claims){if(c.body!==bodyAt(position).id)continue;const local=this.toLocal(position,c);
      for(const p of c.pieces){if(!p.landingPad||!PIECES[p.type].padSize)continue;
        const normal=UP.clone().applyQuaternion(q(c.quaternion)),forward=FORWARD.clone().applyQuaternion(orientation).projectOnPlane(normal).normalize();if(forward.lengthSq()<.5)continue;
        const attitude=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(),forward,normal));
        const transform=q(c.quaternion).invert().multiply(attitude),corners=[];
        for(const x of [nav.layout.flightBounds.min[0]-1,nav.layout.flightBounds.max[0]+1])for(const z of [nav.layout.flightBounds.min[2]-1,nav.layout.flightBounds.max[2]+1])corners.push(v([x,0,z]).applyQuaternion(transform).add(v([local.x,p.position[1],local.z])));
        if(!corners.every(v=>contains(footprint(p),v.x,v.z)))continue;
        const ship={min:[Math.min(...corners.map(v=>v.x)),p.position[1]+.02,Math.min(...corners.map(v=>v.z))],max:[Math.max(...corners.map(v=>v.x)),p.position[1]+nav.layout.flightBounds.max[1],Math.max(...corners.map(v=>v.z))]};
        if(c.pieces.some(other=>other.id!==p.id&&getWorldBoxes(other,this.doorFraction(other)).some(b=>overlap(ship,b))))continue;
        return {point:this.toWorld(v([local.x,p.position[1],local.z]),c),normal,clearance:local.y-p.position[1],size:PIECES[p.type].padSize};
      }
    }return null;
  }
  terminalAccess(c){c=this.claims.find(claim=>claim.id===c.id)??c;return c.owner===LOCAL_OWNER&&(!this.power||this.power.status(c).powered)&&c.pieces.some(p=>p.type==='terminal'&&this.nav.position.distanceTo(this.toWorld(v(p.position),c))<4);}
  setLandingPad(claimId,pieceId,enabled){
    const c=this.claims.find(c=>c.id===claimId),p=c?.pieces.find(p=>p.id===pieceId);
    if(!p||!PIECES[p.type].padSize||!this.canBuild()||distanceToPolygon(footprint(p),...this.toLocal(this.nav.position,c).toArray().filter((_,i)=>i!==1))>4)return {ok:false,message:'Approach this pad to change its designation.'};
    const data=structuredClone(this.data);data.claims.find(c=>c.id===claimId).pieces.find(p=>p.id===pieceId).landingPad=Boolean(enabled);
    if(!this.store.write({...this.store.state,build:data}))return {ok:false,message:this.store.warning};this.sync();return {ok:true,message:enabled?'Landing pad marked.':'Landing pad designation removed.'};
  }
  nearbyInteraction(){
    if(this.active||this.nav.mode!=='walk'||this.nav.insideShip)return null;
    const dir=FORWARD.clone().applyQuaternion(this.nav.orientation);
    return this.claims.flatMap(c=>c.pieces.filter(p=>(['mainframe','crate','rack','terminal'].includes(p.type)||POWER_PARTS[p.type]||PIECES[p.type].light||PIECES[p.type].door)).map(p=>{const point=this.toWorld(v(p.position).addScaledVector(UP,PIECES[p.type].light?-.06:.8),c),delta=point.sub(this.nav.position);return {c,p,d:delta.length(),f:delta.normalize().dot(dir)};})).filter(x=>x.d<3.5&&x.f>.15).sort((a,b)=>b.f-a.f||a.d-b.d)[0]??this.claims.flatMap(c=>c.pieces.filter(p=>PIECES[p.type].padSize).map(p=>{const local=this.toLocal(this.nav.position,c);return {c,p,d:Math.hypot(distanceToPolygon(footprint(p),local.x,local.z),local.y-p.position[1])};})).find(hit=>hit.d<3.5)??null;
  }
  get interaction(){const hit=this.nearbyInteraction();return hit?`F / X · ${PIECES[hit.p.type].light?`Switch ceiling light ${hit.p.lightOn===false?'on':'off'}`:Boolean(PIECES[hit.p.type].door)?(this.doorMotion.doors.get(hit.p.id)?.blocked?'Closing paused · step clear · Open':hit.p.doorOpen?'Close':'Open')+' base door':(hit.p.type==='mainframe'||POWER_PARTS[hit.p.type])?'Base mainframe / power':hit.p.type==='terminal'?'Inventory terminal':PIECES[hit.p.type].padSize?'Landing pad designation':'Base storage'}`:'';}
  interact(){
    const hit=this.nearbyInteraction();if(!hit)return false;
    const {c,p}=hit;
    if(PIECES[p.type].light){const data=structuredClone(this.data),lamp=data.claims.find(a=>a.id===c.id).pieces.find(a=>a.id===p.id);lamp.lightOn=p.lightOn===false;if(this.store.write({...this.store.state,build:data})){this.sync();this.nav.gamepad.suspend();this.nav.notify(lamp.lightOn?'Ceiling light on.':'Ceiling light off.');}else this.nav.notify(this.store.warning);return true;}
    if(POWER_PARTS[p.type]){const core=c.pieces.find(p=>p.type==='mainframe');this.onMainframe?.({...structuredClone(c),bufferId:bufferId(c,core)});return true;}
    if(p.type==='mainframe'){this.onMainframe?.({...structuredClone(c),bufferId:bufferId(c,p)});return true;}
    if(p.type==='terminal'&&this.power&&!this.power.status(c).powered){this.nav.notify('Terminal has no power. Open storage directly or restore generation.');return true;}
    if(p.type==='terminal'){this.onMainframe?.({...structuredClone(c),terminal:true,containers:c.pieces.filter(a=>['mainframe','crate','rack'].includes(a.type)).map(a=>({id:bufferId(c,a),name:this.store.container(bufferId(c,a))?.name}))});return true;}
    if(PIECES[p.type].padSize){this.onMainframe?.({...structuredClone(c),pad:{id:p.id,size:PIECES[p.type].padSize,enabled:Boolean(p.landingPad)}});return true;}
    if(['crate','rack'].includes(p.type)){this.onOpenStorage?.(bufferId(c,p));return true;}
    if(p.type==='hangar-door'&&this.power&&!this.power.status(c).powered){this.nav.notify('Hangar motor has no power. Restore generation.');return true;}
    if(p.doorOpen){const feet=this.toLocal(this.nav.position,c).addScaledVector(UP,-(this.nav.layout?.eyeHeight??1.65));if(getWorldBoxes({...p,doorOpen:false}).some(b=>capsuleIntersectsBox(feet,.35,1.8,b))){this.nav.notify('Step clear of the doorway before closing.');return true;}}
    this.doorMotion.ensure(p.id,p.doorOpen);
    const data=structuredClone(this.data),piece=data.claims.find(a=>a.id===c.id).pieces.find(a=>a.id===p.id);piece.doorOpen=!piece.doorOpen;
    if(this.store.write({...this.store.state,build:data})){this.sync();this.nav.gamepad.suspend();this.nav.notify(piece.doorOpen?'Opening base door…':'Closing base door…');}else this.nav.notify(this.store.warning);return true;
  }
  constrainWalker(previous,proposed){
    this.grounded=false;let point=proposed.clone(),hit=false;
    for(const c of this.claims){if(c.body!==bodyAt(point).id||v(c.origin).distanceTo(point)>c.radius+20)continue;
      const result=constrainBuildStep(this.toLocal(previous,c).toArray(),this.toLocal(point,c).toArray(),this.livePieces(c),{eyeHeight:this.nav.layout?.eyeHeight??1.65,radius:.28,stepHeight:.3});
      if(result.hit||result.grounded){point=this.toWorld(v(result.point),c);hit=true;}
      this.grounded||=result.grounded;
    }
    return {point,hit,grounded:this.grounded};
  }
  raycast(start,direction,range=1600,envelope=null){
    let nearest=null;
    for(const c of this.claims){if(v(c.origin).distanceTo(start)>Math.hypot(c.radius,CLAIM_HEIGHT)+range+(envelope?Math.max(...envelope.min.map(Math.abs),...envelope.max.map(Math.abs))*2:0))continue;
      const local=this.toLocal(start,c),dir=direction.clone().applyQuaternion(q(c.quaternion).invert()),ray=new THREE.Ray(local,dir);
      // Project the rotated ship/capsule envelope into the claim frame, then
      // Minkowski-expand each building box. This conservatively includes empty
      // corners of a rotated hull; it is not a triangle-accurate ship sweep.
      let offsets=null;
      if(envelope){
        offsets=new THREE.Box3();const rotation=q(c.quaternion).invert().multiply(envelope.orientation??new THREE.Quaternion());
        for(const x of [envelope.min[0],envelope.max[0]])for(const y of [envelope.min[1],envelope.max[1]])for(const z of [envelope.min[2],envelope.max[2]])offsets.expandByPoint(new THREE.Vector3(x,y,z).applyQuaternion(rotation));
      }
      for(const p of c.pieces)for(const b of getWorldBoxes(p,this.doorFraction(p))){
        const box=new THREE.Box3(v(b.min),v(b.max));
        if(offsets){
          box.min.sub(offsets.max);box.max.sub(offsets.min);
          if(box.containsPoint(local)){
            // Permit escape and tangential movement from an existing contact,
            // including lifting off a floor; reject motion deeper into it.
            let gap=Infinity,outward=0;
            for(let axis=0;axis<3;axis++)for(const side of ['min','max']){
              const d=Math.abs(local.getComponent(axis)-box[side].getComponent(axis));
              if(d<gap){gap=d;outward=dir.getComponent(axis)*(side==='min'?-1:1);}
            }
            if(outward>=-1e-8)continue;
            const distance=0;if(!nearest||distance<nearest.distance)nearest={distance,point:start.clone(),normal:direction.clone().negate(),building:true,claimId:c.id,pieceId:p.id};continue;
          }
        }
        const exact=offsets?null:rayPrism(local,dir,b);const point=offsets?ray.intersectBox(box,new THREE.Vector3()):exact===null?null:ray.at(exact,new THREE.Vector3());if(!point)continue;
        const distance=point.distanceTo(local);if(distance>range||nearest&&distance>=nearest.distance)continue;
        const normal=new THREE.Vector3();let error=Infinity;for(let axis=0;axis<3;axis++)for(const side of ['min','max']){const gap=Math.abs(point.getComponent(axis)-box[side].getComponent(axis));if(gap<error){error=gap;normal.set(0,0,0).setComponent(axis,side==='min'?-1:1);}}
        nearest={distance,point:this.toWorld(point,c),normal:normal.applyQuaternion(q(c.quaternion)),building:true,claimId:c.id,pieceId:p.id};
      }
    }return nearest;
  }
}
