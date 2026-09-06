// Extra samples belong to the landscape band: retain small walking patches and
// cheap globe roots, while resolving ridge and crater silhouettes during flight.
export function terrainGridForLevel(level) { return level >= 4 && level <= 13 ? 32 : 16; }

export function validateTerrainGrid(grid) {
  if (grid !== 16 && grid !== 32) throw new Error('Terrain grid must be 16 or 32');
}
