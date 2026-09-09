# Focused location arrows

Cees requested HUD arrows only for the next objective, selected POI and the
player's ships/vehicles. All destinations remain browsable on the map. Existing
filter preferences control signal discovery and aiming, without restoring the
startup wall of arrows. Required freight/recovery guidance advances with the
live cargo ledger; optional recovery loot is selectable on the map. Each active
contract supplies its next step. Current patrol guidance is retained.

The existing ship recovery marker stays visible from a rover. Spawned, unoccupied
Burrow and owned Sentry vehicles gain live position markers. Other players'
vehicles remain selectable through the map. No movement, input binding,
inventory mutation, dependency or save/protocol change.

Worktree `fix/focused-location-arrows` based on `d2202c1`; private preview port5694.
Files are listed in SA-NAV-002. Local integration follows source/build and focused
browser checks; no public deployment is part of this task.
