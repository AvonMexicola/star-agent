# Concourse shop print and textile sources

Original artwork generated with the built-in `image_gen` tool on 2026-09-06.
The exact production prompts are in [prompts.json](prompts.json). No third-party
brand, stock image or hosted runtime service is used. The retained PNGs are the
unmodified 1254 × 1254 generated masters, outside the public runtime tree.

| Source | Runtime derivative | Role |
| --- | --- | --- |
| `source/shop-campaign-art.png` | `/textures/station/shop-campaign-art.webp` | Four illustrations, composited into printed campaigns with deterministic type |
| `source/shop-worn-carpet.png` | `/textures/station/shop-worn-carpet.webp` | Neutral worn textile base colour; independent procedural surface relief |

Generation request IDs (from saved output filenames): campaign
`exec-8574c21b-818f-43b7-82e8-5ae9bb73b3fb`, textile
`exec-018bab93-231f-40c2-a56c-2a39d1d50cca`.

Reproduce the 1024² runtime encoding from the repository root:

```sh
magick assets/station-shop/source/shop-campaign-art.png -resize 1024x1024 -quality 88 public/textures/station/shop-campaign-art.webp
magick assets/station-shop/source/shop-worn-carpet.png -resize 1024x1024 -quality 86 public/textures/station/shop-worn-carpet.webp
```

Runtime sizes: campaign 178,562 bytes; textile 386,642 bytes. All colour images
are sRGB. Generated imagery is illustration/base colour, not a manufactured mesh
or a complete PBR material. Bitmap text is not used as an instruction source.
`src/station-shop-graphics.js` supplies precise shop typography using the game's
font and palette tokens, then shares the print atlas between physical fixtures.

Art direction: WATCHKEEP uses petrol, ivory and mint with restrained security
catalogue layouts. KESTREL uses ochre, paper and dark industrial fixtures with
trade-counter product and maintenance print. Both are original station tenants.
Decorative products and service notices do not add combat, equipping, repairs or
component installation to gameplay. The shop menus retain the actual limitations.

See [the production record](../../docs/qa/station-shop-branding-record.md) for
geometry, physical placement, renderer inspection and acceptance status.
