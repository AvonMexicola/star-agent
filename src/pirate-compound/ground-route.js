/** Small deterministic terrain survey around the raised outer pad. The returned
 * route is metadata/wayfinding, never a second floor or movement authority. */
export function pirateGroundRoute(height,start,end){
 const step=2,width=33,rows=Math.round((start[1]-end[1])/step)+1;
 if(rows<1||rows>180)return null;
 const point=(x,z)=>[17+x*step,end[1]+z*step],key=(x,z)=>z*width+x,coords=id=>[id%width,Math.floor(id/width)];
 const heights=new Map(),get=(x,z)=>{const k=key(x,z);if(!heights.has(k))heights.set(k,height(...point(x,z)));return heights.get(k);};
 const source=key(0,rows-1),target=key(0,0),open=[source],cost=new Map([[source,0]]),parents=new Map(),done=new Set();let maxSlope=0;
 const heuristic=id=>{const [x,z]=coords(id);return (x+z)*step;};
 while(open.length){
  let best=0;for(let i=1;i<open.length;i++)if(cost.get(open[i])+heuristic(open[i])<cost.get(open[best])+heuristic(open[best]))best=i;
  const id=open.splice(best,1)[0];if(done.has(id))continue;done.add(id);
  if(id===target){const ids=[id];while(ids.at(-1)!==source)ids.push(parents.get(ids.at(-1)));ids.reverse();const raw=ids.map(id=>point(...coords(id))),points=[raw[0]];
   const segment=(a,b)=>{const length=Math.hypot(b[0]-a[0],b[1]-a[1]),count=Math.ceil(length*2);let slope=0,before=height(...a);for(let i=1;i<=count;i++){const p=b.map((value,k)=>a[k]+(value-a[k])*i/count);if(p[1]>=222&&p[1]<=298&&p[0]<29)return Infinity;const next=height(...p);slope=Math.max(slope,Math.abs(next-before)/(length/count));before=next;}return slope;};
   for(let i=0;i<raw.length-1;){let next=raw.length-1;while(next>i+1&&segment(raw[i],raw[next])>.8)next--;maxSlope=Math.max(maxSlope,segment(raw[i],raw[next]));points.push(raw[next]);i=next;}
   return {points,maxSlope,samples:heights.size};
  }
  const [x,z]=coords(id);
  for(const [nx,nz] of [[x-1,z],[x+1,z],[x,z-1],[x,z+1]]){
   if(nx<0||nx>=width||nz<0||nz>=rows)continue;const nextId=key(nx,nz);if(done.has(nextId))continue;
   const [px,pz]=point(nx,nz);if(pz>=222&&pz<=298&&px<29)continue;
   const a=point(x,z),b=point(nx,nz);let previous=get(x,z),slope=0;
   for(let i=1;i<=4;i++){const h=i===4?get(nx,nz):height(a[0]+(b[0]-a[0])*i/4,a[1]+(b[1]-a[1])*i/4);slope=Math.max(slope,Math.abs(h-previous)/.5);previous=h;}
   if(slope>.8)continue;const score=cost.get(id)+step*(1+slope*slope);
   if(score>=(cost.get(nextId)??Infinity))continue;parents.set(nextId,id);cost.set(nextId,score);open.push(nextId);
  }
 }
 return null;
}
