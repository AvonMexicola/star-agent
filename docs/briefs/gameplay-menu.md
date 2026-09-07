# Gameplay screen

Cees requests one viewport-contained in-game screen with tabs for Comms, Map,
Contracts, Inventory and Loadout, plus useful ship/settings screens and a Dev tab
on the development server containing the console list. No player scrolling.

Reuse actual native screens and their transactions/input ownership. Add common
fixed chrome, LB/RB and keyboard tab selection, and explicit pagination for long
lists. Retain neutral-input gates, controller-only journeys, keyboard and touch.
Dev tools stay gated by the existing development launcher build flag. No new
runtime dependencies, protocol changes or fabricated chat service.

Visual plan: existing navy #0a1721, white #e9f1f3, mint #b6efd1, muted #80979f and
amber #e2bf87. Barlow display, DM Sans body, Space Mono bindings. A full-viewport
ship terminal: header, persistent tab rail, working panel, fixed footer. On phones
tabs form two rows and dense data uses explicit pages or a detail subview. Controls
and information remain visible at1440×900 and390×844.
