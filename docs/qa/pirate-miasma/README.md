# Crimson vacuum habitats production record

Development candidate from checkedcc1e749, SA-PIRATE-003. No shared integration or
deployment claimed. Parent appearance 48be92e is privately composed in 63164c5;
its browser/independent acceptance is pending. The original tower/Crimson sources
and prior Hush evidence remain in assets/pirate-* and docs/qa/pirate-compound.

Initial18 focused invariants pass1.244s: existing balance/asset/save contracts,
additive independent Veil stock, both enclosed/interlocked door routes and swept
closing protection, Miasma all-five-ship pad envelopes, every actual ramp step and
the canonical route around the raised pad. Combined full 160 registered files pass (58.507 s, disk-backed test-results/unit-all-01.log); production build passes (9.33 s, 389 modules). Focused pirate tests pass after composition (3.019 s). Repository/plan/diff checks pass; plan suggestions are not acceptance. Browser and combined appearance acceptance remain pending.

Survey failures retained: the initial small Vitriol search found low slab relief
but its straight ground corridor crossed steep rock detail. A first bounded route
found long ramps outside the intended claim envelope and was rejected. The wider
1024-candidate survey checks four orientations, limits both ramp runs and finds
a short supported site with core2.096m/pad3.709m relief. Its five waypoint ground
route is sampled every0.5m, max gradient0.411. The route is guidance only; actual
navigation and collision use the canonical body sampler. No terrain was changed.

The previous Hush test assumed an always-open exchange door; the new closed
habitat correctly blocked that assertion. It now verifies closed collision first,
then explicit open passage; additional checks exercise real shared DoorMotion,
opposite-door interlock and a person obstructing the closing sweep. No save
validation was weakened. Complete controller/phone fixtures will exercise both
actual door controls before delivery.

The focused three-case browser batch is frozen for Miasma controller traversal,
Hush keyboard/native-phone interlocked doors and commerce, then both-site art plus
Miasma's actual reduced burst and retreat. The controller case walks into the outer
leaf sweep, requests closing, observes blocked motion and reopens with X before
continuing. It purchases, views and sells cargo, exercises focus/held/disconnect
gates, and leaves through both actual doors. Phone and art use explicitly declared
nearby presentation poses; they do not replace that physical journey.

Fixture preflight initially rejected a callback parameter without Playwright's
required destructuring; no browser launched. Corrected test listing passes for all
three new cases and all four retained Hush cases. Original source assets and prior
HDR repair evidence remain unchanged.

## First renderer run and corrections

Miasma01 on frozen fabe36b completed in 10.4 minutes: full controller journey
passed (6.1 minutes), Hush keyboard/native phone handlers passed (1.2 minutes),
and the final art case failed after capturing both sites. Its fixture registered
a second non-configurable getGamepads override on the same page; the precise
error was `Cannot redefine property: getGamepads`. Making the injected property
configurable fixes that test-only setup. All original images, state, source hashes,
runner output and failure video remain in ignored test-results/miasma-01. Source
before/after hashes were unchanged. No application error was observed in either
completed journey.

Author and parent image review found two actual issues: the long airlock touch
action overlapped the right-hand movement arrows, and procedural Miasma plants
grew through the compound slab and entrance. The contextual action now occupies
free lower-left space; its focused native check requires disjoint bounds and
actual movement-button hit targets. The scenery fix uses the same composed player
and settlement claims as construction, deriving their actual authored footprints.
It preserves canonical terrain, original assets, ship clearing and exterior
colonies. It also covers the ordinary Verdigris site.

The generic clearance uses JavaScript double body-frame origins and quaternions.
Flora margins use maximum absolute model extents about the planting origin,
measured from all four original GLBs, plus accepted slope and animated wind.
Fragment margins are 0.4 metres. Four new tests pass (102.5 ms), including original
vertex/node-transform checks, stationary rebuilding after construction changes,
actual mineral instance locations and exact preservation of exterior colonies.
Existing Miasma/pirate files pass (1.029 s). Build passes (6.05 s, 390 modules).
A multiline sandbox build initially failed writing the existing symlinked Vite
cache with EROFS; the already-authorized standalone build command passed without
an application/configuration workaround or a new permission request.

The unchanged-key CPU probe covers 357 pieces in three Miasma claims: 10,000
updates average 0.0449 ms, with 79 effective envelopes after contained footprints
are removed. This is a Node CPU probe, not an FPS claim. Follow-up renderer work
checks native input layout, both rigid pirate habitats, actual flora/fragment
instance transforms and the parent's two matching Verdigris art cameras. The
completed controller route is not rerun for visual-only clearing/CSS changes.
