# Step-by-step player guidance

Cees requests stronger, continuous handholding: start walking, find the Nomad's
rear hatch, open/board/close, reach the chair, launch, retract gear, then choose a
destination with M or a contract with Tab, and continue with appropriate next steps.

Replace the misleading near-station departure/docking prompt with observed journey
state. A persistent, optional Flight guide panel shows one current action and its
actual keyboard, controller or touch controls. Continue through targeting, drive
charge, arrival/descent/landing, exploration/reboarding, and patrol/report steps.
Do not automate movement, accept contracts or advance on timers. Respect native
dialogs, HUD modes, current ship access and existing input arming. Plain Tab opens
Contracts; Shift+Tab retains HUD cycling and native dialog focus remains intact.

Owned branch: `feat/step-by-step-player-guide` from `c5eb519`. Core files:
`src/player-guide*`, `src/main.js`, `src/opening-sequence.js`,
`src/gameplay-menu.js`, `src/hud-display.js`, help/control documentation and
affected keyboard QA shortcuts. Private browser preview5700, one GPU worker.
No server/protocol/schema/assets change or public promotion in this feature scope.

Validation: state-transition regressions, existing opening/controller tests, build,
actual keyboard and standard-Gamepad opening→boarding→launch→navigation/contracts,
desktop/phone and touch guidance, modal/held-input guards, optional guide setting,
HUD cycling. Record observed checks and limits; injected Gamepad is not physical
controller testing. Integrate checked work locally under the standing instruction,
preserving other drive/tractor/Greenbank changes and the append-only shared journal.
