# Machine-readable coordination

`areas.json` maps paths to technical contracts and recommended checks. Maintainers
are null until a real person is appointed; the repository owner is the routing fallback.
It is not a filesystem ACL. Multiple areas can intentionally share a hook.

`tasks/*.json` records new scoped claims. Existing feature lanes remain coordinated
in HANDOFF until their owners register them. Do not infer abandonment from absence.
A task includes ID/title, milestone, human owner, agent label, state, branch/base SHA,
updated date, area IDs, claimed paths and a linked brief. Allowed states are
`proposed`, `active`, `review`, `blocked`, `integrated`, `released`, `parked`, `cancelled`.
Claims in active/review/blocked tasks are checked for overlapping paths across tasks.
`integrated` releases the claim; acceptance/deployment remain separate evidence.

Use safe repository-relative paths. A trailing slash claims a subtree. New files
may be claimed before they exist. Keep no secrets, machine configuration or real-name
requirements in this register. Helpers report cooperative conflicts and validate
shape; they cannot establish who actually ran a test or who is currently online.
