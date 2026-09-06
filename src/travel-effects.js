import * as THREE from 'three';
import { LIGHT_SPEED } from './travel-model.js';

/** Camera-local optical tunnel. Additive light leaves the destination visible
 * down the centre; it never alters the navigation path or world depth. */
export class TravelEffects {
  constructor() {
    this.scene = new THREE.Scene();
    this.time = 0;
    this.uniforms = { time: { value: 0 }, intensity: { value: 0 }, speed: { value: 0 } };
    const geometry = new THREE.CylinderGeometry(6, 16, 180, 96, 32, true);
    geometry.rotateX(Math.PI / 2); geometry.translate(0, 0, -90.5);
    const material = new THREE.ShaderMaterial({
      uniforms: this.uniforms, transparent: true, side: THREE.BackSide,
      depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending,
      vertexShader: `
        #include <common>
        #include <logdepthbuf_pars_vertex>
        varying vec2 tunnelUv;
        void main(){tunnelUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `
        #include <common>
        #include <logdepthbuf_pars_fragment>
        uniform float time,intensity,speed;
        varying vec2 tunnelUv;
        void main(){
          #include <logdepthbuf_fragment>
          float a=tunnelUv.x*6.2831853,z=tunnelUv.y;
          float motion=time*(.65+speed*2.0);
          float spiral=a*7.0+z*18.0-motion*2.5;
          float ribbon=pow(.5+.5*sin(spiral+sin(a*3.0-motion)*.7),10.0);
          float thread=pow(.5+.5*sin(a*97.0+sin(z*9.0-time)*.4),36.0);
          float pulse=pow(.5+.5*sin(z*90.0-motion*24.0+sin(a*11.0)),16.0);
          float haze=.08+.1*sin(a*3.0+z*7.0-motion);
          float ends=smoothstep(0.0,.05,z)*(1.0-smoothstep(.94,1.0,z));
          vec3 cyan=vec3(.12,.65,.72),violet=vec3(.28,.15,.65);
          vec3 color=mix(cyan,violet,.5+.5*sin(a*2.0+z*4.0));
          color+=vec3(.38,.75,.67)*thread*pulse;
          float light=(max(0.0,haze)+ribbon*.36+thread*.25+thread*pulse*1.8)*ends;
          gl_FragColor=vec4(color,intensity*light);
        }`,
    });
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.name = 'Relativistic travel tunnel'; this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 100; this.mesh.visible = false; this.scene.add(this.mesh);
  }
  update(dt, nav, camera) {
    this.time += Math.max(0, dt); this.uniforms.time.value = this.time;
    const state = nav.travelState;
    let target = 0;
    if (nav.travel) {
      const spool = state.phase === 'spooling';
      target = state.phase === 'cooldown' ? .15 : spool ? .15 + .5 * Math.min(1, nav.travel.elapsed / 3) : 1;
    }
    this.uniforms.intensity.value = THREE.MathUtils.lerp(this.uniforms.intensity.value, target, 1 - Math.exp(-5 * Math.max(0, dt)));
    this.uniforms.speed.value = (state?.speed || 0) / LIGHT_SPEED;
    if(!nav.travel)this.uniforms.intensity.value=0;
    this.mesh.visible = Boolean(nav.travel)&&this.uniforms.intensity.value > .005;
    this.mesh.position.copy(camera.position); this.mesh.quaternion.copy(camera.quaternion);
  }
  // The atmosphere replaces pixels with no world depth with its sky. Composite
  // optical light afterwards so the tunnel stays visible against empty space.
  render(renderer, camera) {
    if (!this.mesh.visible) return;
    const autoClear = renderer.autoClear;
    renderer.autoClear = false;
    try { renderer.render(this.scene, camera); }
    finally { renderer.autoClear = autoClear; }
  }
  get state() { return { visible: this.mesh.visible, intensity: this.uniforms.intensity.value }; }
  dispose() { this.mesh.geometry.dispose(); this.mesh.material.dispose(); this.mesh.removeFromParent(); }
}
