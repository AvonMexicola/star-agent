# Star Agent

A browser spaceflight experiment: fly continuously around a procedural quarter-Earth planet, descend through its atmosphere, land, and explore on foot. Star Citizen is the visual reference and long-term fidelity target; this prototype does not yet match that production quality.

## Run

Node 22.12 or newer:

```sh
npm ci
npm run dev
```

Open the URL printed by Vite. WebGL 2, a desktop keyboard and mouse, and hardware acceleration are recommended. Core play needs no account, API key, hosted service, or paid asset. Audio starts only after a user gesture: keyboard handover in the opening, or Sound in the H options panel.

## Explore and share

The default seed is `7291`. Open `/?seed=42` for another planet, or enter a seed in the controls panel (H). Share the resulting URL. The same seed and client generation versions produce the same terrain, destinations, vegetation placement, and cloud noise for everyone; this is deterministic generation, not multiplayer synchronization. Cloud animation follows each session's elapsed time.

The active terrain generator is version **2**. Its expanded landforms differ from the original generator even with the same seed. Future generation changes must update that version; old algorithms are not archived by the seed URL.

The default opening starts inside the station hangar. Press W (or move the controller stick) to blend into first person, walk to the rear hatch, and board. Taking control dismisses the launcher controls while retaining the player HUD and cockpit displays. Use ?intro=0 for the previous orbital start. See the [station opening guide](docs/station-opening.md).

WASD moves, mouse or arrow keys steer, Space/C ascends/descends, Shift boosts, X brakes, and the mouse wheel adjusts assisted flight speed. Open H (controller Menu/Options) and expand **Quick transit** for location shortcuts. Shift + click a destination to set a bearing and distance for **continuous flight**. Climb when the destination lies beyond the horizon. A plain destination click performs optional quick transit; ordinary flight does not use it.

Press **V** while freely flying to toggle inertial flight. Releasing thrust then preserves momentum; arrow keys and Q/E apply rotational thrust, and mouse movements adjust rotation rate. Space/C thrust along the ship's up/down axis in this mode. **X** stops translation and rotation; **V** restores assisted braking. Inertial flight includes inverse-square gravity (9.81 m/s² at sea level), density-dependent drag, banked wing lift and loss of lift beyond stall angle. It shares the atmospheric/space speed limits below and retains the station approach speed limit. Assisted mode remains the default, with gravity/aero compensation and altitude-scaled travel speed. The transition readout maps 70–20 km above sea level to ATMO 0–100%; it is a regime blend, not air density. Orbit/quick-transit resets assist to on.

**P** toggles ship main power from the pilot chair. **F** lets you stand during ordinary flight: assisted flight holds the current course and speed while you walk inside either ship. Approach the chair and press F to resume piloting. Shutdown preserves momentum and disables propulsion; external exits remain secured in flight. See [ship power and cabin flight](docs/ship-power.md).

Press **4** (or the **EXTERNAL 4** button) to see the ship from above and behind; press again to return to the cockpit. Normal flight controls still steer the ship. The camera retracts near terrain and station walls, temporarily returns to cockpit in tight spaces, and keeps independent view selections for walking and piloting. On foot, **4** toggles first person / an animated third-person player view; normal walking and jumping controls still apply.

Forest layout is independently versioned at **2**: seeded groves and clearings replace the previous dense tree lattice. This changes tree placement for existing seeds without changing terrain heights or destinations. Clients must run matching generation versions to reproduce the same world.

WASD moves, mouse or arrow keys steer, Space/C ascends/descends, Shift boosts, X brakes, and the mouse wheel adjusts assisted flight speed. Shift + click a destination to set a bearing and distance for **continuous flight**. Climb when the destination lies beyond the horizon. A plain destination click performs optional quick transit; ordinary flight does not use it.

