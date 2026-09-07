# Atlas nose cleanup, pilot MFDs and physical action labels

2026-09-06. Continuation of draft PR #30 from `95227bc`, isolated in
`/tmp/star-agent-atlas-mark-ii`. Root owns this source and consumer integration;
shared station, equipment and main-game integration work is preserved.

## Brief and cause

The user reported front-panel protrusions and floating black boxes, requested
four pilot MFDs, and asked for a button standard that projects the action text
from its physical control. The first complete views are a close bow quarter and
the actual seated pilot view, followed by a reachable lift control.

The shaped bow overlapped legacy forward flank plates and fore spine fittings.
One sensor array used fixed world-X boxes instead of the sloping facet surface;
a second obsolete set hung beneath the loading arch. Full-height arch uprights
also pierced the lower bow armour. The legacy overlap and detached boxes are
removed, arch feet terminate inside the cheeks, and the retained sensor housings
and lenses follow the actual facet tangent and normal. Drive-pod geometry remains
unchanged. These are original Blender mesh edits, not a generated concept.

## Pilot station

Four named `PilotMFD_01..04` anchors in the GLB share positions, rotations and
screen dimensions with `layout.json`. Four framed 0.52 × 0.325 m displays replace
the old three groups of static screen marks. The instrument shelf and mounting
stalks support the new frames. The pilot eye is aligned with the chair at
`[-2.1, 11.05, -21.25]`; F/A at the reachable seat enters that view, and F/A
returns to the original standing point. Sitting does not enable flight in this bay.

`createShipMFDs()` retains its default Nomad/fleet layout and live telemetry API.
It additionally accepts authored mounts, optional frame omission and explicit
page data for other consumers. The Atlas uses four 512 × 320 canvas screens at
5 Hz, with FLIGHT, NAVIGATION, SYSTEMS and CARGO pages. Ramp and crew-lift
statuses reflect their actual moving mechanisms. Flight/navigation/manifest
connections are explicitly unavailable in this standalone studio; no simulated
fuel, shield, cargo mass or flight telemetry is represented as live data.

The runtime screens add four meshes/materials/textures beyond the static GLB
statistics. The pilot view is checked at 1440 × 900 and 56° vertical FOV, including
all screen corners inside the camera frame and readable actuator page content.

## Button standard

[Physical control standard](../../physical-control-standard.md) defines the
shared descriptor, state-derived verbs, reach/activation ownership and render-local
anchor. The reusable projected widget and stylesheet work on Atlas ramp controls,
both lift landings, the new button on the moving platform and the pilot seat.
Labels show F, A or TAP according to the active input and use a leader to the button.
Moving/interlocked controls show their actual unavailable state.

Mouse/touch label activation uses the same guarded handler as keyboard/controller
input. The handler revalidates the control ID and state. The screen-projected label
hides behind opaque structure and outside the camera; a conventional action prompt
remains available. Inspection preset buttons hide while walking so they do not
cover these controls or the pilot screens; the exit control remains accessible.

The shared hangar verbs are implemented and tested, but this branch does not
modify the station owner's hangar consumer. Its adoption point is documented.

## Corrections retained

- Close-up evidence identified the second hanging docking-box set and the
  piercing arch feet after the first sensor/legacy-armour correction.
- The first unit run caught an outdated lift-height expectation after adding
  the rider button; its authored top is now 1.32 m above the platform.
- A broad console collider initially included the whole bridge width at the
  new console depth. It was split to match the actual port-only extension.
  The bridge-cheek test samples the remaining passage between console and chair,
  while the physical journey still reaches the seat and returns to the crew aisle.
- The first four-case hardware suite passed on intermediate hero `242636ed…`.
  Final results below supersede that run and include mouse/touch label activation.

## Final validation

Hero SHA-256: `a3b6e095060b965fbc51bb7e87dea4f985521d114efeaf5493d18bfe9ea434aa`.
412,988 triangles, 168 static mesh batches, 13 static materials, 10 static textures,
38,037,892 GLB bytes. Runtime MFDs add four meshes/materials/canvas textures.
Complete LOD bounds, sizes and hashes are in the measured manifest. Compared with
upper-deck hero `659b5466…`, geometry decreases by 13,516 triangles and 853,072 bytes;
separate physical display anchors increase the static batch count by eleven.

- `npm test`: 184 passed, including the default shared-MFD power/telemetry checks.
- Production build: passed; existing large-chunk warning remains.
- Final hardware browser suite: five cases passed in 1.7 minutes with zero captured
  page/console errors. The full physical journey also enters/exits the pilot seat;
  all four screen corners fit and Systems reports the actual open aft ramp and
  upper-deck lift. Mouse and touch operate the projected lift button; Xbox input
  switches the fallback binding to A and operates the existing ramp mechanism.
- The phone capture exposed the generic button-hover style washing out the label
  over its bright physical face. The shared widget now keeps an opaque hover
  background; the focused mouse/touch case passed again, 1/1 in 13.8 seconds.
- Chromium 151.0.7922.173, AMD Radeon 860M, ANGLE GL / OpenGL ES 3.2. Presets and
  seated pilot: 1440 × 900, DPR 1. Physical walking: 480 × 300, switching to the
  full pilot resolution while seated. Phone/touch: 390 × 844. Controller: 720 × 450.
  Durations are suite timings, not frame-rate measurements.

`nose-before.png`, `nose-intermediate.png` and `nose-after.png` retain the actual
bow comparison. `pilot-mfds.png`, `lift-action.png` and `lift-action-phone.png`
come from browser tests. Extra bow cameras are inspection evidence, not a physical
journey: [-24,12,-38] looking at [-7,6.5,-22], and [0,10,-42] at [0,6,-24].

## Acceptance boundary

This remains the Atlas authoring studio. Fleet installation, live flight/cargo
adapters, station-wide label adoption, hardware budgeting, LOD visual acceptance
and independent art approval remain separate work. No merge, public deployment,
physical Xbox-device test or FPS claim is implied.
