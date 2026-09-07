# Kestrel blockout: independent silhouette review, round 1

**Criterion 1: 3.8 / 5. Gate: FAIL (4.5 required before detail).**

The long nose, single-seat canopy, thin swept wings and twin exhausts already read
as a light interceptor. The scale is credible against the 1.80 m reference. The
main unresolved problem is volume integration: the shoulders read as thick,
constant-depth slabs, with two long rectangular drive volumes sitting on a flat
deck. That is particularly apparent from the true front and side views. This is
a promising blockout, but it does not yet have the continuous, low lifting-body
profile requested by the brief.

Only silhouette and scale are scored. Uniform materials, missing cockpit detail,
gear detail, animations and flight integration have not reduced this score and
are not approved by this review. The cropped builder top view is an evidence
framing issue, not a geometry defect; the independent top view shows the entire
asset.

## Evidence and scope

- Read `QUALITY.md`, `docs/briefs/fighter.md`, and request 24 in the live shared
  `HANDOFF.md` (the isolated worktree's HANDOFF predates that request).
- Visually inspected all six actual EEVEE images in `../../round-1/`.
- Independently rendered the immutable `.blend` in EEVEE at 1200 x 1200 with one
  neutral material, an uncropped orthographic top/front/side, and a front quarter
  view approximately 30 m from the ship centre. The figure is 1.80 m tall.
- Independent views: [top](top-ortho.png), [side](side-ortho.png),
  [front](front-ortho.png), [30 m quarter](front-quarter-30m.png).
- Actual geometry bounds: 13.501 m long, 9.000 m span, 3.210 m high on gear,
  ground contact y = 0. The approximately 1 cm height excess is a bevel extent,
  not a meaningful scale defect at this stage.
- Source SHA-256 `2d182600cc4d0b689ef14061f1a72d268ab9965ad883fccb1b3def36f8537fcd`.
  Source hash was unchanged after capture. No builder/source asset edits made.
- Reproduce: `blender -b --python docs/qa/kestrel/reviewer/render_round1.py`.
  See [capture metadata](capture-info.json). Blender emitted an installed
  extension `cattrs` import error and audio-backend warnings; the four EEVEE
  renders and geometry extraction completed. Audio shutdown was slow after
  rendering completed. No performance claim is made.

## Ranked geometric fixes

All coordinates below use the authoring convention: metres, Y up, nose -Z.
Coordinates are practical starting points, not a requirement to copy exact
vertices. The first two changes are the main gate blockers; the last three refine
the silhouette rather than substitute detail for it.

1. **Loft the shoulders into the wing instead of extruding a slab.**
   `blender/build_fighter.py:41`, `Shoulder L/R`. The current constant top 1.88 /
   bottom 1.17 gives the complete leading shoulder a 0.71 m vertical side. In
   `front-ortho.png` it is a rectangular bar spanning the centre of the fighter;
   in `side-ortho.png` it makes most of the ship look equally deep. Replace this
   prism with longitudinal sections and an outer chine: retain useful inner
   volume near |x| < 1.1, but taper the outboard edge near |x| = 1.8-2.0 toward
   wing y = 1.65-1.78. Let the upper surface slope continuously from the fuselage
   into the wing, and pull the lower outside corner upward instead of retaining
   bottom y = 1.17 at the wing boundary. The lead-in at z = -3.5 should emerge
   from the nose chine without a blunt wall; the aft root should taper into the
   drive collar rather than end as a rectangular plate at z = 5.8.

2. **Give the drive pair integrated, tapered volume.**
   `blender/build_fighter.py:52-54`, `Drive | tapered nacelle L/R` and
   `Drive | swept armour L/R`. The five-metre nearly parallel roof edges and
   constant-height outer rails make two straight runners visible from top,
   quarter and side views. Loft the ceramic cowl with the drive cross sections
   so it reads as one enclosing volume: a narrow, low lead-in around z = -0.3,
   a gradual shoulder/fullest section around z = 2.5-3.2, then a definite neck
   toward z = 5.8 and the existing large round nozzles. Remove the current
   flat roof panel's independent raised outline. Keep the twin nozzles; their
   separation and size are already a useful identity cue.

3. **Increase fin cant and tighten their side profile.**
   `blender/build_fighter.py:50`, `Wingtip fin L/R`. From the true front they
   appear as tall, almost upright stalks, and the side silhouette is a broad
   conventional trapezoid. Preserve the approximately 3.2 m height and 9 m
   span, but bring the lower attachment inward to |x| around 3.5-3.8 while
   keeping the upper tip near 4.4. Aim for roughly 30-35 degrees outward cant
   and a shorter upper chord, with both edges swept aft. For example, an upper
   chord around z = 4.45-4.98 would sharpen the current z = 4.57-5.34 top. Refit
   the full lower edge to the actual wing surface so the cant is structural.

4. **Make the outer wing trailing edge contribute to the swept silhouette.**
   `blender/build_fighter.py:43`, airfoil sections. The leading edge is effective;
   the broad, nearly straight rear edge leaves the aft half reading like one
   generic delta plate. Try a more deliberate taper through the outer two
   sections, e.g. trailing z around 4.75 at |x| = 3.2 and 4.25 at |x| = 4.5,
   retaining the current leading edge. Preserve sufficient chord under the fin
   root and move that root with the wing. Judge this as a coupled wing/fin
   outline in a true top view, not as an isolated wing edit.

5. **Blend the canopy's aft profile into the centre spine.**
   `blender/build_fighter.py:36,61`, canopy sections and fuselage crown. The
   canopy has the right single-seat footprint, but its rear slope terminates
   abruptly onto a very flat deck near z = -0.3, making it look placed on top.
   Add a narrow tapering turtleback from the canopy rear into the centre spine
   over approximately z = -0.6 to 1.0, and smooth the long crest transition
   between z = -2.55 and -1.15. Preserve the long nose and seated eye clearance;
   do not simply flatten the canopy without checking the pilot envelope.

For the next gate, submit the same six angles plus uncropped orthographic top
and front views. Check the shoulders and drives in a single neutral material;
their shape should read clearly before panel lines, colour breaks or greebles
are added. This report does not approve export, integration or PR merge.
