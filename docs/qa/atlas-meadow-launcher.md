# Atlas + Burrow meadow development preset

The one-off meadow playtest becomes a named local launcher location. Selecting it
chooses Atlas, adds Burrow and restores the reviewed seed 7291. Both normal Vite
development and built `VITE_DEV_TOOLS=1` entry support it. Public entry cannot
activate the preset. Changing hull after choosing the fixed Atlas scene returns
the location selection to the station hangar.

The ship pose and canonical terrain placement come from the user-playtested
scene (44655f4 plus ramp correction 37ffcdc and clear windscreen f8415cc).
This change is based on fleet integration 2c11644, which already includes those
ramp, carrier and windscreen dependencies. No terrain, mesh or collision physics
are changed by the launcher work. Its initial rover exit uses the existing door
and steps, with its timeout paused while gameplay is paused.

## Verification

- Cees manually drove Burrow into Atlas and flew away carrying it in the original
  scene, then requested this preset. This is manual gameplay evidence.
- 35 focused unit checks pass: launcher URL/public guard/save isolation, actual
  rover surface placement and carrier, ramp ground/contact/interaction/jump checks.
- `VITE_DEV_TOOLS=1 npm run build` passes (5.68 s; existing large-chunk warning).
- Repository and whitespace checks pass.
- Independent source review found no blocking issues and separately passed the
  launcher tests, syntax and whitespace checks.
- A focused controller launcher browser route is being prepared; it has not run.
  The previous manual test does not establish new browser automation or
  multiplayer rover support.

Direct link: `/?dev=1&ship=atlas&start=atlas-meadow&intro=0&seed=7291`.
Use F2 or Menu → Dev → Test locations to find “Aeon · Atlas + Burrow meadow”.
Each launch is fresh and uses the existing isolated test storage.
