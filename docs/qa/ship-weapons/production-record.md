# Ship weapons production record

Current status: implemented development candidate; controller patrol and final
independent visual review in progress. No release acceptance or deployment claim.
Base `a748be101aad4ea672a157481044ce9ed6b03e35`, isolated branch
`feat/ship-weapon-fittings`. Brief: [ship-weapons](../../briefs/ship-weapons.md).

## Source and fit

Nine original Meridian Blender guns: Cobalt pulse, Solar lance, Singularity in S1,
S2 and S3. Hollow named barrel tips, keyed mating feet, beveled receiver armor,
service panels, cooling structure and distinct emitter assemblies. Source blend
opens as an editable lineup. Original procedural base color / ORM / tangent normal
maps are 1024² with baked vertex contact shading; no external imagery or service.
Nomad and Kestrel hull sources/UVs were not modified.

Current kit SHA256 `308a1ebeae4b1d5119dd98f96d21cc478335a638317fde19fdc542703f9cde67`:
2,806,012 bytes; 25,852 stored triangles including all six adapters; 2,232–3,368
triangles and two material draws per selected gun. All nine variants share three
WebP maps and one cached kit download. At rest only the chosen family is visible.
The actual Three sheet confirms each selected gun's two draws. Combined scene
metrics and independent review remain separate from these component counts.

Nomad uses 15 mm annular spacers. Kestrel's nose fork moves its S2 gun 1.05 m
forward; outboard return posts and wing footings follow independently sampled hull
surfaces. The open central channel preserves gear motion. Atlas roof pads and an
aft bridge between radiator fins support its three guns. Mark II keeps its original
three sockets and aft-facing bore. Flight and walking/EVA envelopes include the
actual fitted groups, without adding cabin floors.

## Reproduce

```
python3 blender/ship_weapon_textures.py
ALSOFT_DRIVERS=null blender -b --factory-startup -noaudio --python-exit-code 1 --python blender/build_ship_weapons.py
python3 blender/pack_ship_weapons.py
npm test
VITE_DEV_TOOLS=1 npm run build
npm run check:repo
npm run test:browser -- -c scripts/ship-weapons.config.js
npm run test:browser -- -c scripts/ship-weapons-patrol.config.js -g 'controller patrol'
node scripts/ship-weapon-sheet.mjs
```

Python needs Pillow (used isolated Pillow12.3.0); Blender5.2.0 LTS; Node26.7.0.
Browser configs default to the owned production preview5410, with memory API5411.
The independent kit sheet temporarily serves5412 and closes its server/browser.
Where `/tmp` has a quota, set `TMPDIR` to an existing private writable directory
on a filesystem with space. No global Chromium or system configuration is changed.

## Checked so far and retained failures

- Full unit suite684/684 and production build pass. Repo helper passes.
- Nomad, Kestrel and Atlas actual production keyboard/pointer selection/fire and
  gear interlock pass (45.9/46.7/44.9s); 1440×900 and390×844 captures, no browser
  errors/warnings. These first views precede the final05 foundation refinements.
- Native Three PBR kit sheet passes all nine variants: Chromium151, AMD860M
  ANGLE OpenGL ES3.2,1536×1152, no errors/warnings. No FPS benchmark claim.
- CPU tests retain actual exported mesh transforms at25billion-metre origins,
  muzzle/flash agreement, exact size matching, projectile tail/range and damage,
  NPC current-pose firing, obstruction, equipment collision and load failure.
- Initial texture authoring failed because system Python lacked Pillow; repaired
  with an isolated authoring environment. No runtime dependency added.
- Initial sampled nose package omitted the wide mating foot; exact mesh review
  caught its gear collision. Nose offset revised. Review also caught Nomad's
  protruding connector and the steep nose chine; current spacers/lofts address it.
- First browser crashed before page load: SIGABRT, font_data_service_impl.cc379,
  `Disk quota exceeded (122)` in its core. A private disk TMPDIR fixed startup;
  this was distinct from the earlier repository Crashpad SIGTRAP. Extracted core
  copies were deleted. No browser startup retries with security/GPU flag changes.
- First sheet imported Three twice; a Vite fixture module fixed it. A unit run
  raced the GLB packer and correctly failed the manifest-byte check; sequential
  frozen-artifact rerun passed. Neither failure is counted as successful evidence.

NPC damage now follows the same24/42 pulse profiles, with1.5s/1.75s spacing. Actual
CPU patrol defeats a stationary Nomad in20.9s versus51.15s previously; this is a
real difficulty increase. Controller patrol balance is being checked, not assumed.
No physical controller hardware or listening approval is claimed.