Press **V** while freely flying to toggle inertial flight. Releasing thrust then preserves momentum; arrow keys and Q/E apply rotational thrust, and mouse movements adjust rotation rate. Space/C thrust along the ship's up/down axis in this mode. **X** stops translation and rotation; **V** restores assisted braking. Inertial flight includes inverse-square gravity (9.81 m/s² at sea level), density-dependent drag, banked wing lift and loss of lift beyond stall angle. It has a 3 km/s travel cap and retains the station approach speed limit. Assisted mode remains the default, with gravity/aero compensation and altitude-scaled travel speed. The transition readout maps 70–20 km above sea level to ATMO 0–100%; it is a regime blend, not air density. Orbit/quick-transit resets assist to on.

L engages landing assistance near dry terrain or polar ice. After landing, F stands from the pilot chair. Walk aft, press F at the rear hatch, wait for the ramp to lower, and walk outside. Return up the ramp, approach the chair, press F to sit, then L to launch. Boarding is physical; F outside does not teleport you aboard. Tab hides the interface.

Press **M** for the **system map** and select Aeon or Selene. **ENGAGE DRIVE** or
**J** starts continuous travel with an optical tunnel, automatic alignment and
arrival braking; **X** aborts. The drive tops out at **0.9c**; short moon routes
reach a lower peak. Ordinary flight cruises at **250 m/s** in atmosphere
(**400 m/s** boosted), rising smoothly to **3 km/s** in space (**9 km/s** boosted).
See the [space travel guide](docs/space-travel.md) for clearance limits and controls.

## Controller

Connect a gamepad and press a button, then release the controls to start. Uses the browser's [Standard Gamepad mapping](https://www.w3.org/TR/gamepad/#remapping), including recognized Xbox and PlayStation controllers. Mouse capture is optional. Sticks have a radial deadzone and proportional movement in flight and on foot. Release controls after switching windows, closing help or reconnecting to resume movement.

| Control (Xbox / PlayStation) | Action |
| --- | --- |
| Left / right stick | Move and strafe / look and steer |
| RT / LT · R2 / L2 | Ascend / descend |
| LB / RB · L1 / R1 | Roll left / right |
| A / ✕ | Jump on foot |
| B / ○ (hold) | Brake translation and rotation |
| X / □ | Interact with pilot chair or hatch |
| Y / △ | Land, dock or launch |
| L3 (hold) / R3 | Boost or sprint / toggle flight assist |
| D-pad up / down | Increase / decrease assisted speed |
| View / Share | Toggle HUD |
| Menu / Options | Open / close controls |

In help, the D-pad selects controls, A / Cross activates, B / Circle closes, and the right stick scrolls. Menu initially focuses MAIN POWER while seated. Seed entry still uses the keyboard. Controllers without a standard browser mapping are reported as unsupported; custom remapping and vibration are not implemented. Controller availability depends on browser/OS support and requires HTTPS or localhost.

Hit terrain, polar ice or water at **12 m/s or more into the surface** and the ship is destroyed. The impact uses surface-normal closing speed, including terrain slope, before collision stops the ship. A short procedural explosion and crash screen replace flight; propulsion, launch and boarding stay disabled. Choose **Return to orbit**, press O, or use an explicit destination shortcut to restart with the same seed. Gentle contact and landing assistance still work. Station damage, persistent wrecks and deformable ship parts are not implemented.

## Visit Aeon Orbital

Shift + click **Aeon Orbital** to set a course for continuous flight, or click it normally for optional transit to the exterior approach. The doors open automatically as you approach. Fly forward with W, brake with X over the central pad, and press L to dock. Approach speed is limited automatically near the station.

F stands from the chair. Walk aft, use F at the hatch, wait for the ramp and walk onto the hangar deck. Return up the ramp to the chair and press F to sit. L lifts the ship gently to bay clearance; reverse with S to leave through the doors. Walking stays on the supported deck; jumping into space is not part of this prototype.

The port has twenty numbered modular berths and two slowly rotating rings, each 2.9 km across. Walk to the aft cargo terminal and press F to transfer supplies between your ship and a persistent station warehouse. **Take all** moves everything that fits; the ship crate also has Take all and Stow all. At the aft elevator, F calls the door. Walk inside, press F and choose the central concourse or another berth. Your ship remains parked in its original bay. The concourse has a directory, seating and panoramic glazing. These are single-player spaces; multiplayer berth assignment is not implemented. See [the station guide](docs/aeon-orbital-port.md) and [authoring pipeline](STATION-PIPELINE-MEMORY.md).

