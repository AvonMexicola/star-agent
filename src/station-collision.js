import * as THREE from 'three';

// Conservative triangle bounds, in station-local metres. A BVH keeps swept
// queries small while retaining openings in the merged, concave station mesh.
// No world-scale floats or render-origin positions participate in collision.
const epsilon = 1e-5;
export function sweepBox(start, end, box, extentMin, extentMax) {
  let entry = 0, exit = 1;
  for (const axis of ['x','y','z']) {
    const lo = box.min[axis]-extentMax[axis], hi = box.max[axis]-extentMin[axis];
    const p = start[axis], d = end[axis]-p;
    if (Math.abs(d) < epsilon) { if (p <= lo+epsilon || p >= hi-epsilon) return null; continue; }
    const a = (lo-p)/d, b = (hi-p)/d;
    entry = Math.max(entry,Math.min(a,b)); exit = Math.min(exit,Math.max(a,b));
    if (entry >= exit-epsilon) return null;
  }
  return exit > epsilon && entry < 1-epsilon ? Math.max(0,entry) : null;
}
function buildTree(boxes) {
  const bounds = new THREE.Box3(); for (const box of boxes) bounds.union(box);
  if (boxes.length <= 12) return { bounds, boxes };
  const size = bounds.getSize(new THREE.Vector3());
  const axis = size.x > size.y && size.x > size.z ? 'x' : size.y > size.z ? 'y' : 'z';
  boxes.sort((a,b) => a.min[axis]+a.max[axis]-b.min[axis]-b.max[axis]);
  const mid = boxes.length >> 1;
  return { bounds, left: buildTree(boxes.slice(0,mid)), right: buildTree(boxes.slice(mid)) };
}
export function buildStationColliders(model) {
  const boxes = [], point = new THREE.Vector3();
  model.updateMatrixWorld(true);
  const excluded = /Door|Markings|Number|Sign_|Lights|Detail/;
  model.traverse(mesh => {
    if (!mesh.isMesh || excluded.test(mesh.name)) return;
    const geometry = mesh.geometry, positions = geometry.attributes.position, indices = geometry.index;
    const count = indices ? indices.count : positions.count;
    const transform=new THREE.Matrix4(),instance=new THREE.Matrix4();
    for(let n=0;n<(mesh.isInstancedMesh?mesh.count:1);n++){
      transform.copy(mesh.matrixWorld);
      if(mesh.isInstancedMesh){mesh.getMatrixAt(n,instance);transform.multiply(instance);}
      for (let i=0;i<count;i+=3) {
        const box = new THREE.Box3();
        for (let j=0;j<3;j++) box.expandByPoint(point.fromBufferAttribute(positions,indices ? indices.getX(i+j) : i+j).applyMatrix4(transform));
        boxes.push(box);
      }
    }
  });
  return buildTree(boxes);
}
export function constrainStationSweep(tree, doors, start, end, extentMin, extentMax) {
  let time = 1;
  const visit = node => {
    const entry = sweepBox(start,end,node.bounds,extentMin,extentMax);
    // A stationary axis inside a zero-thickness node still needs the expanded
    // body bounds; sweepBox performs that expansion before testing.
    if (entry === null || entry > time) return;
    if (node.boxes) {
      for (const box of node.boxes) { const hit = sweepBox(start,end,box,extentMin,extentMax); if (hit !== null) time=Math.min(time,hit); }
    } else { visit(node.left); visit(node.right); }
  };
  if (tree) visit(tree);
  for (const box of doors) { const hit = sweepBox(start,end,box,extentMin,extentMax); if (hit !== null) time=Math.min(time,hit); }
  const length = start.distanceTo(end);
  return { point: start.clone().lerp(end,Math.max(0,time-(time<1 && length>0 ? .015/length : 0))), hit: time<1 };
}
