# Handheld tool source

The current articulated mining cutter has its own [source pipeline](../field-cutter/README.md).
The commands below preserve its delegated manifest entry and do not overwrite its
moving head or yellow texture. The original cutter `.blend` remains historical
provenance. Normal/ORM maps are shared, while the new yellow basecolor has its own
cache identity and adds approximately 5.33 MiB including mipmaps.

Four original manufactured tools, authored in Blender 5.2 from the existing
`blender/build_gear.py` construction helpers. The rifle retains the 0.36 rear-stock
fit from `fit-rifle-stock.mjs`; its grips and barrel are unchanged. The tractor
shares cutter grip calibration but has an independently built induction head,
three poles, guarded aperture, teal shells and rectangular capacitor.

Rebuild from repository root (Python 3 with Pillow, Fontconfig and Blender 5.2):

```sh
python assets/handheld-tools/textures.py
blender -b -t 4 --python assets/handheld-tools/build.py
node assets/handheld-tools/pack.mjs
node --test tests/handheld-tools.test.js
```

The `.blend` files retain individually named parts, UVs, PBR nodes, packed PNG
sources, contact-AO corner colours, metre units and the muzzle/support anchors.
Final exports batch compatible materials into three or four primitives. Named
part editability is retained in Blender; held mesh consumers use the origin and
equipment sockets, not individual screw names.

The 1024² atlas contains ceramic paint, machined steel, polymer, rubber, teal and
ochre swatches plus deterministic model/service labels. Colour is sRGB. Roughness
and metalness occupy ORM's G/B channels. The independently authored micro-height
field yields a tangent normal with OpenGL +Y. Local geometric contact shading is
baked to `COLOR_0`; no scene lighting is painted into the base-colour map. A 32²
micrograin repeats within swatches to keep high-frequency detail quiet and compact.
Full PNG source maps and exact runtime WebP derivatives have recorded hashes.

`pack.mjs` measures the actual binary, replaces embedded PNGs with those WebPs,
prunes unused payload, updates the prop manifest and rejects over-budget outputs.
There is no image-generation service, borrowed image, commercial texture or paid
asset in this pass. Labels render the system JetBrains Mono font to the atlas.

Each self-contained GLB embeds the same three maps; `equipment-materials.js` shares
them between equipment assets/players for approximately16 MiB RGBA residency with
mipmaps. Geometry/materials live in the existing equipment cache. Instance disposal
does not dispose shared maps. The original cutter shader remains only as a fallback
for legacy/untextured cutter assets. Standard glTF viewers see the authored PBR.

These are held hero props, with no new distant LOD. Triangle counts remain below
10k and each download below1 MB; see the exact [manifest](manifest.json). Reduced
material draws help remote equipment without reducing the held silhouette. Scene
timing and independent art acceptance must be reported separately from those counts.