## Visit Selene

Selene is a procedural, cratered moon with a 434.35 km radius, held at a fixed position 24,000 km from Aeon’s centre. Its orbit is compressed for the prototype; this is not an astronomical simulation. Broad dark plains, crater bowls, bright rims and surface relief share one deterministic lunar surface function. The moon uses the scene’s sunlight and atmosphere/depth rendering, so its phase and visibility change with your viewpoint.

Click **Selene** for an optional descent approach, or Shift + click it to set a course for continuous flight. Press **L** to land, **F** to leave the chair, walk aft, use **F** at the hatch, and walk down the ramp. Explore with **WASD** and jump with **Space** in lunar gravity (1.62 m/s²). Return up the ramp, **F** sits, and **L** launches. **O** returns to Aeon orbit. Controller landing, interaction and walking use the same controls as Aeon.

The surface streams detailed terrain, with collision and walking height sampled from the same crater generator. The HUD reports height above local terrain, including crater floors below the moon’s reference radius. Selene is airless and has no water or vegetation; it stays the same across planet seeds. Its position is fixed, without orbital motion or an N-body gravity simulation.

The landing area overlooks a deep impact basin, with steep crater walls, fractured ridges, smaller craters and basalt outcrops. Sunlit ice grains drift above the ground, and a tilted belt of ice/dust bands and 1,800 asteroids arches overhead. See the [landscape and rings guide](docs/selene-landscape.md).

See the [lunar exploration guide](docs/selene.md) and [complete planet pipeline memory](PLANET-PIPELINE-MEMORY.md). Moon checks: `node --test tests/moon.test.js tests/navigation.test.js` and `npm run test:browser -- -c scripts/moon.config.js`. Browser evidence is saved under `/tmp/star-agent-moon-evidence`.

## Rendering

- Terrain ridges, valleys, coastal cliffs and glaciers come from one shared CPU height function. Collision, rendering, biomes and vegetation use that function.
- Quadtree terrain streams during flight, retaining parents and skirts while children load. CPU world coordinates remain double-precision metres; render positions subtract local origins before GPU upload.
- Soil, fractured stone, moss and rippled sand use procedural albedo/relief layers, blended by slope and biome. Local sun shadows and prefiltered sky lighting give surfaces depth. The cabin retains a physical floor, hatch and ramp.
- Forests form seeded groves and clearings on a 16 m candidate grid. A worker generates approximately 256 m tiles, retaining nearby tiles during movement. New instances and their shadows fade in over 0.8 seconds. Detailed branches, simpler middle-distance branches and distant crossed silhouettes use overlapping dithered transitions and a 1.4 km fade. Tree placement stays fixed across LOD and origin changes. Grass and rocks cache terrain samples separately and fade with distance; uploads cover only live instances.
- Water uses filtered wave normals, Fresnel sky reflection, sun glints, depth-coloured shallows and animated shoreline foam. Shore depth comes from the same terrain mesh; wave detail does not displace sea level.
- The HDR atmosphere uses Rayleigh/Mie single scattering and logarithmic scene depth. Seeded volumetric clouds occupy a layer from 1.8–4.6 km and composite against that same depth, allowing continuous flight through them.

The current cloud integrator uses 16 samples and approximate self-shadowing. It can show banding at grazing angles; temporal reconstruction and cloud shadows on terrain are not implemented. Water reflects an analytic sky, without scene reflections or refraction. Distant trees are crossed silhouettes; tree collision, higher quality assets and broader shadow coverage remain work toward the visual target. Flight physics is an initial model: assisted travel is the default, with optional inertial flight. Landing gear suspension, aerodynamic control surfaces and re-entry heating are not implemented; swimming is not implemented. Aeon Orbital is a fixed station 100 km above Aeon; the default opening uses a twilight berth, while intro=0 retains the coast location. Its twenty hangars and central hub are playable; ring interiors, side rooms and catwalks are scenery. Passenger elevators use explicit transit. EVA and moving-station passenger physics are not implemented. Station collision uses conservative bounds around model triangles, including the animated hangar doors.

