# Construction and creature audio — 7 September 2026

Source branch: feat/construction-fauna-audio, based on local dev 7c173f5.

- Building placement: .65 s settling thump with fasteners and a final locking click.
- Pyrebear: 1.55 s low chest/subharmonic growl, irregular throat pulses and breath.
- Sulphurhound: 1.05 s higher, rougher snarl. Current fauna species ID `suloher`
  maps to the same sound; canonical sound ID is `sulphurhound-attack`.
- Existing weapon size/pitch behavior is retained. Interruptions now stop long
  one-shot voices as well as cutter audio. Playback remains gesture gated.

BuildSystem.place calls onSound after successful material/storage commit.
Main forwards it to GameplayAudio.event. Invalid placement, failed saves and
sync/reload stay silent. Positional effects use existing distance/pan behavior.

## Evidence

28 focused building/audio cases pass. Full npm test passes all 95 configured
file suites. Production build passes, with inherited >500 kB chunk warning.
Repository check passes. The origin-based plan includes older local-only
integration changes; actual patch scope is audio, the placement callback and docs.

Chrome sound studio tested at port 5522: Pyrebear RMS .042, Sulphurhound .034,
placement .019; all emit real PCM. Mute yields zero voices/RMS, with no captured
console warnings/errors. These are playback measurements, not independent
listening approval. No new controller bindings or physical-device journey claim.

## Fauna source integration

`fauna-attack-hook.patch` is a small source patch against the active SA-FAU-001
worktree. It adds onAttack at windup entry, forwards a cloned world position
through onSound, and binds the callback to the shared mixer in main. The fauna owner has now applied the callback, and Nova applied only the two
committed audio-module diffs to that worktree. Do not apply the patch twice. The fauna runtime/GLBs were not copied or committed by this audio task.
The full creature feature remains in its owner worktree and is not yet live in
the shared preview. No whole-creature gameplay/browser acceptance is claimed.

The studio buttons audition the sounds independently of unfinished creature AI.

Source integration verification: `node scripts/verify-fauna-audio.mjs /path/to/fauna-worktree`
passes against the current owner source for both species. The real simulation
emits exactly one growl at windup entry, none on later windup frames, a fresh
sound for the next attack, and no attacks after death; suspension stops voices.
It uses the actual owner GameplayAudio and generated PCM with a mock WebAudio
graph. Chrome separately verified real WebAudio playback, including on shared5178.
