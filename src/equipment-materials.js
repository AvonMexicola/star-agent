// The handheld GLBs embed the same three authored atlases so they also work in
// ordinary glTF viewers. Reuse those textures across cached game assets: a local
// player and every remote equipment instance retain a single GPU copy per map.
const atlases = new Map();
export function shareHandheldTextures(root) {
  root.traverse(node => {
    if (!node.isMesh) return;
    for (const material of [node.material].flat()) {
      if (material.userData.handheldFinish !== 1) continue;
      for (const slot of ['map', 'normalMap', 'roughnessMap', 'metalnessMap']) {
        const texture = material[slot];
        if (!/^(HandheldAtlas|FieldCutterAtlas)-v1-/.test(texture?.name||'')) continue;
        texture.anisotropy = 4; // Keep physical service plates legible at oblique aim angles.
        const key = `${texture.name}:${texture.colorSpace}`;
        if (!atlases.has(key)) atlases.set(key, texture);
        material[slot] = atlases.get(key);
      }
      material.vertexColors = node.geometry.hasAttribute('color');
    }
  });
}
export function hasAuthoredHandheldFinish(root) {
  let authored = false;
  root.traverse(node => {
    if (node.isMesh && [node.material].flat().some(m => m.userData.handheldFinish === 1)) authored = true;
  });
  return authored;
}
// Like the equipment GLB cache this owns page-lifetime resources; instances do
// not dispose shared geometry/maps. Clearing a test cache must not dispose maps
// still used by a live scene.
export function clearHandheldTextureCache() { atlases.clear(); }
