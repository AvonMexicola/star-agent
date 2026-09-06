import { Vector3 } from 'three';

// A quarter-scale lunar radius with a compressed, fixed orbit for this prototype.
// Positions stay in planet-centred metres. Rendering and contact share this terrain.
export const MOON_RADIUS = 434_350;
export const MOON_DISTANCE = 24_000_000;
export const MOON_POSITION = Object.freeze(new Vector3(-.1, 0, -1).normalize().multiplyScalar(MOON_DISTANCE).toArray());
export const MOON_MAX_HEIGHT = 16_000;
export const MOON_GRAVITY = 1.62;
export const MOON_GENERATOR_VERSION = 4;
export const MOON_LANDING_DIRECTION = Object.freeze(new Vector3(.45,.22,.87).normalize().toArray());
export const MOON_NAME = 'Selene';

// A separate deterministic seed keeps the moon stable across planet seeds.
let seed = 0x53454c45;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
export const CRATERS = Object.freeze(Array.from({length: 96}, () => {
  const y = random() * 2 - 1, angle = random() * Math.PI * 2, r = Math.sqrt(1 - y*y);
  const radius = .012 + random() ** 2 * .13;
  return Object.freeze({ direction: Object.freeze([r*Math.cos(angle), y, r*Math.sin(angle)]), radius, depth: radius * MOON_RADIUS * .095 });
}));
const smooth = (a,b,x) => {const t=Math.max(0,Math.min(1,(x-a)/(b-a)));return t*t*(3-2*t);};
const hash = (x,y,z) => {let h=Math.imul(x,374761393)^Math.imul(y,668265263)^Math.imul(z,2147483647);h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967295;};
function noise(x,y,z) {
  const a=Math.floor(x),b=Math.floor(y),c=Math.floor(z);
  const u=smooth(0,1,x-a),v=smooth(0,1,y-b),w=smooth(0,1,z-c);
  let sum=0;
  for(let i=0;i<2;i++)for(let j=0;j<2;j++)for(let k=0;k<2;k++)sum+=hash(a+i,b+j,c+k)*(i?u:1-u)*(j?v:1-v)*(k?w:1-w);
  return sum;
}

// A reproducible exploration basin: large walls read from the ground while the
// central landing shelf stays traversable. These features belong to the canonical
// heightfield, so the visible slopes and the walking floor cannot disagree.
const landing=new Vector3(...MOON_LANDING_DIRECTION);
const east=new Vector3().crossVectors(new Vector3(0,1,0),landing).normalize();
const north=new Vector3().crossVectors(landing,east).normalize();
export const LANDING_FRAME=Object.freeze({east:Object.freeze(east.toArray()),north:Object.freeze(north.toArray())});
const localDirection=(x,z)=>landing.clone().addScaledVector(east,x/MOON_RADIUS).addScaledVector(north,z/MOON_RADIUS).normalize().toArray();
// Resource provinces are spherical, named geology rather than an unrelated UV
// texture. Their 80–150 km radii remain sampled by the orbital terrain LODs.
export const MOON_RESOURCE_VERSION=1;
export const MOON_RESOURCE_PALETTE=Object.freeze({basalt:Object.freeze([.025,.037,.057]),copper:Object.freeze([.38,.10,.025]),ice:Object.freeze([.43,.68,.83])});
export const RESOURCE_PROVINCES=Object.freeze([
  ['FROSTWALL ICE PROVINCE','ice',localDirection(65000,135000),145000],
  ['COPPER EJECTA PROVINCE','copper',localDirection(100000,-130000),150000],
  ['NORTH GLASS FIELDS','ice',new Vector3(-.3,.83,-.46).normalize().toArray(),120000],
  ['FAR COPPER BASINS','copper',new Vector3(-.88,-.3,.3).normalize().toArray(),135000],
  ['SOUTH ICE FIELDS','ice',new Vector3(.1,-.97,.12).normalize().toArray(),95000],
].map(([name,resource,direction,radius])=>Object.freeze({id:name.toLowerCase().replaceAll(' ','-'),name,resource,direction:Object.freeze(direction),radius})));

