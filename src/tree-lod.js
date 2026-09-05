// Distances in metres. Overlapping bands use complementary screen-door fades.
export const TREE_LODS = [
  { near: [-2, -1], far: [95, 140], capacity: 1000 },
  { near: [95, 140], far: [360, 460], capacity: 7000 },
  { near: [360, 460], far: [1200, 1400], capacity: 48000 },
];
export const TREE_RADIUS = 1480;
export const TREE_REBUILD_DISTANCE = 40;
export function treeLodIncludes(distance, level, margin = TREE_REBUILD_DISTANCE + 25) {
  const band = TREE_LODS[level];
  return distance >= band.near[0] - margin && distance <= band.far[1] + margin;
}
export function treeLodCoverage(distance, level) {
  const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x-a)/(b-a))); return t*t*(3-2*t); };
  const band = TREE_LODS[level];
  return smooth(...band.near, distance) * (1-smooth(...band.far, distance));
}
export function addTreeLod(material, level, camera) {
  const before = material.onBeforeCompile;
  const previousKey = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    before.call(material, shader);
    shader.uniforms.lodCamera = camera;
    const { near, far } = TREE_LODS[level];
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nuniform vec3 lodCamera;\nvarying float vTreeDistance;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTreeDistance=length(instanceMatrix[3].xyz-lodCamera);');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vTreeDistance;')
      .replace('#include <alphatest_fragment>', `#include <alphatest_fragment>
        float enter=smoothstep(${near[0].toFixed(1)},${near[1].toFixed(1)},vTreeDistance);
        float leave=smoothstep(${far[0].toFixed(1)},${far[1].toFixed(1)},vTreeDistance);
        float dither=fract(52.9829189*fract(dot(floor(gl_FragCoord.xy),vec2(.06711056,.00583715))));
        if(dither<1.0-enter || dither>=1.0-leave) discard;
      `);
  };
  material.customProgramCacheKey = () => `${previousKey}-tree-lod-${level}`;
}
