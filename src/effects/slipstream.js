import * as THREE from 'three';
import {additive} from './particles.js';

/** A surrounding, depth-tested field. Geometry remains in a small local frame;
 * the open centre leaves the flight destination and cockpit readable. */
export class Slipstream {
  constructor(scene){
    const geometry=new THREE.CylinderGeometry(1,1,1,80,48,true);
    geometry.rotateX(Math.PI/2);geometry.translate(0,0,.5);
    this.material=new THREE.ShaderMaterial({...additive,side:THREE.DoubleSide,uniforms:{time:{value:0},drive:{value:0}},vertexShader:`
      varying vec2 vUv;uniform float time;uniform float drive;
      #include <common>
      #include <logdepthbuf_pars_vertex>
      void main(){vUv=uv;vec3 p=position;float z=p.z;
        float breathing=1.0+.06*sin(z*17.0-time*2.0)+.035*cos(z*29.0+uv.x*18.8496-time*3.0);
        p.xy*=mix(18.0,38.0,z)*breathing;
        p.z=z*260.0;
        vec4 mvPosition=modelViewMatrix*vec4(p,1.0);gl_Position=projectionMatrix*mvPosition;
        #include <logdepthbuf_vertex>
      }`,fragmentShader:`
      varying vec2 vUv;uniform float time;uniform float drive;
      #include <common>
      #include <logdepthbuf_pars_fragment>
      void main(){
        #include <logdepthbuf_fragment>
        float a=vUv.x*6.2831853,z=1.0-vUv.y,t=time*(.8+drive*1.4);
        float curl=a*5.0+z*9.0+.45*sin(z*13.0-t*1.8);
        float strands=pow(.5+.5*sin(curl),18.0);
        float lace=pow(.5+.5*sin(a*23.0-z*38.0+sin(z*19.0-t*2.0)),40.0);
        float waves=.5+.5*sin(z*70.0+t*16.0+sin(a*3.0)*2.0);
        float knots=pow(waves,14.0);
        float haze=(.5+.5*sin(curl+sin(z*8.0-t)))*(.5+.5*sin(a*9.0-z*18.0+t));
        float ends=smoothstep(0.0,.07,z)*(1.0-smoothstep(.72,1.0,z));
        float mask=(strands*(.55+knots*2.5)+lace*.5+haze*.14+knots*.045)*ends*drive;
        vec3 color=mix(vec3(.03,.75,2.3),vec3(.8,.08,2.1),.5+.5*sin(a*2.0+z*9.0-t*.4));
        color=mix(color,vec3(.25,2.3,2.7),knots*strands*.65);
        if(mask<.003)discard;
        gl_FragColor=vec4(color,mask*.65);
      }`});
    this.mesh=new THREE.Mesh(geometry,this.material);this.mesh.name='Slipstream / braided energy field';this.mesh.frustumCulled=false;this.mesh.visible=false;scene.add(this.mesh);
    this.direction=new THREE.Vector3(0,0,-1);
  }
  update({origin,eye=origin,velocity,intensity,time,reducedMotion=false},dt){
    const amount=reducedMotion?0:THREE.MathUtils.smoothstep(intensity,.25,.95);
    this.material.uniforms.drive.value=amount;
    this.mesh.visible=amount>.002;if(!this.mesh.visible)return;
    if(velocity.lengthSq()>1){this.direction.lerp(velocity.clone().normalize(),1-Math.exp(-dt*4)).normalize();}
    this.mesh.position.copy(eye).sub(origin).addScaledVector(this.direction,-35);
    this.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),this.direction);
    this.material.uniforms.drive.value=amount;this.material.uniforms.time.value=time;
  }
  reset(){this.mesh.visible=false;this.material.uniforms.drive.value=0;}
  dispose(){this.mesh.removeFromParent();this.mesh.geometry.dispose();this.material.dispose();}
}
