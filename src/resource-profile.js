/** Canonical composition contract shared by geography, colour and surveys.
 * Body-specific samplers supply abundance; this module never invents deposits. */
export function resourceProfile(ids,abundances,province){
  if(ids.length!==abundances.length||!ids.length||abundances.some(n=>!Number.isFinite(n)||n<0))throw new RangeError('Invalid resource composition');
  const total=abundances.reduce((a,b)=>a+b,0);if(total<=0)throw new RangeError('Empty resource composition');
  const weights=abundances.map(n=>n/total),index=weights.indexOf(Math.max(...weights));
  return {ids,weights,dominant:ids[index],province};
}
export function resourceColor(profile,palette){return [0,1,2].map(axis=>profile.ids.reduce((sum,id,i)=>sum+palette[id][axis]*profile.weights[i],0));}
