# Projected exchange terminals

Cees requests more advanced terminals: project a login/welcome screen, then show
actual contents like a high-resolution website when a player interacts.

## Design

Use the existing hardware and physical F/X route. A luminous planar projection
above the console carries the real site identity and a Connect prompt; interacting
opens the existing native trade dialog, rendered as sharp HTML at viewport
resolution. No extra account/password requirement or fake authentication.

Palette: midnight ink #0b1c25, deep teal #163c46, panel white #edf4f1,
text ink #14333e, mint #b6efd1, amber #efc28c for shortages and warnings.
Retain existing bundled display/body fonts, with large site names, readable body
copy and tabular numerals for quantities/prices. Desktop uses a compact vertical
cargo navigation rail beside a broad commodity list. Mobile uses a wrapping
navigation strip and a scrollable list; focus and 44px actions remain visible.

Projection silhouette is the memorable element: a floating glass-like screen
with two restrained emitter lines. No decorative dashboards, fake telemetry,
new solid props or animated scanline interference. Real stock, needs, quotes,
cargo and base-owner controls use their existing handlers. Freight integration
must retain the transport owner's new tab and action renderer.

Plan critique: a generic dark card grid would repeat the pilot menu. Use a light
cargo manifest area and a dark terminal rail, so opening physical hardware feels
like accessing that exchange while existing global gameplay tabs remain available.
All selectors are scoped to the trade dialog; shared menu and input code stay owned
by their existing lanes.

## Runtime contract and checks

Projection graphics are non-colliding, code-native display planes on existing
Blender hardware. Local geometry and subtract-origin positioning preserve world
precision. Use built-in Three materials with log depth, no new shader/backend.
Only nearby terminals allocate textures; bound the active pool, update textures
only when displayed state changes, and dispose all owned resources. Closed and
unpowered bases display truthful status and existing trade permissions still apply.

Source base1d4181c, isolated .worktrees/projected-terminals, preview5668. No runtime
dependency, generated image, new manufactured asset, save/protocol change or
production deployment. Verify actual game before/after, display placement,
controller land/walk/trade/cargo/return journey and held-input transitions,
keyboard/native390touch and1440desktop layout, diagnostics and bounded resource
counts. Physical hardware and independent art/performance acceptance remain separate.
