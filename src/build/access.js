export const hasMainframe = claim => Boolean(claim?.pieces.some(p=>p.type==='mainframe'));
/** Unsecured sites cannot close a door on visitors. Owner identity stays with the
 * existing local/account save; adding a mainframe does not transfer structures. */
export const doorTarget = (claim,piece) => !hasMainframe(claim) || Boolean(piece.doorOpen);
