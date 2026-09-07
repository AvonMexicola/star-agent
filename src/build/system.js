import { shipCargoAccess } from '../inventory/ship-access.js';
import * as THREE from 'three';
import { bodyAt, bodyAltitude, bodyOffset, bodySurfacePoint, BODIES } from '../celestial.js';
import { terrainHeight } from '../world.js';
import { PIECES, GRID, STOREY } from './definitions.js';
import { getWorldBoxes, getPlacementBoxes, getPlacementBounds, capsuleIntersectsBox, constrainBuildStep } from './collision.js';
import { createBuildVisual, setDoorOpen, createBuildGhost, setBuildGhostValid, disposeBuildGhost, disposeBuildVisual, setBuildOpacity } from './visuals.js';
import { DoorMotion, buildOpacity, serviceLightFade, nightFactor, nearestServiceLights, MAX_SERVICE_LIGHTS } from './motion.js';
import { updateMainframeDisplay } from './mainframe-display.js';
import { withClaimAnchor, restoreBuildAnchors } from './anchors.js';
import { emptyBuild, validBuild, planCost, addBuildContainer, CLAIM_RADIUS, CLAIM_HEIGHT, MAX_CLAIMS, MAX_PIECES, LOCAL_OWNER } from './state.js';

const UP=new THREE.Vector3(0,1,0),FORWARD=new THREE.Vector3(0,0,-1);
const v=a=>new THREE.Vector3(...a),q=a=>new THREE.Quaternion(...a);
const close=(a,b,t=.03)=>Math.abs(a-b)<t;
const overlap=(a,b)=>a.min.every((n,i)=>n<b.max[i]-.025&&a.max[i]>b.min[i]+.025);
const bufferId=(claim,piece)=>piece.type==='mainframe'?`build-core-${claim.id.split('-').at(-1)}`:`build-crate-${piece.id.split('-').at(-1)}`;
export class BuildSystem {
  constructor({scene,nav,store,render=true}){
    this.scene=scene;this.nav=nav;this.store=store;this.render=render;this.active=false;this.pieceId='mainframe';this.turn=0;this.height=0;this.snap=0;
    this.doorMotion=new DoorMotion();this.ghostRequest=0;this.ghostModel=null;this.ghostFactory=createBuildGhost;this.ghostDisposer=disposeBuildGhost;this.disposed=false;this.claimVisibility=[];
    this.groups=new Map();this.models=new Map();this.registered=new Set();this.grounded=false;this.error='';this.preview=null;this.revision=0;
    const restored=store.state.build!==undefined&&!validBuild(store.state.build)?{ok:false,message:'Base save is invalid. Original data retained; construction paused.'}:restoreBuildAnchors(store.state.build);
    this.blocked=!restored.ok||restored.build!==undefined&&(!validBuild(restored.build)||restored.build.claims.some(c=>c.pieces.filter(p=>['mainframe','crate'].includes(p.type)).some(p=>store.container(bufferId(c,p))?.kind!=='base')));
    if(this.blocked)this.error=restored.message||'Base save is invalid. Original data retained; construction paused.';
    else if(restored.build!==undefined)store.state={...store.state,build:restored.build};
    this.ghost=new THREE.Group();this.ghost.name='Construction preview';if(render)scene.add(this.ghost);
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
  get state(){return {active:this.active,pieceId:this.pieceId,preview:this.preview?{pieceId:this.pieceId,valid:this.preview.valid,reason:this.preview.reason,cost:this.preview.cost,sources:this.preview.sources,position:this.preview.position,claimId:this.preview.claim?.id??null}:null,claims:structuredClone(this.claims),pieceCount:this.claims.reduce((s,c)=>s+c.pieces.length,0),error:this.error,grounded:this.grounded,visuals:this.visualDiagnostics,assetsReady:this.models.size>0&&[...this.models.values()].every(m=>m.ready),materials:this.store.container('pack')?.items};}
  get visualDiagnostics(){return {doors:[...this.doorMotion.doors].map(([id,d])=>({id,target:Boolean(d.target),fraction:d.fraction,colliderFraction:d.fraction,blocked:d.blocked})),ghost:{pieceId:this.ghost.userData.piece??null,ready:Boolean(this.ghostModel),meshes:this.ghostModel?(()=>{let count=0;this.ghostModel.traverse(o=>{if(o.isMesh)count++;});return count;})():0},claims:this.claimVisibility,lights:{active:this.serviceLights.filter(l=>l.visible).length,max:MAX_SERVICE_LIGHTS,work:this.workLight.visible}};}
  canBuild(){return !this.nav.multiplayer?.connected&&!this.nav.openingActive&&this.nav.mode==='walk'&&!this.nav.insideShip&&!this.nav.dockedAtStation&&!this.nav.travel&&this.nav.altitude<80;}
  begin(id=this.pieceId){if(!this.canBuild())return {ok:false,message:'Leave the ship and stand on a planetary surface to build.'};if(this.blocked||this.store.blocked)return {ok:false,message:this.error||this.store.warning};this.active=true;this.nav.buildActive=true;this.nav.keys.clear();this.nav.gamepad.suspend();return this.select(id);}
  select(id){if(!PIECES[id])return {ok:false,message:'Choose a building piece.'};this.pieceId=id;this.snap=0;this.height=0;this.refreshPreview();return {ok:true};}
  cancel(){this.active=false;this.nav.buildActive=false;this.preview=null;this.ghost.visible=false;this.boundary.visible=false;this.workLight.visible=false;this.nav.keys.clear();this.nav.toolTrigger=0;this.nav.gamepad.suspend();}
  rotate(delta){this.turn=((this.turn+delta*(PIECES[this.pieceId].category==='wall'?2:1))%4+4)%4;this.refreshPreview();}
  cycleSnap(){this.snap++;this.refreshPreview();}
  adjustHeight(delta){const foundation=PIECES[this.pieceId].category==='foundation';this.height=THREE.MathUtils.clamp(this.height+(foundation?delta:Math.sign(delta)*STOREY),foundation?-.2:0,24);this.refreshPreview();}
  toLocal(point,c){return point.clone().sub(v(c.origin)).applyQuaternion(q(c.quaternion).invert());}
  toWorld(point,c){return point.clone().applyQuaternion(q(c.quaternion)).add(v(c.origin));}
  nearestClaim(point=this.nav.position){return this.claims.filter(c=>c.body===bodyAt(point).id).map(c=>({c,d:this.toLocal(point,c).length()})).filter(x=>x.d<CLAIM_RADIUS+15).sort((a,b)=>a.d-b.d)[0]?.c??null;}
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
    const panels=claim.pieces.filter(p=>['foundation','floor'].includes(p.type));
    if(def.category==='wall')return panels.flatMap(p=>[
      {position:[p.position[0],p.position[1],p.position[2]+2],rotation:0},
      {position:[p.position[0],p.position[1],p.position[2]-2],rotation:Math.PI},
      {position:[p.position[0]+2,p.position[1],p.position[2]],rotation:Math.PI/2},
      {position:[p.position[0]-2,p.position[1],p.position[2]],rotation:-Math.PI/2},
    ]).map(p=>({...p,rotation:p.rotation+Math.floor(this.turn/2)*Math.PI})).sort((a,b)=>v(a.position).distanceToSquared(local)-v(b.position).distanceToSquared(local));
    if(def.category==='stairs')return panels.filter(p=>p.type==='foundation'||p.type==='floor').map(p=>({position:[...p.position],rotation})).sort((a,b)=>v(a.position).distanceToSquared(local)-v(b.position).distanceToSquared(local));
    if(def.category==='floor'){
      const candidates=panels.map(p=>({position:[p.position[0],p.position[1]+STOREY+this.height,p.position[2]],rotation}));
      return candidates.sort((a,b)=>v(a.position).distanceToSquared(local)-v(b.position).distanceToSquared(local));
    }
    if(def.category==='foundation')return [{position:[Math.round(local.x/GRID)*GRID,.3+this.height,Math.round(local.z/GRID)*GRID],rotation}];
    const base=panels.filter(p=>Math.abs(local.x-p.position[0])<2&&Math.abs(local.z-p.position[2])<2).sort((a,b)=>b.position[1]-a.position[1])[0];
    return [{position:[Math.round(local.x*2)/2,base?.position[1]??local.y,Math.round(local.z*2)/2],rotation}];
  }
  refreshPreview(){
    if(!this.active)return;
    const target=this.target(),claim=this.pieceId==='mainframe'?this.newClaim(target):this.nearestClaim(target);
    const candidates=claim?(this.pieceId==='mainframe'?[{position:[0,0,0],rotation:(this.turn+2)%4*Math.PI/2}]:this.candidates(claim,target)):[];
    const candidate=candidates[this.snap%Math.max(1,candidates.length)];
    const p={type:this.pieceId,id:`build-piece-${this.data.nextId+(this.pieceId==='mainframe'?1:0)}`,position:candidate?.position??[0,0,0],rotation:candidate?.rotation??0,doorOpen:false};
    const actor=claim?this.toLocal(this.nav.position,claim):null;
    const sources=claim?.useBuffer&&this.pieceId!=='mainframe'&&Math.hypot(actor.x,actor.z)<=claim.radius?['pack',bufferId(claim,claim.pieces.find(p=>p.type==='mainframe'))]:['pack'];
    let reason=!claim?'Place a mainframe to establish building rights.':!candidate?'Place a supporting foundation first.':this.validate(claim,p);
    if(shipCargoAccess(this.nav).available)sources.push('ship');
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
    const body=BODIES.find(b=>b.id===c.body),point=this.toWorld(v(p.position),c),localPlayer=this.toLocal(this.nav.position,c),boxes=getPlacementBoxes(p),bounds=getPlacementBounds(p);
    if(this.nav.position.distanceTo(point)>12)return 'Move within 12 m of the piece.';
    if(c.pieces.length>=MAX_PIECES)return `Prototype limit: ${MAX_PIECES} pieces per site.`;
    if(bounds.min[1]<-2||bounds.max[1]>CLAIM_HEIGHT||[bounds.min[0],bounds.max[0]].some(x=>[bounds.min[2],bounds.max[2]].some(z=>Math.hypot(x,z)>c.radius)))return 'The complete piece must fit inside the claim.';
    if(p.type==='mainframe'){
      if(this.claims.length>=MAX_CLAIMS)return 'Prototype claim limit reached.';
      if(this.claims.some(other=>other.body===c.body&&v(other.origin).distanceTo(point)<2*CLAIM_RADIUS))return 'Another mainframe claim overlaps this site.';
    }
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
      const corner=PIECES[p.type].category==='wall'&&PIECES[old.type].category==='wall'&&Math.abs(Math.sin(old.rotation-p.rotation))>.99&&close(old.position[1],p.position[1])&&close(Math.abs(old.position[0]-p.position[0]),2)&&close(Math.abs(old.position[2]-p.position[2]),2);
      const floor=p.type==='floor'?p:old.type==='floor'?old:null,wall=PIECES[p.type].category==='wall'?p:PIECES[old.type].category==='wall'?old:null;
      // Floor origins are their walking surface. Their slab seats into the
      // wall's top band; this intentional structural joint is not occupied space.
      const seated=floor&&wall&&close(wall.position[1]+STOREY,floor.position[1])&&Math.hypot(wall.position[0]-floor.position[0],wall.position[2]-floor.position[2])<=2.03;
      return getPlacementBoxes(old).some(a=>boxes.some(b=>overlap(a,b)&&!((corner||seated)&&a.kind!=='doorSweep'&&b.kind!=='doorSweep')));
    }))return 'That space or socket is occupied.';
    const def=PIECES[p.type];
    if(p.type==='foundation'||p.type==='mainframe'||p.type==='crate'){
      for(const dx of [-def.footprint[0]/2,0,def.footprint[0]/2])for(const dz of [-def.footprint[1]/2,0,def.footprint[1]/2]){
        const offset=v([dx,0,dz]).applyAxisAngle(UP,p.rotation),sample=this.toWorld(v(p.position).add(offset),c),alt=bodyAltitude(sample,body),normal=bodyOffset(sample,body).normalize();
        if(body.water&&terrainHeight(...normal.toArray())<0)return 'Choose dry land.';
        const localSample=this.toLocal(sample,c),onPanel=p.type==='crate'&&c.pieces.some(a=>['foundation','floor'].includes(a.type)&&close(a.position[1],p.position[1])&&Math.abs(localSample.x-a.position[0])<=2&&Math.abs(localSample.z-a.position[2])<=2);
        if(!onPanel&&(alt<-.04||alt>(p.type==='foundation'?.6:.35)))return 'Terrain is too uneven. Adjust height or choose a flatter site.';
      }
    }else if(def.category==='wall'){
      if(!c.pieces.some(a=>['foundation','floor'].includes(a.type)&&close(a.position[1],p.position[1])&&Math.hypot(a.position[0]-p.position[0],a.position[2]-p.position[2])<=2.03))return 'A supported floor edge is required.';
    }else if(p.type==='floor'){
      const supports=c.pieces.filter(a=>PIECES[a.type].category==='wall'&&close(a.position[1]+3,p.position[1])&&Math.hypot(a.position[0]-p.position[0],a.position[2]-p.position[2])<=2.03);
      if(supports.length<2)return 'An upper floor needs two supporting walls.';
    }else if(p.type==='stairs'){
      if(!c.pieces.some(a=>['foundation','floor'].includes(a.type)&&close(a.position[1],p.position[1])&&Math.hypot(a.position[0]-p.position[0],a.position[2]-p.position[2])<.1))return 'Place stairs on a supported floor.';
    }
    return null;
  }
  place(){
    this.refreshPreview();const preview=this.preview;if(!preview?.valid)return {ok:false,message:preview?.reason??'Enter build mode first.'};
    const c=structuredClone(preview.claim),p=structuredClone(preview.piece),data=structuredClone(this.data);
    const paid=planCost(this.store,this.store.state,preview.cost,preview.sources);if(!paid.ok)return paid;
    c.pieces.push(p);if(p.type==='mainframe'){data.claims.push(c);data.nextId+=2;}else{data.claims=data.claims.map(old=>old.id===c.id?c:old);data.nextId++;}
    let next={...paid.next,build:data};
    if(p.type==='mainframe'||p.type==='crate')next=addBuildContainer(next,bufferId(c,p),p.type==='mainframe'?`${c.name} supplies`:`${c.name} crate ${c.pieces.filter(p=>p.type==='crate').length}`);
    if(!validBuild(data)||!this.store.validContainers(next))return {ok:false,message:'Building or storage limits reached.'};
    if(!this.store.write(next))return {ok:false,message:this.store.warning};
    this.revision++;this.sync();this.refreshPreview();return {ok:true,message:`${PIECES[p.type].label} placed.`,pieceId:p.id,claimId:c.id};
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
    for(const c of this.claims){
      let group=this.groups.get(c.id);if(!group){group=new THREE.Group();group.name=c.name;group.quaternion.fromArray(c.quaternion);this.groups.set(c.id,group);if(this.render)this.scene.add(group);}
      for(const p of c.pieces){
        if(p.type==='doorway')this.doorMotion.ensure(p.id,p.doorOpen);
        if(this.render&&!this.models.has(p.id)){
          const entry={ready:false,group:null};this.models.set(p.id,entry);
          createBuildVisual(p).then(model=>{if(this.disposed){disposeBuildVisual(model);return;}entry.group=model;entry.ready=true;model.position.fromArray(p.position);model.rotation.y=p.rotation;group.add(model);setDoorOpen(model,this.doorFraction(p));}).catch(e=>{this.error=`Building asset unavailable: ${e.message}`;});
        }
        const model=this.models.get(p.id)?.group;if(model){setDoorOpen(model,this.doorFraction(p));if(p.type==='mainframe')updateMainframeDisplay(model,c);}
        if(['mainframe','crate'].includes(p.type)&&this.onRegisterContainer&&!this.registered.has(p.id)){
          const id=bufferId(c,p),registered=this.onRegisterContainer({id,name:this.store.container(id)?.name??c.name,kind:'base',boxes:2,available:()=>this.nav.mode==='walk'&&!this.nav.insideShip&&this.nav.position.distanceTo(this.toWorld(v(p.position),c))<4});
          if(registered!==false)this.registered.add(p.id);
        }
      }
    }
  }
  doorFraction(piece){return this.doorMotion.fraction(piece.id,piece.doorOpen);}
  livePieces(claim){return claim.pieces.map(p=>p.type==='doorway'?{...p,doorOpen:this.doorFraction(p)}:p);}
  canCloseDoor(claim,piece,previous,next){
    if(!['walk','eva'].includes(this.nav.mode)||this.nav.insideShip)return true;
    const feet=this.toLocal(this.nav.position,claim).addScaledVector(UP,-(this.nav.layout?.eyeHeight??1.65));
    const before=getWorldBoxes(piece,previous).filter(b=>b.kind==='door'),after=getWorldBoxes(piece,next).filter(b=>b.kind==='door');
    // Sweep both translating leaves, so even a slow frame cannot tunnel them
    // across a person who entered after the close command was accepted.
    return after.every((box,i)=>!capsuleIntersectsBox(feet,.35,1.8,{min:box.min.map((n,a)=>Math.min(n,before[i].min[a])),max:box.max.map((n,a)=>Math.max(n,before[i].max[a]))}));
  }
  updateGhost(){
    if(!this.render||!this.preview||this.disposed)return;
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
    this.boundary.visible=this.active&&Boolean(this.preview.claim);if(this.preview.claim){this.boundary.position.fromArray(this.preview.claim.origin).sub(this._origin);this.boundary.quaternion.fromArray(this.preview.claim.quaternion);}
    if(this.preview.claim)this.ghost.quaternion.copy(q(this.preview.claim.quaternion)).multiply(new THREE.Quaternion().setFromAxisAngle(UP,this.preview.piece.rotation));
    if(this.ghostModel)setBuildGhostValid(this.ghostModel,this.preview.valid);
  }
  update(dt,origin){
    if(this.disposed)return;
    this._origin.copy(origin);this.sync();this.claimVisibility=[];const fixtures=[];
    for(const c of this.claims){
      const group=this.groups.get(c.id),distance=v(c.origin).distanceTo(this.nav.position),opacity=buildOpacity(distance);group.position.fromArray(c.origin).sub(origin);group.visible=opacity>0;this.claimVisibility.push({id:c.id,distance,opacity});
      for(const p of c.pieces){
        if(p.type==='doorway'){const wasBlocked=this.doorMotion.doors.get(p.id)?.blocked;this.doorMotion.update(p.id,p.doorOpen,dt,(previous,next)=>this.canCloseDoor(c,p,previous,next));if(!wasBlocked&&this.doorMotion.doors.get(p.id).blocked)this.nav.notify?.('Closing paused · step clear of the doorway.');}
        const model=this.models.get(p.id)?.group;if(model){setDoorOpen(model,this.doorFraction(p));setBuildOpacity(model,opacity);}
        if(opacity>0&&['doorway','mainframe'].includes(p.type)){
          const offset=p.type==='doorway'?v([0,2.36,-.30]):v([0,1.50,-.56]),position=this.toWorld(offset.applyAxisAngle(UP,p.rotation).add(v(p.position)),c);
          fixtures.push({id:p.id,type:p.type,position,distance:position.distanceTo(this.nav.position),opacity});
        }
      }
    }
    if(this.active&&!this.canBuild())this.cancel();
    const dark=nightFactor(this.nav.normal&&this.nav.sunDirection?this.nav.normal.dot(this.nav.sunDirection):NaN);
    this.workLight.visible=this.active&&this.nav.enabled&&this.nav.focused&&dark>.01;this.workLight.intensity=4*dark;
    if(this.workLight.visible){this.workLight.position.copy(this.nav.position).sub(origin);this.workLight.target.position.copy(this.workLight.position).add(FORWARD.clone().applyQuaternion(this.nav.orientation).multiplyScalar(8));}
    const selected=nearestServiceLights(fixtures);
    this.serviceLights.forEach((light,i)=>{const fixture=selected[i];light.visible=Boolean(fixture);if(fixture){light.position.copy(fixture.position).sub(origin);light.distance=fixture.type==='doorway'?6:4;light.intensity=(fixture.type==='doorway'?8:1.25)*(.35+.65*dark)*serviceLightFade(fixture.distance)*fixture.opacity;}});
    if(this.active){this._lastPreview+=dt;if(this._lastPreview>.08){this._lastPreview=0;this.refreshPreview();}else this.updateGhost();}
  }
  dispose(){
    this.disposed=true;this.ghostRequest++;if(this.ghostModel)this.ghostDisposer(this.ghostModel);this.ghostModel=null;this.ghost.clear();for(const entry of this.models.values())if(entry.group)disposeBuildVisual(entry.group);this.models.clear();this.scene.remove(this.ghost,this.boundary,this.workLight,this.workLight.target,...this.serviceLights,...this.groups.values());this.boundary.geometry.dispose();this.boundary.material.dispose();this.workLight.dispose();this.serviceLights.forEach(l=>l.dispose());
  }
  nearbyInteraction(){
    if(this.active||this.nav.mode!=='walk'||this.nav.insideShip)return null;
    const dir=FORWARD.clone().applyQuaternion(this.nav.orientation);
    return this.claims.flatMap(c=>c.pieces.filter(p=>['mainframe','crate','doorway'].includes(p.type)).map(p=>{const point=this.toWorld(v(p.position).addScaledVector(UP,.8),c),delta=point.sub(this.nav.position);return {c,p,d:delta.length(),f:delta.normalize().dot(dir)};})).filter(x=>x.d<3.5&&x.f>.15).sort((a,b)=>a.d-b.d)[0]??null;
  }
  get interaction(){const hit=this.nearbyInteraction();return hit?`F / X · ${hit.p.type==='doorway'?(this.doorMotion.doors.get(hit.p.id)?.blocked?'Closing paused · step clear · Open':hit.p.doorOpen?'Close':'Open')+' base door':hit.p.type==='mainframe'?'Base mainframe':'Base storage'}`:'';}
  interact(){
    const hit=this.nearbyInteraction();if(!hit)return false;
    const {c,p}=hit;
    if(p.type==='mainframe'){this.onMainframe?.({...structuredClone(c),bufferId:bufferId(c,p)});return true;}
    if(p.type==='crate'){this.onOpenStorage?.(bufferId(c,p));return true;}
    if(p.doorOpen){const feet=this.toLocal(this.nav.position,c).addScaledVector(UP,-(this.nav.layout?.eyeHeight??1.65));if(getWorldBoxes({...p,doorOpen:false}).some(b=>capsuleIntersectsBox(feet,.35,1.8,b))){this.nav.notify('Step clear of the doorway before closing.');return true;}}
    this.doorMotion.ensure(p.id,p.doorOpen);
    const data=structuredClone(this.data),piece=data.claims.find(a=>a.id===c.id).pieces.find(a=>a.id===p.id);piece.doorOpen=!piece.doorOpen;
    if(this.store.write({...this.store.state,build:data})){this.sync();this.nav.gamepad.suspend();this.nav.notify(piece.doorOpen?'Opening base door…':'Closing base door…');}else this.nav.notify(this.store.warning);return true;
  }
  constrainWalker(previous,proposed){
    this.grounded=false;let point=proposed.clone(),hit=false;
    for(const c of this.claims){if(c.body!==bodyAt(point).id||v(c.origin).distanceTo(point)>CLAIM_RADIUS+20)continue;
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
            const distance=0;if(!nearest||distance<nearest.distance)nearest={distance,point:start.clone(),normal:direction.clone().negate(),building:true};continue;
          }
        }
        const point=ray.intersectBox(box,new THREE.Vector3());if(!point)continue;
        const distance=point.distanceTo(local);if(distance>range||nearest&&distance>=nearest.distance)continue;
        const normal=new THREE.Vector3();let error=Infinity;for(let axis=0;axis<3;axis++)for(const side of ['min','max']){const gap=Math.abs(point.getComponent(axis)-box[side].getComponent(axis));if(gap<error){error=gap;normal.set(0,0,0).setComponent(axis,side==='min'?-1:1);}}
        nearest={distance,point:this.toWorld(point,c),normal:normal.applyQuaternion(q(c.quaternion)),building:true};
      }
    }return nearest;
  }
}
