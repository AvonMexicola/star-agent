import * as THREE from 'three';

const Z = new THREE.Vector3(0, 0, 1);
const blend = {transparent: true, depthWrite: false, depthTest: true,
  blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false};
const depthVertex = '#include <common>\n#include <logdepthbuf_pars_vertex>';
const depthFragment = '#include <common>\n#include <logdepthbuf_pars_fragment>';

/** Burrow presentation only. Actual muzzle rays and mining own both endpoints.
 * One camera-facing ribbon resolves a fine hot core, travelling filaments and
 * soft sheath; it does not need a stack of high-poly transparent cylinders.
 */
export class RoverCuttingBeam {
  constructor(scene) {
    this.mesh = new THREE.Group(); this.mesh.name = 'Burrow cutter effect';
    this.mesh.visible = false; scene.add(this.mesh);
    this.material = new THREE.ShaderMaterial({...blend,
      uniforms: {time: {value: 0}, length: {value: 1}, radius: {value: .085}},
      vertexShader: `${depthVertex}
        varying vec2 vUv; uniform float radius;
        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4(0.0, 0.0, position.y, 1.0);
          vec3 axis = normalize((modelViewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
          vec3 side = cross(axis, normalize(-mvPosition.xyz));
          side = length(side) > .001 ? normalize(side) : vec3(1.0, 0.0, 0.0);
          mvPosition.xyz += side * position.x * radius;
          gl_Position = projectionMatrix * mvPosition;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `${depthFragment}
        varying vec2 vUv; uniform float time; uniform float length;
        void main() {
          #include <logdepthbuf_fragment>
          float x = vUv.x * 2.0 - 1.0;
          float metres = vUv.y * length;
          float core = exp(-x*x*150.0);
          float sheath = exp(-x*x*5.0) * .15;
          float coil = .26 * sin(metres*10.0-time*5.0);
          float strands = exp(-pow((x-coil)*27.0, 2.0))
                        + exp(-pow((x+coil)*27.0, 2.0));
          float flow = .88 + .12 * sin(metres*17.0-time*12.0);
          float ends = smoothstep(0.0, .035, metres)
                     * smoothstep(0.0, .06, length-metres);
          float alpha = (core*.78 + sheath + strands*.10) * ends;
          if (alpha < .004) discard;
          vec3 tint = mix(vec3(.14, 1.05, .68), vec3(1.55, 2.05, 1.7), core);
          gl_FragColor = vec4(tint*flow, alpha);
        }`});
    const ribbon = new THREE.PlaneGeometry(2, 1, 1, 1); ribbon.translate(0, .5, 0);
    this.ribbon = new THREE.Mesh(ribbon, this.material); this.ribbon.frustumCulled = false;
    this.mesh.add(this.ribbon);
    this.glowMaterial = new THREE.ShaderMaterial({...blend,
      uniforms: {time: {value: 0}},
      vertexShader: `${depthVertex}
        varying vec2 vUv;
        void main() {
          vUv = uv;
          vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mvPosition;
          #include <logdepthbuf_vertex>
        }`,
      fragmentShader: `${depthFragment}
        varying vec2 vUv; uniform float time;
        void main() {
          #include <logdepthbuf_fragment>
          vec2 p = vUv*2.0-1.0; float r = length(p);
          float hot = exp(-r*r*27.0);
          float ring = exp(-pow((r-.52)*22.0, 2.0));
          float sectors = .55+.45*pow(sin(atan(p.y,p.x)*3.0-time*.5),2.0);
          float alpha = hot*.8 + ring*sectors*.21 + exp(-r*r*5.0)*.12;
          alpha *= 1.0-smoothstep(.75,1.0,r);
          if (alpha < .004) discard;
          gl_FragColor = vec4(mix(vec3(.12,1.15,.72),vec3(2.1,1.65,.85),hot),alpha);
        }`});
    this.glowGeometry = new THREE.PlaneGeometry(2, 2);
    this.muzzle = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
    this.contact = new THREE.Mesh(this.glowGeometry, this.glowMaterial);
    for (const node of [this.muzzle, this.contact]) {node.frustumCulled = false; this.mesh.add(node);}
    this.muzzle.scale.setScalar(.069); this.contact.scale.setScalar(.23);
  }

  set(start, end, origin, time, {hit = false, normal = null, reducedMotion = false} = {}) {
    const delta = end.clone().sub(start), length = delta.length();
    this.mesh.visible = Number.isFinite(length) && length > .001;
    if (!this.mesh.visible) return;
    // Subtract the double-precision origin before any render transform.
    this.mesh.position.copy(start).sub(origin);
    const direction = delta.clone().divideScalar(length);
    this.ribbon.quaternion.setFromUnitVectors(Z, direction); this.ribbon.scale.z = length;
    this.muzzle.quaternion.copy(this.ribbon.quaternion);
    this.contact.visible = Boolean(hit);
    this.contact.position.copy(delta);
    const outward = normal?.lengthSq() > 1e-8 ? normal.clone().normalize() : direction.clone().negate();
    this.contact.position.addScaledVector(outward, .008);
    this.contact.quaternion.setFromUnitVectors(Z, outward);
    this.material.uniforms.length.value = length;
    this.material.uniforms.time.value = this.glowMaterial.uniforms.time.value = reducedMotion ? 0 : time;
  }

  dispose() {
    this.mesh.removeFromParent(); this.ribbon.geometry.dispose();
    this.glowGeometry.dispose(); this.material.dispose(); this.glowMaterial.dispose();
  }
}
