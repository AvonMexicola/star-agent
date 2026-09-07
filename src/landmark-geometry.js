import {BufferGeometry,Float32BufferAttribute,Vector3} from 'three';

export const LANDMARK_GEOMETRY_VERSION=1;
export const LANDMARK_FAMILIES=Object.freeze(['Undercut escarpment','Split leaning fins','Weathered stone bridge','Crowned monolith','Shelter slab','Fractured tors']);
export const LANDMARK_VARIANTS=12;
const TAU=Math.PI*2;
// Rings are [height, half width, half depth, centre X, centre Z]. A narrower
// lower ring followed by a projecting upper ring creates an actual underside,
// not another heightfield. Bottom caps are buried in the canonical terrain.
const forms=[
  [
    [[-18,48,35,-16,0],[0,47,35,-16,0],[15,39,33,-20,1],[33,36,32,-18,0],[43,48,35,-2,2],[55,53,37,0,0],[70,48,34,-2,0],[80,35,26,-3,0],[84,4,5,-8,1]],
    [[-18,24,20,-55,-25],[0,25,21,-55,-25],[17,22,19,-55,-25],[31,14,13,-57,-26],[35,2,3,-58,-26]],
  ],
  [
    [[-18,23,33,-29,0],[0,25,33,-28,0],[25,20,31,-22,1],[54,15,27,-9,1],[87,9,21,4,0],[101,2,5,8,0]],
    [[-18,23,32,30,4],[0,24,32,30,4],[23,19,30,34,4],[55,16,27,41,1],[72,7,18,45,-2],[80,2,3,43,-3]],
    [[-18,18,22,-2,-35],[0,21,23,-1,-35],[21,15,16,0,-38],[31,3,4,-3,-38]],
  ],
  [
    [[-18,26,29,-41,0],[0,28,30,-41,0],[19,22,25,-43,1],[40,18,24,-39,1],[55,23,27,-33,0],[69,15,20,-30,0],[73,3,3,-31,0]],
    [[-18,26,30,43,0],[0,27,31,43,0],[23,20,24,43,1],[46,19,24,35,1],[61,23,26,32,0],[69,3,6,29,0]],
    [[43,43,18,0,0],[47,54,24,0,0],[57,53,26,-2,-1],[68,42,20,-3,-2],[73,16,10,-13,-2],[75,2,3,-16,-2]],
  ],
  [
    [[-18,60,40,0,0],[0,62,40,0,0],[18,60,39,1,0],[39,56,36,4,1],[67,49,33,7,0],[84,41,29,6,-2],[92,26,22,3,-1],[96,2,3,-1,0]],
    [[-18,20,24,53,-18],[0,22,25,53,-18],[24,19,21,53,-17],[46,15,17,55,-15],[54,2,4,53,-14]],
  ],
  [
    [[-18,43,34,-18,0],[0,42,34,-18,0],[16,35,32,-22,0],[29,32,31,-20,0],[36,43,35,-8,-1],[44,51,37,-4,-1],[56,49,34,-5,-2],[64,37,24,-7,-3],[68,3,4,-12,-4]],
    [[-18,18,24,-50,27],[0,20,24,-50,27],[22,17,21,-51,27],[38,4,6,-52,27]],
  ],
  [
    [[-18,34,30,-28,0],[0,36,29,-28,0],[22,29,28,-29,0],[35,36,31,-18,0],[48,33,30,-17,0],[55,29,26,-12,0],[73,32,25,-7,0],[85,22,21,-6,0],[90,3,3,-9,0]],
    [[-18,23,30,30,5],[0,27,29,30,5],[20,21,27,32,4],[34,29,26,36,3],[44,25,25,37,3],[57,17,20,34,3],[62,3,4,32,3]],
    [[-18,22,23,7,-35],[0,24,23,7,-35],[17,20,21,10,-36],[30,13,15,14,-37],[34,2,3,13,-37]],
  ],
];
// A buried root skirt spans the existing terrain LOD's height error. Its top
// profile stays in the same place; the canonical ground still owns the floor.
for(const parts of forms)for(const profile of parts)if(profile[0][0]<0)profile[0][0]=-64;
const mix=(a,b,t)=>a+(b-a)*t;
function erosion(x,y,z,seed){
  const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),smooth=t=>t*t*(3-2*t),u=smooth(x-ix),v=smooth(y-iy),w=smooth(z-iz);
  const hash=(a,b,c)=>{let h=Math.imul(a,374761393)^Math.imul(b,668265263)^Math.imul(c,1442695041)^seed;h=Math.imul(h^(h>>>13),1274126177);return ((h^(h>>>16))>>>0)/4294967296;};
  const layer=k=>mix(mix(hash(ix,iy,k),hash(ix+1,iy,k),u),mix(hash(ix,iy+1,k),hash(ix+1,iy+1,k),u),v);
  return layer(iz)*(1-w)+layer(iz+1)*w;
}

/** Conservative plant-volume exclusion from the same loft profiles. Grass can
 * grow in an open shelter; a tree is tested through its crown height too. */
export function landmarkOccupies(variant,x,y,z,margin=0,height=1){
  const version=Math.floor(variant/6),family=variant%6;
  x/=version?1.09:1;z/=version?.92:1;y/=version?.92:1;height/=version?.92:1;
  for(const [part,profile] of forms[family].entries())for(let i=0;i<profile.length-1;i++){
    const a=profile[i],b=profile[i+1],lo=Math.max(y,a[0]),hi=Math.min(y+height,b[0]);if(lo>hi)continue;
    for(const yy of [lo,(lo+hi)/2,hi]){
      const t=(yy-a[0])/(b[0]-a[0]),r=a.map((n,j)=>mix(n,b[j],t)),phase=variant*1.711+part*2.39;
      const cx=r[3]+(version?Math.sin(yy*.023+phase)*5:0),power=3.1+.45*Math.sin(phase);
      const padding=margin+7; // Bounds fluting, erosion and close chips.
      if((Math.abs(x-cx)/(r[1]+padding))**power+(Math.abs(z-r[4])/(r[2]+padding))**power<1)return true;
    }
  }
  return false;
}

