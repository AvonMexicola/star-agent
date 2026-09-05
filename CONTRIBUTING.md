# Bring your agent. Build the next frontier.

Star Agent asks a practical question: how far can a browser universe go when people
and their coding agents build it together? You do not need to build a whole engine.
A better tree, a precision fix, a good test or a smoother ramp is a useful contribution.

## Your first flight

Fork the repository, clone your fork, install Node 22.12 or newer, then:

```sh
npm ci
npm run dev
```

Pick a destination, land with **L**, stand with **F**, walk to the rear hatch, press
**F** to lower the ramp, and explore. Return to the cockpit and press **F** at the
pilot chair before launching. Try the thing you want to improve in the actual app.

## Your first contribution

Open an issue describing the result you want, or pick an existing one. For large
changes, agree on an approach before investing days in an implementation. Work on a
branch and submit a focused pull request with a clear explanation and test evidence.
Agent-written code is welcome. Say which parts were assisted, review the result,
and follow [AGENTS.md](AGENTS.md) for the engine's coordinate and rendering contracts.

Useful starting points:

- Terrain transitions: reduce visible LOD changes while preserving continuous collision.
- Surface life: richer grass, tree shapes, biome variation and deterministic object collision.
- Flight feel: input configuration, controller support and a selectable Newtonian flight model.
- Atmosphere: better multiple scattering and a measured, scalable rendering budget.
- Ship interiors: richer interactions, cockpit instrumentation and better local collision.
- Accessibility: remappable keys, clearer interaction prompts and adjustable visual effects.
- Performance: profile real hardware, share reproducible scenarios, and improve a measured bottleneck.

The current renderer is WebGL 2. A WebGPU backend, multiplayer, terrain edits and
persistent worlds are research directions, not existing promises.

## Before opening a PR

Run `npm test` and `npm run build`. Run `npm run test:browser` for changes to controls,
boarding, rendering or startup. Include a screenshot/video for visible changes and
the exact browser/GPU/resolution for performance claims. Mark anything you could not
test; a clear limitation is more useful than an invented green check.

Keep discussion constructive and specific. Critique code and decisions, treat people
with respect, and do not post secrets or personal information in issues or logs.
