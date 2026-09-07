# Construction and creature audio

Cees requests placement feedback, a deep Pyrebear growl and a Sulphurhound snarl.
Original procedural mono PCM, four deterministic variants per sound, shared
24-voice mixer and existing gesture/mute/focus/distance controls. No new inputs,
assets, dependencies or authority changes. Preserve fitted-weapon pitch/gain.

Placement emits once after successful storage commit, never for invalid ghosts,
failed saves or loading a base. Fauna emits at attack windup entry, not every
frame or only after damage. The fauna owner retains the unfinished creature
runtime; the small callback patch is a handoff, not integrated wildlife.

Validation and remaining integration: [audio record](../qa/construction-audio/README.md).
