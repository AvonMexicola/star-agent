# 0003 — Capture the mining destination with each excavation job

Status: implemented on the Burrow feature branch, pending browser verification.

Burrow's two cutters deposit into its two ore cassettes. The previous excavation
transaction always credited the player's backpack. Crediting the rover after
that transaction would duplicate or lose resources if a save failed or the player
left the cabin while the worker was cutting.

Use the existing remote-container format with `meridian-rover-bin`, kind `ship`,
two boxes and 96kg mineral capacity. No save-version, database or protocol change
is needed. `MineableRock` captures the destination when it starts a worker job;
`MiningStore.commitRock` validates that destination again and commits inventory,
rock density/revision and mining XP together. Mesh/collider publication follows
that successful commit. The default destination remains the backpack.

Unknown destinations, full or changed capacity, stale worker results and failed
writes cannot publish excavation or rewards. Two cutters explicitly pass their
own target and contact; they share the existing worker budgets and revision gate.
The existing inventory dialog handles storage and transfers through the same
container validation as other cargo.

Rover position and battery are local session state. Development starts use the
existing separate test-save storage. Reloading a test start places the rover back
aboard Atlas; saved ore and excavated rocks remain subject to that test save. This
is not multiplayer replication or a new authoritative economy.
