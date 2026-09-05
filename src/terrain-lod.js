export const TERRAIN_SPLIT_RATIO = 1.8;
export const TERRAIN_MERGE_RATIO = 2.3;
export const TERRAIN_MORPH_SECONDS = .6;

export function wantsTerrainSplit(level, maxLevel, distance, width, wasSplit) {
  return level < maxLevel && (level < 3 || distance < width * (wasSplit ? TERRAIN_MERGE_RATIO : TERRAIN_SPLIT_RATIO));
}

/** Linear progress has no discontinuity on reversal; smoothstep is applied only
 * to the rendered value, so both endpoints have zero velocity. */
export function advanceTerrainMorph(progress, target, dt) {
  // Use elapsed time, including slow frames, so streaming does not take six
  // rendered frames per level on a busy GPU or after a background-tab pause.
  const step = Math.max(0, dt) / TERRAIN_MORPH_SECONDS;
  return target > progress ? Math.min(target, progress + step) : Math.max(target, progress - step);
}

export function terrainMorphValue(progress) { return progress * progress * (3 - 2 * progress); }

/** Composes with the terrain surface shader and Three's logarithmic depth.
 * Each patch owns a material/uniform; the compiled GPU program is shared. */
export function addTerrainMorph(material, morph, shading = true) {
  const before = material.onBeforeCompile, key = material.customProgramCacheKey();
  material.onBeforeCompile = shader => {
    before.call(material, shader);
    shader.uniforms.terrainMorph = morph;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
        attribute vec3 parentPosition;
        uniform float terrainMorph;
        ${shading ? 'attribute vec3 parentNormal; attribute vec3 parentColor;' : ''}`)
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed = mix(parentPosition, position, terrainMorph);');
    if (shading) shader.vertexShader = shader.vertexShader
      .replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\nobjectNormal = mix(parentNormal, normal, terrainMorph);')
      .replace('#include <color_vertex>', '#include <color_vertex>\nvColor = mix(parentColor, color, terrainMorph);');
  };
  material.customProgramCacheKey = () => `${key}-terrain-morph-v1-${shading}`;
}
