# Where to see a Vermeer

A world map of every city where you can stand in front of a painting by Johannes Vermeer.
Choose a city and its paintings rise out of the map into frames, each with a wall label:
title, date, collection, city and canvas size. Frames are drawn to one shared scale, so
*The Lacemaker* (24 cm) really is small next to *The Art of Painting* (120 cm).

Static HTML, CSS and vanilla JavaScript, with no build step and no runtime dependencies.

## Running locally

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Don't open `index.html` with `file://`: the page `fetch`es
`data/paintings.json`, which that origin blocks.

## Structure

```
index.html            page, inline styles, and the baked SVG world map
css/style.css         shared fonts, tokens, layout and footer
js/map.js             pearls, clustering, pan/zoom by viewBox, city list
js/frames.js          the room overlay: frames, wall labels, rise/return animation
data/paintings.json   generated from scripts/paintings_src.py — don't edit by hand
images/               one JPEG per painting, from Wikimedia Commons (public domain)
scripts/              one-time Python (stdlib only) helpers, see below
```

## Scripts

| Script | What it does |
| --- | --- |
| `scripts/paintings_src.py` | Source of truth for the paintings. Writes `data/paintings.json`. |
| `scripts/fetch_images.py` | Downloads any missing `images/<id>.jpg` from Commons, 1000px long edge. Uses macOS `sips`. |
| `scripts/build_map.py` | Projects Natural Earth land (Natural Earth I projection), simplifies it, and writes the `<svg>` into `index.html` between `<!-- map:start -->` and `<!-- map:end -->`. |
| `scripts/wikidata_query.py` | Lists Vermeer paintings on Wikidata (collection, image, size), for checking the data. |

`build_map.py` needs the land file, which isn't committed:

```sh
curl -L -o scripts/ne_50m_land.geojson \
  https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_land.geojson
```

## Adding or correcting a painting

1. Edit `P` (and `M` for a new museum) in `scripts/paintings_src.py`. Each painting needs its
   Commons file name and height × width in cm. Take the date from the museum's own page.
2. `python3 scripts/paintings_src.py && python3 scripts/fetch_images.py`

## Credits

Painting images: Wikimedia Commons, public domain. Coastlines: Natural Earth, public domain.
