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
    this.cache=new Map();this.active=this.ground;this.target=null;this.spaceMode=false;
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
    const wanted=new Set(candidates.slice(0,2).filter(c=>c.d<90).map(c=>c.r.id));
    for(const [id,rock] of this.cache){if(!wanted.has(id)&&!rock.pending){rock.dispose();this.cache.delete(id);this.store.releaseRock?.(rock.rockId);}}
    // Only two live worker volumes. Saved distant rocks stay suppressed in the
    // instance LOD, so a pristine shell never grows back over a saved cavity.
    for(const {r,d} of candidates.slice(0,2)){
      if(d>90||this.cache.has(r.id)||this.cache.size>=2)continue;
      const quaternion=new THREE.Quaternion().setFromEuler(new THREE.Euler(...r.rotation));
      const rock=new MineableRock(this.scene,null,{store:this.store,rockId:r.key,position:new THREE.Vector3(...r.position).add(center),quaternion,initialField:createDensity((x,y,z)=>asteroidField(x,y,z,r.family)),space:true});
      rock.descriptor=r;this.cache.set(r.id,rock);
    }
    this.rings.hiddenIds.clear();
    for(const key of Object.keys(this.store.state.rocks??{}))if(key.startsWith('selene-ring-v1-'))this.rings.hiddenIds.add(Number(key.slice(15)));
    for(const [id,rock] of this.cache){rock.update(origin);if(rock.ready)this.rings.hiddenIds.add(id);}
    this.active=this.spaceMode&&candidates.length?(this.cache.get(candidates[0].r.id)??this.ground):(this.surfaceRock&&this.surfaceRock.rockId===this.surfaceSurvey?.rockId?this.surfaceRock:this.ground);
    this.ground.update(origin);this.fieldCache.update(origin);
  }
  raycast(origin,direction,range=8){
    let nearest=null;for(const rock of [this.ground,...(this.surfaceRock?[this.surfaceRock]:[]),...this.cache.values()]){
      const hit=rock.raycast(origin,direction,range);if(hit&&(!nearest||hit.distance<nearest.distance))nearest={...hit,rock};
    }
    if(nearest&&this.fieldCache.raycast(origin,direction,nearest.distance))nearest=null;
    if(nearest){
      const ray=new THREE.Ray(origin,direction),center=new THREE.Vector3(...MOON_POSITION);
      for(const r of this.rings.local){
        if(r.id===nearest.rock.descriptor?.id||this.cache.get(r.id)?.ready||this.rings.hiddenIds.has(r.id))continue;
        const point=ray.intersectSphere(new THREE.Sphere(new THREE.Vector3(...r.position).add(center),r.size*1.95),new THREE.Vector3());
        if(point&&point.distanceTo(origin)<nearest.distance){nearest=null;break;}
      }
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
      // Unpromoted populations use a conservative bounding sphere. The active
      // editable rock switches to the actual carved triangle collision.
      const c=new THREE.Vector3(...r.position).add(center),start=previous.clone().sub(c),step=point.clone().sub(previous),reach=r.size*1.95+radius;
      const aa=step.lengthSq(),bb=start.dot(step),cc=start.lengthSq()-reach*reach;
      if(cc<0&&this.rings.hiddenIds.has(r.id))return {point:previous.clone(),hit:true};
      if(aa<1e-12)continue;const disc=bb*bb-aa*cc;if(disc<0||bb>=0)continue;
      const t=(-bb-Math.sqrt(disc))/aa;if(t<0||t>1)continue;
      point.copy(previous).addScaledVector(step,Math.max(0,t-.001));hit=true;
    }
    return {point,hit};
  }
  get state(){return {...this.active.state,pending:this.pending,groundRevision:this.ground.snapshot.revision,space:this.spaceMode,targetName:this.targetName,activeRock:this.surveyDescriptor?.key??this.active.rockId,activeRevision:this.surveyDescriptor?this.store.state.rocks?.[this.surveyDescriptor.key]?.revision??0:this.active.snapshot.revision,activePosition:this.position.toArray(),debrisBrake:Boolean(this.debrisBrake),surfaceRock:this.surfaceRock?{id:this.surfaceRock.rockId,name:this.surfaceRock.descriptor.name,direction:this.surfaceRock.descriptor.direction,...this.surfaceRock.state}:null,spaceRocks:[...this.cache.values()].map(r=>({id:r.rockId,...r.state}))};}
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
