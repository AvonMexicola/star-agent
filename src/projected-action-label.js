import * as THREE from 'three';

/** Shared verbs for physical controls. State describes the real mechanism. */
export function controlAction(kind, state) {
  const noun = kind === 'hangar' ? 'hangar' : 'ramp';
  const actions = kind === 'lift' ? {
    up: ['Go up', true], down: ['Go down', true], call: ['Call lift', true],
    present: ['Enter lift', false, 'Platform at this deck'],
    moving: ['Lift moving', false, 'Wait for arrival'],
    securing: ['Securing gates', false, 'Wait for the safety bars'],
  } : kind === 'seat' ? {
    empty: ['Sit in pilot seat', true], occupied: ['Stand up', true],
  } : ['ramp', 'hangar'].includes(kind) ? {
    closed: [`Open ${noun}`, true], open: [`Close ${noun}`, true],
    opening: [`Opening ${noun}`, false, 'Wait for the actuator'],
    closing: [`Closing ${noun}`, false, 'Wait for the actuator'],
    obstructed: [`Clear ${noun}`, false, 'Moving surface occupied'],
  } : {};
  const action = actions[state];
  if (!action) throw new RangeError(`Unknown physical control state: ${kind}/${state}`);
  return { action: action[0], enabled: action[1], reason: action[2] ?? '' };
}

/** Anchor and camera must already share render-local coordinates. */
export function projectActionAnchor(anchor, camera, viewport, occluder = null) {
  camera.updateMatrixWorld();
  const point = new THREE.Vector3().fromArray(anchor);
  if (!point.toArray().every(Number.isFinite)) return null;
  const view = point.clone().applyMatrix4(camera.matrixWorldInverse);
  if (view.z >= -camera.near) return null;
  const ndc = point.clone().project(camera);
  if (Math.abs(ndc.x) > .96 || Math.abs(ndc.y) > .94 || Math.abs(ndc.z) > 1) return null;
  if (occluder) {
    const eye = camera.getWorldPosition(new THREE.Vector3());
    const direction = point.clone().sub(eye), distance = direction.length();
    const ray = new THREE.Raycaster(eye, direction.normalize(), .01, Math.max(.01, distance - .08));
    const hidden = ray.intersectObject(occluder, true).some(hit => {
      const materials = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material];
      const material = materials[hit.face?.materialIndex ?? 0];
      return material && !(material.transparent && material.opacity < .5);
    });
    if (hidden) return null;
  }
  return { x: (ndc.x + 1) * viewport.width / 2, y: (1 - ndc.y) * viewport.height / 2 };
}

/** One label for the reachable control; click/tap uses the same guarded action as F/A. */
export function createProjectedActionLabel(parent, activate) {
  const button = document.createElement('button');
  button.type = 'button';button.className = 'projected-action';button.hidden = true;
  const key = document.createElement('kbd'), action = document.createElement('strong');
  const target = document.createElement('span'), reason = document.createElement('small');
  button.append(key, action, target, reason);parent.append(button);
  let current = null;
  let occlusionAt = -Infinity, occlusionKey = '', unobstructed = false;
  button.addEventListener('click', () => { if (current?.enabled) activate(current.id); });
  return {
    element: button,
    update(control, camera, viewport, binding = 'F', occluder = null) {
      current = control;
      const projected = control && projectActionAnchor(control.anchor, camera, viewport);
      const cacheKey = `${control?.id}/${occluder?.uuid}`;
      if (projected && (cacheKey !== occlusionKey || performance.now() - occlusionAt > 100)) {
        unobstructed = Boolean(projectActionAnchor(control.anchor, camera, viewport, occluder));
        occlusionAt = performance.now();occlusionKey = cacheKey;
      }
      button.hidden = !projected || !unobstructed;
      if (button.hidden) return;
      button.style.left = `${projected.x}px`;button.style.top = `${projected.y - 22}px`;
      key.textContent = binding;action.textContent = control.action;
      target.textContent = control.target;reason.textContent = control.reason;
      reason.hidden = !control.reason;button.disabled = !control.enabled;
      button.dataset.control = control.id;
      button.setAttribute('aria-label', `${control.action} — ${control.target}`);
    },
    hide() { current = null;button.hidden = true; },
    dispose() { button.remove(); },
  };
}
