# Session-local wildlife authority

The current game has transactional local suit health and ammo plus separate
server-owned multiplayer combat. Wildlife simulation owns only offline creature
health/AI and publishes validated local bite/weapon outcomes. It is disabled
while connected online, so it cannot grant client damage or alter server state.

Creature descriptors use species generator versions and canonical body terrain,
without changing existing planet generator/save/protocol versions. Streaming
geometry is camera-relative; simulation remains JavaScript doubles. Defeated
IDs and wounds live for the session; suit injuries/ammo use existing transactions.
No creature loot, persistence schema or server replication is implied. Future
online wildlife needs an authoritative server implementation before enabling it.
