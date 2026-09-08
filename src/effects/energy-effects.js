import * as THREE from 'three';
import { ParticlePool, additive } from './particles.js';
import { Slipstream } from './slipstream.js';
import { weaponProfile } from './weapons.js';
import { ENGINE_EXHAUST } from './engine-state.js';

const ZERO=new THREE.Vector3(),Z=new THREE.Vector3(0,0,1);
const CYAN=new THREE.Color(.12,1.3,2.8),MINT=new THREE.Color(.18,2.3,1.2);
const ORE=[new THREE.Color(.75,.85,1),new THREE.Color(2.4,.68,.12),new THREE.Color(.5,1.6,2.5)];
const clamp=THREE.MathUtils.clamp;

export class Plasma {
  constructor(scene,jet=false){
    const geometry=new THREE.CylinderGeometry(1,1,1,24,32,true);
    geometry.rotateX(Math.PI/2);geometry.translate(0,0,.5);
    this.material=new THREE.ShaderMaterial({...additive,side:THREE.DoubleSide,uniforms:{time:{value:0},jet:{value:jet?1:0},power:{value:1},color:{value:jet?CYAN.clone():MINT.clone()}},vertexShader:`
      varying vec2 vUv;uniform float jet;uniform float time;uniform float power;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vUv=uv;vec3 p=position;
        float z=p.z;float taper=mix(1.0,pow(max(.001,1.0-z),.65),jet);
        float diamonds=1.0-.26*jet*(.5+.5*cos(z*38.0-time*2.0));
        p.xy*=taper*diamonds*(1.0+.035*sin(z*90.0-time*47.0));
        vec4 mvPosition=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mvPosition;
        #include <logdepthbuf_vertex>
      }`,fragmentShader:`
      varying vec2 vUv;uniform float time;uniform float jet;uniform float power;uniform vec3 color;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float z=1.0-vUv.y;
        float noise=sin(vUv.x*69.0+z*117.0-time*34.0)*sin(z*63.0-time*53.0);
        float flow=.72+.28*sin(z*150.0-time*48.0+vUv.x*19.0);
        float diamonds=pow(.5+.5*cos(z*38.0-time*2.0),8.0);
        float fade=mix(1.0,pow(max(0.0,1.0-z),1.2),jet);
        float a=fade*(.26+flow*.2+diamonds*jet*.45+noise*.055)*power;
        if(a<.003)discard;
        gl_FragColor=vec4(color+vec3(diamonds*jet*2.5),a);
      }`});
    this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
  }
  set(start,end,radius,origin,time,power=1){
    const delta=end.clone().sub(start),length=delta.length();
    this.mesh.visible=length>.001&&power>.005;
    this.mesh.position.copy(start).sub(origin);this.mesh.quaternion.setFromUnitVectors(Z,delta.normalize());this.mesh.scale.set(radius,radius,length);
    this.material.uniforms.time.value=time;this.material.uniforms.power.value=power;
  }
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();}
}

