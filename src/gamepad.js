// W3C Standard Gamepad layout: https://www.w3.org/TR/gamepad/#remapping
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value) ? value : 0;
export const STICK_DEADZONE = .16;

export function stick(x, y) {
  x = clamp(finite(x), -1, 1); y = clamp(finite(y), -1, 1);
  const length = Math.hypot(x, y);
  if (length <= STICK_DEADZONE) return [0, 0];
  const scale = (Math.min(1, length) - STICK_DEADZONE) / (1 - STICK_DEADZONE) / length;
  return [x * scale, y * scale];
}
const value = button => clamp(finite(button?.value ?? (button?.pressed ? 1 : 0)), 0, 1);
const trigger = button => Math.max(0, (value(button) - .05) / .95);
const empty = () => ({ strafe: 0, forward: 0, yaw: 0, pitch: 0, vertical: 0, roll: 0,
  boost: false, jump: false, brake: false, speed: 0, scroll: 0, pressed: new Set(), menuPressed: new Set(), used: false });

export class GamepadInput {
  constructor(read = () => globalThis.navigator?.getGamepads?.() ?? []) {
    this.read = read; this.id = null; this.index = null; this.connected = false;
    this.armed = false; this.previous = []; this.status = 'Connect a controller and press a button.';
  }
  suspend() { this.armed = false; }
  poll({ focused = true, enabled = true } = {}) {
    let pads;
    try { pads = Array.from(this.read() ?? []); }
    catch { pads = []; }
    const supported = pads.filter(pad => pad?.connected && pad.mapping === 'standard');
    const pad = supported.find(pad => pad.index === this.index && pad.id === this.id) ?? supported[0];
    if (!pad) {
      this.connected = false; this.index = null; this.id = null; this.previous = []; this.armed = false;
      this.status = pads.some(pad => pad?.connected)
        ? 'Controller layout unsupported. Use a controller with a standard browser mapping.'
        : 'Connect a controller and press a button.';
      return empty();
    }
    if (this.index !== pad.index || this.id !== pad.id) {
      this.index = pad.index; this.id = pad.id; this.armed = false; this.previous = [];
    }
    this.connected = true;
    const buttons = Array.from(pad.buttons ?? [], button => Boolean(button?.pressed) || value(button) > .5);
    const pressed = new Set(buttons.flatMap((down, index) => down && !this.previous[index] ? [index] : []));
    this.previous = buttons;
    const [strafe, moveY] = stick(pad.axes?.[0], pad.axes?.[1]);
    const [lookX, lookY] = stick(pad.axes?.[2], pad.axes?.[3]);
    const up = trigger(pad.buttons?.[7]), down = trigger(pad.buttons?.[6]);
    const neutral = !strafe && !moveY && !lookX && !lookY && !up && !down && !buttons.some(Boolean);
    if (!focused || !enabled) this.armed = false;
    else if (neutral) this.armed = true;
    this.status = this.armed ? 'Controller ready · Menu / Options opens controls.' : 'Controller connected · Release controls to resume.';
    if (!focused) return empty();
    if (!this.armed) {
      // Menu remains available while help pauses navigation. Gameplay edges are discarded.
      const result = empty();
      if(!enabled){
        result.scroll=lookY;
        result.menuPressed=new Set([...pressed].filter(index=>[0,1,12,13,14,15].includes(index)));
      }
      if (pressed.has(9)) result.pressed.add(9);
      return result;
    }
    return { strafe, forward: -moveY, yaw: -lookX, pitch: -lookY, vertical: up - down,
      // Positive roll banks right: RB/R1; LB/L1 banks left.
      roll: Number(buttons[5] ?? false) - Number(buttons[4] ?? false),
      boost: Boolean(buttons[10]), jump: Boolean(buttons[0]), brake: Boolean(buttons[1]),
      scroll: 0, menuPressed: new Set(), speed: Number(buttons[12] ?? false) - Number(buttons[13] ?? false), pressed, used: !neutral };
  }
}
