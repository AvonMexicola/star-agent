# 0003: Social authority and moderation

Date: 2026-09-07. Status: implemented on the isolated social feature branch;
integration and release are separate decisions.

The existing same-origin authenticated WebSocket carries an additive `social`
message type with bounded `requestId`, `action`, and action fields. The sender is
the admitted account; uploaded identities are ignored. Commands arriving after
room welcome but before social loading wait in the existing bounded socket queue.
No silent early acknowledgement loss is accepted. Existing world/protocol versions
remain unchanged because this adds optional messages, not physics or save format.
The UI requires the social-enabled server before enabling chat/friend controls.

`server/social.js` serializes social work within the one ten-player room. Chat is
not stored in PostgreSQL or sent to later arrivals. Connected clients retain at
most100 received messages until disconnect. Chat is at most400 Unicode code points
and1600 UTF-8 bytes, single-line plain text; invisible controls are removed.
The burst budget is4 messages with one token replenished every2seconds. Friend/
refresh actions allow20 per minute. Per-account budgets survive reconnect for
10minutes, retain64 request results and are capped at2048 accounts. Socket payload,
traffic, connection, origin and authentication limits still apply.

Migration004 adds canonical account-pair `friendships` and directed
`social_blocks`. Requests require a live-roster target. Persisted relationships
can be accepted, declined, cancelled, removed or blocked while their peer is
offline. Crossing requests retain one pending request; neither grants implicit
consent. PostgreSQL locks the two account rows in ID order. A block and friendship
deletion are one transaction. Each account has at most100 relationships and100
outgoing blocks. The memory adapter follows the same contract for explicit tests.
Migrations are discovered by unique numbered filenames; independently authored
commerce002, base003 and social004 must retain different numbers.

`store.areFriends(a, b) -> Promise<boolean>` and the service delegate return true
only for an accepted mutual relation with no block either way. This is the hook
for the separate station-protection work; pending/removed/blocked/self pairs are
false. Social presence derives from room IDs. The physical multiplayer roster is
already public to admitted pilots; blocking does not make a ship invisible.

The service returns only a caller's own relationships and outgoing blocks, with
ID/callsign/status. There is no callsign, email or account-existence lookup. Unknown,
offline and blocked request targets share the same generic acknowledgement.
Blocking withholds future chat in both directions; the blocking client clears
its received messages from that sender. Blocking cannot retract messages already
delivered to someone else's browser. Storage errors close the live social
connections to avoid permissive stale block caches; no success is fabricated.

`CHAT_POLICY` in `server/chat-moderation.js` is a small, explicit English-first
policy with severe slur, hateful-violence and promotion phrases. Operators may
pass a reviewed policy to `createServer({chatPolicy})`; no client can set it.
Normalization covers full-width/combining characters, selected confusables,
leetspeak, zero-width insertion and bounded letter spacing. It does not remove
all word boundaries. Ordinary profanity and words such as Jewish, gay, Muslim or
Nazi are not banned by themselves. An equipment-context regression preserves
phrases such as “white power cable.”

Matches never broadcast. High-confidence matches acknowledge rejection privately,
emit a generic moderation reason, invalidate queued social work and close the
authenticated socket with4003. Clear quotation/report/condemnation context still
withholds the term but avoids an automatic kick. There is no permanent ban,
inventory penalty, moderator inbox, durable report queue or chat archive.

This rule-based policy does not understand intent, all languages, every slur or
all obfuscation. Reclaimed/ambiguous terms can be withheld; adding reporting
context can avoid a kick but cannot cause a matched message to broadcast. It is
not a complete harassment, threat, extremism or moderation solution. New rules
require false-positive and evasion regressions and review before rollout.
