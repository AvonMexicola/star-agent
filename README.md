# Star Agent

A browser spaceflight experiment: fly continuously around a procedural quarter-Earth planet, descend through its atmosphere, land, and explore on foot. Star Citizen is the visual reference and long-term fidelity target; this prototype does not yet match that production quality.

## Run

Node 22.12 or newer:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. WebGL 2, a desktop keyboard and mouse, and hardware acceleration are recommended. Core play needs no account, API key, hosted service, or paid asset. Audio starts only after pressing the sound button.

## Explore and share

The default seed is `7291`. Open `/?seed=42` for another planet, or enter a seed in the controls panel (H). Share the resulting URL. The same seed and generator version produce the same terrain, destinations, vegetation placement, and cloud noise for everyone; this is deterministic generation, not multiplayer synchronization. Cloud animation follows each session's elapsed time.

The active terrain generator is version **2**. Its expanded landforms differ from the original generator even with the same seed. Future generation changes must update that version; old algorithms are not archived by the seed URL.

WASD moves, mouse or arrow keys steer, Space/C ascends/descends, Shift boosts, X brakes, and the mouse wheel adjusts assisted flight speed. Shift + click a destination to set a bearing and distance for **continuous flight**. Climb when the destination lies beyond the horizon. A plain destination click performs optional quick transit; ordinary flight does not use it.

Press **V** while freely flying to toggle inertial flight. Releasing thrust then preserves momentum; arrow keys and Q/E apply rotational thrust, and mouse movements adjust rotation rate. Space/C thrust along the ship's up/down axis in this mode. **X** stops translation and rotation; **V** restores assisted braking. Inertial flight includes inverse-square gravity (9.81 m/s² at sea level), density-dependent drag, banked wing lift and loss of lift beyond stall angle. It has a 3 km/s travel cap and retains the station approach speed limit. Assisted mode remains the default, with gravity/aero compensation and altitude-scaled travel speed. The transition readout maps 70–20 km above sea level to ATMO 0–100%; it is a regime blend, not air density. Orbit/quick-transit resets assist to on.

L engages landing assistance near dry terrain or polar ice. After landing, F stands from the pilot chair. Walk aft, press F at the rear hatch, wait for the ramp to lower, and walk outside. Return up the ramp, approach the chair, press F to sit, then L to launch. Boarding is physical; F outside does not teleport you aboard. Tab hides the interface.

Hit terrain, polar ice or water at **12 m/s or more into the surface** and the ship is destroyed. The impact uses surface-normal closing speed, including terrain slope, before collision stops the ship. A short procedural explosion and crash screen replace flight; propulsion, launch and boarding stay disabled. Choose **Return to orbit**, press O, or use an explicit destination shortcut to restart with the same seed. Gentle contact and landing assistance still work. Station damage, persistent wrecks and deformable ship parts are not implemented.

## Visit Aeon Orbital

Shift + click **Aeon Orbital** to set a course for continuous flight, or click it normally for optional transit to the exterior approach. The doors open automatically as you approach. Fly forward with W, brake with X over the central pad, and press L to dock. Approach speed is limited automatically near the station.

F stands from the chair. Walk aft, use F at the hatch, wait for the ramp and walk onto the hangar deck. Return up the ramp to the chair and press F to sit. L lifts the ship gently to bay clearance; reverse with S to leave through the doors. Walking stays on the supported deck; jumping into space is not part of this prototype.

## Rendering

- Terrain ridges, valleys, coastal cliffs and glaciers come from one shared CPU height function. Collision, rendering, biomes and vegetation use that function.
- Quadtree terrain streams during flight, retaining parents and skirts while children load. CPU world coordinates remain double-precision metres; render positions subtract local origins before GPU upload.
- Soil, fractured stone, moss and rippled sand use procedural albedo/relief layers, blended by slope and biome. Local sun shadows and prefiltered sky lighting give surfaces depth. The cabin retains a physical floor, hatch and ramp.
- Forests use detailed branches nearby, simpler branches at middle distances, and crossed tree silhouettes farther away, with overlapping dithered transitions and a 1.4 km fade. Trees keep their seeded positions across LOD and origin changes. Grass and rocks are instanced.
- Water uses filtered wave normals, Fresnel sky reflection, sun glints, depth-coloured shallows and animated shoreline foam. Shore depth comes from the same terrain mesh; wave detail does not displace sea level.
- The HDR atmosphere uses Rayleigh/Mie single scattering and logarithmic scene depth. Seeded volumetric clouds occupy a layer from 1.8–4.6 km and composite against that same depth, allowing continuous flight through them.

The current cloud integrator uses 16 samples and approximate self-shadowing. It can show banding at grazing angles; temporal reconstruction and cloud shadows on terrain are not implemented. Water reflects an analytic sky, without scene reflections or refraction. Distant trees are crossed silhouettes; tree collision, higher quality assets and broader shadow coverage remain work toward the visual target. Flight physics is an initial model: assisted travel is the default, with optional inertial flight. Landing gear suspension, aerodynamic control surfaces and re-entry heating are not implemented; swimming is not implemented. Aeon Orbital is a fixed station 100 km above the coast. Its hangar is playable; the ring, side rooms and catwalks are scenery. EVA and moving-station passenger physics are not implemented. Station collision uses conservative bounds around model triangles, including the animated hangar doors.

## Verify

```sh
npm test
npm run build
npm run test:browser
npm run test:browser -- -c scripts/inspect.config.js
npm run test:browser -- -c scripts/fidelity.config.js
npm run test:browser -- -c scripts/surface-detail.config.js
npm run test:browser -- -c scripts/station.config.js
npm run test:browser -- -c scripts/flight-model.config.js
npm run test:browser -- -c scripts/crash.config.js
```

Unit checks cover terrain seams, local coordinate precision, seed reproducibility, worker/collision agreement, continuous descent and travel between zone coordinates, physical boarding, gap-free tree LOD coverage, and real-asset station collision/docking/deck support. Browser checks compile and render shaders and exercise the playable controls. The fidelity inspection saves images and render-environment metadata under `/tmp/star-agent-fidelity`; the station journey saves `/tmp/star-agent-station`; the surface-detail inspection saves `/tmp/star-agent-surface`; the boarding inspection saves `/tmp/star-agent-*.png`.

Flight-model checks cover vacuum momentum, body-axis thrust/torque, density boundaries, stall, banked lift, terminal speed, timestep consistency and assist controls. Its browser configuration runs the inertial-control check and full station journey, saving flight evidence under `/tmp/star-agent-flight`.

The browser tests default to system Chromium with ANGLE/SwiftShader. Override `CHROMIUM_PATH` for another executable. Software-rendered test frame rates are not hardware performance claims. Render scale adapts to slow machines; `starAgent.setRenderScale(1)` fixes native scale for visual inspection.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for contribution and architecture contracts.
