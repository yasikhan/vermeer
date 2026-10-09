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
- `SEEN` in `paintings_src.py` (id → year, or `True`) marks paintings seen in person. It drives
  the headline tally, the city-list circles (filled once seen), the lead-tin fill in a finished city's mark and
  the lead-tin wax seal pressed into the corner of a wall label: a thin raised rim around a
  sunken field with the year cut in Roman numerals (`sealSVG()` / `roman()` in `js/frames.js`).
  Only the wax outline and angle vary, seeded by the painting's id.
- Images live at `images/<id>.jpg`. Use JPEG only, with a 1000px long edge, at sips `formatOptions normal`
  (about quality 80). A bare number is ignored by sips.

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
- Performance (Safari): `markMoving()` puts `.moving` on the viewport during any zoom, drag, pinch or
  wheel, and CSS hides the decorative layers (outer water-lines, hatch, wash, coast2, rhumbs,
  graticule, paper grain) until 160ms after it stops. WebKit can't redraw the full drawing at
  frame rate; with this it holds ~50–57fps. Keep any new decorative map layer in that list.
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
- `--display` (IM Fell Double Pica) is used for h1/h2, room titles and the year stamped on seals, at weight 400.
- `--body` (IM Fell DW Pica) is used for everything else. Meta text is italic. Fell figures are
  old-style.
- `--hand` (YasiHand), in `--gall` ink (never blue), is used for controls. The
  tally ("13/37") is set in `--display`, centred under the intro. Map counts are
  set in `--body` so they sit on the city name's baseline.
- Palette: the wall is cool whitewashed plaster (`--plaster`, lit by `--daylight`, a strong
  falloff from the upper left, fixed to the screen). Objects on it are warm `--paper`, so they separate
  by temperature, not just value. `--gall` is ink on paper and `--umber` is secondary on paper. Text written straight on the wall uses
  bone-black `--wall-ink` / `--wall-ink-2`, with `--wall-rule` for rules. `--ultramarine` is
  the one accent: the tally, the rule's lozenge, links, water-lining and focus rings. `--lead-tin`
  is reserved for "seen". Don't add another yellow or another beige.
- No highlighter bars, no all-caps labels.
- Light comes from the upper left, so every cast shadow falls down and to the right
  (`--cast`). Keep new shadows consistent with that.
- The light source is an engraved casement window in the top-left corner (`.window`, fixed,
  above the room): carved cornice, sill, and two paned leaves swung open in perspective. Clicking
  it swings the leaves shut (cross-hatched panes; `.leaves-open` / `.leaves-shut` scale on their
  hinges in turn): `html[data-light="off"]` fades out the daylight
  (`body::before`, `.room-scrim::after`, the map's sheen), fades in a dim `--dusk` (`body::after`,
  `.room-scrim::before`), dims `--paper`, darkens `--wall-ink-2` to stay legible, and swaps `--cast`
  for an even, directionless shadow. `--daylight` is a hard falloff plus a soft shaft (a conic wedge
  from the corner). The choice is saved in `localStorage` (`vermeer-light`) and restored before first paint
  by an inline script in `<head>`. Anything new that depends on light needs an off state.
- Animation: the rise and return use the Web Animations API with staggered delays.
  `prefers-reduced-motion` gets plain fades. Hidden tabs skip animation entirely, because rAF
  and WAAPI don't tick there.

## The room

- "close" is `position: fixed` outside `.room-inner`, so it stays reachable however far the wall
  scrolls. Any click on bare wall (not a frame, label or heading) also closes the room, as does Esc.
