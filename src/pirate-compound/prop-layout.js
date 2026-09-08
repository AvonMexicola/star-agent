export function piratePropPlacements(deck){return [
 {id:'generator',position:[-10,deck,-27],width:1.8,rotation:0},
 {id:'workbench',position:[-8,deck,6],width:1.9,rotation:Math.PI},
 {id:'floodlight',position:[-3,deck,15],width:1.9,rotation:0},
 {id:'floodlight',position:[15,deck,-7],width:1.9,rotation:Math.PI},
 ...[[-9,12],[-11,12],[-11,10],[-6,6],[6,5],[8,5],[8,7],[12,14],[14,14],[13,-14]].map(([x,z],i)=>({id:'crate',position:[x,deck,z],width:1.65,rotation:i*Math.PI/2})),
];}
// The normalized lamp head ends at z=-0.201m. Place its light in front
// of that metal casing so the point source cannot illuminate its own housing.
export const crimsonLampEmitter=height=>[0,height*.81,-.5];