const provinceFrames=RESOURCE_PROVINCES.map((p,index)=>{
  const direction=new Vector3(...p.direction),u=new Vector3().crossVectors(Math.abs(direction.y)<.9?new Vector3(0,1,0):new Vector3(1,0,0),direction).normalize();
  return {u:u.toArray(),v:new Vector3().crossVectors(direction,u).normalize().toArray(),phase:index*1.73};
});

/** Normalized lunar direction -> collectible mineral fractions [basalt,copper,ice].
 * This cheap classifier is also the authority for orbital and walking colors. */
export function moonResources(x,y,z){
  let copper=0,ice=0,province='BASALT HIGHLANDS',strongest=0,coreProvince=null,corePriority=0,stratigraphy=null;
  const landingDot=x*landing.x+y*landing.y+z*landing.z;
  const localOnly=landingDot>0&&(1-landingDot*landingDot)*MOON_RADIUS*MOON_RADIUS<18000*18000;
  for(let index=0;!localOnly&&index<RESOURCE_PROVINCES.length;index++){
    const p=RESOURCE_PROVINCES[index],frame=provinceFrames[index];
    const dot=x*p.direction[0]+y*p.direction[1]+z*p.direction[2],r=p.radius/MOON_RADIUS;
    if(dot<1-r*r*2)continue;
    const distance=Math.sqrt(Math.max(0,2-2*dot))*MOON_RADIUS;
    // One shared geological sample, not extra noise octaves for every district.
    stratigraphy ??= .38+.62*noise(x*22+11,y*22-4,z*22+7);
    const u=(x*frame.u[0]+y*frame.u[1]+z*frame.u[2])/r,v=(x*frame.v[0]+y*frame.v[1]+z*frame.v[2])/r;
    const wu=u+.23*Math.sin(v*6+frame.phase)+.12*Math.sin(u*11-v*8),wv=v+.19*Math.sin(u*5-v*3)+.08*Math.sin(v*14+frame.phase);
    const basin=1-smooth(.25,1.08,Math.hypot(wu/1.2,wv*1.25));
    // Long sinuous faults and diagonal tributaries join the core to satellite
    // exposures. Variable strength opens dark basalt channels through the field.
    const trunk=(1-smooth(.80,1.65,Math.abs(u)))*(1-smooth(.06,.30,Math.abs(v+.30*Math.sin(u*4+frame.phase)+.14*Math.sin(u*9))));
    const branch=(1-smooth(.75,1.5,Math.hypot(u,v)))*(1-smooth(.025,.19,Math.abs(v-.65*u-.20*Math.sin(u*6+frame.phase))));
    const core=1-smooth(40000,65000,distance*(1+.12*Math.sin(u*7+frame.phase)*Math.sin(v*6)));
    if(core>corePriority){coreProvince=p;corePriority=core;}
    const strength=Math.max(core,basin*stratigraphy,trunk*.82*stratigraphy,branch*.76*stratigraphy);
    if(p.resource==='ice')ice=Math.max(ice,strength);else copper=Math.max(copper,strength);
    if(strength>strongest){strongest=strength;province=p.name;}
  }
  // Keep every survey anchor and its 35 km test core exactly the same profile;
  // neighbouring province tendrils cannot alter already-authored mining yields.
  if(coreProvince){ice=ice*(1-corePriority)+Number(coreProvince.resource==='ice')*corePriority;copper=copper*(1-corePriority)+Number(coreProvince.resource==='copper')*corePriority;if(corePriority>.5)province=coreProvince.name;}
  const dot=x*landing.x+y*landing.y+z*landing.z;
  if(dot>.997){
    const u=(x*east.x+y*east.y+z*east.z)*MOON_RADIUS,v=(x*north.x+y*north.y+z*north.z)*MOON_RADIUS;
    const regional=1-smooth(18000,28000,Math.hypot(u,v));
    copper*=1-regional;ice*=1-regional;
    const fault=u+220-Math.sin(v/900)*380-Math.sin(v/240)*65;
    const localIce=Math.max(1-smooth(90,260,Math.abs(fault)),1-smooth(3000,5000,Math.hypot(u-5400,v-11500)))*regional;
    const localCopper=(1-smooth(1000,2700,Math.hypot(u-2600,v+3400)))*regional;
    const obsidian=(1-smooth(3000,5000,Math.hypot(u+7600,v+5300)))*regional;
    copper=Math.max(copper,localCopper)*(1-obsidian);ice=Math.max(ice,localIce)*(1-obsidian);
    if(regional>.5)province=moonRegion(x,y,z);
  }
  let c=.015+copper*.92,i=.02+ice*.94;
  if(c+i>.98){const scale=.98/(c+i);c*=scale;i*=scale;}
  const weights=[1-c-i,c,i],dominant=c>weights[0]&&c>=i?'copper':i>weights[0]?'ice':'basalt';
  return {weights,dominant,province};
}