The current cloud integrator uses 16 samples and approximate self-shadowing. It can show banding at grazing angles; temporal reconstruction and cloud shadows on terrain are not implemented. Water reflects an analytic sky, without scene reflections or refraction. Distant trees are crossed silhouettes; tree collision, higher quality assets and broader shadow coverage remain work toward the visual target. Flight physics is an initial model: assisted travel is the default, with optional inertial flight. Landing gear suspension and aerodynamic control surfaces are not implemented; swimming is not implemented. Aeon Orbital is a fixed station 100 km above the coast. Its hangar is playable; the ring, side rooms and catwalks are scenery. EVA and moving-station passenger physics are not implemented. Station collision uses conservative bounds around model triangles, including the animated hangar doors.

Re-entry adds orange/yellow emission and animated plasma streaks to windward hull surfaces as air density and speed increase. It uses the flight model's density with a dynamic-pressure × speed proxy, smooth heating, and slower cooling. This is a visual effect, not a temperature or heat-damage simulation. Glass, emissive instruments and the cabin volume are excluded.

## Verify

```sh
npm test
npm run build
npm run test:browser
npm run test:browser -- -c scripts/inspect.config.js
npm run test:browser -- -c scripts/fidelity.config.js
npm run test:browser -- -c scripts/surface-detail.config.js
npm run test:browser -- -c scripts/station.config.js
npm run test:browser -- -c scripts/hangar.config.js
npm run test:browser -- -c scripts/flight-model.config.js
npm run test:browser -- -c scripts/travel.config.js
npm run test:browser -- -c scripts/opening.config.js

npm run test:browser -- -c scripts/crash.config.js

npm run test:browser -- -c scripts/reentry.config.js

npm run test:browser -- -c scripts/ship-camera.config.js

npm run test:browser -- -c scripts/forest.config.js
```

Unit checks cover terrain seams, local coordinate precision, seed reproducibility, worker/collision agreement, continuous descent and travel between zone coordinates, physical boarding, gap-free tree LOD coverage, and real-asset station collision/docking/deck support. Browser checks compile and render shaders and exercise the playable controls. The fidelity inspection saves images and render-environment metadata under `/tmp/star-agent-fidelity`; the station journey saves `/tmp/star-agent-station`; the surface-detail inspection saves `/tmp/star-agent-surface`; the boarding inspection saves `/tmp/star-agent-*.png`.

Flight-model checks cover vacuum momentum, body-axis thrust/torque, density boundaries, stall, banked lift, terminal speed, timestep consistency and assist controls. Its browser configuration runs the inertial-control check and full station journey, saving flight evidence under `/tmp/star-agent-flight`.

Re-entry checks cover the heating threshold, vacuum boundary, timestep consistency, material ownership and weather-shader composition. Its production browser check renders the exterior hull cold/hot/cooled and exercises flight telemetry; evidence is saved to `/tmp/star-agent-reentry`.

Forest checks cover deterministic tile generation, grove density, dateline continuity, bounded worker requests, retained appearance times and stale replies after transit. The forest browser inspection saves aerial/ground images and browser/GPU metadata under `/tmp/star-agent-forest`. Set `FOREST_BASELINE_URL` to a running older client to capture the same seeded poses for comparison. These measurements describe one location, not a global density or hardware FPS guarantee. Terrain LOD morphing and higher quality distant tree shapes remain separate work.

The browser tests default to system Chromium with ANGLE/SwiftShader. Override `CHROMIUM_PATH` for another executable. Software-rendered test frame rates are not hardware performance claims. Render scale adapts to slow machines; `starAgent.setRenderScale(1)` fixes native scale for visual inspection.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for contribution and architecture contracts.

Expanded mining, controller commands, shared backpack/storage, EVA and asteroid rings:
[expedition guide](docs/selene-expedition.md). Selene's orbital color patches now
show [resource provinces](docs/resource-geology.md), with matching mineable outcrops.
Run `npm run test:browser -- -c scripts/expedition.config.js` for the integrated journeys.

Original mining slice: [mining guide](docs/selene-mining.md).
