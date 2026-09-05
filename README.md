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

L engages landing assistance near dry terrain or polar ice. After landing, F stands from the pilot chair. Walk aft, press F at the rear hatch, wait for the ramp to lower, and walk outside. Return up the ramp, approach the chair, press F to sit, then L to launch. Boarding is physical; F outside does not teleport you aboard. Tab hides the interface.

## Rendering

- Terrain ridges, valleys, coastal cliffs and glaciers come from one shared CPU height function. Collision, rendering, biomes and vegetation use that function.
- Quadtree terrain streams during flight, retaining parents and skirts while children load. CPU world coordinates remain double-precision metres; render positions subtract local origins before GPU upload.
- Soil, fractured stone, moss and rippled sand use procedural albedo/relief layers, blended by slope and biome. Local sun shadows and prefiltered sky lighting give surfaces depth. The cabin retains a physical floor, hatch and ramp.
- Forests use detailed branches nearby, simpler branches at middle distances, and crossed tree silhouettes farther away, with overlapping dithered transitions and a 1.4 km fade. Trees keep their seeded positions across LOD and origin changes. Grass and rocks are instanced.
- Water uses filtered wave normals, Fresnel sky reflection, sun glints, depth-coloured shallows and animated shoreline foam. Shore depth comes from the same terrain mesh; wave detail does not displace sea level.
- The HDR atmosphere uses Rayleigh/Mie single scattering and logarithmic scene depth. Seeded volumetric clouds occupy a layer from 1.8–4.6 km and composite against that same depth, allowing continuous flight through them.

The current cloud integrator uses 16 samples and approximate self-shadowing. It can show banding at grazing angles; temporal reconstruction and cloud shadows on terrain are not implemented. Water reflects an analytic sky, without scene reflections or refraction. Distant trees are crossed silhouettes; tree collision, higher quality assets and broader shadow coverage remain work toward the visual target. Flight is assisted rather than orbital mechanics; swimming is not implemented. The station modules and Blender assets are separate experiments, not part of the playable scene.

## Verify

```sh
npm test
npm run build
npm run test:browser
npm run test:browser -- -c scripts/inspect.config.js
npm run test:browser -- -c scripts/fidelity.config.js
npm run test:browser -- -c scripts/surface-detail.config.js
```

Unit checks cover terrain seams, local coordinate precision, seed reproducibility, worker/collision agreement, continuous descent and travel between zone coordinates, physical boarding, and gap-free tree LOD coverage. Browser checks compile and render shaders and exercise the playable controls. The fidelity inspection saves images and render-environment metadata under `/tmp/star-agent-fidelity`; the surface-detail inspection saves `/tmp/star-agent-surface`; the boarding inspection saves `/tmp/star-agent-*.png`.

The browser tests default to system Chromium with ANGLE/SwiftShader. Override `CHROMIUM_PATH` for another executable. Software-rendered test frame rates are not hardware performance claims. Render scale adapts to slow machines; `starAgent.setRenderScale(1)` fixes native scale for visual inspection.

See [CONTRIBUTING.md](CONTRIBUTING.md) and [AGENTS.md](AGENTS.md) for contribution and architecture contracts.