export const LOCAL_CRATERS=Object.freeze([
  [-1350,100,1354,1350],[-3400,1200,1900,1650],[1800,2300,1250,980],
  [-280,-480,145,43],[-490,570,210,78],[460,-210,95,32],
  [-6000,-2500,3100,1100],[2600,-3400,2100,760],
  ...Array.from({length:28},(_,i)=>{
    const angle=i*2.39996,distance=700+random()*6500,radius=40+random()**2*280;
    return [Math.cos(angle)*distance,Math.sin(angle)*distance,radius,radius*.24];
  })
].map(([x,z,radius,depth])=>Object.freeze({direction:Object.freeze(localDirection(x,z)),radius:radius/MOON_RADIUS,depth})));

function relief(x,y,z){
  const broad=noise(x*3.7+11,y*3.7-4,z*3.7+7),detail=noise(x*24+7,y*24+3,z*24-6);
  const maria=1-smooth(.33,.50,broad);
  const ridge=(f,a,b,c)=>1-Math.abs(noise(x*f+a,y*f+b,z*f+c)*2-1);
  const highlands=smooth(.30,.64,broad);
  let height=(broad-.5)*6200+(detail-.5)*1150;
  height+=highlands*(Math.pow(ridge(62,4,7,-2),3)*2100+Math.pow(ridge(180,-3,9,5),4)*620);
  height+=(noise(x*720+13,y*720-9,z*720+3)-.5)*165;
  height+=(noise(x*2500-2,y*2500+5,z*2500+8)-.5)*18;
  height+=(noise(x*18000+6,y*18000-2,z*18000+8)-.5)*.9;
  let fresh=0,rock=0,glacier=0,ochre=0,obsidian=0,capIce=0;
  const crater=(c,local)=>{
    const dot=x*c.direction[0]+y*c.direction[1]+z*c.direction[2];
    if(dot<1-c.radius*c.radius*1.45)return;
    const r=Math.sqrt(Math.max(0,2-2*dot))/c.radius;
    // A rounded basin, steep inner wall, broken rim and broad ejecta apron.
    const broken=1+(noise(x*110+7,y*110-4,z*110+2)-.5)*.24;
    const bowl=-c.depth*(1-smooth(.22,.98,r));
    const rim=c.depth*.46*Math.exp(-(((r-1.01)/.115)**2))*broken;
    const ejecta=c.depth*.055*Math.exp(-(((r-1.17)/.27)**2))*(1-smooth(1.35,1.65,r));
    const peak=local?0:c.depth*.16*Math.exp(-r*r/ .015);
    height+=bowl+rim+ejecta+peak;
    fresh+=Math.exp(-(((r-1.02)/.18)**2))*.10;
  };
  for(const c of CRATERS)crater(c,false);
  if(x*landing.x+y*landing.y+z*landing.z>.997){
    for(const c of LOCAL_CRATERS)crater(c,true);
    const u=(x*east.x+y*east.y+z*east.z)*MOON_RADIUS,v=(x*north.x+y*north.y+z*north.z)*MOON_RADIUS;
    // Compact basalt outcrops are part of the heightfield too. A stable local
    // cell lattice avoids testing hundreds of rocks for every terrain sample.
    const cellX=Math.floor(u/45),cellZ=Math.floor(v/45);
    for(let dz=-1;dz<=1;dz++)for(let dx=-1;dx<=1;dx++){
      const cx=cellX+dx,cz=cellZ+dz;if(hash(cx,37,cz)<.64)continue;
      const px=(cx+.15+hash(cx,61,cz)*.7)*45,pz=(cz+.15+hash(cx,89,cz)*.7)*45;
      const radius=2.5+hash(cx,107,cz)*6.5,dist=Math.hypot(u-px,(v-pz)*(.7+hash(cx,123,cz)*.6))/radius;
      const shape=1-smooth(.05,1,dist);
      height+=radius*.55*shape;rock=Math.max(rock,shape);
    }
    // A sinuous ice-filled fault gives explorers a continuous ground landmark.
    // Its broad trough and tributaries are geometry, with the same ice mask used
    // for the material. Blend all regional additions out before the cap boundary.
    const regional=1-smooth(18000,28000,Math.hypot(u,v));
    const fault=u+220-Math.sin(v/900)*380-Math.sin(v/240)*65;
    glacier=(1-smooth(90,260,Math.abs(fault)))*regional;
    height-=glacier*180;
    ochre=(1-smooth(1000,2700,Math.hypot(u-2600,v+3400)))*regional;
    obsidian=(1-smooth(3000,5000,Math.hypot(u+7600,v+5300)))*regional;
    capIce=(1-smooth(3000,5000,Math.hypot(u-5400,v-11500)))*regional;
    // Fractured peaks beyond the basin: silhouettes are geometry, not a sky card.
    for(const [a,b,r,h] of [[-7600,-5300,4800,6800],[-11000,6500,5200,7600],[5400,11500,5200,6200]]){
      const du=u-a,dv=v-b,angle=Math.atan2(dv,du);
      const distance=Math.hypot(du,dv)/(r*(1+.16*Math.sin(angle*5)+.08*Math.cos(angle*9)));
      const envelope=Math.pow(Math.max(0,1-distance),1.05);
      const gullies=.73+.27*Math.pow(ridge(460,8,-3,5),2);
      height+=h*envelope*gullies;
    }
  }
  const frost=Math.max(glacier,capIce*.88,smooth(.50,.77,noise(x*38-7,y*38+2,z*38+8)+fresh*.6)*.7)*(1-rock*.7);
  const basalt=Math.max(rock,obsidian,1-smooth(.30,.62,detail));
  // Materials are sampled at every terrain vertex, including centimetre LODs.
  // Ground identity must never depend on a kilometre-wide orbital texture pixel.
  // Broad mineral fields remain stable on distant meshes; sub-metre fractures
  // belong in the mipmapped fragment material, not aliased vertex noise.
  const veins=smooth(.47,.64,noise(x*720+8,y*720-5,z*720+2));
  const ice=Math.min(1,Math.max(capIce*.88,frost*(.55+veins*.45)+veins*.15*(1-obsidian)));
  const resources=moonResources(x,y,z);
  const palette=MOON_RESOURCE_PALETTE;
  const color=[0,1,2].map(i=>(palette.basalt[i]*resources.weights[0]+palette.copper[i]*resources.weights[1]+palette.ice[i]*resources.weights[2])*(.80+veins*.32)+fresh*.10);
  return {height,albedo:Math.max(.065,Math.min(.38,.145-maria*.055+(detail-.5)*.065+fresh+frost*.075-rock*.05)),frost:Math.max(ice*.15,resources.weights[2]),color,resources,resource:resources.dominant};
}
const landingHeight=relief(landing.x,landing.y,landing.z).height;
/** Direction-based color and canonical geometry remain continuous at UV seams. */
export function moonSurface(x,y,z){
  const sample=relief(x,y,z),dot=x*landing.x+y*landing.y+z*landing.z;
  if(dot>.9999998){
    const distance=Math.sqrt(Math.max(0,2-2*dot))*MOON_RADIUS;
    sample.height=landingHeight+(sample.height-landingHeight)*smooth(35,150,distance);
  }
  return sample;
}

