import { Vector3, Triangle, Box3, Ray } from 'three';
const v=()=>new Vector3();
// Closest points on two finite segments, including degenerate/parallel cases.
function segmentPair(p1,q1,p2,q2){
  const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),r=p1.clone().sub(p2);
  const a=d1.dot(d1),e=d2.dot(d2),f=d2.dot(r),clamp=x=>Math.max(0,Math.min(1,x));let s=0,t=0;
  if(a<1e-15)t=e?clamp(f/e):0;
  else{const c=d1.dot(r);if(e<1e-15)s=clamp(-c/a);else{const b=d1.dot(d2),den=a*e-b*b;s=den>1e-15?clamp((b*f-c*e)/den):0;t=(b*s+f)/e;if(t<0){t=0;s=clamp(-c/a);}else if(t>1){t=1;s=clamp((b-c)/a);}}}
  return [p1.clone().addScaledVector(d1,s),p2.clone().addScaledVector(d2,t)];
}
function closest(triangle,a,b){
  const direction=b.clone().sub(a),length=direction.length(),ray=new Ray(a,direction.normalize()),hit=ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,v());
  if(hit&&hit.distanceTo(a)<=length)return {distance:0,normal:triangle.getNormal(v())};
  let best=Infinity,normal=v();
  const pair=(p,q)=>{const delta=p.clone().sub(q),d=delta.length();if(d<best){best=d;normal=d>1e-12?delta.divideScalar(d):triangle.getNormal(v());}};
  pair(a,triangle.closestPointToPoint(a,v()));pair(b,triangle.closestPointToPoint(b,v()));
  for(const [p,q] of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]])pair(...segmentPair(a,b,p,q));
  return {distance:best,normal};
}
function tree(items){
  const box=new Box3();for(const item of items)box.union(item.box);
  if(items.length<=12)return {box,items};
  const size=box.getSize(v()),axis=size.x>size.y?(size.x>size.z?'x':'z'):(size.y>size.z?'y':'z');
  items.sort((a,b)=>a.center[axis]-b.center[axis]);const mid=items.length>>1;
  return {box,left:tree(items.slice(0,mid)),right:tree(items.slice(mid))};
}
export class RockCollision {
  constructor(positions){
    const triangles=[];
    for(let i=0;i<positions.length;i+=9){const triangle=new Triangle(new Vector3().fromArray(positions,i),new Vector3().fromArray(positions,i+3),new Vector3().fromArray(positions,i+6));if(triangle.getArea()<1e-12)continue;const box=new Box3().setFromPoints([triangle.a,triangle.b,triangle.c]);triangles.push({triangle,box,center:box.getCenter(v())});}
    this.root=tree(triangles);
  }
  query(box){const found=[];const visit=node=>{if(!node.box.intersectsBox(box))return;if(node.items){for(const item of node.items)if(item.box.intersectsBox(box))found.push(item.triangle);}else{visit(node.left);visit(node.right);}};visit(this.root);return found;}
  raycast(origin,direction,range){
    const ray=new Ray(origin,direction),end=origin.clone().addScaledVector(direction,range),box=new Box3().setFromPoints([origin,end]).expandByScalar(.001);
    let distance=range,point=null,normal=null;
    for(const tri of this.query(box)){const hit=ray.intersectTriangle(tri.a,tri.b,tri.c,false,v());if(hit&&hit.distanceTo(origin)<distance){distance=hit.distanceTo(origin);point=hit;normal=tri.getNormal(v());}}
    return point?{point,normal,distance}:null;
  }
  /** Conservative advancement of a vertical capsule against the published mesh. */
  sweep(previous,proposed,{radius=.25,height=1.75}={}){
    const start=previous.clone(),target=proposed.clone();let grounded=false,hit=false;
    const box=new Box3().setFromPoints([previous,proposed,previous.clone().add(new Vector3(0,-height,0)),proposed.clone().add(new Vector3(0,-height,0))]).expandByScalar(radius+.05);
    const triangles=this.query(box);if(!triangles.length)return {point:proposed.clone(),grounded,hit};
    let contacts=0;
    for(let step=0;step<128;step++){
      const motion=target.clone().sub(start),length=motion.length();if(length<1e-7)break;
      const a=start.clone().add(new Vector3(0,-height+radius,0)),b=start.clone().add(new Vector3(0,-radius,0));
      let clearance=Infinity,normal=null;
      for(const triangle of triangles){const closestPair=closest(triangle,a,b);if(closestPair.distance-radius<clearance){clearance=closestPair.distance-radius;normal=closestPair.normal;}}
      if(clearance<.001){
        hit=true;grounded ||= normal.y>.55;
        if(++contacts>4)break;
        const into=motion.dot(normal);if(into<0)motion.addScaledVector(normal,-into);
        start.addScaledVector(normal,.003-clearance);target.copy(start).add(motion);
      }else{
        const advance=Math.min(length,clearance*.9);start.addScaledVector(motion,advance/length);
        if(advance===length)break;
      }
    }
    return {point:start,grounded,hit};
  }
}
