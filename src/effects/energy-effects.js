import * as THREE from 'three';
import { ParticlePool, additive } from './particles.js';

const ZERO=new THREE.Vector3(),Z=new THREE.Vector3(0,0,1);
const CYAN=new THREE.Color(.12,1.3,2.8),MINT=new THREE.Color(.18,2.3,1.2);
const ORE=[new THREE.Color(.75,.85,1),new THREE.Color(2.4,.68,.12),new THREE.Color(.5,1.6,2.5)];
const clamp=THREE.MathUtils.clamp;

class Plasma {
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

/** Visual effects only. Damage and inventory remain owned by gameplay modules. */
export class EnergyEffects {
  constructor(scene,{capacity=2048,reducedMotion=false,seed=7291}={}){
    this.particles=new ParticlePool(scene,capacity);this.time=0;this.seed=seed;this.reducedMotion=reducedMotion;
    this.beam=new Plasma(scene);this.jets=[new Plasma(scene,true),new Plasma(scene,true)];
    this.light=new THREE.PointLight(0x88ffd4,0,7,2);scene.add(this.light);
    this.nozzles=[new THREE.Vector3(-2.56,1.86,4.08),new THREE.Vector3(2.56,1.86,4.08)];
    this.bolts=[];this.boost=0;this.throttle=0;this.travel=0;this.carries={};
    this._p=new THREE.Vector3();this._v=new THREE.Vector3();this._collector=new THREE.Vector3();
    this._previousOrigin=null;this.miningContacts=0;this.collectedBursts=0;this.weaponShots=0;
  }
  random(){this.seed=(Math.imul(this.seed,1664525)+1013904223)>>>0;return this.seed/4294967296;}
  budget(key,rate,dt){const amount=(this.carries[key]??0)+rate*dt,n=Math.floor(amount);this.carries[key]=amount-n;return Math.min(n,120);}
  spray(point,normal,count,{color=0xffb45c,speed=4,size=.07,life=.65,kind=1,attract=false,gain=1}={}){
    for(let i=0;i<count;i++){
      this._v.set(this.random()-.5,this.random()-.5,this.random()-.5).normalize();
      if(this._v.dot(normal)<0)this._v.negate();
      this._v.addScaledVector(normal,.4).multiplyScalar(speed*(.25+this.random()));
      this.particles.emit(point,this._v,{color,life:life*(.7+this.random()*.6),size:size*(.5+this.random()),kind,stretch:kind===1?.035:0,drag:attract?0:1.3,attract,gain});
    }
  }
  /** Called only after a successful save/mesh commit, never for an attempted cut. */
  collect(point,yields,normal=Z){
    if(!yields?.some(n=>n>0))return;
    this.collectedBursts++;
    yields.forEach((amount,i)=>{if(amount>0)this.spray(point,normal,Math.min(18,Math.max(2,Math.ceil(amount*1100))),{color:ORE[i],speed:1.7,size:.065,life:1.5,kind:3,attract:true});});
  }
  impact(point,normal=Z,power=1){
    this.spray(point,normal,Math.round(38*power),{speed:9,color:0x6dcfff,size:.1,gain:2});
    this.spray(point,normal,Math.round(16*power),{speed:5,color:0xffa34e,size:.065,gain:2});
    this.particles.emit(point,ZERO,{color:CYAN,life:.32,size:1.5*power,kind:2,stretch:0});
    this.particles.emit(point,ZERO,{color:0xe9faff,life:.14,size:1.2*power,stretch:0,gain:4});
  }
  fire(start,direction,{hit=null,speed=450,range=1600,power=1,velocity=ZERO}={}){
    if(this.bolts.length>=32)return;
    this.weaponShots++;
    this.bolts.push({start:start.clone(),p:start.clone(),direction:direction.clone().normalize(),velocity:velocity.clone(),age:0,speed,range,power,hit:hit?{point:hit.point.clone(),normal:hit.normal?.clone()??direction.clone().negate()}:null,travelled:0});
    this.particles.emit(start,ZERO,{color:0xbceaff,life:.12,size:.6*power,stretch:0,gain:4});
    this.spray(start,direction,6,{color:CYAN,speed:3,size:.07,life:.2});
  }
  reset(){
    this.particles.clear();this.bolts.length=0;this.carries={};this.boost=0;this.throttle=0;this.travel=0;
    this._particleOrigin=null;
    this.beam.mesh.visible=false;for(const jet of this.jets)jet.mesh.visible=false;this.light.intensity=0;
  }
  update(dt,{origin,camera,shipPosition,shipQuaternion,velocity=ZERO,flying=false,boost=false,throttle=0,mining=null,collector=origin,suspended=false}={}){
    dt=clamp(Number.isFinite(dt)?dt:0,0,.1);this.time+=dt;
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
    this.boost+=(Number(boost&&flying)-this.boost)*(1-Math.exp(-dt*5));
    this.throttle+=(clamp(flying?throttle:0,0,1)-this.throttle)*(1-Math.exp(-dt*9));
    const jetPower=flying?(.16+this.throttle*.7+this.boost*.9):0;
    this.jets.forEach((jet,i)=>{
      if(!flying||!shipPosition||!shipQuaternion){jet.mesh.visible=false;return;}
      const start=this.nozzles[i].clone().applyQuaternion(shipQuaternion).add(shipPosition);
      const aft=Z.clone().applyQuaternion(shipQuaternion),length=1.3+this.throttle*3+this.boost*8;
      const end=start.clone().addScaledVector(aft,length);
      jet.set(start,end,.37+this.boost*.12,origin,this.time,jetPower);
      const count=this.budget(`engine${i}`,(this.reducedMotion?12:45)*jetPower,dt);
      for(let n=0;n<count;n++){
        const pos=start.clone().addScaledVector(aft,this.random()*length*.7);
        this._v.copy(aft).multiplyScalar(10+this.boost*25).add(velocity);
        const particle=this.particles.emit(pos,this._v,{color:CYAN,life:.12+this.random()*.15,size:.04+this.random()*.06,kind:1,stretch:.012});
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
    for(let i=this.bolts.length-1;i>=0;i--){
      const b=this.bolts[i],step=b.speed*dt;b.age+=dt;b.travelled+=step;
      const hitDistance=b.hit?b.start.distanceTo(b.hit.point):Infinity;
      if(b.travelled>=hitDistance){this.impact(b.hit.point,b.hit.normal,b.power);this.bolts.splice(i,1);continue;}
      if(b.travelled>b.range||b.age>4){this.bolts.splice(i,1);continue;}
      b.p.copy(b.start).addScaledVector(b.direction,b.travelled).addScaledVector(b.velocity,b.age);
      this._v.copy(b.direction).multiplyScalar(b.speed);
      this.particles.emit(b.p,this._v,{color:CYAN,life:.045,size:.12*b.power,kind:1,stretch:.025,gain:3});
    }
    const speed=velocity.length(),targetTravel=flying&&!this.reducedMotion?clamp(Math.log10(Math.max(1,speed)/350)/2.5,0,1):0;
    this.travel+=(targetTravel-this.travel)*(1-Math.exp(-dt*3));
    if(this.travel>.01&&camera){
      // A camera-local dust neighborhood, aligned with actual velocity (including reverse/strafe).
      const forward=velocity.clone().normalize(),right=new THREE.Vector3(1,0,0).applyQuaternion(camera.quaternion),up=new THREE.Vector3(0,1,0).applyQuaternion(camera.quaternion);
      const count=this.budget('travel',this.travel*340,dt);
      for(let i=0;i<count;i++){
        const angle=this.random()*Math.PI*2,r=9+this.random()*55;
        const pos=origin.clone().addScaledVector(forward,90+this.random()*80).addScaledVector(right,Math.cos(angle)*r).addScaledVector(up,Math.sin(angle)*r);
        this._v.copy(forward).multiplyScalar(-100-this.travel*240);
        const p=this.particles.emit(pos,this._v,{color:i%5?0x519bde:0xb3cfff,life:.65,size:.14+this.travel*.3,kind:1,stretch:.04+this.travel*.16,gain:1.6});
        p.cameraLocal=true;
      }
    }
    this.particles.update(dt,origin,this._collector);
  }
  get state(){return {particles:this.particles.count,capacity:this.particles.capacity,boost:this.boost,travel:this.travel,bolts:this.bolts.length,miningContacts:this.miningContacts,collectedBursts:this.collectedBursts,weaponShots:this.weaponShots,reducedMotion:this.reducedMotion};}
  dispose(){this.particles.dispose();this.beam.dispose();this.jets.forEach(j=>j.dispose());this.light.removeFromParent();}
}
