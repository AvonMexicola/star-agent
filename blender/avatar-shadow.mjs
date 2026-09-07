/** A shadow-only index LOD. Collapse small position cells to existing vertices,
 * preserving their skin/morph attributes and separating dominant bone regions.
 * The color mesh, UVs, textures and vertex buffers remain untouched. */
export function addShadowIndices(glb) {
  let triangles = 0, maxCell = 0;
  for (const mesh of glb.json.meshes) {
    if (mesh.primitives.length !== 1) throw Error('Shadow index LOD expects one primitive per character mesh');
    const primitive = mesh.primitives[0], positions = glb.rows(primitive.attributes.POSITION);
    const joints = glb.rows(primitive.attributes.JOINTS_0), weights = glb.rows(primitive.attributes.WEIGHTS_0);
    const original = glb.rows(primitive.indices).map(row => row[0]);
    let result, cell;
    for (cell of [.008, .010, .012, .014, .016, .018, .020, .025]) {
      const groups = new Map(), keys = [], representatives = new Map();
      for (const [i, position] of positions.entries()) {
        const dominant = weights[i].indexOf(Math.max(...weights[i]));
        const grid = position.map(value => Math.round(value / cell));
        const key = `${joints[i][dominant]}:${grid.join(',')}`; keys.push(key);
        const error = position.reduce((sum, value, axis) => sum + (value - grid[axis] * cell) ** 2, 0);
        if (!groups.has(key) || groups.get(key).error > error) groups.set(key, { i, error });
      }
      for (const [key, group] of groups) representatives.set(key, group.i);
      const remap = keys.map(key => representatives.get(key)), faces = new Set(); result = [];
      for (let i = 0; i < original.length; i += 3) {
        const face = original.slice(i, i + 3).map(index => remap[index]);
        if (new Set(face).size !== 3) continue;
        const key = [...face].sort((a, b) => a - b).join(',');
        if (faces.has(key)) continue;
        faces.add(key); result.push(...face);
      }
      if (result.length / 3 <= 20000) break;
    }
    if (result.length / 3 > 20000) throw Error('Could not meet character shadow budget');
    mesh.extras.shadowIndices = glb.addRows(result.map(index => [index]), 'SCALAR', 5125);
    mesh.extras.shadowCellMetres = cell;
    triangles += result.length / 3; maxCell = Math.max(maxCell, cell);
  }
  return { triangles, cellMetres: maxCell, maximumRestDisplacementMetres: Math.sqrt(3) * maxCell };
}
