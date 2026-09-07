# Foundation-first construction and secured access

Requested by Cees, 2026-09-07. This is the next shared-building design; it is not
implemented by the account-scoped solo power-save slice.

## Player rules

1. Place a small starter foundation cluster on an unclaimed site, then place the
   mainframe on its supported floor. The mainframe need not occupy the geometric
   centre. A protected interior room is a player choice.
2. Installing the mainframe establishes the site's building authorization. Its
   server-owned identity controls permissions, upkeep and storage. Walking into a
   base, opening its UI or losing power never transfers ownership.
3. Doors can be locked. Default access is owner only; grant named players access or
   enable an explicit friends option. Visiting/door access and permission to build,
   remove structures, take stored items or manage the mainframe are separate rights.
4. A locked but open door remains physically passable. Locking does not close it.
   Players are responsible for shutting doors; automatic closure is not the default.
   Authorized users may close/open it normally. Unauthorized users cannot operate
   the lock or motor, but collision does not create an invisible barrier in an open
   doorway. Manual locks retain security when electricity fails.
5. The mainframe itself is locked to authorized administrators. Reaching an intact
   enemy mainframe does not allow pressing a takeover button. A future raiding
   mechanic must explicitly resolve destruction/claim replacement on the server;
   attack balance is not settled by this design. Zero-health upkeep expiry remains
   the existing removal of the whole site and its stored contents.

## Implementation sequence and boundaries

- Add a bounded provisional starter site before a mainframe exists. Only starter
  foundations may be placed there; server proximity, terrain/support, material
  debit, overlap and short expiry prevent unclaimed foundation spam. Installing a
  mainframe atomically converts it into a claim without moving placed geometry.
  Existing saves retain their anchored mainframe locations.
- Introduce authenticated claim membership with explicit roles. Resolve current
  friendships through the social service on the server; removing a friendship or
  blocking must revoke any friendship-derived access immediately. Keep deliberate
  named grants distinguishable from friendship-derived access.
- Persist door lock and open state separately. Validate every operation against
  the current account, distance, claim role and power requirements. Replicate door
  motion/collision to nearby players; an authorized client's menu is never the
  authority for a visitor's ability to pass or operate the door.
- Route construction costs, removal, container access and claim changes through
  server commands. Do not promote client-authored solo layout/inventory snapshots
  into competitive shared ownership or raiding state.
- Provide controller-native door/mainframe permissions screens using the shared
  dialog router. Physical testing must cover owner and visitor clients: locked
  closed denial, authorized operation, an open locked doorway, friendship removal,
  disconnection, power failure and a held input while a permissions dialog closes.

The current prototype still requires mainframe-first construction and uses a local
owner abstraction. The new PostgreSQL solo save records do not make these access
rules available between players. Integration should build on the shared social and
cargo authority work rather than embedding a second friends list in construction.
