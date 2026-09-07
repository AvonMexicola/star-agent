/** Build mode owns face buttons/triggers before navigation and tool routing.
 * A places once, B opens the wheel, X exits. RB replaces A for jumping. */
export function routeBuildInput(pad, actions) {
  const pressed = new Set(pad.pressed);
  pad.mine = 0; pad.vertical = 0; pad.roll = 0; pad.speed = 0; pad.brake = false;
  pad.jump = false; pad.evaVertical = 0; pad.evaBrake = false;
  for (const id of [0,1,2,3,4,5,6,7,12,13,14,15]) pad.pressed.delete(id);
  if (pressed.has(2)) { actions.cancel(); return; }
  if (pressed.has(1)) { actions.palette(); return; }
  // Simultaneous trigger edges cancel: do not apply two rotations in one frame.
  const rotation=Number(pressed.has(7))-Number(pressed.has(6));
  if(rotation)actions.rotate(rotation);
  if (pressed.has(4)) actions.cycleSnap();
  if (pressed.has(12)) actions.adjustHeight(.25);
  if (pressed.has(13)) actions.adjustHeight(-.25);
  if (pressed.has(0)) actions.place();
  else if (pressed.has(5)) pad.jump = true;
}
