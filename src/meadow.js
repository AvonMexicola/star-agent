import * as THREE from 'three';
import { RADIUS, terrainHeight, moisture, hash } from './world.js';
import { SHIP_LAYOUT } from './boarding.js';

export const MEADOW_RANGE = 10;
export const MEADOW_REBUILD = 1.5;
export const MEADOW_PRELOAD = 12;
export const MEADOW_SPACING = .22;
const CAPACITY = 11000, CONTACTS = 8, RECOVERY = 2.4;
const UP = new THREE.Vector3(0, 1, 0);

export function meadowHabitat(y, height) {
  return Math.abs(y) < .78 && height > 12 && height < 2200;
}
export function contactStrength(age) {
  const t = Math.max(0, Math.min(1, age / RECOVERY));
  return 1 - t * t * (3 - 2 * t);
}

/** Aggregate engine exhaust projected onto canonical ground below the ship.
 * Assisted hover includes gravity compensation; inertial coasting has no thrust. */
export function flightDownwash(nav) {
  if(nav.mode!=='flight'||!nav.enabled||nav.body.airless||!nav.engineAcceleration)return null;
  const acceleration=nav.engineAcceleration,force=acceleration.length();
  if(force<.1)return null;
  const source=new THREE.Vector3(0,.3,1).sub(new THREE.Vector3(...SHIP_LAYOUT.seatEye))
    .applyQuaternion(nav.orientation).add(nav.position);
  const up=source.clone().normalize(),direction=acceleration.clone().divideScalar(-force);
  const down=-direction.dot(up),height=source.length()-RADIUS-terrainHeight(...up.toArray());
  if(down<.2||height<0||height>25)return null;
  const travel=height/down;
  if(travel>35)return null;
  const point=source.clone().addScaledVector(direction,travel).normalize();
  point.multiplyScalar(RADIUS+terrainHeight(...point.toArray()));
  return {point,radius:2.5+travel*.3,strength:Math.min(1.6,force/9.81)*down*(1-height/25)**2};
}