/** Original procedural geometry; no imported mesh. All LODs sample the same
 * profiles and weathering. Variant changes are seeded geometry, not random frames. */
export function createLandmarkGeometry(variant=0,lod=0){
  if(!Number.isInteger(variant)||variant<0||variant>=LANDMARK_VARIANTS||![0,1,2].includes(lod))throw RangeError('Invalid landmark variant/LOD');
  const family=variant%6,version=Math.floor(variant/6),segments=[64,32,16][lod],subdivisions=[4,2,1][lod];
  const positions=[],colors=[],a=new Vector3(),b=new Vector3(),c=new Vector3();
  const triangle=(p,q,r)=>{
    for(const v of [p,q,r]){
      positions.push(...v);
      // Darker sheltered feet and oxidised stratification, coherent across LODs.
      const stratum=.88+.08*Math.sin(v[1]*.32+Math.sin(v[0]*.025+v[2]*.017));
      const foot=.75+.25*Math.min(1,Math.max(0,v[1]/18));
      colors.push(foot*stratum,foot*stratum,foot*stratum);
    }
  };
  for(const [part,profile] of forms[family].entries()){
    const rings=[],phase=variant*1.711+part*2.39;
    for(let ring=0;ring<profile.length-1;ring++)for(let sub=0;sub<subdivisions;sub++){
      const t=sub/subdivisions,r=profile[ring].map((n,i)=>mix(n,profile[ring+1][i],t));
      rings.push(r);
    }
    rings.push(profile.at(-1));
    const vertices=rings.map(([y,rx,rz,cx,cz],row)=>{
      const edge=[];
      for(let i=0;i<segments;i++){
        const theta=i/segments*TAU,cs=Math.cos(theta),sn=Math.sin(theta);
        const power=3.1+.45*Math.sin(phase),denom=(Math.abs(cs)**power+Math.abs(sn)**power)**(1/power);
        // Broad irregular planes and vertical weathered flutes are sampled at
        // every LOD. Fine 0.5 m chips belong only to the close representation.
        const flute=1+.038*Math.sin(theta*7+phase+y*.018)+.026*Math.sin(theta*13-phase+y*.035);
        const chip=lod===0?.45*Math.sin(theta*29+y*1.17+phase):0;
        const bend=version?Math.sin(y*.023+phase)*5:0;
        const bx=cx+cs/denom*rx,bz=cz+sn/denom*rz;
        const salt=variant*139+part*911+7291;
        const weather=(erosion(bx/17,y/13,bz/17,salt)-.5)*10+(erosion(bx/7,y/6,bz/7,salt^379)-.5)*3;
        // Deep irregular erosion crosses ring rows; it cannot resolve into a
        // stack of identical bands or a smooth extruded block. Thin crown points
        // taper the displacement so their cap remains closed.
        const strength=Math.min(1,Math.min(rx,rz)/9);
        const x=cx+cs/denom*(rx*flute+chip+weather*strength)+bend,z=cz+sn/denom*(rz*flute+chip+weather*strength);
        const topWeight=Math.max(0,y)/100,dy=topWeight*(1.7*Math.sin(theta*5+phase)+1.1*Math.sin(theta*9-phase));
        edge.push([x*(version?1.09:1),(y+dy)*(version?.92:1),z*(version?.92:1)]);
      }
      return edge;
    });
    for(let row=0;row<vertices.length-1;row++)for(let i=0;i<segments;i++){
      const j=(i+1)%segments;
      triangle(vertices[row][i],vertices[row+1][i],vertices[row][j]);
      triangle(vertices[row][j],vertices[row+1][i],vertices[row+1][j]);
    }
    for(const row of [0,vertices.length-1]){
      const center=vertices[row].reduce((s,p)=>s.map((n,i)=>n+p[i]/segments),[0,0,0]);
      for(let i=0;i<segments;i++){
        const j=(i+1)%segments;
        if(row===0)triangle(center,vertices[row][i],vertices[row][j]);
        else triangle(center,vertices[row][j],vertices[row][i]);
      }
    }
  }
  const geometry=new BufferGeometry();
  geometry.setAttribute('position',new Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new Float32BufferAttribute(colors,3));
  // Average identical vertices without welding across distinct formations.
  // Broad fracture corners keep their deliberate geometry; material supplies grit.
  const accumulated=new Map(),normals=new Float32Array(positions.length);
  const key=i=>`${positions[i].toFixed(4)}/${positions[i+1].toFixed(4)}/${positions[i+2].toFixed(4)}`;
  for(let i=0;i<positions.length;i+=9){
    a.fromArray(positions,i);b.fromArray(positions,i+3).sub(a);c.fromArray(positions,i+6).sub(a);b.cross(c);
    for(const j of [i,i+3,i+6]){const k=key(j);if(!accumulated.has(k))accumulated.set(k,new Vector3());accumulated.get(k).add(b);}
  }
  for(let i=0;i<positions.length;i+=3)accumulated.get(key(i)).clone().normalize().toArray(normals,i);
  geometry.setAttribute('normal',new Float32BufferAttribute(normals,3));
  geometry.computeBoundingBox();geometry.computeBoundingSphere();
  return geometry;
}
