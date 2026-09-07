# Star Agent soundtrack

Six instrumental variants generated in the project owner's Suno Pro account
(`ceesmiddel`) on 6 September 2026, using v5.5 and the Star Agent generation brief.
The adjacent manifest records song URLs, source WAV hashes and encoding settings.
These recordings are project soundtrack assets; this note does not assign them a
third-party stock or CC0 license. The original WAV masters remain outside Git.

| Files | Use |
| --- | --- |
| `between-worlds-{1,2}.mp3` | Travel beyond the orbital approach region |
| `blue-horizon-{1,2}.mp3` | Orbital approach, landing and quiet exploration |
| `atmospheric-descent-{1,2}.mp3` | Descending into Aeon's atmosphere |

Runtime downloads only the playing track and its incoming fade partner, after
the opening movement gesture enables audio or the user enables Sound in H. Local MP3s avoid a Suno connection, account or streaming
API. Procedural engine/wind audio and flight still work if these files are absent.

Delivery encoding uses FFmpeg/libmp3lame at 160 kb/s, stereo 48 kHz. `loudnorm`
targets -22 LUFS, -2 dBTP and 11 LU LRA, followed by two-second opening and
three-second ending fades. The player overlaps tracks for six seconds with
equal-power fades. These are edited full tracks, not verified seamless loops.

Both Between Worlds variants need listening review: Suno interpreted the word
“crossfade” as a band reference and substituted “Alternative Rock, Post-grunge”
in its style metadata. Blue Horizon avoids that wording. Variant 1 of Blue
Horizon is 2:42.52, shorter than the requested 3–4 minute target. No audio-quality
or stylistic-fit claim is made from UI playback or file validation alone.
