# Existing Star Agent typefaces, served locally

Downloaded 2026-09-07 from the Google Fonts CSS response used by `src/style.css`.
The families, weights, normal style and `font-display: swap` are unchanged.
`sources.json` lists the exact public source URLs. Each font family is distributed
under its retained SIL Open Font License. This removes an external stylesheet
request from the fresh-browser startup path.

Runtime faces are WOFF2 (264,848 bytes together). The original 690,268 bytes of
TTF sources live under `assets/fonts/`. Rebuild with
`node scripts/prepare-fonts.mjs`, using the system `woff2_compress` tool. No glyph
subsetting or typeface change is applied. Font display remains `swap`.

License sources: Google Fonts repository, `ofl/barlowcondensed/OFL.txt`,
`ofl/dmsans/OFL.txt`, and `ofl/spacemono/OFL.txt` at
https://github.com/google/fonts.
