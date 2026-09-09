# Planetary rotation

Cees requested spinning planets. The feature is locally integrated into
`dev/all-features` at `8f819ac`, with checked faction/vacuum-base delivery 2a6e405
preserved. The paired 5178/API8087 preview serves protocol 9; no public deployment.

Aeon, Selene, Pyre and Miasma rotate around Y on a default 60-minute day. Existing
body centres, canonical terrain, building/mining saves and parked-hull anchors
stay intact. Sunlight, sky, atmosphere and surface rendering share consistent
frames. Flight/boarding/collision preserve physical poses and velocity across
three-radius rotation domains; existing eight-radius gravity domains are unchanged.
Server time and peer frames synchronize online play; no schema migration.

Combined checks pass 1233 normal cases,204 multiplayer cases with 2 existing skips,
production build and repository checks. Four-world phase rendering and full
controller landing/day-night/boarding/launch pass. Combined controller moon drive
and two authenticated skewed-clock station clients pass in browser09.
See the [QA record](../qa/planet-rotation/README.md) and
[handoff](../qa/planet-rotation/handoff.md) for exact source and retained failures.
Physical devices, independent domain/art and performance acceptance remain pending.
