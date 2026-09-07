import * as THREE from 'three';

/** Authored glove closure for Meshy's wrist-only rig. The palm stays rigid;
 * fingers bend around a 31 mm radius and the thumb closes across the grip.
 * With glove thickness this encloses the 16–19 mm equipment handles; the
 * earlier 38 mm curl left visible air between the fingers and the foregrip.
 * Targets are independent so a wave can open both hands and a pistol only
 * closes the trigger hand. Coordinates are metres in each bind-pose wrist.
 */
export function addGripShapes(glb) {
  const skin = glb.json.skins[0];
  const inverseBinds = glb.rows(skin.inverseBindMatrices);
  for (const mesh of glb.json.meshes) {
    mesh.extras = { ...mesh.extras, targetNames: ['GripRight', 'GripLeft'] };
    mesh.weights = [0, 0];
    for (const primitive of mesh.primitives) {
      const positions = glb.rows(primitive.attributes.POSITION);
      const normals = glb.rows(primitive.attributes.NORMAL);
      const joints = glb.rows(primitive.attributes.JOINTS_0);
      const weights = glb.rows(primitive.attributes.WEIGHTS_0);
      primitive.targets = [];
      for (const side of ['Right', 'Left']) {
        const joint = skin.joints.findIndex(i => glb.json.nodes[i].name === `${side}Hand`);
        const inverse = new THREE.Matrix4().fromArray(inverseBinds[joint]);
        const outward = inverse.clone().invert();
        const normalIn = new THREE.Matrix3().getNormalMatrix(inverse);
        const normalOut = new THREE.Matrix3().getNormalMatrix(outward);
        const sign = side === 'Right' ? 1 : -1;
        const deltas = [], normalDeltas = [];
        for (let i = 0; i < positions.length; i++) {
          const weight = joints[i].reduce((sum, value, c) => sum + (value === joint ? weights[i][c] : 0), 0);
          const original = new THREE.Vector3(...positions[i]);
          const p = original.clone().applyMatrix4(inverse).multiplyScalar(.01);
          const n = new THREE.Vector3(...normals[i]);
          let angle = 0;
          if (weight > .8 && p.y > .075) {
            const thumb = THREE.MathUtils.smoothstep(sign * p.x, .004, .026)
              * (1 - THREE.MathUtils.smoothstep(p.z, -.025, .005));
            const start = .102, radius = .031;
            const length = Math.max(0, p.y - start);
            // Bring the spread fingers together as they curl. Keeping the
            // open-hand fan made a closed palm still read as a splayed glove.
            const squeeze = 1 - .34 * THREE.MathUtils.smoothstep(p.y, .10, .16) * (1 - thumb);
            p.z *= squeeze;
            angle = Math.min(length / radius, 3.05) * (1 - thumb);
            const x = sign * p.x + .024;
            p.y += radius * Math.sin(angle) - length + length * thumb - x * Math.sin(angle);
            p.x += sign * (radius * (1 - Math.cos(angle)) + x * (Math.cos(angle) - 1) - thumb * .012);
            p.z += thumb * .032;
            n.applyMatrix3(normalIn).normalize(); n.z /= squeeze;
            n.applyAxisAngle(new THREE.Vector3(0, 0, 1), -sign * angle)
              .applyMatrix3(normalOut).normalize();
          }
          deltas.push(p.multiplyScalar(100).applyMatrix4(outward).sub(original).toArray());
          normalDeltas.push(n.sub(new THREE.Vector3(...normals[i])).toArray());
        }
        primitive.targets.push({ POSITION: glb.addSparseRows(deltas, 'VEC3'), NORMAL: glb.addSparseRows(normalDeltas, 'VEC3') });
      }
    }
  }
}
