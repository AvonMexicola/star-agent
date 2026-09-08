export const TRADE_RESOURCES=Object.freeze([
  {id:'basalt',name:'Basalt concentrate',kgPerSBU:16,buy:20,sell:12,color:0x9aa4ac},
  {id:'copper',name:'Copper ore',kgPerSBU:16,buy:48,sell:30,color:0xc58c60},
  {id:'ice',name:'Water ice',kgPerSBU:16,buy:24,sell:15,color:0x8ed9e4},
  {id:'aggregate',name:'Aggregate',kgPerSBU:16,buy:28,sell:17,color:0xb5aaa0},
  {id:'metal-stock',name:'Metal stock',kgPerSBU:16,buy:64,sell:40,color:0xa0b8b0},
  {id:'conductor',name:'Conductor stock',kgPerSBU:16,buy:80,sell:50,color:0xd9ad72},
]);
export const resourceById=id=>TRADE_RESOURCES.find(r=>r.id===id);
