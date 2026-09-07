import * as THREE from 'three';
import { AvatarGLB } from './avatar-glb.mjs';

/** Retract the overlong rear receiver/stock around the unchanged trigger grip.
 * The original .55 m length behind the hand pierced the entire shoulder. A
 * .22 m stock fits this 1.85 m rig while retaining the barrel and both grips. */
export function fitRifleStock(source, output) {
  const glb = new AvatarGLB(source);
  for (const mesh of glb.json.meshes) for (const p of mesh.primitives) {
    const positions = glb.rows(p.attributes.POSITION), normals = glb.rows(p.attributes.NORMAL);
    positions.forEach((v, i) => {
      if (v[0] <= .035) return;
      v[0] = .035 + (v[0] - .035) * .36;
      normals[i] = new THREE.Vector3(normals[i][0] / .36, normals[i][1], normals[i][2]).normalize().toArray();
    });
    p.attributes.POSITION = glb.addRows(positions, 'VEC3');
    p.attributes.NORMAL = glb.addRows(normals, 'VEC3');
  }
  glb.compact().save(output);
}
