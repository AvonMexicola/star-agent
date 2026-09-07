/** Consume contextual actions from the shared poll before navigation/tool routing.
 * Movement, look and A jump remain available. All build actions use armed edges. */
export function routeBuildInput(pad, actions) {
  const pressed = new Set(pad.pressed);
  pad.mine = 0; pad.vertical = 0; pad.roll = 0; pad.speed = 0; pad.brake = false;
  for (const id of [1,2,3,4,5,6,7,12,13,14,15]) pad.pressed.delete(id);
  if (pressed.has(1)) { actions.cancel(); return; }
  if (pressed.has(2)) { actions.palette(); return; }
  if (pressed.has(4)) actions.rotate(-1);
  if (pressed.has(5)) actions.rotate(1);
  if (pressed.has(6)) actions.cycleSnap();
  if (pressed.has(12)) actions.adjustHeight(.25);
  if (pressed.has(13)) actions.adjustHeight(-.25);
  if (pressed.has(7)) actions.place();
}
