import * as THREE from 'three';
import { WATER_ROTATION, createWaterAnchors, updateWaterAnchors } from './water-field.js';

// Optical waves only. The shared terrain still owns shore depth and sea level.
export function createWaterMaterial() {
  const anchors=createWaterAnchors();
  const material=new THREE.ShaderMaterial({
    side:THREE.DoubleSide,
    uniforms:{
      planetFrameInverse:{value:new THREE.Matrix3()},sunDirection:{value:new THREE.Vector3(1,0,0)},time:{value:0},altitude:{value:1e6},
      terrainMorph:{value:1},waterRotation:{value:WATER_ROTATION},
      waveCells:{value:anchors.cells},waveFractions:{value:anchors.fractions},
    },
    vertexShader:`
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 direction;
      attribute float terrainHeight;
      attribute vec3 parentPosition;
      attribute float parentHeight;
      uniform float terrainMorph;
      uniform mat3 planetFrameInverse;
      varying vec3 vDirection, vWorld;
      varying float vFloor;
      void main() {
        vec3 morphed=mix(parentPosition,position,terrainMorph);
        vDirection=direction;
        vFloor=mix(parentHeight,terrainHeight,terrainMorph);
        vec4 world=modelMatrix*vec4(morphed,1.0); vWorld=planetFrameInverse*world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader:`
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform vec3 sunDirection;
      uniform mat3 waterRotation;
      uniform ivec3 waveCells[5];
      uniform vec3 waveFractions[5];
      varying vec3 vDirection,vWorld;
      varying float vFloor;

      float cellHash(uvec3 p,uint seed){
        uint h=p.x*1597334677u ^ p.y*3812015801u ^ p.z*2798796415u ^ seed;
        h^=h>>16u;h*=2246822519u;h^=h>>13u;h*=3266489917u;h^=h>>16u;
        return float(h>>8u)*(1.0/16777216.0);
      }
      // Nonperiodic quintic value noise and its analytic gradient. CPU integer
      // cells + local fractional coordinates avoid large float world positions.
      vec4 field(vec3 p,ivec3 anchor,uint seed){
        uvec3 i=uvec3(ivec3(floor(p)))+uvec3(anchor);vec3 f=fract(p);
        vec3 u=f*f*f*(f*(f*6.0-15.0)+10.0);
        vec3 d=30.0*f*f*(f*(f-2.0)+1.0);
        float a=cellHash(i,seed),b=cellHash(i+uvec3(1,0,0),seed);
        float c=cellHash(i+uvec3(0,1,0),seed),e=cellHash(i+uvec3(1,1,0),seed);
        float g=cellHash(i+uvec3(0,0,1),seed),h=cellHash(i+uvec3(1,0,1),seed);
        float j=cellHash(i+uvec3(0,1,1),seed),k=cellHash(i+uvec3(1,1,1),seed);
        float lo=mix(mix(a,b,u.x),mix(c,e,u.x),u.y);
        float hi=mix(mix(g,h,u.x),mix(j,k,u.x),u.y);
        vec3 grad=vec3(
          mix(mix(b-a,e-c,u.y),mix(h-g,k-j,u.y),u.z),
          mix(mix(c-a,e-b,u.x),mix(j-g,k-h,u.x),u.z),
          hi-lo)*d;
        return vec4(grad,mix(lo,hi,u.z));
      }
      void addBand(inout vec3 gradient,inout float variance,inout float crest,
                   vec3 local,float size,int layer,float strength,float footprint){
        float resolved=1.0-smoothstep(size*.12,size*.65,footprint);
        variance+=strength*strength*.22*(1.0-resolved*resolved);
        if(resolved>.001){
          vec4 wave=field(local/size+waveFractions[layer],waveCells[layer],uint(layer)*1013u+7291u);
          gradient+=wave.xyz*strength*resolved;
          crest+=max(0.0,wave.w-.55)*resolved;
        }
      }
      void main(){
        #include <logdepthbuf_fragment>
        vec3 radial=normalize(vDirection),toEye=cameraPosition-vWorld;
        vec3 view=normalize(toEye);
        // Actual pixel footprint includes grazing angle, FOV and render scale.
        float footprint=max(length(dFdx(vWorld)),length(dFdy(vWorld)));
        vec3 local=waterRotation*vWorld,gradient=vec3(0.0);
        float variance=0.0,crest=0.0;
        addBand(gradient,variance,crest,local,1.7,0,.10,footprint);
        addBand(gradient,variance,crest,local,8.3,1,.14,footprint);
        addBand(gradient,variance,crest,local,37.0,2,.17,footprint);
        addBand(gradient,variance,crest,local,173.0,3,.12,footprint);
        // The large field changes wind roughness, never giant repeating normals.
        float windResolved=1.0-smoothstep(6100.0*.12,6100.0*.65,footprint);
        float wind=.5;
        if(windResolved>.001)wind=mix(.5,field(local/6100.0+waveFractions[4],waveCells[4],5917u).w,windResolved);
        vec3 slope=transpose(waterRotation)*gradient;
        slope-=radial*dot(radial,slope);
        vec3 n=normalize(radial-slope);
        vec3 sun=normalize(sunDirection);
        float daylight=smoothstep(-.10,.22,dot(radial,sun));
        float nl=max(dot(n,sun),0.0),nv=max(dot(n,view),.001);
        float depth=max(0.0,-vFloor),shallow=exp(-depth*.045);
        vec3 absorption=mix(vec3(.003,.020,.037),vec3(.032,.22,.19),shallow);
        vec3 body=absorption*(.16+.84*nl);
        vec3 reflected=reflect(-view,n);
        float skyHeight=max(0.0,dot(reflected,radial));
        vec3 sky=mix(vec3(.34,.47,.59),vec3(.035,.105,.23),pow(skyHeight,.5))*daylight;
        sky+=vec3(.001,.002,.005);
        float fresnel=.0204+.9796*pow(1.0-nv,5.0);
        vec3 halfVector=view+sun;
        halfVector*=inversesqrt(max(dot(halfVector,halfVector),1e-8));
        float nh=max(dot(n,halfVector),0.0),vh=max(dot(view,halfVector),0.0);
        // Unresolved wave energy becomes microfacet variance, avoiding distant
        // pin-sharp tiled glints or a sudden glass-smooth ocean at an LOD cutoff.
        float alpha2=.00014+variance*(.38+.32*wind);
        float den=nh*nh*(alpha2-1.0)+1.0;
        float distribution=alpha2/(3.141593*den*den);
        float gv=2.0*nv/(nv+sqrt(alpha2+(1.0-alpha2)*nv*nv));
        float gl=2.0*nl/(nl+sqrt(alpha2+(1.0-alpha2)*nl*nl)+.00001);
        float fs=.0204+.9796*pow(1.0-vh,5.0);
        vec3 glint=vec3(1.0,.90,.73)*distribution*gv*gl*fs/max(.004,4.0*nv)*2.2*daylight;
        vec3 color=mix(body,sky,fresnel)+glint;
        float shore=(1.0-smoothstep(.2,2.0,depth))*smoothstep(-.4,.05,-vFloor);
        float nearDetail=1.0-smoothstep(2.0,12.0,footprint);
        float foam=shore*smoothstep(.05,.35,crest)*nearDetail;
        foam+=smoothstep(.35,.56,length(slope))*smoothstep(.25,.7,crest)*nearDetail*.12;
        color=mix(color,vec3(.62,.72,.72)*(.25+nl),clamp(foam,0.0,.8));
        float ice=smoothstep(.83,.9,abs(radial.y));
        color=mix(color,vec3(.75,.84,.87)*(.22+max(dot(radial,sun),0.0)*1.2),ice);
        gl_FragColor=vec4(color,1.0);
      }`,
  });
  material.userData.waterAnchors=anchors;
  return material;
}

export function updateWaterMaterial(material,origin,sunDirection,time,altitude){
  updateWaterAnchors(material.userData.waterAnchors,origin,time);
  material.uniforms.sunDirection.value.copy(sunDirection);
  material.uniforms.time.value=time;material.uniforms.altitude.value=altitude;
}
