# SA-MESH-001 — Blender mesh cleanup baseline

Requested by Cees on 9 October 2026: scan model topology, identify overbuilt
simple shapes such as pyramids, find overlapping faces that may Z-fight and
provide basic instructions other agents can use to clean models in Blender.

Owned scope: read-only Blender scanner/core/selection helper, focused fixtures,
[cleanup guide](../mesh-cleanup.md), concise QA evidence, registry claim and narrow
links in the asset standard/local-development documentation plus HANDOFF.
No model repairs, runtime changes, dependencies, preview ports or deployments.
Base: local `dev/all-features` `6bb57a7732684f0855f028a2b22163ae22139351`.

Acceptance: JSON/Markdown reports with located object/polygon findings and source
identity; exact and near-coplanar positive-area overlap within/between objects;
simple-shape and dense-plane hints; basic topology warnings; configurable metre
tolerances; explicit sample/budget/scope limits; no source/model saving; repeatable
Blender and geometric checks; real asset baseline; actionable cleanup/verification
instructions that preserve source, materials, hierarchy and gameplay contracts.
Independent art acceptance and actual model cleanup remain separate tasks.