/** Presentation effects and optional sound events. Gameplay owns damage and inventory. */
export class EnergyEffects {
  constructor(scene,{capacity=2048,reducedMotion=false,seed=7291,onSound=null}={}){
    this.onSound=onSound;this.scene=scene;
    this.particles=new ParticlePool(scene,capacity);this.time=0;this.seed=seed;this.reducedMotion=reducedMotion;
    this.slipstream=new Slipstream(scene);
    this.lances=Array.from({length:6},()=>({shell:new Plasma(scene),core:new Plasma(scene),active:false}));
    this.beam=new Plasma(scene);this.jets=[];
    this.light=new THREE.PointLight(0x88ffd4,0,7,2);scene.add(this.light);
    this.nozzles=[];this.engineProfile=null;this.engineId=null;
    this.engine={shipId:null,state:'off',throttle:0,forwardThrottle:0,signedForwardDemand:0,boost:false,activeEmitters:0};
    this.bolts=[];this.boost=0;this.throttle=0;this.travel=0;this.carries={};
    this._p=new THREE.Vector3();this._v=new THREE.Vector3();this._collector=new THREE.Vector3();
    this._previousOrigin=null;this.miningContacts=0;this.collectedBursts=0;this.weaponShots=0;this.weaponImpacts=0;this.lastWeapon='pulse';
  }
  clearEngines(){
    this.boost=0;this.throttle=0;this.engine.activeEmitters=0;
    for(const particle of this.particles.slots)if(particle.engine)particle.alive=false;
    for(const jet of this.jets)jet.mesh.visible=false;
    for(const key of Object.keys(this.carries))if(key.startsWith('engine'))delete this.carries[key];
  }
  setExhaust(profile,shipId){
    if(profile===this.engineProfile&&shipId===this.engineId)return;
    this.clearEngines();this.engineProfile=profile;this.engineId=shipId;
    this.nozzles=profile.sockets.map(socket=>new THREE.Vector3(...socket.position));
    const count=profile.authoredCones?0:this.nozzles.length;
    while(this.jets.length>count)this.jets.pop().dispose();
    while(this.jets.length<count)this.jets.push(new Plasma(this.scene,true));
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  budget(key,rate,dt){const amount=(this.carries[key]??0)+rate*dt,n=Math.floor(amount);this.carries[key]=amount-n;return Math.min(n,120);}
  spray(point,normal,count,{color=0xffb45c,speed=4,size=.07,life=.65,kind=1,attract=false,gain=1,velocity=ZERO}={}){
    for(let i=0;i<count;i++){
      this._v.set(this.random()-.5,this.random()-.5,this.random()-.5).normalize();
      if(this._v.dot(normal)<0)this._v.negate();
      this._v.addScaledVector(normal,.4).multiplyScalar(speed*(.25+this.random()));
      this._v.add(velocity);
      this.particles.emit(point,this._v,{color,life:life*(.7+this.random()*.6),size:size*(.5+this.random()),kind,stretch:kind===1?.035:0,drag:attract?0:1.3,attract,gain});
    }
  }
  /** Called only after a successful save/mesh commit, never for an attempted cut. */
  collect(point,yields,normal=Z,{attract=true}={}){
    if(!yields?.some(n=>n>0))return;
    this.collectedBursts++;this.onSound?.({type:'collect',point});
    yields.forEach((amount,i)=>{if(amount>0)this.spray(point,normal,Math.min(18,Math.max(2,Math.ceil(amount*1100))),{color:ORE[i],speed:1.7,size:.065,life:1.5,kind:3,attract});});
  }
  impact(point,normal=Z,power=1,{color=0x6dcfff,kind='pulse'}={}){
    this.weaponImpacts++;this.onSound?.({type:'impact',point});
    this.spray(point,normal,Math.round(38*power),{speed:kind==='void'?14:9*Math.min(1,Math.sqrt(power)),color,size:.1*Math.min(1,Math.sqrt(power)),gain:2});
    this.spray(point,normal,Math.round(16*power),{speed:5,color:kind==='void'?0x64ffee:0xffa34e,size:.065,gain:2});
    this.particles.emit(point,ZERO,{color:kind==='pulse'&&color===0x6dcfff?CYAN:color,life:kind==='void'?.7:.32,size:1.5*power,kind:2,stretch:0,gain:kind==='pulse'?1:2});
    this.particles.emit(point,ZERO,{color:0xe9faff,life:.14,size:1.2*power,stretch:0,gain:4});
    if(kind==='void'){
      for(let i=0;i<3;i++)this.particles.emit(point,ZERO,{color:i%2?0x50ffec:color,life:.3+i*.17,size:(1+i*.6)*power,kind:2,stretch:0,gain:2});
      this.spray(point,normal,25,{speed:2,color,life:.8,size:.4,kind:0,gain:1.4});
    }
  }
  fire(start,direction,{hit=null,speed,range=1600,power,velocity=ZERO,weapon='pulse',color,sound=weapon,muzzle=true,muzzlePosition=null,size=1,pitch=1}={}){
    const profile=weaponProfile(weapon),kind=profile.kind;
    if(hit&&start.distanceTo(hit.point)>range)hit=null;
    speed??=profile.speed;power??=profile.power;
    const tint=color===undefined?(kind==='pulse'?CYAN.clone():new THREE.Color(profile.color).multiplyScalar(2)):new THREE.Color(color).multiplyScalar(2);
    if(this.bolts.length>=32)return;
    this.weaponShots++;this.lastWeapon=kind;this.onSound?.({type:'shot',weapon,sound,point:start,size,pitch});
    const end=hit?.point.clone()??start.clone().addScaledVector(direction,range);
    if(kind==='laser'){
      const lance=this.lances.find(l=>!l.active)??this.lances[0];
      Object.assign(lance,{active:true,start:start.clone(),end,age:0,life:muzzlePosition ? .06 : .22,power,tint,muzzlePosition,fresh:Boolean(muzzlePosition)});
      lance.shell.material.uniforms.color.value.copy(tint);lance.core.material.uniforms.color.value.setRGB(3,2.8,2.2);
      if(hit)this.impact(end,hit.normal??direction.clone().negate(),power,{color:tint,kind});
      // Ionised motes peel from the length of the fired lance.
      const length=Math.min(80,start.distanceTo(end));
      for(let i=0;i<16;i++){const p=start.clone().addScaledVector(direction,length*i/16);this.spray(p,direction,1,{color:tint,speed:2,life:.28,size:.06});}
    }else this.bolts.push({start:start.clone(),p:start.clone(),direction:direction.clone().normalize(),velocity:velocity.clone(),age:0,speed,range,power,tint,kind,hit:hit?{point:hit.point.clone(),normal:hit.normal?.clone()??direction.clone().negate()}:null,travelled:0});
    if(muzzle){
      this.particles.emit(start,velocity,{anchor:muzzlePosition,color:kind==='pulse'&&color===undefined?0xbceaff:tint,life:.12,size:.6*power,stretch:0,gain:4});
      this.spray(start,direction,6,{color:tint,speed:3,size:.07,life:.2,velocity});
    }
  }
  reset(){
    this.particles.clear();this.bolts.length=0;this.carries={};this.boost=0;this.throttle=0;this.travel=0;
    this._particleOrigin=null;this.slipstream.reset();
    for(const l of this.lances){l.active=false;l.shell.mesh.visible=false;l.core.mesh.visible=false;}
    this.beam.mesh.visible=false;this.clearEngines();this.light.intensity=0;
  }
  update(dt,{origin,camera,shipPosition,shipQuaternion,velocity=ZERO,flying=false,inSpace=false,relativistic=false,boost=false,throttle=0,engine=null,exhaust=null,mining=null,collector=origin,suspended=false}={}){
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);this.time+=dt;
    const shipId=engine?.shipId??'nomad';
    this.setExhaust(exhaust??ENGINE_EXHAUST[shipId]??{sockets:[]},shipId);
    if(engine){shipPosition=engine.shipPosition;shipQuaternion=engine.shipQuaternion;velocity=engine.velocity;boost=engine.boost;throttle=engine.forwardThrottle;}
    const engineOn=!suspended&&!relativistic&&(engine?engine.active&&engine.flying:flying);
    Object.assign(this.engine,{shipId,state:engine?.state??(engineOn?(throttle>0?'forward':'idle'):'off'),throttle:engine?.throttle??throttle,
      forwardThrottle:throttle,signedForwardDemand:engine?.signedForwardDemand??throttle,boost:Boolean(boost&&engineOn)});
    // Quick transit/long camera jumps must not leave a line across the solar system.
    if(suspended||(this._previousOrigin&&origin.distanceTo(this._previousOrigin)>Math.max(2000,velocity.length()*dt*4)))this.reset();
    this._previousOrigin??=origin.clone();this._previousOrigin.copy(origin);
    if(suspended)return;
    if(this._particleOrigin){
      const delta=origin.clone().sub(this._particleOrigin);
      for(const p of this.particles.slots)if(p.alive&&p.cameraLocal)p.p.add(delta);
    }
    this._particleOrigin??=origin.clone();this._particleOrigin.copy(origin);
    this._collector.copy(collector);
    const emitting=Boolean(engineOn&&throttle>.001&&shipPosition&&shipQuaternion&&this.nozzles.length);
    if(!emitting)this.clearEngines();
    this.boost+=(Number(boost&&emitting)-this.boost)*(1-Math.exp(-dt*5));
    this.throttle+=(clamp(emitting?throttle:0,0,1)-this.throttle)*(1-Math.exp(-dt*9));
    const jetPower=emitting?this.throttle*(.86+this.boost*.9):0;
    this.engine.activeEmitters=emitting?this.nozzles.length:0;
    this.nozzles.forEach((nozzle,i)=>{
      if(!emitting)return;
      const start=nozzle.clone().applyQuaternion(shipQuaternion).add(shipPosition);
      const aft=Z.clone().applyQuaternion(shipQuaternion),length=this.engineProfile.length*(.2+this.throttle*.8)+this.boost*this.engineProfile.boostLength;
      const end=start.clone().addScaledVector(aft,length);
      this.jets[i]?.set(start,end,this.engineProfile.radius*(1+this.boost*.15),origin,this.time,jetPower);
      const count=this.budget(`engine${i}`,(this.reducedMotion?12:45)*jetPower,dt);
      for(let n=0;n<count;n++){
        const pos=start.clone().addScaledVector(aft,this.random()*length*.7);
        const radial=new THREE.Vector3(this.random()-.5,this.random()-.5,0).multiplyScalar(this.engineProfile.radius*.65).applyQuaternion(shipQuaternion);
        pos.add(radial);
        this._v.copy(aft).multiplyScalar(10+this.boost*25).add(velocity);
        const particle=this.particles.emit(pos,this._v,{color:shipId==='kestrel'?MINT:CYAN,life:.12+this.random()*.15,size:(.04+this.random()*.06)*this.engineProfile.radius/.48,kind:1,stretch:.012,engine:true});
        // Exhaust inherits ship velocity, but trail length must stay local even at millions of m/s.
        particle.stretch=Math.min(particle.stretch,2/Math.max(1,this._v.length()));
      }
    });
    this.beam.mesh.visible=false;this.light.intensity=0;
    if(mining?.active){
      this.beam.set(mining.start,mining.end,.018,origin,this.time,.9);
      if(mining.hit){
        this.miningContacts++;
        const normal=mining.normal??mining.start.clone().sub(mining.end).normalize();
        const point=mining.end.clone().addScaledVector(normal,.035);
        this.spray(point,normal,this.budget('sparks',this.reducedMotion?28:130,dt),{color:0xffbb5b,speed:3.5,size:.035,gain:2});
        this.spray(point,normal,this.budget('dust',25,dt),{color:MINT,speed:.45,size:.12,life:.35,kind:0});
        this.particles.emit(point,ZERO,{color:MINT,life:.065,size:.33,stretch:0,gain:1.5});
        this.light.position.copy(point).sub(origin);this.light.intensity=5;
      }
    }
    for(const l of this.lances){
      if(!l.active)continue;if(l.fresh)l.fresh=false;else l.age+=dt;
      if(l.age>=l.life){l.active=false;l.shell.mesh.visible=false;l.core.mesh.visible=false;continue;}
      if(l.muzzlePosition){const start=l.muzzlePosition();if(!start){l.active=false;l.shell.mesh.visible=false;l.core.mesh.visible=false;continue;}l.start.copy(start);}
      const fade=Math.pow(1-l.age/l.life,.5);
      l.shell.set(l.start,l.end,.11*l.power,origin,this.time,fade*1.4);
      l.core.set(l.start,l.end,.025*l.power,origin,this.time,fade*2);
    }
    for(let i=this.bolts.length-1;i>=0;i--){
      const b=this.bolts[i],worldVelocity=b.direction.clone().multiplyScalar(b.speed).add(b.velocity),step=worldVelocity.length()*dt;b.age+=dt;b.travelled+=step;
      const hitDistance=b.hit?b.start.distanceTo(b.hit.point):Infinity;
      if(b.travelled>=hitDistance){this.impact(b.hit.point,b.hit.normal,b.power,{color:b.tint,kind:b.kind});this.bolts.splice(i,1);continue;}
      if(b.travelled>b.range||b.age>b.range/b.speed+.5){this.bolts.splice(i,1);continue;}
      b.p.copy(b.start).addScaledVector(worldVelocity,b.age);
      this._v.copy(worldVelocity);
      if(b.kind==='void'){
        this.particles.emit(b.p,ZERO,{color:b.tint,life:.08,size:.85*b.power,stretch:0,gain:2});
        const rotation=new THREE.Quaternion().setFromUnitVectors(Z,b.direction);
        for(let j=0;j<3;j++){
          const phase=b.age*23+j*Math.PI*2/3;
          const offset=new THREE.Vector3(Math.cos(phase),Math.sin(phase),0).multiplyScalar(.45*b.power).applyQuaternion(rotation);
          this.particles.emit(b.p.clone().add(offset),ZERO,{color:j?b.tint:0x62ffee,life:.23,size:.13*b.power,stretch:0,gain:2});
        }
      }else this.particles.emit(b.p,this._v,{color:b.tint,life:.045,size:.12*b.power,kind:1,stretch:Math.min(.025,b.travelled/b.speed),gain:3});
    }
    const speed=velocity.length(),targetTravel=flying&&inSpace&&!relativistic&&!this.reducedMotion?clamp(Math.log10(Math.max(1,speed)/25)/3,0,1):0;
    this.travel+=(targetTravel-this.travel)*(1-Math.exp(-dt*3));
    // Ordinary velocity never generates an energy tunnel. TravelEffects owns
    // the sole relativistic tunnel; this layer supplies sparse space dust.
    this.slipstream.update({origin,eye:origin.clone().add(camera?.position??ZERO),velocity,intensity:0,time:this.time,reducedMotion:this.reducedMotion},dt);
    if(this.travel>.01&&camera&&inSpace&&!relativistic&&flying){
      // A camera-local dust neighborhood, aligned with actual velocity (including reverse/strafe).
      const forward=velocity.clone().normalize(),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      const count=this.budget('travel',this.travel*340,dt);
      for(let i=0;i<count;i++){
        const angle=this.random()*Math.PI*2,r=9+this.random()*55;
        const pos=origin.clone().addScaledVector(forward,90+this.random()*80).addScaledVector(right,Math.cos(angle)*r).addScaledVector(up,Math.sin(angle)*r);
        this._v.copy(forward).multiplyScalar(-100-this.travel*240);
        const p=this.particles.emit(pos,this._v,{color:i%5?0xb8c4cf:0xe0e8ef,life:.65,size:.06+this.travel*.12,kind:1,stretch:.02+this.travel*.06,gain:.8});
        p.cameraLocal=true;
      }
    }
    this.particles.update(dt,origin,this._collector);
  }
  get state(){return {engine:{...this.engine,nozzleCount:this.nozzles.length,activeJets:this.jets.filter(jet=>jet.mesh.visible).length,particles:this.particles.slots.filter(p=>p.alive&&p.engine).length,authoredCones:Boolean(this.engineProfile?.authoredCones)},spaceDust:this.particles.slots.filter(p=>p.alive&&p.cameraLocal).length,particles:this.particles.count,capacity:this.particles.capacity,boost:this.boost,travel:this.travel,bolts:this.bolts.length,miningContacts:this.miningContacts,collectedBursts:this.collectedBursts,weaponShots:this.weaponShots,weaponImpacts:this.weaponImpacts,lastWeapon:this.lastWeapon,lances:this.lances.filter(l=>l.active).length,slipstream:this.slipstream.material.uniforms.drive.value,reducedMotion:this.reducedMotion};}
  dispose(){this.slipstream.dispose();this.lances.forEach(l=>{l.shell.dispose();l.core.dispose();});this.particles.dispose();this.beam.dispose();this.jets.forEach(j=>j.dispose());this.light.removeFromParent();}
}
