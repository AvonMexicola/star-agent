/** Saved metres below deck level. Legacy pieces retain their original depth. */
export const MAX_FOUNDATION_DEPTH = 8;
export const adjustableFoundation = type => ['foundation','foundation-triangle','foundation-quarter','foundation-strut'].includes(type);
export const foundationDepth = piece => piece?.supportDepth ?? (piece?.type === 'foundation-strut' ? 3.6 : .6);
export function validFoundationDepth(piece) {
  return piece.supportDepth === undefined || adjustableFoundation(piece.type) &&
    Number.isFinite(piece.supportDepth) && piece.supportDepth >= (piece.type === 'foundation-strut' ? 1.1 : .6) && piece.supportDepth <= MAX_FOUNDATION_DEPTH;
}
/** Two braces run at 45 degrees from the outer lip toward the uphill (+Z) feet. */
export function cliffBraces(piece) {
  const depth=foundationDepth(piece),run=depth-.6;
  return [-1.45,1.45].map(x=>({top:[x,-.6,-1.7],foot:[x,-depth,-1.7+run]}));
}
export function cliffColliders(piece) {
  return cliffBraces(piece).flatMap(({top,foot})=>{
    const count=Math.ceil((top[1]-foot[1])/.1),boxes=[];
    for(let i=0;i<count;i++){
      const a=top.map((n,k)=>n+(foot[k]-n)*i/count),b=top.map((n,k)=>n+(foot[k]-n)*(i+1)/count);
      boxes.push({min:a.map((n,k)=>Math.min(n,b[k])-.10),max:a.map((n,k)=>Math.max(n,b[k])+.10),support:false,kind:'brace'});
    }
    boxes.push({min:[foot[0]-.3,foot[1]-.1,foot[2]-.3],max:[foot[0]+.3,foot[1]+.1,foot[2]+.3],support:false,kind:'footing'});
    return boxes;
  });
}
