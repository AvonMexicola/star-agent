/** Original world identities. Branding is visual affiliation, not reputation or ownership authority. */
export const FACTIONS = Object.freeze({
  verdant: Object.freeze({id:'verdant',name:'Verdant Materials',wordmark:['VERDANT','MATERIALS'],finish:'jade',ink:'#b9d5a3',paper:'#142d27',motto:'BUILD A LASTING FOOTHOLD',detail:'SURFACE SUPPLY DIVISION',symbol:'terraces'}),
  tidemark: Object.freeze({id:'tidemark',name:'Tidemark Logistics',wordmark:['TIDEMARK','LOGISTICS'],finish:'petrol',ink:'#b9dfed',paper:'#173342',motto:'FROM ICE TO ORBIT',detail:'LUNAR FREIGHT NETWORK',symbol:'orbits'}),
  cinder: Object.freeze({id:'cinder',name:'Cinder Industrial',wordmark:['CINDER','INDUSTRIAL'],finish:'ochre',ink:'#f0cc86',paper:'#392a20',motto:'FORGED AT THE FRONTIER',detail:'METALS / POWER / INFRASTRUCTURE',symbol:'furnace'}),
  vesper: Object.freeze({id:'vesper',name:'Vesper Extraction',wordmark:['VESPER','EXTRACTION'],finish:'violet',ink:'#ddd0ed',paper:'#30263f',motto:'BEYOND THE EASY GROUND',detail:'SEALED PROSPECTING OPERATIONS',symbol:'strata'}),
  meridian: Object.freeze({id:'meridian',name:'Meridian Shipworks',wordmark:['MERIDIAN','SHIPWORKS'],finish:'ivory',ink:'#b6efd1',paper:'#102b29',motto:'BUILT FOR THE JOURNEY',detail:'FIELD ENGINEERING / SERVICE',symbol:'meridian'}),
  crimson: Object.freeze({id:'crimson',name:'Crimson Pact',wordmark:['CRIMSON','PACT'],finish:'crimson',ink:'#eadcc7',paper:'#6b1828',motto:'NO CROWN. NO CLAIM.',detail:'SALVAGE / EXCHANGE / SANCTUARY',symbol:'skull'}),
});
export const factionById = id => typeof id==='string'&&Object.hasOwn(FACTIONS,id) ? FACTIONS[id] : null;
export const PRINTS = Object.freeze({
  ...Object.fromEntries(Object.values(FACTIONS).map(f=>[f.id,Object.freeze({...f,label:f.name})])),
  airlock:Object.freeze({id:'airlock',label:'Airlock procedure',wordmark:['AIRLOCK','PROCEDURE'],ink:'#f0cc86',paper:'#202a2c',motto:'SECURE BOTH DOORS',detail:'KEEP THE VESTIBULE CLEAR',symbol:'airlock'}),
  helmet:Object.freeze({id:'helmet',label:'Helmet required',wordmark:['HELMET','REQUIRED'],ink:'#e3e9df',paper:'#243638',motto:'CHECK SUIT SEALS',detail:'EXTERIOR / NO SAFE BREATHING AIR',symbol:'helmet'}),
});
export const printById = id => typeof id==='string'&&Object.hasOwn(PRINTS,id) ? PRINTS[id] : null;
