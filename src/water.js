import * as THREE from 'three';

// Sea level remains the shared world's zero-height surface. Wave slopes are
// optical detail; shore depth comes from the terrain worker, not a second floor.
export function createWaterMaterial(surfaceTexture) {
  return new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    uniforms: { waveTexture: { value: surfaceTexture }, sunDirection: { value: new THREE.Vector3() }, time: { value: 0 }, altitude: { value: 1e6 }, terrainMorph: { value: 1 } },
    vertexShader: `
      #include <common>
      #include <logdepthbuf_pars_vertex>
      attribute vec3 direction;
      attribute vec3 surfacePoint;
      attribute float terrainHeight;
      attribute vec3 parentPosition;
      attribute float parentHeight;
      uniform float terrainMorph;
      varying vec3 vDirection, vWorld, vWaterPoint;
      varying float vFloor;
      void main() {
        vec3 morphed=mix(parentPosition,position,terrainMorph);
        vDirection=direction; vWaterPoint=surfacePoint+morphed-position;
        vFloor=mix(parentHeight,terrainHeight,terrainMorph);
        vec4 world=modelMatrix*vec4(morphed,1.0); vWorld=world.xyz;
        gl_Position=projectionMatrix*viewMatrix*world;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: `
      #include <common>
      #include <logdepthbuf_pars_fragment>
      uniform sampler2D waveTexture;
      uniform vec3 sunDirection;
      uniform float time, altitude;
      varying vec3 vDirection, vWorld, vWaterPoint;
      varying float vFloor;
      // Texture periods divide the 256 m CPU wrap; mipmaps filter distant ripples.
      vec3 waveField(vec3 p, vec3 w) {
        return texture2D(waveTexture,p.yz).rgb*w.x+texture2D(waveTexture,p.zx).rgb*w.y+texture2D(waveTexture,p.xy).rgb*w.z;
      }
      void main() {
        #include <logdepthbuf_fragment>
        vec3 radial=normalize(vDirection);
        vec3 view=normalize(cameraPosition-vWorld);
        float range=length(cameraPosition-vWorld);
        vec3 p=vWaterPoint;
        vec3 weights=pow(abs(radial),vec3(6.0)); weights/=dot(weights,vec3(1.0));
        vec3 broad=waveField((p+vec3(time*.7,0.0,time*.4))/64.0,weights)-.5;
        vec3 chop=waveField((p+vec3(-time*.3,time*.2,time*.5))/16.0,weights)-.5;
        vec3 ripple=waveField((p+vec3(time*.12,time*.1,-time*.08))/4.0,weights)-.5;
        float fine=1.0-smoothstep(40.0,250.0,range);
        float swell=1.0-smoothstep(1800.0,18000.0,range);
        vec3 slope=(broad*.32+chop*.22+ripple*.12*fine)*swell;
        slope-=radial*dot(radial,slope);
        vec3 n=normalize(radial-slope);
        float depth=max(0.0,-vFloor);
        float shallow=exp(-depth*.065);
        float daylight=smoothstep(-.08,.25,dot(radial,sunDirection));
        float light=max(dot(n,sunDirection),0.0);
        vec3 body=mix(vec3(.004,.025,.045),vec3(.045,.24,.19),shallow)*(.15+light*.85);
        vec3 reflection=reflect(-view,n);
        float skyHeight=max(0.0,dot(reflection,radial));
        vec3 sky=mix(vec3(.36,.48,.57),vec3(.055,.17,.33),pow(skyHeight,.45))*daylight;
        float fresnel=.0204+.9796*pow(1.0-max(dot(n,view),0.0),5.0);
        vec3 halfway=normalize(view+sunDirection);
        float nh=max(dot(n,halfway),0.0), nv=max(dot(n,view),.02);
        float rough=mix(.12,.065,fine), a2=rough*rough*rough*rough;
        float denominator=nh*nh*(a2-1.0)+1.0;
        float distribution=a2/(3.141593*denominator*denominator);
        float visibility=1.0/(4.0*max(.08,nv+light-nv*light));
        vec3 glint=vec3(1.0,.87,.66)*min(12.0,distribution*visibility*.035)*light*daylight;
        // Broken advancing foam bands follow the actual submerged slope.
        float shoreline=(1.0-smoothstep(.15,1.5,depth))*smoothstep(-.4,.05,-vFloor);
        float band=sin(depth*5.5-time*1.6+broad.g*4.0+chop.r*3.0);
        float foam=shoreline*smoothstep(.35,.85,band)*(.65+.7*ripple.g);
        vec3 color=mix(body,sky,fresnel)+glint;
        color=mix(color,vec3(.65,.73,.70)*(.25+light),foam*.65);
        float ice=smoothstep(.83,.9,abs(radial.y));
        color=mix(color,vec3(.75,.84,.87)*(.22+max(dot(radial,sunDirection),0.0)*1.2),ice);
        gl_FragColor=vec4(color,1.0);
      }`,
  });
}