/** Named, fixed geological districts provide an orientation cue while exploring. */
export function moonRegion(x,y,z){
  const u=(x*east.x+y*east.y+z*east.z)*MOON_RADIUS,v=(x*north.x+y*north.y+z*north.z)*MOON_RADIUS;
  if(x*landing.x+y*landing.y+z*landing.z<.997)return 'FAR HIGHLANDS';
  if(Math.hypot(u,v)<180)return 'CRESCENT RIM';
  if(Math.hypot(u+7600,v+5300)<2700)return 'OBSIDIAN CROWN';
  if(Math.hypot(u+11000,v-6500)<3000)return 'TWIN SPIRES';
  if(Math.hypot(u-5400,v-11500)<3200)return 'FROSTWALL';
  if(Math.hypot(u-2600,v+3400)<2700)return 'COPPER EJECTA';
  if(Math.abs(u+220-Math.sin(v/900)*380-Math.sin(v/240)*65)<300)return 'GLASS RIFT';
  if(Math.hypot(u+1350,v-100)<1500)return 'CRESCENT BASIN';
  return 'ASH HIGHLANDS';
}

export function moonOffset(position) { return position.clone().sub(new Vector3(...MOON_POSITION)); }
export function moonAltitude(position) { return moonOffset(position).length()-MOON_RADIUS; }
export function moonApproach() {
  // Near side, with a gibbous sunlit face and enough clearance to frame the disk.
  const normal=new Vector3(.45,.22,.87).normalize();
  return new Vector3(...MOON_POSITION).addScaledVector(normal,MOON_RADIUS*3.4);
}

