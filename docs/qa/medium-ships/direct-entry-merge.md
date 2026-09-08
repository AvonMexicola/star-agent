# Checked startup and cache integration

The medium branch incorporates the checked development successor `9d9b3fe`
(normal PR86 merge). Its complete tree is identical to reviewed `a7d08ee`;
unfinished base-commerce/protocol6 work is excluded.

Only two merge conflicts require resolution. The cache side-effect import is
the actual first line of `src/main.js`, before medium imports or eager loaders.
The normal test command retains the full union of both parents:143 distinct
files, including all four medium suites and the new model-cache suite. Incoming
entry policy, optional scene menu and content-versioned model URLs remain intact.
Medium Fleet preparation, isolated storage, camera diagnostics, controls and
mining routes remain intact. The other342 tracked source/server files are
byte-identical to the medium parent `1d3d9c3`.

Validation in the isolated merge tree on 2026-09-08:

- Normal suite:1083 passed, zero failures/skips,34.495 seconds.
- Focused startup/cache/entry/medium/mining:58 passed, zero failures/skips,
  3.563 seconds.
- Development production build:PASS15.91 seconds, `main-B2NOonl7.js`; existing
  greater-than-500kB chunk advisory retained.
- Repository and whitespace checks:PASS.

The exact receipt and logs remain under `/tmp/star-agent-medium-direct-entry-qa`.
These checks use the merge parent's Art02 Stratum and Art10 Gannet; subsequent
checked art and fixture commits are preserved when root integrates this merge,
with final asset checks and a fresh production build before keyboard/touch routes.
No new browser, performance, shared service, database or deployment claim is made.
