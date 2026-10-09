# Where to see a Vermeer

Static GitHub Pages site. No build step, no runtime dependencies, no package manager.
Serve over HTTP to preview (`python3 -m http.server 8000`); `file://` blocks the data fetch.

## Deploy

GitHub Pages serves `main` as-is (`.nojekyll` is present). Pushing to `main` publishes.

## Data flow

- `scripts/paintings_src.py` is the source of truth → writes `data/paintings.json`. Never
  hand-edit the JSON.
- `frame` per museum is `ebony` or `gilt`. `stolen: true` (The Concert) renders an empty frame
  with no image, and `fetch_images.py` skips it.
- Images live at `images/<id>.jpg`. Use JPEG only, with a 1000px long edge.

## Map

- The SVG is baked into `index.html` by `scripts/build_map.py`. Don't hand-edit anything
  between the `map:start`/`map:end` markers.
- `js/map.js` re-implements the same Natural Earth I projection using `data-k/tx/ty` from the
  `<svg>`. If you change the projection, crop or width in the script, the markers follow
  automatically.
- Stroke widths are `calc(Npx * var(--u))`, where `--u` is set by `applyVB()`.
  `vector-effect: non-scaling-stroke` is ignored on `<use>` in Chrome, so don't switch back to it.
- Pearls cluster by screen distance (`clusterRadius()`). A city's label side comes from
  `LABEL_SIDE` and flips automatically near the map edge.

## Design rules (inherited from yrk-website)

- `--serif` (Libre Caslon Display) is used for h1/h2 only, at weight 400.
- `--body` (Newsreader) is used for everything else. Meta text is italic with old-style figures.
- `--hand` (YasiHand) is used for counts and controls.
- Light comes from the upper left, so every cast shadow falls down and to the right
  (`--cast`). Keep new shadows consistent with that.
- Animation: the rise and return use the Web Animations API with staggered delays.
  `prefers-reduced-motion` gets plain fades. Hidden tabs skip animation entirely, because rAF
  and WAAPI don't tick there.
