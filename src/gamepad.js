// W3C Standard Gamepad layout: https://www.w3.org/TR/gamepad/#remapping
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const finite = value => Number.isFinite(value) ? value : 0;
export const STICK_DEADZONE = .16;
const UTILITY_SHORTCUTS = new Map([[12,'free-drive'],[13,'gear'],[14,'lights'],[15,'camera-view'],[9,'graphics']]);

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
  boost: false, jump: false, brake: false, speed: 0, scroll: 0, mine: 0, fire: 0, evaVertical: 0, evaBrake: false, ui: null, shortcuts: new Set(), shortcutModifier: false, pressed: new Set(), menuPressed: new Set(), used: false });

export class GamepadInput {
  constructor(read = () => globalThis.navigator?.getGamepads?.() ?? []) {
    this.shortcutHeld = new Set(); this.utilityChord = false;
    this.read = read; this.id = null; this.index = null; this.connected = false;
    this.uiArmed = false; this.wasUI = false; this.armed = false; this.previous = []; this.status = 'Connect a controller and press a button.';
  }
  suspend() { this.armed = false; this.uiArmed = false; }
  poll({ focused = true, enabled = true, ui = false } = {}) {
    let pads;
    try { pads = Array.from(this.read() ?? []); }
    catch { pads = []; }
    const supported = pads.filter(pad => pad?.connected && pad.mapping === 'standard');
    const pad = supported.find(pad => pad.index === this.index && pad.id === this.id) ?? supported[0];
    if (!pad) {
      this.connected = false; this.index = null; this.id = null; this.previous = []; this.armed = false; this.uiArmed = false;
      this.status = pads.some(pad => pad?.connected)
        ? 'Controller layout unsupported. Use a controller with a standard browser mapping.'
        : 'Connect a controller and press a button.';
      return empty();
    }
    if (this.index !== pad.index || this.id !== pad.id) {
      this.index = pad.index; this.id = pad.id; this.armed = false; this.uiArmed = false; this.previous = [];
    }
    this.connected = true;
    const buttons = Array.from(pad.buttons ?? [], button => Boolean(button?.pressed) || value(button) > .5);
    const pressed = new Set(buttons.flatMap((down, index) => down && !this.previous[index] ? [index] : []));
    this.previous = buttons;
    const [strafe, moveY] = stick(pad.axes?.[0], pad.axes?.[1]);
    const [lookX, lookY] = stick(pad.axes?.[2], pad.axes?.[3]);
    const up = trigger(pad.buttons?.[7]), down = trigger(pad.buttons?.[6]);
    const neutral = !strafe && !moveY && !lookX && !lookY && !up && !down && !buttons.some(Boolean);
    if (ui !== this.wasUI) { this.uiArmed = false; this.armed = false; }
    this.wasUI = ui;
    if (!focused) this.uiArmed = false;
    else if (ui && neutral) this.uiArmed = true;
    if (ui && focused) {
      this.armed = false;
      this.status = this.uiArmed ? 'Controller menu · D-pad selects · A confirms · B returns.' : 'Controller menu · Release controls to navigate.';
      const result = empty();
      if (this.uiArmed) {
        result.ui = { stickX: strafe, stickY: moveY, x: strafe + Number(buttons[15] ?? false) - Number(buttons[14] ?? false),
          y: moveY + Number(buttons[13] ?? false) - Number(buttons[12] ?? false), scroll: lookY, pressed };
        result.used = !neutral;
      }
      return result;
    }
    if (!focused || !enabled) this.armed = false;
    else if (neutral) this.armed = true;
    this.status = this.armed ? 'Controller ready · Menu / Options opens the command menu.' : 'Controller connected · Release controls to resume.';
    if (!focused) return empty();
    if (!this.armed) {
      // Menu remains available while help pauses navigation. Gameplay edges are discarded.
      const result = empty();
      if(!enabled){
        result.scroll=lookY;
        result.menuPressed=new Set([...pressed].filter(index=>[0,1,12,13,14,15].includes(index)));
      }
      if (pressed.has(9)&&!(buttons[4]&&buttons[5])) result.pressed.add(9);
      return result;
    }
    // Latch both shoulders until both release, so releasing a chord in either
    // order cannot produce a stray roll. Consumed D-pad holds cannot become
    // throttle/tool actions when the modifier releases first.
    for(const index of this.shortcutHeld)if(!buttons[index])this.shortcutHeld.delete(index);
    this.utilityChord = Boolean(buttons[4]&&buttons[5]) || (this.utilityChord&&Boolean(buttons[4]||buttons[5]));
    const shortcuts=new Set();
    if(this.utilityChord)for(const [index,action] of UTILITY_SHORTCUTS){
      if(buttons[4]&&buttons[5]&&pressed.has(index))shortcuts.add(action);
      if(buttons[index])this.shortcutHeld.add(index);
    }
    for(const index of this.shortcutHeld)pressed.delete(index);
    const speed=this.utilityChord?0:Number(Boolean(buttons[12])&&!this.shortcutHeld.has(12))-Number(Boolean(buttons[13])&&!this.shortcutHeld.has(13));
    return { ui: null, shortcuts, shortcutModifier: this.utilityChord, evaVertical: Number(buttons[0] ?? false) - Number(buttons[1] ?? false), evaBrake: down > .1, mine: up, fire: up, strafe, forward: -moveY, yaw: -lookX, pitch: -lookY, vertical: Number(buttons[0] ?? false) - Number(buttons[1] ?? false),
      roll: this.utilityChord?0:Number(buttons[5] ?? false) - Number(buttons[4] ?? false),
      boost: Boolean(buttons[10]), jump: Boolean(buttons[0]), brake: down > .1,
      scroll: 0, menuPressed: new Set(), speed, pressed, used: !neutral };
  }
}
