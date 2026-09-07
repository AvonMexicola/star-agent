# Bastion native capture

This is a portable capture fixture authored by the Bastion builder and executed by the root hardware runner. A separate reviewer judges the resulting images. It uses the exact frozen GLB with its native materials; no station scenery, effects or authority code is included.

Copy both `.mjs` files into `scripts/station-defense-review/`, or run them from the shadow directory with `BASTION_REVIEW_ROOT` set. Existing repository dependencies are used. The script starts its own loopback Vite service on the reserved port 5565, launches Chromium once, captures five 1600×900 PNGs plus `capture.json`, then closes the browser and server. It does not retry a failed launch, fall back to software rendering or overwrite an earlier `capture.json`.

```sh
BASTION_REVIEW_ROOT=/home/cees/projects/star-agent-community-hub \
BASTION_REVIEW_OUT=/home/cees/projects/.community-hub-qa/bastion-native-05 \
BASTION_BROWSER_TMP=/home/cees/projects/.bstmp \
BASTION_REVIEW_PORT=5565 \
node scripts/station-defense-review/capture.mjs
```

The output and temporary paths above are executor-owned examples; use a short browser temporary path to avoid Chromium's Unix socket path limit. `CHROMIUM_PATH` can select the repository's supported executable. Run only during the explicitly granted GPU window.

Full exterior, side and posed views fit every actual world vertex with a framing assertion. Bore and base/cradle views are explicitly cropped details with their own vertex coverage records; no geometry is hidden. A one-metre ground grid communicates scale. Actual named muzzle world transforms are asserted for each pose. The recoil image is a still, not a motion review.

Lighting uses the previously verified native review's ACES exposure 0.95, RoomEnvironment intensity 0.75, key 2.6, fill 1.0 and hemisphere 0.35. A 4096² PCF shadow map fits the actual posed vertices plus their projected floor shadows; bias is −0.00008 and normal bias 0.020 m. Cast and contact shadows remain enabled. The larger map accommodates the battery's 39 m length. These fixture choices are recorded rather than attributed to station lighting.

The capture records local and served SHA256, source commit/dirty state, layout and fixture hashes, actual Chromium/GPU identity, renderer and asset counts, PBR map decoding, exact poses/cameras and browser diagnostics. It makes no art, live strike, transition-quality, station-placement or FPS claim. The frozen candidate is `ccc8f276dc07891aff056fded88367607a28d5f5aa2897e39b9ae973fca3472f`.
