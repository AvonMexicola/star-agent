# Settlement stock and logical needs — author validation

Builder: Codex settlement economy lane, SA-SETTLE-002. Feature d50bc56,
combined with checked foundation development 01a28df at 1f8a20a.
No independent reviewer is claimed. No geometry, shader, dependencies, save
schema, network protocol or shared settlement authority changes.

## Implemented and checked

Four complete commodity stock/target profiles seed new markets once. The
existing finite warehouse is the source for quotes, transactions, terminal
needs and map summaries. Excess deliveries fail before cargo or wallet mutation.
Existing saves, including depleted and above-target reserves, remain unchanged.

- Seven new economy cases and sixteen existing settlement/market cases pass:
  `node --test --test-isolation=none tests/settlement-economy.test.js
  tests/station-market.test.js tests/settlements.test.js` (23 pass).
  They cover actual inter-market cargo and money conservation/profit, replay and
  stale rejection, full and partial demand, same-site spread, marginal bids,
  migration/reload, failed-save rollback and map summaries.
- Combined `npm test`: **1,147 individual cases pass**, zero skips, 42.52 s.
- `npm run prisma:generate` and `npm run test:multiplayer`: **191 pass,
  two existing opt-in skips**. No production database was used or modified.
- `VITE_DEV_TOOLS=1 npm run build`: pass, 13.65 s. Existing chunk-size warnings.
  First combined sandbox build stopped at read-only linked Vite cache; approved
  rerun passed. No application workaround was added.
- `npm run check:repo`: pass. Retired stale SA-MARKET-001 review metadata only
  after confirming its complete branch head fae04d4 is already a dev ancestor.
- `npm run plan:checks -- --base origin/dev/all-features` and `npm run branches`
  recorded the suggested checks and concurrent ownership. The remote base is
  older than local integrated work; these helpers do not certify gameplay.

Logs retained under /tmp/settlement-needs-{focused,prisma,multiplayer,union-build,
union-units,union-repo,plan,branches}.log. Repository evidence records outcomes;
local logs are not promised as remotely downloadable files.

## Browser journey

`npm run test:browser -- -c scripts/settlement-economy.config.js` passes
**1/1 in 2.6 minutes**, one worker/no retries, isolated 5652. Chromium
151.0.7922.173, ANGLE OpenGL on AMD Radeon 860M (radeonsi krackan1 ACO),
1440 × 900 and 390 × 844, seed 7291. Zero page/console errors or warnings.

The fixture starts at the explicit Stillwater approach, with two previously
purchased conductor crates and a destination reserve at 255 of 256 SBU. It
physically lands, leaves the cabin, walks to the terminal, fills the final
need for 80 credits, rejects a second excess crate, buys ice, verifies cargo
and map changes, walks back to the seat and launches. All navigation and trade
selection use injected standard Gamepad; additional keyboard and native-touch
pagination pass. Held RT is suppressed across modal closure, actual browser
focus loss/return and Gamepad disconnect/reconnect until neutral.

Builder inspected original [desktop stock](local-stock-1440.png),
[phone stock](local-stock-390.png), [filled delivery](delivery-filled.png)
and [updated phone map](map-needs-phone.png). Text fits without horizontal
overflow; the phone commodity list scrolls within the existing trade panel.
The completed shortage disappears from the map and the newly bought ice becomes
a replenishment need. [Controller receipt](controller.json) records the exact
fixture, graphics and resulting cargo/warehouse state. Originals, including
physical approach/entrance/return captures, remain under
/tmp/star-agent-settlement-needs-evidence; log /tmp/settlement-needs-browser-01.log.
This lane needed no failed browser rerun or runtime workaround.

Physical Gamepad hardware, independent visual review and continuous
interplanetary flight are not established by this injected approach fixture.
No automatic production or multiplayer settlement economy is claimed.

## Final local combination

Checked Burrow a75b82f was merged at 9e49597. Settlement, trading and navigation
runtime files are byte-identical to the passing browser candidate 1f8a20a.
Only the package test list conflicted; both additions remain. This final union
passes **1,154 individual unit cases**, zero skips, 32.98 s, production development
build **6.10 s**, and repository checks. Logs at the union paths above now record
this final run. No additional GPU run was needed for unchanged settlement code.
