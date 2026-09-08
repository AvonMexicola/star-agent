import {settlementById} from '../settlements/catalog.js';
import {stationTerminal} from './station-terminals.js';

/** Public terminal identity. Never projects an owner's private storage or wallet. */
export function terminalIdentity(snapshot,id,{powered=true}={}){
  const site=settlementById(id),station=stationTerminal(id),terminal=snapshot.terminals?.find(t=>t.id===id);
  const name=site?.name??(station?`Aeon Orbital · ${station.label}`:terminal?.name??'Cargo operations');
  const role=site?.role??(station?'Orbital freight exchange':terminal?.base?'Independent base exchange':terminal?'Surface freight exchange':'Ship cargo and field supplies');
  const status=!powered?'Power offline':terminal?.base&&!terminal.base.open?'Shop closed':id?'Ready to connect':'Pilot workspace';
  return {name,role,status,available:powered&&(!terminal?.base||terminal.base.open),network:site?'Settlement exchange':station?'Aeon port services':terminal?'Local trade network':'Pilot services'};
}
