# Subtle navigation marker types

Cees requested slightly distinct marker types following the focused HUD arrows.
Retain the existing Space Mono labels, dark navy backing, sizes and positioning.
Objectives use an amber dotted diamond; selected POIs a soft-white location pin;
ships a mint hull outline; ground vehicles a pale-blue rover outline. Each edge
arrow retains a small matching type icon in its label. A selected objective or
vehicle keeps its type/color and receives only a thin selection outline. The
aimed-target ring uses the same type color.

Palette: navy `#07151c`, soft white `#edf5f1`, amber `#e2bf87`, mint `#b6efd1`,
pale blue `#a9cde2`. Symbols use fixed monochrome SVG strokes, with no motion or
extra text. Existing map discovery, marker eligibility, navigation and controls
are retained. Review icon legibility in actual desktop/phone screenshots.

Branch `fix/navigation-marker-styles`, based on local `70a2db5`, reuses the clean
isolated focused-location-arrows worktree. Own marker JS/CSS, the shared icon
helper and evidence-path options in the existing browser fixture. No dependency
or shared main-loop hook. Private preview5694; local integration follows checks.
