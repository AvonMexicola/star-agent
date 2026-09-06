import * as THREE from 'three';
import { RADIUS, ATMOSPHERE_HEIGHT } from './world.js';
import { createCloudNoise, cloudShader } from './cloud-volume.js';
import { EnergyBloom } from './effects/bloom.js';

// Single-scattering integration in planet-radius units. Rayleigh + Henyey-Greenstein
// Mie scattering, exponential density, sunlight extinction and planet shadow.
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
uniform sampler2D bloomNear;
uniform sampler2D bloomMid;
uniform sampler2D bloomWide;
uniform float bloomStrength;
varying vec2 vUv;
const vec3 BETA_R=vec3(5.802e-6,13.558e-6,33.100e-6);
const vec3 BETA_M=vec3(3.996e-6);
const float PI=3.14159265359;
vec2 sphere(vec3 ro,vec3 rd,float r){float b=dot(ro,rd);float c=dot(ro,ro)-r*r;float d=b*b-c;if(d<0.0)return vec2(1e10,-1e10);float s=sqrt(d);return vec2(-b-s,-b+s);}
vec2 density(vec3 p){float h=max(0.0,(length(p)-1.0)*radius);return vec2(exp(-h/8000.0),exp(-h/1200.0));}
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
void main(){
  vec4 p=inverseProjection*vec4(vUv*2.0-1.0,1.0,1.0);
  // Direction does not need the homogeneous divide. At astronomical far planes
  // float32 rounds p.w to zero, so dividing would poison the sky with NaNs.
  vec3 viewRay=normalize(p.xyz);
  vec3 rd=normalize(cameraRotation*viewRay);
  float depth=texture2D(sceneDepth,vUv).r;
  bool ground=depth<.999999;
  float distanceToScene=ground?(exp2(depth*logFar)-1.0)/max(.0001,-viewRay.z)/radius:1e9;
  vec4 original=texture2D(sceneColor,vUv);
  float daylight=smoothstep(-.12,.2,dot(normalize(cameraPlanet),sunDirection))
    *exp(-max(0.0,length(cameraPlanet)-1.0)*radius/35000.0);
  // The HDR target is cleared transparent. Its color already contains the
  // premultiplied contribution of transparent rings and additive ice; retain
  // it over empty sky as well as over opaque geometry.
  float skyCoverage=1.0-clamp(original.a,0.0,1.0);
  vec3 color=original.rgb+stars(rd)*(1.0-daylight)*skyCoverage;
  float sunDot=dot(rd,sunDirection);
  // A 120,000-km stellar radius at 25 million km: angular radius 0.0048 rad.
  float disk=smoothstep(cos(.0050),cos(.0046),sunDot);
  if(!ground)color+=vec3(18.0,15.5,12.5)*disk*skyCoverage;
  vec2 hit=sphere(cameraPlanet,rd,atmosphereRadius);
  float start=max(0.0,hit.x),finish=min(distanceToScene,hit.y);
  if(finish>start && hit.y>0.0){
    vec2 planetHit=sphere(cameraPlanet,rd,1.0);
    if(planetHit.x>0.0)finish=min(finish,planetHit.x);
    float stepSize=(finish-start)/16.0;
    vec2 optical=vec2(0.0);vec3 sumR=vec3(0.0),sumM=vec3(0.0);
    for(int i=0;i<16;i++){
      vec3 samplePos=cameraPlanet+rd*(start+(float(i)+.5)*stepSize);
      vec2 local=density(samplePos)*stepSize*radius;
      optical+=local*.5;
      vec2 sunHit=sphere(samplePos,sunDirection,atmosphereRadius);
      vec2 occluder=sphere(samplePos,sunDirection,1.0);
      if(occluder.x<=0.0){
        float lightStep=max(0.0,sunHit.y)/6.0;vec2 lightDepth=vec2(0.0);
        for(int j=0;j<6;j++)lightDepth+=density(samplePos+sunDirection*(float(j)+.5)*lightStep)*lightStep*radius;
        vec3 trans=exp(-(BETA_R*(optical.x+lightDepth.x)+BETA_M*1.1*(optical.y+lightDepth.y)));
        sumR+=local.x*trans;sumM+=local.y*trans;
      }
      optical+=local*.5;
    }
    float mu=sunDot;
    float phaseR=3.0/(16.0*PI)*(1.0+mu*mu);
    float g=.76;
    float phaseM=3.0/(8.0*PI)*((1.0-g*g)*(1.0+mu*mu))/((2.0+g*g)*pow(max(.001,1.0+g*g-2.0*g*mu),1.5));
    vec3 extinction=exp(-(BETA_R*optical.x+BETA_M*1.1*optical.y));
    vec3 inscatter=11.0*(sumR*BETA_R*phaseR+sumM*BETA_M*phaseM);
    color=color*extinction+inscatter;
  }
  vec4 clouds=cloudRadiance(cameraPlanet,rd,distanceToScene,sunDot);
  color=color*(1.0-clouds.a)+clouds.rgb;
  color+=bloomStrength*(texture2D(bloomNear,vUv).rgb*.35+texture2D(bloomMid,vUv).rgb*.4+texture2D(bloomWide,vUv).rgb*.5);
  color=aces(color*exposure);
  color=pow(color,vec3(1.0/2.2));
  float dither=(hash(vec3(gl_FragCoord.xy,0.0))-.5)/255.0;
  gl_FragColor=vec4(color+dither,1.0);
}
`;
export class Atmosphere {
  constructor(renderer){
    this.renderer=renderer;
    this.bloom=new EnergyBloom(renderer);
    this.cloudNoise=createCloudNoise();
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:true});
    this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.material=new THREE.ShaderMaterial({depthWrite:false,depthTest:false,uniforms:{sceneColor:{value:this.target.texture},sceneDepth:{value:this.target.depthTexture},inverseProjection:{value:new THREE.Matrix4()},cameraRotation:{value:new THREE.Matrix3()},cameraPlanet:{value:new THREE.Vector3()},sunDirection:{value:new THREE.Vector3()},resolution:{value:new THREE.Vector2()},logFar:{value:1},radius:{value:RADIUS},atmosphereRadius:{value:1+ATMOSPHERE_HEIGHT/RADIUS},exposure:{value:1.08}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader});
    this.material.uniforms.cloudNoise={value:this.cloudNoise};this.material.uniforms.cloudTime={value:0};
    ['bloomNear','bloomMid','bloomWide'].forEach((key,i)=>this.material.uniforms[key]={value:this.bloom.textures[i]});
    this.material.uniforms.bloomStrength={value:.65};
    this.scene=new THREE.Scene();const quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2),this.material);quad.frustumCulled=false;this.scene.add(quad);this.camera=new THREE.Camera();
  }
  resize(w,h){this.target.setSize(w,h);this.bloom.resize(w,h);this.material.uniforms.resolution.value.set(w,h);}
  render(scene,camera,worldPosition,sunDirection,elapsed=0){
    camera.updateMatrixWorld();const u=this.material.uniforms;
    u.cloudTime.value=elapsed;
    u.inverseProjection.value.copy(camera.projectionMatrixInverse);u.cameraRotation.value.setFromMatrix4(camera.matrixWorld);u.cameraPlanet.value.copy(worldPosition).multiplyScalar(1/RADIUS);u.sunDirection.value.copy(sunDirection);u.logFar.value=Math.log2(camera.far+1);
    this.renderer.setRenderTarget(this.target);this.renderer.setClearColor(0x000000,0);this.renderer.clear();this.renderer.render(scene,camera);
    this.bloom.render(this.target.texture);u.bloomStrength.value=this.bloom.enabled?.65:0;
    this.renderer.setRenderTarget(null);this.renderer.render(this.scene,this.camera);
  }
  dispose(){this.bloom.dispose();this.target.dispose();this.cloudNoise.dispose();this.material.dispose();this.scene.children[0].geometry.dispose();}
}
