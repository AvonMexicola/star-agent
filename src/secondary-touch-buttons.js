/** Chromium does not synthesize a button click for a second finger while a
 * primary game control is held. Preserve that held pointer and activate the
 * tapped action through its existing click handler. */
export function secondaryTouchButtons(root, selector = 'button') {
  const presses = new Map(), activated = new Map();
  const down = event => {
    activated.delete(event.pointerId);
    for (const [id, time] of activated) if (performance.now()-time>=500) activated.delete(id);
    if (event.pointerType !== 'touch' || event.isPrimary) return;
    const button = event.target.closest?.(selector);
    if (!button || !root.contains(button) || button.disabled) return;
    for (const [id, press] of presses) if (!root.contains(press.button)) presses.delete(id);
    event.preventDefault();
    presses.set(event.pointerId, {button, x:event.clientX, y:event.clientY});
    button.setPointerCapture(event.pointerId);
  };
  const up = event => {
    const press = presses.get(event.pointerId);
    presses.delete(event.pointerId);
    if (!press || press.button.disabled || !root.contains(press.button)) return;
    const hit = document.elementFromPoint(event.clientX, event.clientY);
    if (!press.button.contains(hit) || Math.hypot(event.clientX-press.x, event.clientY-press.y)>12) return;
    event.preventDefault();
    activated.set(event.pointerId, performance.now());
    press.button.click();
  };
  const click = event => {
    const time = activated.get(event.pointerId);
    if (event.isTrusted && time !== undefined && performance.now()-time<500) {
      activated.delete(event.pointerId);
      event.preventDefault();event.stopImmediatePropagation();
    }
  };
  const cancel = event => presses.delete(event.pointerId);
  const clear = () => {presses.clear();activated.clear();};
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', cancel);
  root.addEventListener('lostpointercapture', cancel);
  root.addEventListener('click', click, true);
  window.addEventListener('blur', clear);
  return () => {
    root.removeEventListener('pointerdown', down);root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', cancel);root.removeEventListener('lostpointercapture', cancel);
    root.removeEventListener('click', click, true);window.removeEventListener('blur', clear);clear();
  };
}
