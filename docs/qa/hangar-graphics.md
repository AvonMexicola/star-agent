# Hangar printed graphics implementation

`createStationFinishGraphics()` in `src/station-finish-graphics.js` returns a
game-local `THREE.Group`. Add it to the station hero template before cloning.
The material and geometry cache is module-wide; clones reuse both texture sources
and all print materials. There are no custom shaders or emissive printed surfaces.
Await the returned group's `readyPromise` before marking station finish resources
ready. It resolves `true` when Selene loads, or `false` when the optional image is
unavailable. Until then and on failure, that frame displays the complete authored
freight print from the shared atlas. Rejections are handled and the promise lives
outside JSON-cloned `userData`. A Chromium check aborted the poster request and
confirmed the retained 1024-pixel atlas fallback, successful scene cloning, and no
unhandled page errors.

| Print | Centre in game-local metres | Print size |
| --- | --- | --- |
| Selene exploration | -5.1, -5.72, 25.15 | 1.12 × 1.68 m |
| Aeon orbital freight | -7.05, -5.72, 25.15 | 1.12 × 1.68 m |
| Cargo restraint safety | -8.3, -5.9, 25.15 | 0.70 × 0.875 m |
| Service inspection | -4.95, -7.10, 25.15 | 0.32 × 0.20 m |
| Equipment serial | -7.03, -7.08, 25.15 | 0.32 × 0.145 m |

All face -Z. Backplates, metal edge strips and retaining clips sit within 7 cm of
the poster plane. `Sign_`/`Detail` names exclude these visual fittings from the
station collision builder. They add no props on the floor or in the elevator path.

The existing image-generated Selene source becomes
`public/textures/station/poster-selene.webp`: 683 × 1024 pixels, 209,626 bytes.
ImageMagick resized, removed source metadata, and encoded WebP quality 85. The
original generated source remains in `assets/station/textures-source`.

The second poster is an original deterministic screen-print illustration: cargo
containers on an orbital transfer route. It shares one 1024 × 1024 canvas atlas
with a load-restraint diagram, inspection form and equipment label. Its exact
copy and diagram are authored in JavaScript. Font families come from existing
CSS tokens `--station-display` and `--mono`; physical print colours come from
`stationFinishPalette()`. The atlas redraws when optional fonts become ready and
works with local fallback fonts. No additional hosted service is required.

Both colour textures use sRGB. Prints have roughness 0.88, metalness 0 and no
emission; scene lighting provides their brightness. Shared frame/backing batches
use two instanced draws. All five prints plus their frames total seven meshes /
550 triangles, independent of station pod count. Additional near pods can still
add render calls because they are visible scene instances, not a merged station.

Validation: Node construction without `document` succeeded; a deep scene clone
retained the same geometry and material references. A Chromium headless render
at 1280 × 960 with ANGLE SwiftShader reported no JavaScript page errors. The
isolated fixture had eight draws and 562 triangles, including its one box wall.
This is a material/typography fixture, not an FPS benchmark or a claim about
the integrated hangar's lighting or walking tests.

![Atlas typography and illustration review](hangar-graphics-atlas.png)

![Scene-lit frame and material fixture](hangar-graphics-frame-review.png)
