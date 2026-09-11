import {STRATUM_LAYOUT} from '../stratum-layout.js';
import {GANNET_LAYOUT} from '../gannet-layout.js';
/** Ship-local metres, +Y up. Cell volume is 0.216 m³, not a mass unit. */
export const SBU_METRES = .6;
export const SBU_SIZES = Object.freeze([1,2,4,8,16,32,64]);
export const CRATE_CELLS = Object.freeze({1:[1,1,1],2:[1,1,2],4:[1,2,2],8:[2,2,2],16:[2,2,4],32:[2,4,4],64:[2,4,8]});
export const CARGO_GRIDS = Object.freeze({
  nomad: [{id:'aft-starboard',min:[.94,1,2.16],cells:[1,3,2]}],
  // Preserve saved grid IDs/cell coordinates and 512 SBU. The new deck leaves
  // five metres clear through its centre for the Burrow and both loading ramps.
  atlas: [{id:'port-deck',min:[-3.7,2.625,.1],cells:[2,8,16]},{id:'starboard-deck',min:[2.5,2.625,.1],cells:[2,8,16]}],
  kestrel: [],
  stratum: STRATUM_LAYOUT.storage.freight.banks.map(b=>({id:b.id,min:[...b.min],cells:[2,2,4]})),
  gannet: GANNET_LAYOUT.cargo.grids,
});
export const capacitySBU = hull => (CARGO_GRIDS[hull]??[]).reduce((n,g)=>n+g.cells.reduce((a,b)=>a*b,1),0);
export const crateSize = sbu => CRATE_CELLS[sbu]?.map(n=>n*SBU_METRES);
export const usedSBU = crates => crates.reduce((n,c)=>n+c.sbu,0);
export function crateBounds(hull,crate){
  const grid=CARGO_GRIDS[hull]?.find(g=>g.id===crate.grid),size=crateSize(crate.sbu);
  if(!grid||!size||!Array.isArray(crate.cell)||crate.cell.length!==3||!crate.cell.every(Number.isSafeInteger))return null;
  const min=grid.min.map((n,i)=>n+crate.cell[i]*SBU_METRES);
  return {min,max:min.map((n,i)=>n+size[i])};
}
const overlap=(a,b)=>a.min.every((n,i)=>n<b.max[i]-1e-7&&a.max[i]>b.min[i]+1e-7);
export function validGrid(hull,crates){
  if(!Array.isArray(crates)||crates.length>capacitySBU(hull))return false;
  const bounds=[];
  for(const c of crates){
    const g=CARGO_GRIDS[hull]?.find(g=>g.id===c.grid),b=crateBounds(hull,c),dims=CRATE_CELLS[c.sbu];
    if(!g||!b||c.cell.some((n,i)=>n<0||n+dims[i]>g.cells[i])||bounds.some(a=>overlap(a,b)))return false;
    // Every elevated crate has support over its entire footprint.
    if(c.cell[1]>0)for(let x=0;x<dims[0];x++)for(let z=0;z<dims[2];z++){
      if(!crates.some(d=>d!==c&&d.grid===c.grid&&d.cell[1]+CRATE_CELLS[d.sbu]?.[1]===c.cell[1]&&d.cell[0]<=c.cell[0]+x&&d.cell[0]+CRATE_CELLS[d.sbu][0]>c.cell[0]+x&&d.cell[2]<=c.cell[2]+z&&d.cell[2]+CRATE_CELLS[d.sbu][2]>c.cell[2]+z))return false;
    }
    bounds.push(b);
  }
  return true;
}
/** First fit keeps existing crates in place. No magical repacking at purchase. */
export function placeCrate(hull,crates,crate){
  const dims=CRATE_CELLS[crate.sbu];if(!dims||!validGrid(hull,crates))return null;
  for(const g of CARGO_GRIDS[hull]??[]){
    const [nx,ny,nz]=g.cells,index=(x,y,z)=>x+nx*(z+nz*y),occupied=new Uint8Array(nx*ny*nz);
    for(const c of crates.filter(c=>c.grid===g.id)){const d=CRATE_CELLS[c.sbu];for(let x=0;x<d[0];x++)for(let y=0;y<d[1];y++)for(let z=0;z<d[2];z++)occupied[index(c.cell[0]+x,c.cell[1]+y,c.cell[2]+z)]=1;}
    for(let y=0;y<=ny-dims[1];y++)for(let z=0;z<=nz-dims[2];z++)for(let x=0;x<=nx-dims[0];x++){
      let fits=true;
      for(let dx=0;dx<dims[0]&&fits;dx++)for(let dz=0;dz<dims[2]&&fits;dz++){
        if(y>0&&!occupied[index(x+dx,y-1,z+dz)]){fits=false;break;}
        for(let dy=0;dy<dims[1];dy++)if(occupied[index(x+dx,y+dy,z+dz)]){fits=false;break;}
      }
      if(fits)return {...crate,grid:g.id,cell:[x,y,z]};
    }
  }
  return null;
}
/** Remove an upper crate first; never leave a floating stack. */
export const canRemoveCrate=(hull,crates,id)=>validGrid(hull,crates.filter(c=>c.id!==id));
