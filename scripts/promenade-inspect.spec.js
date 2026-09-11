import { test } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

/** Diagnostic captures of the Cosmic Chicken prints from fixed poses inside the
 * galley unit. Pose writes are deliberate here: this is a render inspection,
 * not an input journey, and it exists to answer one question — does the
 * artwork render on its cassette? The PRINTS line reports, per print, where the
 * plane really is against its anchor, in hub metres, so a frame mistake shows
 * as a distance rather than as a blank board in a screenshot. */
const POSES = [
  { name: 'fore-poster', at: [-8.6, -6.25, -24.4], look: [-8.6, -6.15, -21.45] },
  { name: 'aft-poster', at: [-8.6, -6.25, -27.0], look: [-8.6, -6.15, -29.95] },
  { name: 'menu-board', at: [-9.0, -6.25, -24.0], look: [-12.9, -6.05, -24.0] },
  { name: 'unit-overview', at: [-5.2, -6.25, -25.7], look: [-12.9, -6.6, -25.7] },
];

test('the tenant prints render on their cassettes', async ({ page }) => {
  await page.route('**/api/auth/session', route => route.request().method() === 'GET'
    ? route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ account: null }) })
    : route.continue());
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
  await page.goto('/?dev=1&ship=nomad&start=hangar&intro=0&debug&seed=7291');
  await page.waitForFunction(() => window.starAgent?.state.ready && window.starAgent.state.station.finish === 'ready', null, { timeout: 180000 });
  const prints = await page.evaluate(() => {
    const n = window.starAgent.navigation, hub = n.station.hub, V = n.position.constructor;
    const group = hub.promenade.group.getObjectByName('Cosmic Chicken prints');
    const props = hub.promenade.props;
    const r = v => v.toArray().map(x => +x.toFixed(3));
    const out = { hubGroup: r(hub.group.position), hubQuaternion: hub.group.quaternion.toArray().map(x => +x.toFixed(3)), prints: [] };
    group?.traverse(mesh => {
      if (!mesh.isMesh) return;
      const node = mesh.name.replace('Sign_Cosmic_', '');
      const anchor = props.getObjectByName(node);
      const meshWorld = mesh.getWorldPosition(new V()), anchorWorld = anchor.getWorldPosition(new V());
      const normal = new V(0, 0, 1).applyQuaternion(mesh.getWorldQuaternion(new (mesh.quaternion.constructor)()));
      out.prints.push({ node, local: r(mesh.position), hubLocal: r(hub.toLocal(meshWorld, new V())), anchorHubLocal: r(hub.toLocal(anchorWorld, new V())),
        gap: +meshWorld.distanceTo(anchorWorld).toFixed(3), normal: r(normal), visible: mesh.visible,
        map: mesh.material.map?.image ? [mesh.material.map.image.width, mesh.material.map.image.height] : null });
    });
    return out;
  });
  console.log('PRINTS', JSON.stringify(prints));
  const dir = process.env.PROMENADE_INSPECT_OUT || 'test-results/promenade-inspect';
  await mkdir(dir, { recursive: true });
  for (const pose of POSES) {
    const info = await page.evaluate(async ({ at, look }) => {
      const n = window.starAgent.navigation, st = n.station, hub = st.hub;
      const V = n.position.constructor, M = hub.group.matrixWorld.constructor;
      st.location = 'hub'; n.mode = 'walk'; n.insideShip = false; n.dockedAtStation = true; n.enabled = true;
      n.keys.clear(); n.velocity.set(0, 0, 0);
      hub.toWorld(new V(...at), n.position);
      const target = hub.toWorld(new V(...look), new V());
      const up = new V(0, 1, 0).applyQuaternion(hub.quaternion);
      const m = new M().lookAt(n.position, target, up);
      n.orientation.setFromRotationMatrix(m);
      st.rebase(n.position);
      await new Promise(r => { let k = 0; const t = () => ++k >= 45 ? r() : requestAnimationFrame(t); requestAnimationFrame(t); });
      const prints = hub.promenade.group.getObjectByName('Cosmic Chicken prints');
      return { local: n.stationLocal?.toArray().map(v => +v.toFixed(2)), status: prints?.userData.cosmicChicken,
        draws: window.starAgent.state.drawCalls, lights: hub.promenade.lights.filter(l => l.visible).length };
    }, pose);
    console.log('POSE', pose.name, JSON.stringify(info));
    await page.screenshot({ path: `${dir}/${pose.name}.png` });
  }
  console.log('ERRORS', JSON.stringify(errors));
});
