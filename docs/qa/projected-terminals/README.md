# Projected trade terminals — production and validation record

Builder: Codex, SA-UI-004. Source base1d4181c; implementation8f7a0a8,
layout refinement4dab0f5; final phone CSS b0f14a2. Branch feat/projected-trade-terminals, isolated
.worktrees/projected-terminals, private preview5668. Scope: code-native projected
screens over existing authored terminal hardware and the existing native trade
UI. No new manufactured GLB, generated image, external site or account dependency.
No geometry/collision/interaction range, inventory, price, save or protocol changes.

## Design and physical contract

The welcome projection uses the actual site name and role, with the normal F/X
interaction prompt. Active local/settlement, commissioned shared base, standalone
pad and registered station frames follow their existing double-precision transforms.
Player base displays obey the existing power state; closed shops retain a truthful
notice. No private stock or wallet is projected into the world.

A surface screen is1.32×.825m, centre1.96m above the console base and.56m forward,
with its front matching the authored console yaw. Its lower edge is1.5475m above
the base, above the1.5m construction terminal. Two short emitter lines visually
connect it to existing hardware. Station screens are flush projections at.82scale.
All geometry is local; camera origin is subtracted before Three receives position.
Built-in MeshBasic/LineBasic materials preserve the scene log-depth contract.

Native HTML contents remain sharp at viewport resolution. A dark exchange rail
organizes the existing Buy, Cargo, Pack, My shop and Build actions around a light
manifest. Quantity, credits, cargo space, local needs and prices come from the same
snapshot/handlers as before. Page changes reset the manifest scroll position;
transaction updates retain the page and stable focus key.

At most six screens within36m allocate1024×640 RGBA textures. One screen uses
2.5MiB before mipmaps, about3.33MiB with the mip chain; the pool ceiling is20MiB.
Surface projections add two draws each (one screen/two triangles and one line
batch); flush station screens use one. Text uploads only when identity, status,
font readiness or connection changes. Screens leaving range or availability,
and the full pool on disposal, release their owned textures/materials; plane/line
geometry is shared within the pool. These are bounds, not an FPS acceptance claim.

## CPU checks

- Seven projection checks cover public identity/power truth, authored yaw and
  sub-millimetre double precision at25billion metres, nearest-six/range selection,
  texture reuse, origin shifts, disposal, closed/offline state, settlement removal
  and unlinked local terminals.
- First focused projection/economy/settlement run:19individual cases pass (before
  the additional unlinked-base case). Final normal suite:1,170individual cases
  pass, zero skips,34.39s. Final development production build:3.92s (b0f14a2), existing
  large-chunk warnings. Repository checks and requested base test-plan pass.
- The first refined build stopped at a read-only linked Vite config cache;
  the scoped authorized rerun passed without application changes.

No server/schema/transaction mutation was added. Existing economic conservation
and persistence cases are part of the normal suite; previous settlement authority
and server evidence is not relabelled as new multiplayer visual acceptance.

## Browser proceedings

Original attempts are retained; failed runs are never labelled passed.

1. Attempt01 overlapped a Transport browser because the initial guard checked
   comm==node, missing this host's node-MainThread. The renderer1512112 trapped
   during page.goto, before a loaded game. Many threads existed, unlike the
   previously diagnosed single-thread Crashpad startup. Unsymbolized first
   frame chromium+0x99b5e97; host availableRAM~1.1GiB, swap36GiB, contemporaneous
   NVRM allocation errors. A separate Transport recorder hit EDQUOT. These are
   observations; they do not establish the exact renderer assertion cause.
2. Attempt02 used disk-backed temporary storage, but the deep worktree path
   exceeded the Unix socket limit. Chromium1520796 explicitly aborted at
   process_singleton_posix.cc:313 with Socket path too long before page creation.
   The fixture now accepts a short TERMINAL_TMPDIR; root/test-results/ui4-tmp was
   used. The guard checks executable and arguments and records each launch.
3. Attempt03, same Chromium151/ANGLE GL backend, loaded successfully and passed
   the complete actual controller delivery journey in2.9min, zero application
   errors/warnings. Browser-internal GCM registration errors remain in stderr;
   they are not game diagnostics or an account requirement. Builder inspected
   projection, desktop and phone. Page-change scroll retention clipped the first
   commodity heading;4dab0f5 fixes it and moves duplicated activity into the header.
4. Attempt04 passed both cases in 2.5 minutes on runtime4dab0f5 (metadata merge
   35f746b). Actual controller flight, landing, walking, terminal access, delivery,
   excess-delivery refusal, purchase, resulting cargo, map needs, return aboard and
   launch passed. Held-input suppression passed across modal, native focus loss,
   disconnect, replacement device and unsupported mapping transitions. Keyboard
   pagination and native phone taps passed. No application errors or warnings.
   Separate owner presentation fixture passed keyboard offers and native phone
   beacon/open-state controls with recorded command intents; reach and authority
   are explicitly mocked there. Screenshots exposed cramped owner phone contents.
   CSS b0f14a2 puts five tabs in one phone row and hides disabled single-choice
   ship/storage selectors, whose identity remains elsewhere in the dashboard.
5. Attempt05 is the focused final native phone owner offer check on b0f14a2.
   It passed in 4.2 seconds with no page errors; a native tap increased the
   offered basalt from 1 to 2 SBU. The final image was inspected by the author. No redundant full world route
   is claimed for this CSS-only follow-up.

Attempt01 log:/tmp/projected-terminals-browser-01.log. Attempt02/03 original logs,
images and state: this worktree's ignored test-results/projected-02 through projected-05.
No crash core was exported or committed. All owned browser/preview processes exit
at each job's end; no other session, security setting or graphics backend changed.

## Acceptance and integration

Implementation, CPU checks and the complete injected-controller journey pass.
Final phone inspection passes; local integration follows the checked checkpoint. Author inspection is not independent review.
Physical Gamepad hardware, independent visual rubric and hardware FPS acceptance
remain separate. No public deployment is included. Existing Transport ownership
of its Freight tab/online contracts is preserved; only checked source is merged.

## Author image review

Chromium 151.0.7922.173, ANGLE / AMD Radeon 860M / OpenGL ES 3.2; desktop
1440×900 and phone 390×844. The projected screen renders above the existing
console with truthful identity and readable connection guidance. The native
manifest keeps text sharp, restores the first commodity on page changes, gives
prices/actions clear hierarchy, and retains visible keyboard/controller focus.
Long lists scroll within the manifest; phone details remain accessible.

- [Welcome projection](projected-welcome-clean.png), actual rendered game.
- [Desktop local stock](local-stock-1440.png), actual settlement needs and prices.
- [Phone commodity details](phone-conductor-details.png), actual inventory state;
  captured before the final one-row tab refinement.
- [Owner desktop](owner-desktop.png) and [final owner phone](owner-phone.png),
  explicitly mocked presentation fixtures.

The historical [settlement stock view](../settlement-stock-needs/local-stock-1440.png)
records the preceding UI, not a matched lighting/performance baseline.
Station/base frame transforms and power semantics have unit coverage; a separate
physical station or multiplayer-base visual journey was not run for this task.
