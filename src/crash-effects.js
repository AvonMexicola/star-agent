import * as THREE from 'three';

// Small, procedural effect: all instance positions are local metres. Standard
// Three materials retain the scene's logarithmic-depth shader convention.
export class CrashEffects {
  constructor(scene) {
    this.group = new THREE.Group();this.group.visible=false;scene.add(this.group);
    this.anchor = new THREE.Vector3();this.current=null;this.time=0;
    this.object=new THREE.Object3D();
    this.flash=new THREE.Mesh(new THREE.SphereGeometry(1,16,12),new THREE.MeshBasicMaterial({color:new THREE.Color(4,1.1,.2),transparent:true,opacity:0,depthWrite:false,blending:THREE.AdditiveBlending}));
    this.debris=new THREE.InstancedMesh(new THREE.TetrahedronGeometry(1),new THREE.MeshBasicMaterial({color:0xf49738,transparent:true}),36);
    this.smoke=new THREE.InstancedMesh(new THREE.SphereGeometry(1,8,6),new THREE.MeshBasicMaterial({color:0x252326,transparent:true,depthWrite:false}),14);
    this.debris.frustumCulled=this.smoke.frustumCulled=false;
    this.group.add(this.flash,this.debris,this.smoke);
    this.velocities=Array.from({length:36},(_,i)=>{
      const angle=i*2.399963, speed=4+(i*7%13);
      return new THREE.Vector3(Math.cos(angle)*speed,3+(i*11%12),Math.sin(angle)*speed);
    });
  }
  update(crash, origin, dt) {
    if(!crash){this.group.visible=false;this.current=null;return false;}
    const started=crash!==this.current;
    if(started){
      this.current=crash;this.time=0;this.anchor.fromArray(crash.position);
      this.group.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),new THREE.Vector3(...crash.normal));
    }
    this.time+=Math.max(0,dt);const t=this.time;
    this.group.position.copy(this.anchor).sub(origin);this.group.visible=t<12;
    if(!this.group.visible)return started;
    this.flash.visible=t<.65;this.flash.scale.setScalar(1+10*t);this.flash.material.opacity=Math.max(0,.75*(1-t/.65));
    this.debris.visible=t<4;this.debris.material.opacity=Math.max(0,1-t/4);
    for(let i=0;i<this.debris.count;i++){
      const v=this.velocities[i];this.object.position.copy(v).multiplyScalar(t);this.object.position.y=Math.max(-2,this.object.position.y-4.9*t*t);
      this.object.rotation.set(i+t*3,i*.3+t*2,0);this.object.scale.setScalar(.12+(i%4)*.09);this.object.updateMatrix();this.debris.setMatrixAt(i,this.object.matrix);
    }
    this.debris.instanceMatrix.needsUpdate=true;
    this.smoke.material.opacity=Math.max(0,.4*(1-t/12));
    for(let i=0;i<this.smoke.count;i++){
      const angle=i*2.399963,r=1+(i%4)*.8;
      this.object.position.set(Math.cos(angle)*r*(1+t*.2),i*.35+t*(1+i*.07),Math.sin(angle)*r*(1+t*.2));
      this.object.scale.setScalar(.6+t*.35+(i%3)*.3);this.object.updateMatrix();this.smoke.setMatrixAt(i,this.object.matrix);
    }
    this.smoke.instanceMatrix.needsUpdate=true;
    return started;
  }
}

export function playCrashSound(audio) {
  // Reuse only the context explicitly enabled by the player's sound button.
  if(!audio.enabled||!audio.context||audio.context.state!=='running')return;
  const context=audio.context,time=context.currentTime;
  const buffer=context.createBuffer(1,context.sampleRate,context.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*Math.exp(-i/context.sampleRate*6);
  const noise=context.createBufferSource(),filter=context.createBiquadFilter(),gain=context.createGain();
  noise.buffer=buffer;filter.type='lowpass';filter.frequency.setValueAtTime(1000,time);filter.frequency.exponentialRampToValueAtTime(70,time+.8);
  gain.gain.setValueAtTime(.45,time);gain.gain.exponentialRampToValueAtTime(.001,time+.95);
  noise.connect(filter);filter.connect(gain);gain.connect(audio.master);
  noise.onended=()=>{noise.disconnect();filter.disconnect();gain.disconnect();};noise.start(time);noise.stop(time+1);
}
