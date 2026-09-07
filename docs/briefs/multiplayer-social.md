# Multiplayer chat and friends

Requested by Cees, 7 September 2026. Owner: SA-SOCIAL-001, isolated
`feat/multiplayer-chat-friends` from `4694776`. Integration remains with the steward.

Add server-wide text chat and persistent mutual friends to the ten-player room.
Players use existing callsigns, request friendship from live pilots, explicitly
accept or decline, remove friends, and block/unblock chat. Online status follows
the actual admitted roster. There is no account/email search, offline chat,
direct messaging, hosted moderation service or real-name field.

The authenticated socket supplies identity. Bound text, traffic, request replay
and lists; persist social changes independently of inventory. Block before
broadcast and disconnect the sender for explicit severe hateful abuse. Ordinary
swearing and neutral identity/history discussion are allowed. Clearly quoted or
reported severe terms are withheld without an automatic kick. A kick is not an
account ban and does not delete inventory.

Owned additions: `server/social.js`, `server/social-store.js`,
`server/chat-moderation.js`, migration004, social UI/CSS, focused tests and docs.
Narrow hooks: database/Prisma, authenticated WebSocket entry, multiplayer client
and Comms UI, gameplay-menu topmost-dialog handling. No room/physics, main,
remote-character, cargo/trading, base-power or shared live-service changes.

Validation requires real authenticated socket checks, disposable PostgreSQL
consent/block/race/rollback/reopen checks, production Comms keyboard/controller/
touch journeys and held-input suppression. Controller composition must enter
actual text through the on-screen keyboard. Record physical-device validation
separately. See [the decision](../decisions/0003-multiplayer-social.md).
