# Meridian field builder

Cees requests a small handheld builder, 2026-09-08. One compact, original
construction projector draws automatically in the existing Build mode and
restores the selected equipment on exit. The existing wheel, A/Enter/touch Place,
trigger rotation, material debit, removal and save authority remain unchanged.

One-handed, approximately 30 cm long, with a rubber palm grip, ivory ceramic
cheeks, graphite receiver, ochre cartridge latch and a short guarded optical head.
A recessed flat screen reports the actual selected piece and placement validity.
A brief muzzle-to-piece projection acknowledges a successful construction action;
failed transactions produce no success effect. No new ammunition, crafting recipe,
inventory slot or purchase is required. No central bar crosses the screen.

Base: local `dev/all-features` at `5f8f018`. Ownership: Codex, isolated
`feat/handheld-builder`, `.worktrees/handheld-builder`. Scope is the new asset,
presentation module, additive equipment/socket/prop entries and narrow existing
held-tool/build hooks. Existing handheld helpers/maps are read-only dependencies.
Private preview 5670 / studio 5671 / memory API 8670; GPU jobs are serialized.

The asset uses metres, Y up, muzzle -X and the existing sidearm palm origin.
Target: <10k triangles, <1 MB GLB, <=4 material batches plus one live 256×128 screen.
Retain editable Blender source, UV/PBR, actual muzzle and screen anchors. Inspect
the exported model and actual first/third-person game views. Controller journey
covers menu entry, aiming, placement, material result, input interruption and exit;
keyboard/native-touch also reach the action. Hardware and independent visual
acceptance remain distinct from author browser evidence.
