# Frozen candidate 08 handoff

The exact builder is `blender/build_station_defense.candidate-08.py`, SHA256 `27053c6edd6e23039cdc5a6c37801d23f1c9559c218153f959e5f9f5c7234a3a`. Parent export succeeded: GLB `8d0dcbb6395479ad083cd609217833b97c74008acdd15b72ed9182ced46b64ae`,948,632 bytes/9,877 triangles/nine primitives/two materials. The source and asset are frozen. No author GPU/browser launch occurred.

All 700 added triangles are individually named in manifest.candidate 08Additions.components, with parent-local bounds and actual per-component triangle counts. Nothing was removed or moved from 07. Four gasket stocks(28tri each) plus returned plates(44tri each) contribute 288 triangles; two 8-sector journal rings contribute 128; 14 six-sided captive heads contribute 280; two quads contribute 4.

| Added component | Parent-local placement and attachment | Clearance implication |
| --- | --- | --- |
| Two aft fork covers | Existing outer faces absX8.55; Y5.32..8.72, Z2.02..4.24 with raked aft side. Gasket begins7mm inside the shell; cover overlaps gasket6mm and has an actual65mm edge chamfer. | All new faces lie on the outer fixed fork side, away from the pitch cavity. HighestX8.687 is below existing cap extent8.82. |
| Two journal backings | Yaw absX8.546..8.598, centered Y9/Z0; innerR1.19/outerR1.72, eight sectors. |4mm buried in the supporting cheek, behind the existing outer lock. These do not enter the moving trunnion side. |
| Two receiver covers | Pitch absX6.168..6.312, Y±1.5, Z−5.02..−1.88. Each has four captive hex heads. | Still288mm inside the cheek inner plane at absX6.60, and outside the1.55m trunnion radius. Parent's matching motion test includes them. |
| Two supported identifiers | Yaw absX8.704,Y5.49..5.89,Z−.81..1.61, over the existing service-panel flat; same PBR material. |4mm decal separation, below existing raised seams. Glyphs are upright from their respective outward views; actual native readability remains pending. |

Actual16-check delta PASS is `delta-07-08.json`; reusable probe is `assets/station-defense/check_delta.candidate-08.py` SHA256 `875cb9f532e84367d7e0f763a56337c38a2e8de5a40968759eec5fab77c7ec7b`. Every original oriented triangle, normal, UV and rig record is retained;115 original triangles have changed measured contact AO. A deliberately moved muzzle vertex in a throwaway copy correctly fails retained geometry and cylinder checks.

The actual GLB's 19, 001 vertices certify a continuous all-yaw cylinder R 29.6/Y 0..38.1 over full pitch/recoil. The exact extrema/witnesses and derivation are retained in the delta JSON. Parent's actual 08 motion JSON passes 188/188 poses in 15.405s, 77, 720 triangle pairs, 1, 316 independent pose assertions and zero reported failures. This is separate from station-placement and visual acceptance.

Source recipe probe `check_source_08.py`/`check-source-08.json` checks all9,177 original UV triangles against the identifier patch plus4px guard and verifies no map pixel changes outside the patch. Texture payload196,888B is only2B more than07. Original07 is preserved in `archive-candidate-07`.

For native 08 use the exact previous cameras, lights, shadow settings and named poses. Only the expected GLB SHA, expected triangle count(9, 877) and output path change. Native images, independent art grade, fresh station placement, runtime rendering/motion and performance are not granted by this source handoff.
