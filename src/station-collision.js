import * as THREE from 'three';

// Triangle bounds provide the broad phase, in station-local metres. The swept
// triangle narrow phase preserves open space beside long diagonal structures.
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
/** Continuous separating-axis test for a translating axis-aligned box and a
 * fixed triangle. Intersect the overlap times for the 3 box axes, triangle
 * normal and 9 edge/box-axis crosses; endpoint samples can miss a thin spoke. */
export function sweepTriangle(start,end,triangle,extentMin,extentMax) {
  const {a,b,c}=triangle;
  const cx=start.x+(extentMin.x+extentMax.x)*.5,cy=start.y+(extentMin.y+extentMax.y)*.5,cz=start.z+(extentMin.z+extentMax.z)*.5;
  const hx=(extentMax.x-extentMin.x)*.5,hy=(extentMax.y-extentMin.y)*.5,hz=(extentMax.z-extentMin.z)*.5;
  const dx=end.x-start.x,dy=end.y-start.y,dz=end.z-start.z;
  let entry=0,exit=1;
  const overlap=(x,y,z)=>{
    const length=Math.hypot(x,y,z);if(length<1e-12)return true;
    x/=length;y/=length;z/=length;
    const pa=a.x*x+a.y*y+a.z*z,pb=b.x*x+b.y*y+b.z*z,pc=c.x*x+c.y*y+c.z*z;
    const radius=hx*Math.abs(x)+hy*Math.abs(y)+hz*Math.abs(z);
    const lo=Math.min(pa,pb,pc)-radius,hi=Math.max(pa,pb,pc)+radius,p=cx*x+cy*y+cz*z,d=dx*x+dy*y+dz*z;
    if(Math.abs(d)<epsilon)return p>=lo-epsilon&&p<=hi+epsilon;
    const first=(lo-p)/d,last=(hi-p)/d;
    entry=Math.max(entry,Math.min(first,last));exit=Math.min(exit,Math.max(first,last));
    return entry<=exit;
  };
  if(!overlap(1,0,0)||!overlap(0,1,0)||!overlap(0,0,1))return null;
  const abx=b.x-a.x,aby=b.y-a.y,abz=b.z-a.z,acx=c.x-a.x,acy=c.y-a.y,acz=c.z-a.z;
  if(!overlap(aby*acz-abz*acy,abz*acx-abx*acz,abx*acy-aby*acx))return null;
  const edge=(x,y,z)=>overlap(0,z,-y)&&overlap(-z,0,x)&&overlap(y,-x,0);
  if(!edge(abx,aby,abz)||!edge(acx,acy,acz)||!edge(c.x-b.x,c.y-b.y,c.z-b.z))return null;
  return exit>epsilon&&entry<1-epsilon?Math.max(0,entry):null;
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
        const box = new THREE.Box3(),triangle=new THREE.Triangle(),vertices=[triangle.a,triangle.b,triangle.c];
        for (let j=0;j<3;j++) {
          point.fromBufferAttribute(positions,indices ? indices.getX(i+j) : i+j).applyMatrix4(transform);
          box.expandByPoint(point);vertices[j].copy(point);
        }
        box.triangle=triangle;
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
      for (const box of node.boxes) {
        const broad=sweepBox(start,end,box,extentMin,extentMax);if(broad===null||broad>time)continue;
        const hit=box.triangle?sweepTriangle(start,end,box.triangle,extentMin,extentMax):broad;
        if(hit!==null)time=Math.min(time,hit);
      }
    } else { visit(node.left); visit(node.right); }
  };
  if (tree) visit(tree);
  for (const box of doors) { const hit = sweepBox(start,end,box,extentMin,extentMax); if (hit !== null) time=Math.min(time,hit); }
  const length = start.distanceTo(end);
  return { point: start.clone().lerp(end,Math.max(0,time-(time<1 && length>0 ? .015/length : 0))), hit: time<1 };
}