/** Swept contact against the actual heightfield, including crossings whose two
 * endpoints are outside the moon. Work is restricted to its bounding sphere. */
export function constrainMoonStep(previous,proposed,clearance=3.2) {
  const center=new Vector3(...MOON_POSITION),start=previous.clone().sub(center),delta=proposed.clone().sub(previous);
  const length=delta.length(),bound=MOON_RADIUS+MOON_MAX_HEIGHT+clearance;
  const distanceAt=t=>{
    const local=start.clone().addScaledVector(delta,t),r=local.length();
    if(r<1)return -MOON_RADIUS;
    local.divideScalar(r);return r-MOON_RADIUS-moonSurface(local.x,local.y,local.z).height-clearance;
  };
  const contact=t=>{
    const d=start.clone().addScaledVector(delta,t);if(d.lengthSq()<1)d.set(0,0,1);d.normalize();
    return {point:d.clone().multiplyScalar(MOON_RADIUS+moonSurface(d.x,d.y,d.z).height+clearance).add(center),hit:true,t};
  };
  if(start.length()<bound&&distanceAt(0)<=0)return contact(0);
  if(length===0)return {point:proposed,hit:false};
  const ray=delta.clone().divideScalar(length),b=start.dot(ray),c=start.lengthSq()-bound*bound,disc=b*b-c;
  if(disc<0)return {point:proposed,hit:false};
  const root=Math.sqrt(disc),entry=Math.max(0,(-b-root)/length),exit=Math.min(1,(-b+root)/length);
  if(exit<entry||exit<0||entry>1)return {point:proposed,hit:false};
  // A conservative slope allowance covers overlapping crater rims and gravel.
  // If the work budget is exhausted on a grazing ray, stop at the checked point
  // rather than allow the unexamined remainder to tunnel through the terrain.
  let t=entry,last=t;
  for(let i=0;i<4096&&t<=exit;i++){
    const height=distanceAt(t);
    if(height<=.002){
      let lo=last,hi=t;
      for(let j=0;j<24;j++){const mid=(lo+hi)/2;if(distanceAt(mid)>0)lo=mid;else hi=mid;}
      return contact(hi);
    }
    if(t===exit)break;
    last=t;t=Math.min(exit,t+Math.min(250,height/20)/length);
  }
  if(t<exit)return {point:previous.clone().addScaledVector(delta,t),hit:false,limited:true};
  return {point:proposed,hit:false};
}
