# SBU cargo verification

Implemented on `feat/sbu-cargo-trading`, stacked draft PR70 on the combined
content review PR68. Independent art acceptance, physical-controller testing and
public deployment are separate from this implementation record.

## Capacity and physical fit

| Hull | Usable grid | Capacity |
| --- | --- | --- |
| Nomad 02 | Starboard aft, min `[.94,1,2.16]`, cells `[1,3,2]` | **6 SBU** |
| Playable 30 m Atlas | Two side decks, min `[-5.7,4.025,.1]` and `[4.5,4.025,.1]`, each `[2,8,16]` | **512 SBU** |

Cells are 0.6 m cubes. The Nomad keeps its berth, port rack, sample chest and
central aisle. The Atlas reserves the full belly lift, both side lifts, forward
passage and sample chest. Its eight 64 SBU containers each reserve
1.2 × 2.4 × 4.8 m. The separate 64 m Atlas Mark II studio needs a different grid.

The reproducible test loads the **complete runtime Nomad assembly**, including
its procedural cabin liner and adopted GLB. Every cargo bounding box is checked
against all visible hull/furniture triangles; 0.1 mm excludes legitimate surface
contact. Both final holds have zero intersections. Walking and lift clearance,
packing support, overflow, identity conservation and 1 SBU hand limits are tested.

The initial 4 SBU layout was conservative. A GLB-only audit suggested 8 SBU, and
that version completed the browser journey. The full assembly subsequently found
42 triangle intersections with the sloping roof/liner. Reducing to three vertical
layers gives the final **6 SBU** capacity. The earlier flat-ceiling inference is
superseded. Atlas deck tread and aft beam intersections were also caught and
removed by raising its grid base to 4.025 m and moving its front to Z=.1 m.

## Persistence and multiplayer

The combined checkpoint passed 848 unit tests and 96 multiplayer checks with one
pre-existing SQL-only fixture skipped. Additional final collision/transport checks
pass; the final suite counts are recorded with delivery below.

Isolated PostgreSQL tests run migration002 twice, settle concurrent sales without
overselling, roll back a deliberately failed cross-table write, close/reopen the
store and compare saved state. The existing development database is never used
as a disposable fixture. Local write failures and stale tabs preserve old cargo.

Server checks cover docking/reach, 1 SBU carry, rejected 2 SBU pickup, theft,
resource packing/replay, Atlas hull selection and a seller earning while offline.
A visitor continuously walks an open foreign Nomad ramp; a closed hatch blocks it.
The player-pad test also walks from terrain onto the newly built pad and reaches
its terminal through ordinary input packets. Initial fixture placement is explicit.

Real authenticated WebSocket clients receive the committed public manifest while
keeping each wallet private. Reconnection retains the crate and spent credits
without another starting allowance. Common Pyre outcrops use exact server-side
carving/yields and reject forged range/fire. Named lunar sample rocks, ring
extraction and loose Aeon stones are outside the new shared extraction path.

A final authority audit added identical client/server EVA hull and cargo sweeps:
closed Nomad hulls and raised Atlas belly floors block entry; open ramps and a
lowered Atlas lift leave physical openings. Larger salvage uses actual ship speed,
so a stationary person inside a moving ship cannot bypass the parked-ship rule.

## Browser evidence

Chromium151, one worker, injected standard Gamepad, 1440 × 900 and 390 × 844.
No physical controller or FPS/performance acceptance is claimed.

The combined three-case run passed in 3.2 minutes, with no captured page/console
errors: controller Nomad purchase → physical return → carry/stow (1.5 minutes),
Atlas full hold/keyboard cargo/phone paging (53.5 seconds), and controller-built
surface pad → walk to terminal → phone shop (47.2 seconds). This Nomad checkpoint
used 8 SBU; the affected final 6 SBU journey is rechecked before delivery. The
surface case explicitly starts on Selene; it does not claim a flight there.

The Atlas manifest is an explicit eight-container capacity fixture. Actual buying
and delivery are exercised by the Nomad journey. Controller-held RT is suppressed
across closing the dialog, and purchase focus is retained after saving.

Failed attempts and fixes are retained in the local raw logs:

- Atlas preload originally targeted localStorage while dev starts use a separate
  in-memory save. The explicit cargo-test seed now initializes that isolated store.
- Atlas side targeting originally used the whole grid's centre; ray/volume targeting
  now recognises the face of a nearby long container.
- Oblique feedback steering stalled at the Nomad doorframe. A centred ramp waypoint
  fixed the test route without changing or bypassing hatch collision.
- An unscoped Atlas selector matched a hidden Inventory button too. It now targets
  the open Trade dialog.
- Screenshot inspection found mobile shop buttons overflowing their own rows.
  Price controls now share a row, with Withdraw below; assertions check row bounds.
- The player terminal now has a readable unlit display, including on a dark surface.

Raw captures/logs: `/home/cees/.cache/star-agent-sbu/`. Curated delivery images are
stored alongside this record once the affected final cases pass. Rendered online
multi-player boarding has not been independently playtested; its current evidence
is authoritative simulation, real transport and local render/input checks.

## Authoring and cost

Original Blender5.2 source: `assets/cargo/build.py` and `freight-kit.blend`.
Detailed crates contain 2,592–3,888 triangles and occupy 186–279 kB each. Their
actual bounds, including handles and latches, fit the nominal cells. Runtime
labels show size and resource. Materials/labels are instanced; dense manifests
retain authored detail for the nearest24 crates and use authored low-detail meshes
for the remainder. All512 individual 1 SBU crates packed in296 ms in a CPU probe;
this does not establish rendered performance.
