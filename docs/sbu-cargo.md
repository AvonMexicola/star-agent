# SBU cargo and trade

An SBU is a **standard box unit of volume**: a 60 cm cube, or 0.216 m³.
Crates come in 1, 2, 4, 8, 16, 32 and 64 SBU sizes. A 64 SBU container reserves
1.2 × 2.4 × 4.8 m of cargo grid. Each SBU currently packages 16 kg of resources;
this packaging balance does not redefine SBU as a mass unit.

| Playable ship | Grid | Capacity | Examples |
| --- | --- | --- | --- |
| Nomad 02 | Aft starboard, 1 × 4 × 2 cells | 8 SBU | Eight 1 SBU, four 2 SBU or two 4 SBU crates |
| Atlas, 30 m hull | Two side decks, each 2 × 8 × 16 cells | 512 SBU | Eight 64 SBU containers |
| Kestrel | No walkable cargo grid | 0 SBU | Personal inventory only |

Volume alone does not guarantee a fit: an 8 SBU crate is too wide for the Nomad.
The Nomad berth, sample locker, port rack and centre aisle remain accessible.
The Atlas grids exclude its belly elevator, both side lifts, forward passage and
sample chest. The separate 64 m Atlas Mark II studio is not this playable hull.

## Buy and pack

Walk to the freight terminal in your station hangar and press **F / controller X**.
Select **Buy**, the resource, crate size and docked ship. A successful purchase
places a real crate on that ship's grid. Walk back aboard to see the delivery.
Insufficient money, stock or a compatible grid slot rejects the whole transaction.
**Cargo** lists the same physical crates; **Sell** sells an accessible upper crate
at the station. **Pack ore** converts loose resources from the selected source into
a crate at the terminal. Existing expedition sample lockers remain separate.

The **Trade** tab is also in the gameplay menu (**Escape / controller Menu**).
It shows cargo anywhere; purchases still require a nearby terminal and a landed
ship. Online, **Call this ship to berth** brings the selected Nomad or Atlas to
your station berth while you are outside it with empty hands.

All lists have explicit pages, with no scrolling required. D-pad/stick selects,
A confirms and B returns to play; LB/RB changes the main gameplay tab.

## Carry and salvage

Inside a hold, look toward the marked grid and press **F / X** to inspect it.
Only a **1 SBU** crate can be carried; hands hold one crate at a time. Remove the
upper crates first. Approach your own grid and choose **Stow carried crate**.
Carrying occupies the hands and prevents ship control and weapon/tool use.

Online cargo belongs to the server ledger. Another pilot can take reachable
1 SBU crates after physically boarding. Closed hulls block walking. Larger crates
use **Salvage to my ship**: bring your parked receiving ship within 40 m, stand
within 6 m of the crate, and board or disable the source ship. The receiving grid
must fit it. This is an initial mechanical transfer action; a crane/tractor-beam
animation is not implemented. Cargo stays saved when its owner disconnects, but
disconnected ships are not currently rendered as persistent wrecks.

## Run a player shop

On sufficiently flat planetary ground, open **Trade → Build**. A terminal and
36 × 36 m landing pad cost 500 CR. Look across the site: its centre is placed 22 m
ahead. Keep 100 m between pads; each owner may build four. Pad markers appear
under the navigation **Bases** filter.

Land centrally, walk to the terminal, pack your mined ore and choose **Cargo →
List for sale**. **My shop** sets per-SBU prices and withdraws unsold stock.
Visitors choose a resource and their docked ship; purchases load their hold and
credit the seller even while the seller is disconnected. Solo shops use the same
UI and local save; join through Comms before building a shared shop.

Shared mining currently supports the common generated Aeon, Pyre and Selene
outcrops with a 48 kg resource pouch. Named lunar sample rocks, ring extraction
and loose Aeon stones retain their existing separate behaviour. Server resources,
stock, credits, crate custody and mined fields persist in PostgreSQL. Solo mining
saves are never imported into online accounts.

Implementation and actual validation evidence: [SBU QA record](qa/sbu-cargo.md).
