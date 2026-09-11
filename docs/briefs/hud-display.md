# SA-UI-003 — Three HUD display modes

Cees requests Tab to cycle Everything → Markers and reticle → No HUD.
Everything preserves contextual visibility. Markers retains navigation beacons,
ship recovery and hostile/lead markers, the centre reticle and targeting ring.
No HUD hides screen overlays; ship instruments and other physical scene objects
remain in the world. Loading, recovery and explicitly opened native dialogs stay
usable. Modes do not alter simulation, inventories, targeting, or input arming.

Settings exposes the same action to keyboard, standard controller and touch.
Tab in a dialog keeps normal focus behavior. Held Tab advances once; a two-finger
canvas tap restores Everything on touch. Each page starts with Everything.
The conflicting combat Tab listener is removed; Next target and Menu → Ship
retain hostile selection. No new dependency, asset, server or protocol change.

Owned worktree: `/tmp/star-agent-hud`; branch `feat/hud-display-modes` based on
`01a28df`; focused browser preview5666 and isolated memory API8666.

Validation: focused controller/input and combat units, full unit suite, build,
repo checks, desktop and390×844 native-touch captures, a complete controller-only
Settings cycle/return and held-input focus/disconnect checks. Evidence and actual
results are recorded in [QA](../qa/hud-display.md); acceptance remains separate.
