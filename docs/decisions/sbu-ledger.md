# Physical cargo authority

Decision: implement a versioned SBU ledger in one PostgreSQL world row with an
advisory transaction lock. The existing room supports ten players; one lock gives
cross-account sales and theft an explicit atomic boundary without partial wallet
or ownership writes. Loose inventory deductions join that SQL transaction. Periodic
player-state saves do not overwrite the separate commerce ledger. This is a small
server architecture, not a sharded economy design.

Clients send resource, crate, selected ship and expected revision. Server derives
reach/boarding/docking from navigation. Per-command receipts handle retries; stale
revisions reject transactions outside the bounded receipt window. Identity and cash
never come from local saves. Shared base terminals store owner stock in this same
ledger, so sellers need not remain connected. Server and client use identical crate
packing and physical dimensions. No full base-save upload is accepted.

Migration002 adds commerce_state without touching existing accounts or player_state.
Existing player resources remain in player_state inventory; no resource reset or
mass/slot migration. Local commerce lives in the same MiningStore save as ore cuts.
The existing expedition allowance becomes the local wallet; earned sale proceeds
raise its validation ceiling but do not repeat the allowance.

Protocol3 adds shared Atlas hull/lift state, physical boarding support, cargo and
nearby mining revisions. Older clients receive the existing build-mismatch gate.
Common generated Aeon/Pyre/Selene outcrops use their original density/vein sampler.
The server validates tool/fire, elapsed time, range and terrain/landmark occlusion,
carves the same density field and saves exact yields with the field. Nearby peers
receive committed field revisions and rebuild through the existing mesh worker.
This scope does not include the separate named lunar sample rock, rings or loose
Aeon stones; their shared extraction is not claimed. The shared resource pouch is
48kg. Local mining saves are never uploaded or rewarded online.
