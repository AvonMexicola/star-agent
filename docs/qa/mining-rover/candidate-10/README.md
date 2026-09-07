# Candidate 10 curated evidence

These six PNGs are byte-identical copies of actual producer captures, inspected
during documentation curation. They are not regenerated, cropped or retouched.
The three independent reports beside the production record are also exact
copies, including their historical pending statements. Read the later touch
follow-up with the earlier native and keyboard reports.

All six images use GLB SHA-256
`88448d9dd48e0a0acdb2397465302e8ab41335b8ffaab6234050d136bf6cc78f` and layout
`2d3912564b0cd16d212ae47fa528d475cc93a2941dcbdce10cbbad3b1e231a38`.
The native fixture intentionally has a blank MFD. The keyboard cockpit predates
the footer correction. The final phone cockpit covers the physical MFD; it is
not visual closure of the corrected footer.

| Curated PNG | Original archive path | Evidence scope |
| --- | --- | --- |
| [Native exterior with human](native-exterior-human.png) | `reviewer/candidate-10/01-exterior-human.png` | 1440×900 native asset scale, finish and contact shadows |
| [Native cockpit](native-cockpit.png) | `reviewer/candidate-10/03-cockpit.png` | 1440×900 materials, flat control bases and corrected fixture shadows; blank screen by design |
| [Keyboard cockpit before footer correction](keyboard-cockpit-footer-before.png) | `input-02/keyboard/02-enclosed-cockpit.png` | 1440×900 settled game cockpit; preserves the clipped footer finding |
| [Keyboard mining](keyboard-mining.png) | `input-02/keyboard/04-real-twin-mining.png` | 1440×900 actual twin cutters and ore status in Selene gameplay |
| [Final touch cockpit](touch-cockpit.png) | `input-04/touch/02-enclosed-cockpit.png` | 390×844 native control layout; panel obscures physical MFD |
| [Final touch inventory](touch-ore-bin-dialog.png) | `input-04/touch/05-ore-bin-dialog.png` | 390×844 rover bin, Atlas label, both pagers and Resume fit |

Original archive root on the review host:
`/home/cees/projects/.mining-rover-qa/`. The repository retains only the six
selected PNGs, totaling 3,426,968 bytes. Raw JSON, failed contexts, original videos
and motion contact sheets remain in local archives. Their absence from the
repository is not a claim that those complete recordings are portable here.

## Selected record summaries

| Archive record | Result and endpoint |
| --- | --- |
| `full-03/journey.json` | Candidate 09 controller route; Atlas in flight, rover aboard/unoccupied/stopped; 11.4163 cutter seconds, 0.693861 kg after transfer; zero recorded errors/warnings |
| `input-02/keyboard/journey.json` | Candidate 10 / bounded 84860a6; complete return extension and seven milestones; Atlas landed, rover aboard/unoccupied/stopped; 1.686878 kg; stable source hashes; zero errors/warnings/failed requests |
| `input-04/touch/journey.json` | Candidate 10 / bounded e7e297b; complete return extension and seven milestones; Atlas landed, rover aboard/unoccupied/stopped; 1.178567 kg; stable source hashes; zero errors/warnings/failed requests |

The independent reviewer inspected selected keyboard motion intervals, not every
frame of the recording. The final touch reviewer inspected four PNGs and the
route/native-input records, not the phone video. Native static 4.04 and keyboard
motion 3.8 produce an explicitly mixed mean of 4.00; the physical footer check
and performance/product acceptance remain open in the
[production record](../production-record.md).

## File identities

```text
PNG SHA-256
30a25ddec34d37082a11da49cc225f855f5a0511cef9ddf0d2626762cb797cbc  native-exterior-human.png
87b1141b4c09bb8e48c23886c22fe9748fde82b7fbcf2006ba7ad4015c015cdf  native-cockpit.png
1080f1fc8571fe8d3e6db1b10848f2fd3b3d93126fe6180b1a2a97286ac5cbca  keyboard-cockpit-footer-before.png
769612e76f6bf19677bb4ac7603f6cbde85b9935e55801c6007c4f10ca6752bf  keyboard-mining.png
b19a7aae9d2b8897ebbaa4d202a8086b6c5acbebf9b8fc9a6cf7cf45289f4748  touch-cockpit.png
f9706ead0aab126398ff189395a5968bcbe5a87f295e9e78fd130fad47979cd1  touch-ore-bin-dialog.png

Exact reports copied from /tmp/rover-review-portable/
d469d697450f0b60ae2b886e056bf5d144353cb4c113be65f4eb3028c55a5736  ../review-visual-10.md
f5848b8270f56e9c937aca57c855a9837c97b65e3e166bd63d653d123916b06f  ../review-game-10.md
780f0342410bbf13d85458301c5267e8ce0fa5053a288e254f5073781b70e192  ../review-touch-10.md

Original raw records retained outside the repository
a9be16b8e59e4b981e8dd7881ee2502ecf48161c10cc90cb6fe0fd663632742e  full-03/journey.json
b58a93cbf0a188b6a15dd5c6fc03e052b65d572a76e97d68bed37af8f036d286  input-02/keyboard/journey.json
14452ec3dd8517601c16f821782e7c4bb70c13049b41e3f41ea130f9a14eb560  input-02/keyboard/native-input.json
49eea33cdd1ee027d8e80587144a44871307aaf53503b5bad29137950f78e9cb  input-04/touch/journey.json
dbc867c73b2aca1d2f4218b78dfe2244ad6f33bdb932a3dd03bea04b8ab00e8a  input-04/touch/native-input.json
ca11f089fcfa4d9b269626a8f1ce472754e056f7d02c17ac30e4d3b322247325  reviewer/candidate-10/capture.json
```
