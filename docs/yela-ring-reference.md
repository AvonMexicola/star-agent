# Selene ring: Yela visual reference

The requested reference is the Yela asteroid belt in Star Citizen. The [Herald
screenshot by Glenn Batuyong](https://starcitizen.tools/File:Drake_Herald_fleeing_pirates_within_the_Yela_asteroid_belt.jpg)
is dated 26 September 2017 and identified as Alpha 2.6.3. We opened the source
page and visually inspected the downloaded image. Its large foreground rocks
have irregular outlines, angular planes, broken ridges and dark recesses.
Smaller silhouettes continue through many depth layers. Sunlit gray surfaces
and deep shadow make their volume readable against space and the moon.

The [RSI Community Hub post by Narazum](https://robertsspaceindustries.com/community-hub/post/asteroid-belt-around-yela-6QoQ2phsvSqNj)
is a second reference link. Its page was verified; the image endpoint did not
load in the browsing tool, so no specific visual findings are attributed to it.

## Translate the reference into original procedural art

- Build silhouettes first: asymmetric lobes, chipped corners, shelves and broad
  fracture planes. Small noise on a smooth sphere cannot supply these forms.
- Keep surface detail at several scales: major breaks change the silhouette;
  cavities and strata catch directional light; fine grain varies roughness.
- Use cool gray stone, warmer exposed faces, darker clefts and occasional ice or
  mineral seams. Preserve readable light/shadow contrast without making every
  surface uniformly bright or black.
- Compose foreground, middle distance and background together. A close-up of a
  single hand-mining sample cannot establish a convincing asteroid belt.
- Keep distant geometry present while the camera crosses streaming boundaries.
  Use stable descriptor identities and replace detail without a blank frame.

The reference looks densely packed. The user's later request for approximately
2 km clearance takes precedence over that density. Selene's revised v2 generator
therefore replaces the former millions-of-small-rocks population with a sparse,
deterministic population of larger bodies plus smaller mineable samples. Use the
current generator's constants and measured clearance tests for numerical claims;
the reference image cannot establish real distances or population counts.

The intended visibility envelope is 80 km, with near geometry inside 4 km and
middle-distance geometry inside 16 km. These are Star Agent implementation
requirements, not claims about Star Citizen's renderer. Large bodies remain
visible outside the collision neighborhood. Hand mining continues to apply to
small editable rocks; visual scale does not grant excavation support to an
entire large asteroid.

## Verification

`scripts/ring-visibility.spec.js` creates explicitly labeled debug-camera views
of actual generated bodies, captures a large foreground rock at 600 m and 3 km,
and looks along the belt. It checks stable geometry representation through LOD
thresholds, visibility at 60 km and continuity around a 20 km coordinate boundary.
It records browser, GPU, resolution, render scale, descriptors and actual renderer
counts. Screenshot review is still required to judge shape and depth quality.

Source images are reference material only. No Star Citizen geometry, textures or
screenshots are added to the game or its shipped assets.
