const BUTTON_ID = 'ship-power-button';

/** Bind the help-menu power control to Navigation's ship power contract. */
export function createShipPowerUI(nav, button = document.getElementById(BUTTON_ID)) {
  if (!button) throw new Error(`#${BUTTON_ID} is required for the ship power control.`);
  const label = button.querySelector('span');
  if (!label) throw new Error(`#${BUTTON_ID} requires a label span.`);

  function update() {
    const powered = nav.powered !== false;
    const canToggle = Boolean(nav.canTogglePower);
    label.textContent = powered ? 'MAIN POWER ON' : 'MAIN POWER OFF';
    button.setAttribute('aria-pressed', String(powered));
    button.disabled = !canToggle;
    button.title = canToggle
      ? `Turn main power ${powered ? 'off' : 'on'} (P)`
      : 'Main power can only be changed from the pilot seat';
    return powered;
  }

  function toggle() {
    if (!nav.canTogglePower) return update();
    nav.togglePower();
    return update();
  }

  button.addEventListener('click', toggle);
  update();
  return {
    button,
    update,
    dispose() { button.removeEventListener('click', toggle); },
  };
}
