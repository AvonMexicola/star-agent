The original input source fails the regression at the intended first fresh RT, after a real neutral reconnect. The corrected source passes the complete test file.

Positive invocation from this staging directory:

```sh
node --check tests/ship-mining.test.js
node --test tests/ship-mining.test.js
node tests/ship-mining.test.js
```

All commands exited 0. Node v26.7.0's `--test` invocation summarized the passing file; the direct invocation displayed the detailed node:test results: 28 tests, 28 pass, 0 fail/skipped/cancelled, 1370.819046 ms. Fifteen new concrete scenarios are covered, plus three parent grouping tests and ten unchanged existing tests.

Negative invocation, using the identical final test file and only the original input module from commit `465018802b1d5367f01b625a321fb4e37ff30973`:

```sh
node --test-name-pattern='first fresh RT after reconnect neutral' negative/tests/ship-mining.test.js
```

Exit 1, one failure, 60.43883 ms. Exact failure:

```text
AssertionError [ERR_ASSERTION]: First fresh RT after the real neutral reconnect must cut; no extra release/repress
2 !== 4
actual: 2
expected: 4
operator: strictEqual
```

The preconditions passed: both actual heads had cut, disconnect stopped them, Navigation reset `controllerActive`, the neutral reconnection armed the actual GamepadInput while `controllerActive` stayed false, and first fresh RT set it true. No extra release, retry frame or threshold change precedes the failing assertion.

The adapter's whole source is evaluated with imports/export removed solely for Node's CSS limitation; its input aggregation and neutral logic are intact. The test uses real GamepadInput and Navigation.update's actual poll/callback/ownership path, with unrelated movement stopped through an injected vehicle step. The existing real Stratum GLB, createStratum, createShipMining, muzzle obstruction and Plasma path are retained. The existing fixture's texture stubs and injected target/pipeline recorder remain CPU-only; this is not a browser/shader, native input or complete flight assertion.

Additional corrected-source cases cover held reconnect, replacement ID and index, unsupported/restored mapping, fresh keyboard/touch with connected neutral or unsupported pads, and pad/keyboard/touch through both focus and modal suppression with physical release/repress. Focus checks immediate cutter clearing before a new animation frame. No existing test or threshold was weakened.

No production source, package, browser or GPU was changed. The only delivery path is `tests/ship-mining.test.js`. The `negative/` tree, Map/event/DOM test boundaries, package support, source symlinks and this evidence stay outside the delivery archive.
