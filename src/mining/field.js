import * as THREE from 'three';
import {MineableRock} from './rock.js';
import {createDensity} from './volume.js';
import {asteroidField,asteroidDescriptorV1,LEGACY_RING_POPULATION,RING_POPULATION,ringRock,ringPathIntervals,ringCellAt,nearbyAsteroids} from '../ring-world.js';
import {MOON_POSITION,MOON_RADIUS,RESOURCE_PROVINCES,moonResources} from '../moon-world.js';
import {bodySurfacePoint,bodySurfaceNormal,bodyAt,SELENE} from '../celestial.js';
import {nearbyConstructionDeposits,constructionDepositCell} from './construction-deposits.js';
import {FieldCache} from '../inventory-cache.js';
import {LooseStones} from './loose-stones.js';
import {createStoneMaterial} from './stone-material.js';
import {nearbySurfaceDeposits,surfaceDepositCell,SURFACE_DEPOSIT_RANGE,SURFACE_DEPOSIT_WORKERS,SURFACE_DEPOSIT_SPACING} from './surface-deposits.js';

/** Bounded live excavation domains over the deterministic ring population. */
export class MiningField {
  constructor(scene,storage,rings){
    this.scene=scene;this.rings=rings;this.ground=new MineableRock(scene,storage);this.store=this.ground.store;
    this.extracted=data=>this.onExtract?.(data);this.ground.onExtract=this.extracted;
    // Preserve only previously edited v1 rocks. Their original coordinates and
    // saved fields survive the sparse v2 layout; negative runtime ids cannot
    // collide with the new population's positive ids.
    this.legacyDescriptors=Object.keys(this.store.state.rocks??{}).flatMap(key=>{
      const match=/^selene-ring-v1-(\d+)$/.exec(key),id=match?Number(match[1]):-1;
      if(!Number.isSafeInteger(id)||id<0||id>=LEGACY_RING_POPULATION)return [];
      const descriptor=asteroidDescriptorV1(id);
      return [{...descriptor,id:-(id+1),legacy:true,variant:0}];
    });
    this.rings.legacyDescriptors=this.legacyDescriptors;
    for(const descriptor of this.legacyDescriptors)this.rings.hiddenIds.add(descriptor.id);
    for(const key of Object.keys(this.store.state.rocks??{})){
      const match=/^selene-ring-v2-(\d+)$/.exec(key),id=match?Number(match[1]):-1;
      if(Number.isSafeInteger(id)&&id>=0&&id<RING_POPULATION)this.rings.hiddenIds.add(id);
    }
    this.fieldCache=new FieldCache(scene,this.ground.position);
    this.stones=new LooseStones(scene,this.store);
    this.surfaceRock=null;this.surfaceSurvey=null;this.regionalRocks=new Map();this.regionalDescriptors=[];this.regionalAimed=null;
    this.provinces=RESOURCE_PROVINCES.map(province=>({...province,rockId:`selene-resource-v1-${province.id}`,position:bodySurfacePoint(new THREE.Vector3(...province.direction),SELENE,1.35)}));
    this.cache=new Map();this.aimedDescriptor=null;this.inspectState=null;this.active=this.ground;this.target=null;this.spaceMode=false;
  }
  get position(){return this.spaceMode&&this.surveyPosition?this.surveyPosition:this.active.position;}
  get error(){return this.active.error;}
  get pending(){return this.active.pending;}
  get budget(){return this.active.budget;}
  set budget(value){this.ground.budget=value;if(this.surfaceRock)this.surfaceRock.budget=value;for(const rock of [...this.cache.values(),...this.regionalRocks.values()])rock.budget=value;}
  get grounded(){return this.ground.grounded||this.surfaceRock?.grounded||[...this.regionalRocks.values()].some(r=>r.grounded)||this.fieldCache.grounded;}
  get targetName(){return this.spaceMode?(this.surveyDescriptor?.name??'Ring survey'):this.active.descriptor?.name??'Crescent deposit';}
  update(origin){
    const extracted=data=>this.onExtract?.(data);
    this.ground.onExtract=extracted;
    const nearestProvince=this.provinces.map(p=>({p,d:p.position.distanceTo(origin)})).sort((a,b)=>a.d-b.d)[0];
    this.surfaceSurvey=nearestProvince?.d<40000?nearestProvince.p:null;
    if(this.surfaceRock&&this.surfaceRock.rockId!==this.surfaceSurvey?.rockId&&!this.surfaceRock.pending){
      const id=this.surfaceRock.rockId;this.surfaceRock.dispose();this.surfaceRock=null;this.store.releaseRock?.(id);
    }
    if(this.surfaceSurvey&&!this.surfaceRock){
      const p=this.surfaceSurvey,up=bodySurfaceNormal(p.position,SELENE),right=new THREE.Vector3().crossVectors(Math.abs(up.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),up).normalize();
      const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,right.clone().cross(up).normalize()));
      this.surfaceRock=new MineableRock(this.scene,null,{store:this.store,rockId:p.rockId,position:p.position,quaternion,initialField:createDensity(),resourceWeights:moonResources(...p.direction).weights});
      this.surfaceRock.onExtract=this.extracted;
      this.surfaceRock.descriptor=p;this.surfaceRock.group.name=`${p.name} survey outcrop`;
    }
    if(this.surfaceRock)this.surfaceRock.onExtract=extracted;
    this.surfaceRock?.update(origin);
    this.updateRegionalDeposits(origin);
    const center=new THREE.Vector3(...MOON_POSITION),candidates=this.rings.local.filter(r=>r.mineable).map(r=>({r,d:new THREE.Vector3(...r.position).add(center).distanceTo(origin)})).sort((a,b)=>a.d-b.d);
    this.spaceMode=this.rings.local.length>0;
    this.surveyDescriptor=candidates[0]?.r;this.surveyPosition=this.surveyDescriptor?new THREE.Vector3(...this.surveyDescriptor.position).add(center):null;
    if(this.aimedDescriptor&&!candidates.some(c=>c.r.id===this.aimedDescriptor.id&&c.d<90))this.aimedDescriptor=null;
    const priority=this.aimedDescriptor?[this.aimedDescriptor,...candidates.map(c=>c.r).filter(r=>r.id!==this.aimedDescriptor.id)]:candidates.map(c=>c.r);
    const wanted=new Set(priority.slice(0,2).filter(r=>new THREE.Vector3(...r.position).add(center).distanceTo(origin)<90).map(r=>r.id));
    for(const [id,rock] of this.cache){if(!wanted.has(id)&&!rock.pending)this.releaseSpaceRock(id);}
    // Aim gets the first slot. A second nearest deposit streams in ahead of time.
    // Pending jobs are never discarded; the aim waits until an idle slot opens.
    for(const r of priority.slice(0,2))if(wanted.has(r.id))this.promoteSpaceRock(r,origin);
    this.rings.hiddenIds.clear();
    for(const key of Object.keys(this.store.state.rocks??{})){
      // A live descriptor is authoritative, including injected test domains.
      const known=[...this.cache.values()].find(rock=>rock.rockId===key)?.descriptor??this.legacyDescriptors.find(r=>r.key===key);
      const current=/^selene-ring-v2-(\d+)$/.exec(key),id=known?.id??(current?Number(current[1]):null);
      if(id!==null&&Number.isSafeInteger(id)&&(known||id>=0&&id<RING_POPULATION))this.rings.hiddenIds.add(id);
    }
    for(const [id,rock] of this.cache){rock.onExtract=extracted;rock.update(origin);if(rock.ready)this.rings.hiddenIds.add(id);}
    if(this.aimedDescriptor){this.surveyDescriptor=this.aimedDescriptor;this.surveyPosition=new THREE.Vector3(...this.aimedDescriptor.position).add(center);}
    this.active=this.spaceMode&&candidates.length?(this.cache.get(this.surveyDescriptor?.id)??this.ground):(this.regionalRocks.get(this.regionalAimed)??[this.ground,...(this.surfaceRock&&this.surfaceRock.rockId===this.surfaceSurvey?.rockId?[this.surfaceRock]:[]),...this.regionalRocks.values()].sort((a,b)=>a.position.distanceToSquared(origin)-b.position.distanceToSquared(origin))[0]);
    this.ground.update(origin);this.fieldCache.update(origin);
  }
  updateRegionalDeposits(origin){
    const body=bodyAt(origin);
    const key=`${body.id}:${(body.id==='selene'?surfaceDepositCell(origin):constructionDepositCell(origin)).join(':')}:${Math.floor(origin.distanceTo(new THREE.Vector3(...body.center))/SURFACE_DEPOSIT_SPACING)}`;
    if(this.regionalQueryKey!==key){
      this.regionalQueryKey=key;this.regionalQueryOrigin=origin.clone();
      this.regionalDescriptors=body.id==='selene'?nearbySurfaceDeposits(origin,SURFACE_DEPOSIT_RANGE+2*SURFACE_DEPOSIT_SPACING):nearbyConstructionDeposits(origin,SURFACE_DEPOSIT_RANGE+2*SURFACE_DEPOSIT_SPACING);
    }
    const nearby=[...this.regionalDescriptors,...this.stones.query(origin)].filter(d=>d.position.distanceTo(origin)<SURFACE_DEPOSIT_RANGE).sort((a,b)=>a.position.distanceToSquared(origin)-b.position.distanceToSquared(origin));
    if(this.regionalAimed&&!nearby.some(d=>d.id===this.regionalAimed&&d.position.distanceTo(origin)<80))this.regionalAimed=null;
    const priority=this.regionalAimed?[...nearby.filter(d=>d.id===this.regionalAimed),...nearby.filter(d=>d.id!==this.regionalAimed)]:nearby;
    const wanted=new Set(priority.slice(0,SURFACE_DEPOSIT_WORKERS).map(d=>d.id));
    for(const [id,rock] of this.regionalRocks){
      if(wanted.has(id)||rock.pending)continue;
      rock.dispose();this.regionalRocks.delete(id);this.store.releaseRock?.(id);
    }
    for(const d of priority.slice(0,SURFACE_DEPOSIT_WORKERS)){
      if(this.regionalRocks.has(d.id)||this.regionalRocks.size>=SURFACE_DEPOSIT_WORKERS)continue;
      const rock=new MineableRock(this.scene,null,{store:this.store,rockId:d.id,position:d.position,quaternion:d.quaternion,initialField:d.looseStone?this.stones.initialField(d):createDensity((x,y,z)=>asteroidField(x,y,z,d.variant)),resourceWeights:d.resourceWeights,...(d.looseStone?{material:createStoneMaterial()}:{})});
      rock.onExtract=this.extracted;rock.descriptor=d;rock.group.name=`${d.name} ${d.id}`;this.regionalRocks.set(d.id,rock);
    }
    for(const rock of this.regionalRocks.values())rock.update(origin);
    this.stones.update(origin,this.regionalRocks);
    this.nearestRegional=nearby[0]??null;
    this.regionalOrigin=origin.clone();
  }
  releaseSpaceRock(id){
    const rock=this.cache.get(id);if(!rock||rock.pending)return false;
    rock.dispose();this.cache.delete(id);this.store.releaseRock?.(rock.rockId);return true;
  }
  promoteSpaceRock(descriptor,origin){
    if(this.cache.has(descriptor.id))return this.cache.get(descriptor.id);
    if(!descriptor.mineable)return null;
    if(this.cache.size>=2){
      const replace=[...this.cache.values()].filter(r=>!r.pending&&r.descriptor.id!==this.aimedDescriptor?.id).sort((a,b)=>b.position.distanceTo(origin)-a.position.distanceTo(origin))[0];
      if(!replace||!this.releaseSpaceRock(replace.descriptor.id))return null;
    }
    const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(...descriptor.rotation));
    const rock=new MineableRock(this.scene,null,{store:this.store,rockId:descriptor.key,position:new THREE.Vector3(...descriptor.position).add(new THREE.Vector3(...MOON_POSITION)),quaternion,initialField:createDensity((x,y,z)=>asteroidField(x,y,z,descriptor.family)),space:true});
    rock.onExtract=this.extracted;rock.descriptor=descriptor;this.cache.set(descriptor.id,rock);rock.update(origin);
    if(rock.ready)this.rings.hiddenIds.add(descriptor.id);
    return rock;
  }
  readyRaycast(origin,direction,range=8){
    let nearest=null;
    for(const rock of [this.ground,...(this.surfaceRock?[this.surfaceRock]:[]),...this.regionalRocks.values(),...this.cache.values()]){
      const hit=rock.raycast(origin,direction,range);if(hit&&(!nearest||hit.distance<nearest.distance))nearest={...hit,rock};
    }
    return nearest;
  }
  /** Camera-only inspection selects streamed deposits. Muzzle queries never change priority. */
  inspectTarget(origin,direction,range=8){
    const probe=Math.max(range,80),ready=this.readyRaycast(origin,direction,probe);
    const exclude=new Set([...this.cache].filter(([,rock])=>rock.ready).map(([id])=>id));
    const ring=this.rings.raycast?.(origin,direction,probe,{exclude,includeHidden:true});
    const stone=this.stones.raycast(origin,direction,probe,new Set([...this.regionalRocks].filter(([,r])=>r.ready).map(([id])=>id)));
    const raw=stone&&(!ring||stone.distance<ring.distance)?stone:ring;
    const hit=ready&&(!raw||ready.distance<=raw.distance)?ready:raw;
    if(!hit||this.fieldCache.raycast(origin,direction,hit.distance)){this.aimedDescriptor=null;this.regionalAimed=null;this.inspectState=null;return null;}
    const descriptor=hit.descriptor??hit.rock?.descriptor;
    if(descriptor?.looseStone&&!hit.rock){
      this.aimedDescriptor=null;this.regionalAimed=descriptor.id;
      const rock=this.regionalRocks.get(descriptor.id);if(rock)this.active=rock;
      return this.inspectState={status:hit.distance>range?'out-of-range':!this.store.canEditRock(descriptor.id)?'save-full':'preparing',name:descriptor.name,distance:hit.distance,mineable:true,rockId:descriptor.id,point:hit.point};
    }
    if(!descriptor||hit.rock&&!hit.rock.space){
      this.aimedDescriptor=null;this.regionalAimed=descriptor?.regional?descriptor.id:null;this.active=hit.rock;
      return this.inspectState={status:hit.distance>range?'out-of-range':!this.store.canEditRock(hit.rock.rockId)?'save-full':'ready',name:descriptor?.name??'Crescent deposit',distance:hit.distance,mineable:true,rockId:hit.rock.rockId,point:hit.point};
    }
    this.aimedDescriptor=descriptor.mineable?descriptor:null;
    let status=!descriptor.mineable?'too-large':hit.distance>range?'out-of-range':'preparing';
    let rock=hit.rock??this.cache.get(descriptor.id);
    if(descriptor.mineable&&hit.distance<=range){
      if(!this.store.canEditRock(descriptor.key))status='save-full';
      else{rock??=this.promoteSpaceRock(descriptor,origin);status=rock?.ready?'ready':'preparing';}
    }
    if(descriptor.mineable){this.surveyDescriptor=descriptor;this.surveyPosition=new THREE.Vector3(...descriptor.position).add(new THREE.Vector3(...MOON_POSITION));if(rock)this.active=rock;}
    return this.inspectState={status,name:descriptor.name,distance:hit.distance,mineable:descriptor.mineable,rockId:descriptor.key,point:hit.point};
  }
  raycast(origin,direction,range=8){
    let nearest=this.readyRaycast(origin,direction,range);
    if(nearest&&this.fieldCache.raycast(origin,direction,nearest.distance))nearest=null;
    if(nearest){
      const exclude=new Set([...this.cache].filter(([,rock])=>rock.ready).map(([id])=>id));
      if(this.rings.raycast?.(origin,direction,nearest.distance,{exclude}))nearest=null;
      if(nearest&&this.stones.raycast(origin,direction,nearest.distance,new Set([...this.regionalRocks].filter(([,r])=>r.ready).map(([id])=>id))))nearest=null;
    }
    this.target=nearest?.rock??null;return nearest;
  }
  onMine(data,direction){(data.target??this.target)?.onMine(data,direction);}
  constrainSurface(method,a,b){
    let point=b,hit=false,grounded=false;
    for(const rock of [this.ground,...(this.surfaceRock?[this.surfaceRock]:[]),...this.regionalRocks.values(),this.fieldCache]){
      let result;
      if((rock===this.surfaceRock||rock.descriptor?.regional)&&!rock.ready){
        // While a saved outcrop is remeshed, keep its small local excavation
        // domain solid instead of allowing the suit or ship to enter it.
        const reach=method==='constrainFlight'?12.2:method==='constrainWalker'?3.75:2.55;
        const start=a.clone().sub(rock.position),delta=point.clone().sub(a),aa=delta.lengthSq(),bb=start.dot(delta),cc=start.lengthSq()-reach*reach,disc=bb*bb-aa*cc;
        const t=cc<0?0:aa>1e-12&&bb<0&&disc>=0?(-bb-Math.sqrt(disc))/aa:Infinity;
        result=t>=0&&t<=1?{point:a.clone().addScaledVector(delta,Math.max(0,t-.001)),hit:true}:{point,hit:false};
      }else result=rock[method](a,point);
      point=result.point;hit ||= result.hit;grounded ||= Boolean(result.grounded);
    }
    const stones=this.stones.constrain(method,a,point,new Set([...this.regionalRocks.keys()]));
    return {point:stones.point,hit:hit||stones.hit,grounded:grounded||stones.grounded};
  }
  constrainWalker(a,b){return this.constrainSurface('constrainWalker',a,b);}
  constrainEVA(a,b){const surface=this.constrainSurface('constrainEVA',a,b);return surface.hit?surface:this.constrainSpace(a,b,.35);}
  constrainFlight(a,b){
    this.debrisBrake=false;
    if(a.distanceTo(b)>400){const intervals=ringPathIntervals(a,b);if(intervals.length){this.debrisBrake=true;return {point:a.clone().lerp(b,Math.max(0,intervals[0][0]-1e-6)),hit:true,debrisBrake:true};}}
    const surface=this.constrainSurface('constrainFlight',a,b);return surface.hit?surface:this.constrainSpace(a,b,10);
  }
  constrainSpace(previous,proposed,radius){
    let point=proposed.clone(),hit=false;const center=new THREE.Vector3(...MOON_POSITION);
    const key=ringCellAt(previous).join(':');
    if(this.collisionKey!==key){
      this.collisionKey=key;
      const streamed=key===this.rings.cellKey?this.rings.local:nearbyAsteroids(previous,2);
      const ids=new Set(streamed.map(r=>r.id));
      this.collisionDescriptors=[...streamed,...this.legacyDescriptors.filter(r=>!ids.has(r.id))];
    }
    for(const r of this.collisionDescriptors){
      const edited=this.cache.get(r.id);
      if(edited?.ready){const result=radius<1?edited.constrainEVA(previous,point):edited.constrainFlight(previous,point);if(result.hit){point=result.point;hit=true;}continue;}
      // Saved, not-yet-restored domains remain conservative until their edited
      // collider is ready. Other rocks collide with their actual visible mesh.
      const c=new THREE.Vector3(...r.position).add(center),start=previous.clone().sub(c),reach=r.size*1.95+radius;
      if(start.lengthSq()<reach*reach&&this.rings.hiddenIds.has(r.id))return {point:previous.clone(),hit:true};
      if(new THREE.Line3(previous,point).closestPointToPoint(c,true,new THREE.Vector3()).distanceToSquared(c)>reach*reach)continue;
      const result=this.rings.constrainDescriptor(r,previous,point,radius);
      if(result.hit){point=result.point;hit=true;}
    }
    return {point,hit};
  }
  get state(){return {...this.active.state,looseStones:this.stones.stats,inspection:this.inspectState?{...this.inspectState,point:this.inspectState.point.toArray()}:null,pending:this.pending,groundRevision:this.ground.snapshot.revision,space:this.spaceMode,targetName:this.targetName,activeRock:this.surveyDescriptor?.key??this.active.rockId,activeRevision:this.surveyDescriptor?this.store.state.rocks?.[this.surveyDescriptor.key]?.revision??0:this.active.snapshot.revision,activePosition:this.position.toArray(),debrisBrake:Boolean(this.debrisBrake),surfaceRock:this.surfaceRock?{id:this.surfaceRock.rockId,name:this.surfaceRock.descriptor.name,direction:this.surfaceRock.descriptor.direction,...this.surfaceRock.state}:null,nearestRegional:this.nearestRegional?{id:this.nearestRegional.id,name:this.nearestRegional.name,position:this.nearestRegional.position.toArray(),direction:this.nearestRegional.direction,dominant:this.nearestRegional.dominant,resourceWeights:this.nearestRegional.resourceWeights,distance:this.nearestRegional.position.distanceTo(this.regionalOrigin),ready:Boolean(this.regionalRocks.get(this.nearestRegional.id)?.ready)}:null,regionalDeposits:[...this.regionalRocks.values()].map(r=>({id:r.rockId,name:r.descriptor.name,dominant:r.descriptor.dominant,variant:r.descriptor.variant,distance:r.position.distanceTo(this.regionalOrigin),...r.state})),spaceRocks:[...this.cache.values()].map(r=>({id:r.rockId,...r.state}))};}
  dispose(){this.surfaceRock?.dispose();this.fieldCache.dispose();this.ground.dispose();this.stones.dispose();for(const rock of [...this.cache.values(),...this.regionalRocks.values()])rock.dispose();}
}

export function ringSurveyPoint(){const rock=ringRock(5);return new THREE.Vector3(...rock.position).add(new THREE.Vector3(...MOON_POSITION));}

/** Land beside the representative outcrop, never on top of the mining volume. */
export function resourceSurveyDirection(id){
  const p=RESOURCE_PROVINCES.find(p=>p.id===id);if(!p)throw RangeError('Unknown resource province');
  const d=new THREE.Vector3(...p.direction),east=new THREE.Vector3().crossVectors(Math.abs(d.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),d).normalize();
  return d.addScaledVector(east,25/MOON_RADIUS).normalize().toArray();
}
export function resourceSurveyPoint(id,altitude=120){return bodySurfacePoint(new THREE.Vector3(...resourceSurveyDirection(id)),SELENE,altitude);}
