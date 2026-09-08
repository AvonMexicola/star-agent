# Nomad 02 utility ship

Nomad is Meridian Shipworks’ compact solo utility ship: an armoured forward
cockpit, a small living cabin, a rear cargo rack and a physical folding boarding
ramp. Its original authored hull, tapered habitation roof, integrated drive
housings, service panels and articulated landing legs replace the earlier broad
surveyor design. No Star Citizen geometry, textures or licensed ship assets are
used. The historical Drake Cutter starter/utility role informed the gameplay
brief; Nomad retains its own design and existing Star Agent flight handling.

## Use the cabin

Land with **L** or controller **Y**, then stand with **F** / controller **X**.
Walk down the central aisle. Beside the port berth, interact to recline; interact
again to stand at the clear aisle position. Entry and exit ease locally. Movement,
jumping and tool input are suppressed while resting. The pose follows the ship
while its existing assisted or inertial flight continues. Rest does not heal,
advance time, or create a saved logout position.

Beside the aft port rack or orange starboard chest, interact to open the shared
persistent inventory. Transfers change the same supplies and minerals shown by
the cargo display. The rack shows the installed cargo boxes: four initially,
expandable through the existing inventory action to eight. Each box provides eight
stack slots and 12 kg of mineral capacity. Supplies have a separate **120 kg**
limit. Eight visible mounts therefore support **64 slots / 96 kg minerals**, not
an invented SCU capacity. Ship and backpack contents survive a normal reload when
browser storage is available; session storage remains usable when it is not.

At the rear centre control, interact to open the hatch and unfold the ramp.
Wait for the route to clear, then walk outside. Return up the same ramp, close
the hatch, walk to the chair and interact to sit. There is no distance boarding
teleport. The hatch stays secured during moving cabin flight.

On a coarse-pointer screen, the cabin pad provides physical movement, the same
context action, and access to the shared Commands menu. Drag the view to look.
These are cabin controls; full touch flight controls are outside this change.
Controller input uses the existing standard Gamepad/router contract.

## Landing gear, fittings and displays

**G** or **Commands → Landing gear** commands the four folding legs during
powered manual flight. **U** opens Fleet. The gear uses the shared 1.8-second
clock from the flight-options lane, and Navigation supplies the sole animation
progress. Landing/docking assistance requests deployment and soft contact waits
until the feet are down. Launch retains the pilot’s down selection until it is
commanded up. The conservative flight envelope includes every gear pose and the
closed ramp. Animated suspension/contact-load simulation is not introduced.
At a gentle terrain or station contact, emergency lowering can complete with
main power off. It does not allow arbitrary unpowered airborne gear operation.

Two visible empty **S1** fittings follow the project’s
[weapon mount standard](weapon-mount-standard.md). Named `HP_Weapon_Port` and
`HP_Weapon_Starboard` sockets expose their size, fixed mount type, outward +Y
mating axis and forward −Z bore. The circular docks have the actual 0.50 m
interface and six 24 mm holes on a 0.40 m pitch circle. `installedWeapon: null`
and `socketOnly: true` explicitly distinguish these sockets from installed guns.
This change does not connect new weapon firing to them.

The four physical MFDs display live flight, navigation, systems and cargo data.
The systems page includes actual gear progress. Screen bezels, sticks, service
connectors, drawers and console switches are visible construction details; they
do not provide extra interactions or selectable MFD pages.

The scoped gear backport shares state names and the canonical clock with PR #38.
That PR’s 35 m/s gear policy, free-heading drive, revised bindings, utility lights
and per-ship handling are not included here. Its generic telescoping installer
must preserve Nomad’s existing `updateGear` adapter when the lanes are combined.

## Authoring and runtime

The editable source is `assets/ship/nomad.blend`. The scripted Blender builder
is split into `build_ship.py`, `nomad_hull.py`, `nomad_cabin.py`,
`nomad_details.py` and `nomad_finish.py`. Dimensions and rig anchors come from
`src/boarding.js`; the builder converts game Y-up/−Z-forward into Blender space
and exports back. World positions remain JavaScript doubles in metres; all asset
geometry is ship local.

```sh
blender --background --factory-startup --python-exit-code 1 --python assets/ship/build_ship.py
```

The runtime loads `public/models/nomad.glb`. Its `CargoLid`, `PilotChair`,
`NomadCabin`, eight individual cargo box roots, gear pivots and named hardpoints
are retained. The cabin liner, hatch, folding ramp, live MFDs and cargo readout are
runtime geometry. Their visible floor and moving access route agree with the
boarding layout. Asset intake validates the required rig before hiding the
procedural fallback. That fallback retains usable rest, storage and physical
boarding, but does not claim the authored S1 fittings or folding landing legs.

`pack_nomad.py` preserves position and index buffers while quantizing normals and
UVs to normalized 16-bit attributes. Three.js supports the standard extension
without an added decoder. UV error is below 0.008 pixel at 1024 px. The
checked-in runtime manifest records exact bytes, triangles, image count and hash.

The painting pipeline is separate from runtime geometry. `prepare_nomad_textures.py`
binds the upload to the original Blender hull/UV signature;
`clean_meshy_upload.py` removes only degenerate painting-copy fragments.
`import_nomad_textures.py -- --source downloaded.glb`, run through Blender,
validates the full returned painting surface and UV0 material mapping before
retaining raw maps and 1024 px derivatives. `pack_nomad_textures.py` composes those
maps with the original material regions and exports through the same staged
budget check as the builder. Exact prompt/job metadata and hashes are retained.
The pending generated finish has not yet been imported or accepted; see the
[independent pipeline review](qa/nomad-02/pipeline-review.md) for verified scope.

`/nomad/` is a production-built inspection route with exterior, rear, boarding,
pilot-eye, berth, cargo and S1 views plus ramp, storage and gear controls. The old
`/dev/ship.html` path redirects there. The studio uses its own in-memory cargo
store and does not alter the player’s save.

## Validation record

The final candidate, material provenance, review scores, screenshots and measured
performance belong in [Nomad utility delivery](nomad-utility.md). Historical
Nomad 01 images in `docs/images/nomad-*.png` describe the earlier asset and are not
evidence for this revision.
