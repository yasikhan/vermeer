# Seeking Vermeer

Static GitHub Pages site. No build step, no runtime dependencies, no package manager.
Serve over HTTP to preview (`python3 -m http.server 8000`); `file://` blocks the data fetch.

## Deploy

GitHub Pages serves `main` as-is (`.nojekyll` is present). Pushing to `main` publishes.

## Data flow

- `scripts/paintings_src.py` is the source of truth → writes `data/paintings.json`. Never
  hand-edit the JSON.
- `frame` is per painting (`FRAME` in `paintings_src.py`), matched to how it's framed today from
  the photos at essentialvermeer.com/framed. The kinds are listed in `KINDS` in `js/frames.js`. `stolen: true` (The Concert) renders an empty frame
  with no image, and `fetch_images.py` skips it.
- `continent` comes from `CONTINENT` (by country) in `paintings_src.py`; the city list groups by it.
- `SEEN` in `paintings_src.py` (id → year, or `True`) marks paintings seen in person. It drives
  the headline tally, the city-list circles (filled once seen), the lead-tin fill in a finished city's mark and
  the yellow "seen [year]" sticky note on wall labels.
- Images live at `images/<id>.jpg`. Use JPEG only, with a 1000px long edge.

## Map

- The SVG is baked into `index.html` by `scripts/build_map.py`. Don't hand-edit anything
  between the `map:start`/`map:end` markers.
- `js/map.js` re-implements the same Natural Earth I projection using `data-k/tx/ty` from the
  `<svg>`. If you change the projection, crop or width in the script, the markers follow
  automatically.
- The sketched look is baked geometry, not a filter: `wobble()` in `build_map.py` pushes each
  coastline along its normal with smooth noise, and draws larger landmasses twice (`#land`,
  `.coast2`). The compass rose and rhumb lines are baked too. Paper grain and foxing are a
  static overlay on `.map-viewport`, so they don't scale with zoom.
- Stroke widths are `calc(Npx * var(--u))`, where `--u` is set by `applyVB()`.
  `vector-effect: non-scaling-stroke` is ignored on `<use>` in Chrome, so don't switch back to it.
- Cities use the period town sign: a hand-drawn ring with a centre dot (`markSVG()`, seeded by
  name so each is stable). A cluster is a double ring; the open city is inked in. A city
  with every painting seen is filled lead-tin. Marks cluster by screen distance (`clusterRadius()`). A city's label side comes from
  `LABEL_SIDE` and flips automatically near the map edge.

## Frames

`js/frames.js` draws each moulding as an inline SVG at the frame's pixel size. One side's
profile is laid out in side coordinates (x along the side, y from the outer edge to the
picture) and repeated on all four sides with mitred clips. A profile is a stack of bands built
from shared materials in `moulding()`: gradients, ripple and cross-ripple patterns, bead and reel,
and wood grain (`grain()`, turbulence mapped between two colours). Kinds: Dutch ebony ripple
(plain, with a gilt sight edge, in rosewood, or with a tortoiseshell flat), plain stepped ebony
(optionally with a gilt slip), carved gilt (scrolling acanthus, rosettes at corners and centres),
plainer gilt, burl walnut (optionally with ripple bands) and the Lacemaker's marquetry.
Thickness `t` scales with the picture, up to 46px, times the kind's `width`.

## Design rules

- Concept: a 17th-century printed title page, annotated in my own hand.
- `--display` (IM Fell Double Pica) is used for h1/h2 and room titles only, at weight 400.
- `--body` (IM Fell DW Pica) is used for everything else. Meta text is italic. Fell figures are
  old-style.
- `--hand` (YasiHand), in `--gall` ink (never blue), is used for controls and the "seen" sticky notes on wall labels. The
  tally ("13/37") is set in `--display`, centred under the intro. Map counts are
  set in `--body` so they sit on the city name's baseline.
- Palette: `--limewash` wall, `--paper` objects, `--gall` ink, `--umber` secondary,
  `--ultramarine` for water-lining and focus rings only. `--lead-tin` is reserved for "seen".
- No highlighter bars, no all-caps labels.
- Light comes from the upper left, so every cast shadow falls down and to the right
  (`--cast`). Keep new shadows consistent with that.
- Animation: the rise and return use the Web Animations API with staggered delays.
  `prefers-reduced-motion` gets plain fades. Hidden tabs skip animation entirely, because rAF
  and WAAPI don't tick there.

## The room

- "close" is `position: fixed` outside `.room-inner`, so it stays reachable however far the wall
  scrolls. Any click on bare wall (not a frame, label or heading) also closes the room, as does Esc.
