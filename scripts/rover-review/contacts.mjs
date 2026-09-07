import{T}from'./asset.mjs';
export function contactPoints(t,q){const out=[],p=new T.Vector3(),bary=new T.Vector3();for(const [a,b]of[[t,q],[q,t]]){const normal=b.normal.clone().normalize(),triangle=new T.Triangle(...b.p);for(let i=0;i<3;i++){const x=a.p[i],y=a.p[(i+1)%3],d0=normal.dot(x.clone().sub(b.p[0])),d1=normal.dot(y.clone().sub(b.p[0]));if(Math.abs(d0)<1e-7){triangle.getBarycoord(x,bary);if(bary.x>=-1e-7&&bary.y>=-1e-7&&bary.z>=-1e-7)out.push(x.clone());}if(d0*d1>0||Math.abs(d0-d1)<1e-12)continue;const f=d0/(d0-d1);if(f<-1e-7||f>1+1e-7)continue;p.copy(x).lerp(y,f);triangle.getBarycoord(p,bary);if(bary.x>=-1e-7&&bary.y>=-1e-7&&bary.z>=-1e-7)out.push(p.clone());}}
 return out;
}