// Seven individually curled, tapered ribbons, with four bending segments each.
export function meadowGeometry() {
  const positions = [], colors = [], indices = [];
  for (let blade = 0; blade < 7; blade++) {
    const angle = blade * 2.39996, c = Math.cos(angle), s = Math.sin(angle);
    const length = .65 + hash(blade, 0, 427) * .35, base = positions.length / 3;
    // Share segment edges: 10 vertices instead of 24 per blade, with smooth normals.
    for (let ring = 0; ring <= 4; ring++) for (const side of [-1, 1]) {
      const t = ring / 4, width = .023 * (1 - t) * side;
      const curl = .04 + t * t * (.16 + .06 * Math.sin(blade));
      positions.push(c * curl - s * width, t * length, s * curl + c * width);
      colors.push(.42 + t * .38, .52 + t * .36, .27 + t * .18);
    }
    for (let segment = 0; segment < 4; segment++) {
      const a = base + segment * 2;
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function flowerGeometry() {
  const positions = [], colors = [];
  const triangle = (a,b,c,color) => { positions.push(...a,...b,...c); for(let i=0;i<3;i++) colors.push(...color); };
  // Crossed segmented stems keep their bases pinned under the same wind shader.
  for(let axis=0;axis<2;axis++) for(let segment=0;segment<4;segment++) {
    const a=segment/4,b=(segment+1)/4;
    const point=(t,w)=>axis?[0,t,w]:[w,t,0];
    triangle(point(a,-.009),point(a,.009),point(b,-.009),[.16,.32,.07]);
    triangle(point(a,.009),point(b,.009),point(b,-.009),[.16,.32,.07]);
  }
  // Cupped daisy petals, visible from above and at walking eye level.
  for(let petal=0;petal<7;petal++) {
    const angle=petal*Math.PI*2/7;
    const p=(radius,offset,y)=>[Math.cos(angle+offset)*radius,y,Math.sin(angle+offset)*radius];
    const middle=p(.085,0,1.025);
    const outline=Array.from({length:8},(_,i)=>{
      const t=i*Math.PI/4,r=.082+.07*Math.cos(t),offset=.29*Math.sin(t);
      return p(r,offset,1.012+.018*Math.sin(t)**2);
    });
    for(let i=0;i<8;i++)triangle(middle,outline[i],outline[(i+1)%8],[1,.98,.88]);
    triangle([0,1.018,0],p(.035,-.45,1.018),p(.035,.45,1.018),[.95,.55,.06]);
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.computeVertexNormals();return geometry;
}

function addMeadowMotion(material, uniforms) {
  material.onBeforeCompile = shader => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = `uniform float meadowTime;
uniform vec3 meadowEye, meadowUp;
uniform vec4 meadowContacts[${CONTACTS}], meadowShip, meadowWash;
uniform float meadowWashRadius;
attribute float meadowPhase;
attribute vec2 meadowWave;
varying float meadowDistance;
` + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
vec3 root = instanceMatrix[3].xyz;
vec3 toEye = root - meadowEye;
meadowDistance = length(toEye);
vec3 windAxis = normalize(cross(meadowUp, vec3(0.31, 0.79, 0.53)));
vec3 crossWind = cross(meadowUp, windAxis);
float wave = sin(meadowTime * 1.8 + meadowWave.x + meadowPhase * .35);
float gust = .5 + .5 * sin(meadowTime * .62 + meadowWave.y);
vec3 bend = windAxis * (.055 + .095 * wave) * (.5 + gust)
  + crossWind * sin(meadowTime * 2.7 + meadowPhase) * .027;
float flatten = 0.0;
for (int i = 0; i < ${CONTACTS}; i++) {
  if (meadowContacts[i].w <= 0.0) continue;
  vec3 away = root - meadowContacts[i].xyz;
  away -= meadowUp * dot(away, meadowUp);
  float d = length(away);
  float force = (1.0 - smoothstep(.12, .85, d)) * meadowContacts[i].w;
  bend += (away + windAxis * .035) / max(d, .12) * force * .48;
  flatten = max(flatten, force * .78);
}
vec3 shipAway = root - meadowShip.xyz;
shipAway -= meadowUp * dot(shipAway, meadowUp);
float shipDistance = length(shipAway);
float shipForce = meadowShip.w > 0.0 ? 1.0 - smoothstep(meadowShip.w, meadowShip.w + 2.0, shipDistance) : 0.0;
bend += shipAway / max(shipDistance, .1) * shipForce * .5;
flatten = max(flatten, shipForce * .75);
if (meadowWash.w > .001) {
vec3 washAway = root - meadowWash.xyz;
washAway -= meadowUp * dot(washAway, meadowUp);
float washDistance = length(washAway);
float washForce = (1.0 - smoothstep(0.0, meadowWashRadius, washDistance)) * meadowWash.w;
float turbulence = .83 + .17 * sin(meadowTime * 14.0 - washDistance * 2.2 + meadowPhase);
bend += (washAway / max(washDistance, .15) + cross(meadowUp, washAway) / max(washDistance, .15) * .15)
  * washForce * turbulence * .85;
flatten = max(flatten, min(.92, washForce * turbulence));
}
float bladeHeight = length(instanceMatrix[1].xyz);
bend *= min(1.0, bladeHeight * .85 / max(length(bend), .001));
float heightWeight = clamp(position.y, 0.0, 1.0);
vec3 displacement = bend * heightWeight * heightWeight
  - meadowUp * flatten * length(instanceMatrix[1].xyz) * heightWeight;
// Invert just the instance's rotation/scale. Every input is already patch-local.
transformed += vec3(dot(displacement, instanceMatrix[0].xyz) / dot(instanceMatrix[0].xyz, instanceMatrix[0].xyz),
 dot(displacement, instanceMatrix[1].xyz) / dot(instanceMatrix[1].xyz, instanceMatrix[1].xyz),
 dot(displacement, instanceMatrix[2].xyz) / dot(instanceMatrix[2].xyz, instanceMatrix[2].xyz));
`);
    // Thin leaves share the meadow's upward diffuse lobe. Keeping most of
    // that light on both faces matches the distant cluster representation;
    // geometric normals still contribute shape at walking distance.
    shader.vertexShader=shader.vertexShader.replace('#include <defaultnormal_vertex>', '#include <defaultnormal_vertex>\ntransformedNormal=normalize(mix(normalize(transformedNormal),normalize(normalMatrix*meadowUp),.8));');
    shader.fragmentShader = 'varying float meadowDistance;\n' + shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_begin>','#include <normal_fragment_begin>\nnormal*=faceDirection;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
float coverage = 1.0 - smoothstep(6.0, 10.0, meadowDistance);
float meadowDither = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(.06711056, .00583715))));
if (coverage <= meadowDither) discard;
`);
  };
  material.customProgramCacheKey = () => 'interactive-meadow-v3';
}

/** A small independently streamed meadow; moving a metre never rebuilds the forest. */
export class Meadow {
  constructor(scene, vegetation) {
    this.vegetation = vegetation;
    this.group = new THREE.Group(); this.group.name = 'Interactive meadow'; scene.add(this.group);
    this.origin = new THREE.Vector3(); this.lastPosition = new THREE.Vector3(Infinity,Infinity,Infinity);
    this.contacts = []; this.cache = new Map(); this.clearing = null;
    this.wash = {point:new THREE.Vector3(),radius:1,strength:0};this.lastTime=0;
    this.uniforms = { meadowTime:{value:0}, meadowEye:{value:new THREE.Vector3()}, meadowUp:{value:new THREE.Vector3()},
      meadowContacts:{value:Array.from({length:CONTACTS},()=>new THREE.Vector4(0,0,0,0))}, meadowShip:{value:new THREE.Vector4()}, meadowWash:{value:new THREE.Vector4()}, meadowWashRadius:{value:1} };
    this.grass = this.makeMesh(meadowGeometry(),CAPACITY);
    this.flowers = this.makeMesh(flowerGeometry(),1800);
    this.stats = {visible:false,tufts:0,blades:0,flowers:0,contacts:0,range:MEADOW_RANGE,rebuilds:0,downwash:0};
  }
  makeMesh(geometry, capacity) {
    geometry.setAttribute('meadowPhase',new THREE.InstancedBufferAttribute(new Float32Array(capacity),1));
    geometry.setAttribute('meadowWave',new THREE.InstancedBufferAttribute(new Float32Array(capacity*2),2));
    const material = new THREE.MeshStandardMaterial({color:0xffffff,vertexColors:true,side:THREE.DoubleSide,roughness:1});
    addMeadowMotion(material,this.uniforms);
    const mesh = new THREE.InstancedMesh(geometry,material,capacity);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);mesh.count=0;mesh.frustumCulled=false;
    mesh.receiveShadow=true;mesh.castShadow=false;this.group.add(mesh);return mesh;
  }
  update(position, renderOrigin, time, walking=false, downwash=null) {
    const dt=Math.max(0,Math.min(.2,time-this.lastTime));this.lastTime=time;
    const distance=position.length(),up=position.clone().normalize();
    const height=terrainHeight(up.x,up.y,up.z),altitude=distance-RADIUS-height;
    this.group.visible=altitude<MEADOW_RANGE&&altitude>-.5&&meadowHabitat(up.y,height);
    this.stats.visible=this.group.visible;
    if(!this.group.visible){this.contacts=[];this.stats.contacts=0;this.wash.strength=0;this.stats.downwash=0;return;}
    const clearing=this.vegetation.exclusionPosition ? `${this.vegetation.exclusionPosition.toArray()}/${this.vegetation.exclusionRadius}` : null;
    if(position.distanceToSquared(this.lastPosition)>MEADOW_REBUILD**2||clearing!==this.clearing){
      this.lastPosition.copy(position);this.origin.copy(up).multiplyScalar(RADIUS+height);
      this.rebuild(up);this.clearing=clearing;
    }
    const u=this.uniforms;
    u.meadowTime.value=time;u.meadowEye.value.copy(position).sub(this.origin);u.meadowUp.value.copy(up);
    this.contacts=this.contacts.filter(contact=>time-contact.time<RECOVERY);
    if(walking&&altitude<2.4){
      const foot=up.clone().multiplyScalar(RADIUS+height),last=this.contacts[0];
      if(last&&last.point.distanceToSquared(foot)<.3**2){last.time=time;}
      else this.contacts.unshift({point:foot,time});
      this.contacts.length=Math.min(this.contacts.length,CONTACTS);
    }
    for(let i=0;i<CONTACTS;i++) {
      const contact=this.contacts[i],target=u.meadowContacts.value[i];
      if(contact){const p=contact.point.clone().sub(this.origin);target.set(p.x,p.y,p.z,contactStrength(time-contact.time));}
      else target.set(0,0,0,0);
    }
    if(downwash){this.wash.point.copy(downwash.point);this.wash.radius=downwash.radius;}
    this.wash.strength+=( (downwash?.strength??0)-this.wash.strength)*(1-Math.exp(-dt*(downwash?8:3)));
    const washPoint=this.wash.strength>.0001?this.wash.point.clone().sub(this.origin):new THREE.Vector3();
    u.meadowWash.value.set(washPoint.x,washPoint.y,washPoint.z,this.wash.strength);
    u.meadowWashRadius.value=this.wash.radius;this.stats.downwash=this.wash.strength;
    const ship=this.vegetation.exclusionPosition;
    if(ship){const p=ship.clone().sub(this.origin);u.meadowShip.value.set(p.x,p.y,p.z,this.vegetation.exclusionRadius);}
    else u.meadowShip.value.set(0,0,0,0);
    this.group.position.copy(this.origin).sub(renderOrigin);this.stats.contacts=this.contacts.length;
  }
  rebuild(center) {
    const nextCache=new Map(),matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion(),yaw=new THREE.Quaternion();
    const point=new THREE.Vector3(),up=new THREE.Vector3(),scale=new THREE.Vector3(),color=new THREE.Color();
    let tufts=0,flowers=0;
    const place=(mesh,index,record,height,width,tint)=>{
      const {x,y,z,h,a,b}=record;
      point.set(x,y,z).multiplyScalar(RADIUS+h-.018).sub(this.origin);
      up.set(x,y,z);rotation.setFromUnitVectors(UP,up);yaw.setFromAxisAngle(UP,a*Math.PI*2);rotation.multiply(yaw);
      scale.set(width,height,width);matrix.compose(point,rotation,scale);mesh.setMatrixAt(index,matrix);mesh.setColorAt(index,tint);
      mesh.geometry.attributes.meadowPhase.setX(index,b*Math.PI*2);
      mesh.geometry.attributes.meadowWave.setXY(index,((x*.61+y*.23+z*.17)*RADIUS)%(Math.PI*2),((x*.13-y*.19+z*.09)*RADIUS)%(Math.PI*2));
    };
    this.vegetation.scatter(center,MEADOW_PRELOAD,MEADOW_SPACING,4817,(x,y,z,col,row,a,b)=>{
      const key=`${col}/${row}`;
      let record=this.cache.get(key);
      if(!record){const h=terrainHeight(x,y,z);record={x,y,z,h,a,b,m:moisture(x,y,z)};}
      nextCache.set(key,record);
      if(tufts>=CAPACITY||!meadowHabitat(y,record.h)||this.vegetation.isExcluded(x,y,z))return;
      const patch=.5+.5*Math.sin(x*RADIUS*.33+Math.sin(z*RADIUS*.24)*2)*Math.cos(y*RADIUS*.27);
      // Wet grasslands form a thick sward; dry ground has shorter straw and gaps.
      const wet=THREE.MathUtils.clamp((record.m-.28)/.2,0,1);
      if(hash(col,row,5911)>.68+wet*.3)return;
      const height=(.24+a*.33+patch*.15)*(.75+wet*.25);
      color.setRGB(.20+wet*.12+b*.10,.27+wet*.18+b*.12,.045+(1-wet)*.1+b*.025);
      place(this.grass,tufts++,record,height,.8+b*.6,color);
      if(flowers<1800&&wet>.2&&hash(col,row,6131)<.008+patch*patch*.055){
        const choice=hash(col,row,7193);
        color.setHex(choice<.48?0xfff9e5:choice<.76?0xffd24a:0xb6a0ed);
        place(this.flowers,flowers++,record,height*(1.05+b*.45),.22+a*.16,color);
      }
    });
    this.cache=nextCache;
    this.grass.count=tufts;this.flowers.count=flowers;
    for(const mesh of [this.grass,this.flowers]){mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;mesh.geometry.attributes.meadowPhase.needsUpdate=true;mesh.geometry.attributes.meadowWave.needsUpdate=true;}
    Object.assign(this.stats,{tufts,blades:tufts*7,flowers,rebuilds:this.stats.rebuilds+1});
  }
  dispose(){for(const mesh of [this.grass,this.flowers]){mesh.geometry.dispose();mesh.material.dispose();mesh.dispose();}this.group.removeFromParent();}
}
