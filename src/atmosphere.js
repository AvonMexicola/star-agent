import * as THREE from 'three';
import { RADIUS, ATMOSPHERE_HEIGHT, SUN_RADIUS, SUN_ANGULAR_RADIUS } from './world.js';
import { createCloudNoise, cloudShader } from './cloud-volume.js';

// Single-scattering integration in body-radius units. Rayleigh + Henyey-Greenstein
// Mie scattering, exponential density, sunlight extinction and planet shadow.
// Atmosphere slots: 0 Aeon, 1 Pyre, 2 Miasma. A slot is skipped when the camera is more than
// ATMOSPHERE_RANGE body radii away; distant bodies are painted as points instead.
export const ATMOSPHERE_SLOTS = 3, POINT_BODIES = 2, ATMOSPHERE_RANGE = 400;
export const AEON_ATMOSPHERE = Object.freeze({
  height: ATMOSPHERE_HEIGHT, scaleHeight: 8000, mieScaleHeight: 1200,
  betaR: Object.freeze([5.802e-6, 13.558e-6, 33.100e-6]), betaM: Object.freeze([3.996e-6, 3.996e-6, 3.996e-6]), g: .76, gain: 11,
});
const fragmentShader=`
precision highp float;
uniform sampler2D sceneColor;
uniform sampler2D sceneDepth;
uniform mat4 inverseProjection;
uniform mat3 cameraRotation;
uniform vec3 cameraPlanet;
uniform vec3 sunDirection;
uniform vec2 resolution;
uniform float logFar;
uniform float radius;
uniform float atmosphereRadius;
uniform float exposure;
uniform float sunAngularRadius;
uniform float sunDisk;
uniform int atmoOrder[${ATMOSPHERE_SLOTS}];
uniform vec3 atmoCamera[${ATMOSPHERE_SLOTS}];
uniform float atmoRadius[${ATMOSPHERE_SLOTS}];
uniform float atmoOuter[${ATMOSPHERE_SLOTS}];
uniform vec3 atmoBetaR[${ATMOSPHERE_SLOTS}];
uniform vec3 atmoBetaM[${ATMOSPHERE_SLOTS}];
uniform vec2 atmoScale[${ATMOSPHERE_SLOTS}];
uniform vec2 atmoPhase[${ATMOSPHERE_SLOTS}];
uniform float atmoEnabled[${ATMOSPHERE_SLOTS}];
uniform vec3 pointDirection[${POINT_BODIES}];
uniform vec3 pointColor[${POINT_BODIES}];
uniform float pointSize[${POINT_BODIES}];
varying vec2 vUv;
const float PI=3.14159265359;
vec2 sphere(vec3 ro,vec3 rd,float r){float b=dot(ro,rd);float c=dot(ro,ro)-r*r;float d=b*b-c;if(d<0.0)return vec2(1e10,-1e10);float s=sqrt(d);return vec2(-b-s,-b+s);}
vec2 densityAt(vec3 p,float bodyRadius,vec2 scale){float h=max(0.0,(length(p)-1.0)*bodyRadius);return vec2(exp(-h/scale.x),exp(-h/scale.y));}
vec2 density(vec3 p){return densityAt(p,radius,vec2(8000.0,1200.0));}
float hash(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}
vec3 stars(vec3 rd){
  vec3 p=rd*950.0;vec3 cell=floor(p);vec3 f=fract(p)-.5;
  float h=hash(cell);
  float s=smoothstep(.9990,1.0,h)*exp(-dot(f,f)*38.0);
  vec3 color=mix(vec3(.52,.68,1.0),vec3(1.0,.82,.60),hash(cell+24.0));
  float milky=pow(max(0.0,1.0-abs(dot(rd,normalize(vec3(.4,.7,-.2))))),18.0);
  return color*s*2.5+vec3(.0015,.0020,.0035)+vec3(.004,.006,.009)*milky;
}
vec3 aces(vec3 x){return clamp((x*(2.51*x+.03))/(x*(2.43*x+.59)+.14),0.0,1.0);}
${cloudShader}
// One body's single-scattering contribution along the view ray (body-radius units).
vec3 scatter(vec3 color,vec3 ro,vec3 rd,float distanceToScene,float bodyRadius,float outer,vec3 betaR,vec3 betaM,vec2 scale,vec2 phase){
  vec2 hit=sphere(ro,rd,outer);
  float start=max(0.0,hit.x),finish=min(distanceToScene,hit.y);
  if(finish>start && hit.y>0.0){
    vec2 planetHit=sphere(ro,rd,1.0);
    if(planetHit.x>0.0)finish=min(finish,planetHit.x);
    float stepSize=(finish-start)/16.0;
    vec2 optical=vec2(0.0);vec3 sumR=vec3(0.0),sumM=vec3(0.0);
    for(int i=0;i<16;i++){
      vec3 samplePos=ro+rd*(start+(float(i)+.5)*stepSize);
      vec2 local=densityAt(samplePos,bodyRadius,scale)*stepSize*bodyRadius;
      optical+=local*.5;
      vec2 sunHit=sphere(samplePos,sunDirection,outer);
      vec2 occluder=sphere(samplePos,sunDirection,1.0);
      if(occluder.x<=0.0){
        float lightStep=max(0.0,sunHit.y)/6.0;vec2 lightDepth=vec2(0.0);
        for(int j=0;j<6;j++)lightDepth+=densityAt(samplePos+sunDirection*(float(j)+.5)*lightStep,bodyRadius,scale)*lightStep*bodyRadius;
        vec3 trans=exp(-(betaR*(optical.x+lightDepth.x)+betaM*1.1*(optical.y+lightDepth.y)));
        sumR+=local.x*trans;sumM+=local.y*trans;
      }
      optical+=local*.5;
    }
    float mu=dot(rd,sunDirection);
    float phaseR=3.0/(16.0*PI)*(1.0+mu*mu);
    float g=phase.x;
    float phaseM=3.0/(8.0*PI)*((1.0-g*g)*(1.0+mu*mu))/((2.0+g*g)*pow(max(.001,1.0+g*g-2.0*g*mu),1.5));
    vec3 extinction=exp(-(betaR*optical.x+betaM*1.1*optical.y));
    vec3 inscatter=phase.y*(sumR*betaR*phaseR+sumM*betaM*phaseM);
    color=color*extinction+inscatter;
  }
  return color;
}
void main(){
  vec4 p=inverseProjection*vec4(vUv*2.0-1.0,1.0,1.0);
  // Direction does not need the homogeneous divide. At astronomical far planes
  // float32 rounds p.w to zero, so dividing would poison the sky with NaNs.
  vec3 viewRay=normalize(p.xyz);
  vec3 rd=normalize(cameraRotation*viewRay);
  float depth=texture2D(sceneDepth,vUv).r;
  bool ground=depth<.999999;
  float sceneMetres=(exp2(depth*logFar)-1.0)/max(.0001,-viewRay.z);
  float distanceToScene=ground?sceneMetres/radius:1e9;
  vec3 original=texture2D(sceneColor,vUv).rgb;
  float daylight=0.0;
  for(int i=0;i<${ATMOSPHERE_SLOTS};i++){
    if(atmoEnabled[i]<.5)continue;
    daylight=max(daylight,smoothstep(-.12,.2,dot(normalize(atmoCamera[i]),sunDirection))
      *exp(-max(0.0,length(atmoCamera[i])-1.0)*atmoRadius[i]/35000.0));
  }
  // Preserve additive corona light in space pixels even without opaque depth.
  vec3 color=ground?original:stars(rd)*(1.0-daylight)+original;
  float sunDot=dot(rd,sunDirection);
  // Physical photosphere radius: twice the previous angular size from Aeon.
  float disk=smoothstep(cos(sunAngularRadius*1.0417),cos(sunAngularRadius*.9583),sunDot)*sunDisk;
  if(!ground)color+=vec3(18.0,15.5,12.5)*disk;
  // Distant worlds as bright points with a soft halo; extinguished by the air like the star.
  if(!ground)for(int i=0;i<${POINT_BODIES};i++){
    if(pointSize[i]<=0.0)continue;
    float angle=acos(clamp(dot(rd,pointDirection[i]),-1.0,1.0));
    float core=1.0-smoothstep(pointSize[i]*.7,pointSize[i]*1.3,angle);
    float halo=exp(-(angle*angle)/(pointSize[i]*pointSize[i]*9.0))*.22;
    color+=pointColor[i]*(core+halo);
  }
  for(int i=0;i<${ATMOSPHERE_SLOTS};i++){
    int j=atmoOrder[i];
    if(atmoEnabled[j]<.5)continue;
    float bodyDistance=ground?sceneMetres/atmoRadius[j]:1e9;
    color=scatter(color,atmoCamera[j],rd,bodyDistance,atmoRadius[j],atmoOuter[j],atmoBetaR[j],atmoBetaM[j],atmoScale[j],atmoPhase[j]);
  }
  if(atmoEnabled[0]>=.5){
    vec4 clouds=cloudRadiance(cameraPlanet,rd,distanceToScene,sunDot);
    color=color*(1.0-clouds.a)+clouds.rgb;
  }
  color=aces(color*exposure);
  color=pow(color,vec3(1.0/2.2));
  float dither=(hash(vec3(gl_FragCoord.xy,0.0))-.5)/255.0;
  gl_FragColor=vec4(color+dither,1.0);
}
`;
export class Atmosphere {
  constructor(renderer){
    this.renderer=renderer;
    this.cloudNoise=createCloudNoise();
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
    this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    const slots=n=>Array.from({length:n});
    this.material=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{sceneColor:{value:this.target.texture},sceneDepth:{value:this.target.depthTexture},inverseProjection:{value:new THREE.Matrix4()},cameraRotation:{value:new THREE.Matrix3()},cameraPlanet:{value:new THREE.Vector3()},sunDirection:{value:new THREE.Vector3()},resolution:{value:new THREE.Vector2()},logFar:{value:1},radius:{value:RADIUS},atmosphereRadius:{value:1+ATMOSPHERE_HEIGHT/RADIUS},exposure:{value:1.08},sunAngularRadius:{value:SUN_ANGULAR_RADIUS},sunDisk:{value:1},
      atmoOrder:{value:[0,1,2]},atmoCamera:{value:slots(ATMOSPHERE_SLOTS).map(()=>new THREE.Vector3())},atmoRadius:{value:slots(ATMOSPHERE_SLOTS).map(()=>RADIUS)},atmoOuter:{value:slots(ATMOSPHERE_SLOTS).map(()=>1)},
      atmoBetaR:{value:slots(ATMOSPHERE_SLOTS).map(()=>new THREE.Vector3())},atmoBetaM:{value:slots(ATMOSPHERE_SLOTS).map(()=>new THREE.Vector3())},atmoScale:{value:slots(ATMOSPHERE_SLOTS).map(()=>new THREE.Vector2(8000,1200))},atmoPhase:{value:slots(ATMOSPHERE_SLOTS).map(()=>new THREE.Vector2(.76,11))},atmoEnabled:{value:slots(ATMOSPHERE_SLOTS).map(()=>0)},
      pointDirection:{value:slots(POINT_BODIES).map(()=>new THREE.Vector3(0,0,1))},pointColor:{value:slots(POINT_BODIES).map(()=>new THREE.Vector3())},pointSize:{value:slots(POINT_BODIES).map(()=>0)}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader});
    this.material.uniforms.cloudNoise={value:this.cloudNoise};this.material.uniforms.cloudTime={value:0};
    this.scene=new THREE.Scene();const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);quad.frustumCulled=false;this.scene.add(quad);this.camera=new THREE.Camera();
    this.setBody(0,[0,0,0],RADIUS,AEON_ATMOSPHERE);
  }
  /** Assign an atmosphere slot: body centre (world metres), radius and its parameter object. */
  setBody(slot,center,radius,atmosphere){
    const u=this.material.uniforms;
    u.atmoRadius.value[slot]=radius;u.atmoOuter.value[slot]=1+atmosphere.height/radius;
    u.atmoBetaR.value[slot].fromArray(atmosphere.betaR);u.atmoBetaM.value[slot].fromArray(atmosphere.betaM);
    u.atmoScale.value[slot].set(atmosphere.scaleHeight,atmosphere.mieScaleHeight);u.atmoPhase.value[slot].set(atmosphere.g,atmosphere.gain);
    this.bodies=this.bodies||[];this.bodies[slot]={center:new THREE.Vector3(...center),radius};
  }
  /** Paint a distant world as a point: unit direction, HDR colour, angular radius (0 hides it). */
  setPoint(index,direction,color,size){
    const u=this.material.uniforms;u.pointDirection.value[index].copy(direction);u.pointColor.value[index].fromArray(color);u.pointSize.value[index]=size;
  }
  setSun(sun){this.material.uniforms.sunDisk.value=sun.diskWeight;}
  resize(w,h){this.target.setSize(w,h);this.material.uniforms.resolution.value.set(w,h);}
  render(scene,camera,worldPosition,sunDirection,elapsed=0,sunDistance=null){
    camera.updateMatrixWorld();const u=this.material.uniforms;
    u.cloudTime.value=elapsed;
    u.inverseProjection.value.copy(camera.projectionMatrixInverse);u.cameraRotation.value.setFromMatrix4(camera.matrixWorld);u.cameraPlanet.value.copy(worldPosition).multiplyScalar(1/RADIUS);u.sunDirection.value.copy(sunDirection);u.logFar.value=Math.log2(camera.far+1);
    u.sunAngularRadius.value=sunDistance?Math.asin(Math.min(1,SUN_RADIUS/Math.max(SUN_RADIUS,sunDistance))):SUN_ANGULAR_RADIUS;
    for(let i=0;i<ATMOSPHERE_SLOTS;i++){
      const body=this.bodies[i];
      if(!body){u.atmoEnabled.value[i]=0;continue;}
      u.atmoCamera.value[i].copy(worldPosition).sub(body.center).multiplyScalar(1/body.radius);
      u.atmoEnabled.value[i]=u.atmoCamera.value[i].length()<ATMOSPHERE_RANGE?1:0;
    }
    // Distinct non-overlapping atmospheres composite from far to near, including
    // Miasma seen through Pyre's foreground air and Pyre seen from Miasma.
    u.atmoOrder.value.sort((a,b)=>u.atmoCamera.value[b].length()*u.atmoRadius.value[b]-u.atmoCamera.value[a].length()*u.atmoRadius.value[a]);
    this.renderer.setRenderTarget(this.target);this.renderer.setClearColor(0x000000,1);this.renderer.clear();this.renderer.render(scene,camera);
    this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.target.dispose();this.cloudNoise.dispose();this.material.dispose();this.scene.children[0].geometry.dispose();}
}
