# Chat and friends

On a social-enabled multiplayer server, open **Menu → Comms** and choose
**Server chat** or **Friends**. Keyboard and touch players can use the COMMS button.
Flight link still contains the hangar and account controls.

Server chat reaches connected pilots in the same server. Type a message and press
Enter or Send message. With a controller, choose Compose with controller, select
letters or Numbers / symbols, press A to add characters, then Done and Send
message. Space, case, backspace and clear are buttons. B returns from the keyboard
without sending. The right stick scrolls the draft or received history.

Friends has four lists: Friends, Requests, Online pilots and Blocked. Send a
request from Online pilots. The receiving pilot can accept or decline it in
Requests; the sender can cancel it. Remove friend ends friendship. Block ends
friendship and stops chat between both pilots; Unblock does not restore friendship.
Friends persist in PostgreSQL across reconnects/restarts. Their online status
comes from the current server roster. Lists show four entries per page on desktop
and one on compact screens, with Previous and Next buttons.

Messages use existing callsigns. There is no real-name requirement, account or
email search, direct message, offline delivery or archived chat. A connection
retains up to 100 received messages. Leaving clears that local history. Blocking
clears received history from that sender on the blocking player's client; it
cannot retract already-delivered messages from another browser.

Ordinary swearing is allowed. Explicit severe slurs, hateful violence and Nazi/
extremist promotion phrases are checked with a small, English-first rule set.
Matched messages are withheld before broadcast. A high-confidence match removes
the sender from the session and explains the reason privately; it does not ban
the account or delete inventory. Neutral words such as Jewish, gay, Muslim or
Nazi are not triggers. Clear quotation/report/condemnation context withholds the
matched term without automatically kicking. Describe an incident without
repeating a severe term. There is no moderator inbox or report queue yet.

These rules do not understand every language, context or evasion. They cannot
provide comprehensive harassment or extremism detection. See the
[explicit authority and moderation decision](decisions/0003-multiplayer-social.md)
for limits and operator configuration.

For isolated acceptance, run `npm run test:browser -- -c scripts/social.config.js`
after reserving the shared GPU. It owns ports 5544/8094 and an explicit memory
fixture with synthetic accounts. It never selects the shared account database.
Run `npm run test:social:database` for a disposable PostgreSQL migration, lifecycle,
rollback and reopen check. Set `TMPDIR` to a short writable path when `/tmp` has
limited quota; the script creates and removes only its own database directory.

Implementation, validation and integration status are recorded in
[the QA record](qa/multiplayer-social.md). This feature branch does not deploy a
public server or update the shared preview by itself.
