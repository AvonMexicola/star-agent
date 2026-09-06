import * as THREE from 'three';
import {MineableRock} from './rock.js';
import {createDensity} from './volume.js';
import {asteroidField,ringRock,ringPathIntervals,ringCellAt,nearbyAsteroids} from '../ring-world.js';
import {MOON_POSITION,MOON_RADIUS,RESOURCE_PROVINCES,moonResources} from '../moon-world.js';
import {bodySurfacePoint,bodySurfaceNormal,SELENE} from '../celestial.js';
import {FieldCache} from '../inventory-cache.js';

/** Bounded live excavation domains over the deterministic ring population. */
export class MiningField {
  constructor(scene,storage,rings){
    this.scene=scene;this.rings=rings;this.ground=new MineableRock(scene,storage);this.store=this.ground.store;
    this.fieldCache=new FieldCache(scene,this.ground.position);
    this.surfaceRock=null;this.surfaceSurvey=null;
    this.provinces=RESOURCE_PROVINCES.map(province=>({...province,rockId:`selene-resource-v1-${province.id}`,position:bodySurfacePoint(new THREE.Vector3(...province.direction),SELENE,1.35)}));
    this.cache=new Map();this.aimedDescriptor=null;this.inspectState=null;this.active=this.ground;this.target=null;this.spaceMode=false;
  }
  get position(){return this.spaceMode&&this.surveyPosition?this.surveyPosition:this.surfaceSurvey?.position??this.active.position;}
  get error(){return this.active.error;}
  get pending(){return this.active.pending;}
  get budget(){return this.active.budget;}
  set budget(value){this.ground.budget=value;if(this.surfaceRock)this.surfaceRock.budget=value;for(const rock of this.cache.values())rock.budget=value;}
  get grounded(){return this.ground.grounded||this.surfaceRock?.grounded||this.fieldCache.grounded;}
  get targetName(){return this.spaceMode?(this.surveyDescriptor?.name??'Ring survey'):this.surfaceSurvey?.name??'Crescent deposit';}
  update(origin){
    const nearestProvince=this.provinces.map(p=>({p,d:p.position.distanceTo(origin)})).sort((a,b)=>a.d-b.d)[0];
    this.surfaceSurvey=nearestProvince?.d<40000?nearestProvince.p:null;
    if(this.surfaceRock&&this.surfaceRock.rockId!==this.surfaceSurvey?.rockId&&!this.surfaceRock.pending){
      const id=this.surfaceRock.rockId;this.surfaceRock.dispose();this.surfaceRock=null;this.store.releaseRock?.(id);
    }
    if(this.surfaceSurvey&&!this.surfaceRock){
      const p=this.surfaceSurvey,up=bodySurfaceNormal(p.position,SELENE),right=new THREE.Vector3().crossVectors(Math.abs(up.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),up).normalize();
      const quaternion=new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(right,up,right.clone().cross(up).normalize()));
      this.surfaceRock=new MineableRock(this.scene,null,{store:this.store,rockId:p.rockId,position:p.position,quaternion,initialField:createDensity(),resourceWeights:moonResources(...p.direction).weights});
      this.surfaceRock.descriptor=p;this.surfaceRock.group.name=`${p.name} survey outcrop`;
    }
    this.surfaceRock?.update(origin);
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
    for(const key of Object.keys(this.store.state.rocks??{}))if(key.startsWith('selene-ring-v1-'))this.rings.hiddenIds.add(Number(key.slice(15)));
    for(const [id,rock] of this.cache){rock.update(origin);if(rock.ready)this.rings.hiddenIds.add(id);}
    if(this.aimedDescriptor){this.surveyDescriptor=this.aimedDescriptor;this.surveyPosition=new THREE.Vector3(...this.aimedDescriptor.position).add(center);}
    this.active=this.spaceMode&&candidates.length?(this.cache.get(this.surveyDescriptor?.id)??this.ground):(this.surfaceRock&&this.surfaceRock.rockId===this.surfaceSurvey?.rockId?this.surfaceRock:this.ground);
    this.ground.update(origin);this.fieldCache.update(origin);
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
    rock.descriptor=descriptor;this.cache.set(descriptor.id,rock);rock.update(origin);
    if(rock.ready)this.rings.hiddenIds.add(descriptor.id);
    return rock;
  }
  readyRaycast(origin,direction,range=8){
    let nearest=null;
    for(const rock of [this.ground,...(this.surfaceRock?[this.surfaceRock]:[]),...this.cache.values()]){
      const hit=rock.raycast(origin,direction,range);if(hit&&(!nearest||hit.distance<nearest.distance))nearest={...hit,rock};
    }
    return nearest;
  }
  /** Camera-only inspection selects streamed deposits. Muzzle queries never change priority. */
  inspectTarget(origin,direction,range=8){
    const probe=Math.max(range,80),ready=this.readyRaycast(origin,direction,probe);
    const exclude=new Set([...this.cache].filter(([,rock])=>rock.ready).map(([id])=>id));
    const raw=this.rings.raycast?.(origin,direction,probe,{exclude,includeHidden:true});
    const hit=ready&&(!raw||ready.distance<=raw.distance)?ready:raw;
    if(!hit||this.fieldCache.raycast(origin,direction,hit.distance)){this.aimedDescriptor=null;this.inspectState=null;return null;}
    const descriptor=hit.descriptor??hit.rock?.descriptor;
    if(!descriptor||hit.rock&&!hit.rock.space){
      this.aimedDescriptor=null;
      return this.inspectState={status:hit.distance>range?'out-of-range':'ready',name:descriptor?.name??'Crescent deposit',distance:hit.distance,mineable:true,rockId:hit.rock.rockId,point:hit.point};
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
    }
    this.target=nearest?.rock??null;return nearest;
  }
  onMine(data,direction){(data.target??this.target)?.onMine(data,direction);}
  constrainSurface(method,a,b){
    let point=b,hit=false,grounded=false;
    for(const rock of [this.ground,...(this.surfaceRock?[this.surfaceRock]:[]),this.fieldCache]){
      let result;
      if(rock===this.surfaceRock&&!rock.ready){
        // While a saved outcrop is remeshed, keep its small local excavation
        // domain solid instead of allowing the suit or ship to enter it.
        const reach=method==='constrainFlight'?12.2:method==='constrainWalker'?3.75:2.55;
        const start=a.clone().sub(rock.position),delta=point.clone().sub(a),aa=delta.lengthSq(),bb=start.dot(delta),cc=start.lengthSq()-reach*reach,disc=bb*bb-aa*cc;
        const t=cc<0?0:aa>1e-12&&bb<0&&disc>=0?(-bb-Math.sqrt(disc))/aa:Infinity;
        result=t>=0&&t<=1?{point:a.clone().addScaledVector(delta,Math.max(0,t-.001)),hit:true}:{point,hit:false};
      }else result=rock[method](a,point);
      point=result.point;hit ||= result.hit;grounded ||= Boolean(result.grounded);
    }
    return {point,hit,grounded};
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
    if(this.collisionKey!==key){this.collisionKey=key;this.collisionDescriptors=key===this.rings.cellKey?this.rings.local:nearbyAsteroids(previous,2);}
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
  get state(){return {...this.active.state,inspection:this.inspectState?{...this.inspectState,point:this.inspectState.point.toArray()}:null,pending:this.pending,groundRevision:this.ground.snapshot.revision,space:this.spaceMode,targetName:this.targetName,activeRock:this.surveyDescriptor?.key??this.active.rockId,activeRevision:this.surveyDescriptor?this.store.state.rocks?.[this.surveyDescriptor.key]?.revision??0:this.active.snapshot.revision,activePosition:this.position.toArray(),debrisBrake:Boolean(this.debrisBrake),surfaceRock:this.surfaceRock?{id:this.surfaceRock.rockId,name:this.surfaceRock.descriptor.name,direction:this.surfaceRock.descriptor.direction,...this.surfaceRock.state}:null,spaceRocks:[...this.cache.values()].map(r=>({id:r.rockId,...r.state}))};}
  dispose(){this.surfaceRock?.dispose();this.fieldCache.dispose();this.ground.dispose();for(const rock of this.cache.values())rock.dispose();}
}

export function ringSurveyPoint(){const rock=ringRock(5);return new THREE.Vector3(...rock.position).add(new THREE.Vector3(...MOON_POSITION));}

/** Land beside the representative outcrop, never on top of the mining volume. */
export function resourceSurveyDirection(id){
  const p=RESOURCE_PROVINCES.find(p=>p.id===id);if(!p)throw RangeError('Unknown resource province');
  const d=new THREE.Vector3(...p.direction),east=new THREE.Vector3().crossVectors(Math.abs(d.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0),d).normalize();
  return d.addScaledVector(east,25/MOON_RADIUS).normalize().toArray();
}
export function resourceSurveyPoint(id,altitude=120){return bodySurfacePoint(new THREE.Vector3(...resourceSurveyDirection(id)),SELENE,altitude);}
