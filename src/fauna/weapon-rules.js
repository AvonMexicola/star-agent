/** Wildlife is local authority. Only an actually seated Sentry may fire its
 * mounted barrel from a closed cabin; handheld cabin restrictions stay intact. */
export function faunaWeaponDamage(nav,hit,item,online=false){
  const sentry=item==='rover-laser'&&nav.sentrySeat?.phase==='seated';
  if(online||!nav.enabled||!['walk','eva'].includes(nav.mode)||nav.insideShip&&!sentry||hit?.kind!=='fauna'||item==='rover-laser'&&!sentry)return 0;
  const damage={'rifle-laser':30,'sidearm-pistol':18,'rover-laser':18};return Object.hasOwn(damage,item)?damage[item]:0;
}
