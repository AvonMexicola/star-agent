import {printById} from '../factions/catalog.js';

/** sRGB paint colours; hardware, glass, lamps and functional status colours stay authored. */
export const BUILD_FINISHES = Object.freeze({
  mineral:Object.freeze({id:'mineral',label:'Original mineral',swatch:'#b0afa6',concrete:null,armour:null}),
  ivory:Object.freeze({id:'ivory',label:'Ivory ceramic',swatch:'#e4dfcc',concrete:'#e4dfcc',armour:'#f2edda'}),
  graphite:Object.freeze({id:'graphite',label:'Graphite',swatch:'#565e63',concrete:'#606a71',armour:'#969fa3'}),
  crimson:Object.freeze({id:'crimson',label:'Crimson',swatch:'#a43848',concrete:'#b04452',armour:'#ddcbb9'}),
  petrol:Object.freeze({id:'petrol',label:'Petrol blue',swatch:'#42798d',concrete:'#548ba0',armour:'#cfdee2'}),
  ochre:Object.freeze({id:'ochre',label:'Industrial ochre',swatch:'#c29145',concrete:'#d1a05a',armour:'#e5d7b8'}),
  jade:Object.freeze({id:'jade',label:'Field green',swatch:'#66866b',concrete:'#7a9c7e',armour:'#d9ddc5'}),
  violet:Object.freeze({id:'violet',label:'Vesper violet',swatch:'#88709f',concrete:'#9983ae',armour:'#e1d6e9'}),
});
export const finishById = id => Object.hasOwn(BUILD_FINISHES,id) ? BUILD_FINISHES[id] : null;
export const printablePiece = type => type==='wall'||['foundation-pad-small','foundation-pad-medium','foundation-pad-large'].includes(type);
export const validAppearance = p => (p.finish===undefined||Boolean(finishById(p.finish))) && (p.graphic===undefined||p.graphic==='none'||printablePiece(p.type)&&Boolean(printById(p.graphic)));
export const appearanceFor = (type,finish='mineral',graphic='none') => ({...(finish!=='mineral'?{finish}:{}),...(graphic!=='none'&&printablePiece(type)?{graphic}:{})});
export const appearanceKey = p => `${p.finish??'mineral'}/${p.graphic??'none'}`;

/** Changes only cosmetic fields; callers still establish reach and atomically persist. */
export function recolourBuild(data,claimId,pieceId,finish,graphic){
  if(!finishById(finish)||(graphic!=='none'&&!printById(graphic)))return {ok:false,message:'Choose a listed finish and print.'};
  const claim=data.claims.find(c=>c.id===claimId),piece=claim?.pieces.find(p=>p.id===pieceId);
  if(!piece||claim.owner!=='local-player')return {ok:false,message:'Aim at a part in your own base.'};
  const appearance=appearanceFor(piece.type,finish,graphic);
  if(appearanceKey(piece)===appearanceKey(appearance))return {ok:false,message:'This part already has that finish and print.'};
  const replacement={...piece};delete replacement.finish;delete replacement.graphic;Object.assign(replacement,appearance);
  return {ok:true,build:{...data,claims:data.claims.map(c=>c!==claim?c:{...c,pieces:c.pieces.map(p=>p!==piece?p:replacement)})},message:'Finish applied. Structure and contents retained.'};
}
