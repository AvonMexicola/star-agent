# Atlas Mark II design review

Pre-model design review requested through Claude CLI with `--model opus`. This is not a rendered-asset approval.

## Atlas Mark II — pre-modelling design review

I read `layout.json` and `QUALITY.md`. The volumes are sound and unusually well-proportioned: 48 m of clear bay at 6.2 m headroom inside a 64 m hull, with 10.8 m of sponson per side outboard of the cargo box (±7.2 → ±18). That side volume is the whole ship's character — spend it deliberately.

**Five highest-value decisions**

1. **Make the sponsons the Caterpillar read, not the hull sides.** Break each 10.8 m flank into 4–5 unequal angular segments along Z with visible shadow gaps and slightly different chamfer angles (~15°/25°). Unequal spacing is what stops it reading as a bus. The white ceramic panels live only on the outboard segment faces; the gaps expose the dark spine.
2. **Commit to a continuous dark structural spine from nose to tail.** The bay ceiling (8.8) to upper floor (9.5) is only 0.7 m — too thin for a believable deck sandwich. Read that as an exposed dark truss running the ship's length, visible above the shoulder shelves and behind the bridge, with the white ceramic bolted onto it as removable armour. This single move solves silhouette, material contrast, and panel-line logic at once.
3. **Bridge-forward vs. front ramp is your hardest conflict.** The forward ramp pivots at z −24 directly under a bridge whose glass starts at 9.5 and runs to z −25. Open, the nose becomes a mouth and the bridge reads as a lander canopy. Resolve it by insetting the bridge glass ~2 m aft of the hull nose behind a brow/visor cowl, and stepping the front ramp aperture in from the flanks so the bay mouth is clearly a sub-feature of a larger prow.
4. **Interior scale needs vertical furniture, not floor clutter.** 6.2 m of headroom in an 8 m drive lane will read as an empty room. Hang the detail: overhead gantry rails, cable runs, retractable tie-down booms, per-frame ribs at ~4 m spacing on the bay walls with amber-numbered frame markers. Bay walls dark, ceiling dark, floor mid-value with mint edge lighting on the lane boundary — the lane should be legible from the aft ramp view.
5. **Trim-sheet everything.** At ≤60 k tris and ≤4 MB for a 64 m ship with two decks (QUALITY.md §5), per-panel geometry is not affordable. One 1024² trim sheet for panel lines/grilles/hatches, one for decals, geometry reserved for silhouette bevels only. Bevel width should be constant in world units (~3–4 cm) so light catches consistently at 30 m.

**Failure modes I'd expect**

- **The white box.** 36 m of white ceramic with uniform panel lines is a fridge. Vary panel size 3:1, and let the dark spine interrupt the white at least four times along the length.
- **Turret clearance.** `Mount_S3_Aft` at y 14.6 leaves 1.4 m under the 16 m hull ceiling; an S3 turret will overrun the stated envelope. Either the hull box is nominal-excluding-mounts, or drop the mount. Confirm before modelling. The shoulder mounts at y 8.9 sit 0.6 m *below* the upper deck floor — they need recessed barbettes in the shoulder shelf, or they will read as glued-on.
- **Undefined upper lobby.** The elevator's high stop is (5.5, −4), which is outside both the corridor box (±1.3) and the galley (z 1–10). There is an unmodelled upper landing vestibule; design it or the lift opens into a wall.
- **Emissive blowout.** Mint at full intensity under ACES will bloom into white and destroy the ceramic/petrol distinction.

**Materials and light.** White armour albedo 0.8 / rough 0.45; dark polymer 0.16 / rough 0.6; brushed metal metallic 0.65 / rough 0.35 on the spine and ramp hinges. Petrol only as a thin iridescent accent on chamfer returns and thruster nozzles — never as a broad panel. Mint `#b6efd1` for status and emission, amber strictly for the ramp beacons, lane edges and bay warnings. Light the bay with its own practicals (two rows of amber-white bars) plus mint spill from the lift gate; exterior key at ~35° from camera-left with a cool fill, so the top chamfers separate from the flanks.

**First-render acceptance criteria.** Both ramps open at their touchdown angle (the 8 m ramp / −0.331 rad geometry lands exactly on the deck plane — keep it), the 1.80 m figure at the aft ramp and on the bridge, and the six `views` from the JSON at 1600×900. It passes when the flank segmentation is legible in silhouette at 30 m, the dark spine is visible from three of the six views, no emissive clips, and tris/draw calls are inside §5. I am not signing off on the look until I have those renders in hand.
