"""Bake the world map into index.html as inline SVG. No runtime map library.

Input:  scripts/ne_50m_land.geojson (Natural Earth 1:50m land, public domain)
Output: the <svg> between <!-- map:start --> and <!-- map:end --> in index.html

Projection is Natural Earth I (the polynomial from d3-geo's geoNaturalEarth1Raw).
js/map.js repeats the same formula with the constants written onto the <svg>
(data-k, data-tx, data-ty), so markers land exactly on the baked coastline.

Run: python3 scripts/build_map.py
"""
import json, math, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parent.parent
W = 1000                      # viewBox width
LAT_MIN, LAT_MAX = -58, 84    # crop: no Antarctica, keep Greenland/Svalbard
MIN_AREA = 0.5                # viewBox units²; roughly islands smaller than Mallorca
TOL = 0.06                    # Douglas–Peucker tolerance in viewBox units (map zooms ~14x)

def raw(lon, lat):
    l, p = math.radians(lon), math.radians(lat)
    p2 = p * p; p4 = p2 * p2
    x = l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4)))
    y = p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))
    return x, y

K = W / (2 * raw(180, 0)[0])
TX = W / 2
TY = K * raw(0, LAT_MAX)[1]
H = TY - K * raw(0, LAT_MIN)[1]

def proj(lon, lat):
    x, y = raw(lon, lat)
    return TX + K * x, TY - K * y

def dp(pts, tol):
    """Iterative Douglas–Peucker."""
    if len(pts) < 3: return pts
    keep = [False] * len(pts); keep[0] = keep[-1] = True
    stack = [(0, len(pts) - 1)]
    while stack:
        a, b = stack.pop()
        (ax, ay), (bx, by) = pts[a], pts[b]
        dx, dy = bx - ax, by - ay; L = math.hypot(dx, dy)
        best, bi = 0, -1
        for i in range(a + 1, b):
            px, py = pts[i]
            # Rings are closed (first point == last), so fall back to point distance.
            d = abs(dy * (px - ax) - dx * (py - ay)) / L if L > 1e-9 else math.hypot(px - ax, py - ay)
            if d > best: best, bi = d, i
        if best > tol:
            keep[bi] = True; stack += [(a, bi), (bi, b)]
    return [p for p, k in zip(pts, keep) if k]

def ring_d(coords):
    if max(c[1] for c in coords) < LAT_MIN: return ""
    pts = dp([proj(*c[:2]) for c in coords], TOL)
    if len(pts) < 4: return ""
    # Drop specks: at world scale their water-lining reads as noise, not islands.
    area = abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2
    if area < MIN_AREA: return ""
    return "M" + "L".join(f"{num(x)},{num(y)}" for x, y in pts) + "Z"

def num(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")

land = []
for f in json.loads((ROOT / "scripts/ne_50m_land.geojson").read_text())["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        for ring in poly:
            land.append(ring_d(ring))
land_d = "".join(land)

def line(pts):
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts)

grat = []
for lon in range(-180, 181, 15):
    grat.append(line([proj(lon, lat) for lat in range(LAT_MIN, LAT_MAX + 1, 2)]))
for lat in range(-45, LAT_MAX + 1, 15):
    grat.append(line([proj(lon, lat) for lon in range(-180, 181, 5)]))
grat_d = "".join(grat)

# The sea is the projected globe outline cropped to the latitude band.
edge = [proj(180, lat) for lat in range(LAT_MIN, LAT_MAX + 1)] + \
       [proj(-180, lat) for lat in range(LAT_MAX, LAT_MIN - 1, -1)]
sea_d = line(edge) + "Z"

svg = f'''<svg class="map-svg" id="mapSvg" viewBox="0 0 {W} {H:.1f}" data-k="{K:.4f}" data-tx="{TX:.2f}" data-ty="{TY:.2f}" data-lat-min="{LAT_MIN}" data-lat-max="{LAT_MAX}" role="img" aria-label="World map of the cities where Vermeer's paintings hang">
  <defs>
    <path id="land" d="{land_d}"/>
    <clipPath id="seaClip"><path d="{sea_d}"/></clipPath>
    <filter id="vellum" x="0" y="0" width="100%" height="100%">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.35  0 0 0 0 0.29  0 0 0 0 0.18  0 0 0 0.09 0"/>
      <feComposite in2="SourceGraphic" operator="in"/>
      <feBlend in="SourceGraphic" mode="multiply"/>
    </filter>
  </defs>
  <g clip-path="url(#seaClip)">
    <path class="sea" d="{sea_d}"/>
    <path class="graticule" d="{grat_d}"/>
    <use href="#land" class="ripple r3"/><use href="#land" class="ripple-gap r3g"/>
    <use href="#land" class="ripple r2"/><use href="#land" class="ripple-gap r2g"/>
    <use href="#land" class="ripple r1"/><use href="#land" class="ripple-gap r1g"/>
    <use href="#land" class="land" filter="url(#vellum)"/>
    <use href="#land" class="coast"/>
  </g>
  <path class="globe-edge" d="{sea_d}"/>
</svg>'''

idx = ROOT / "index.html"
html = idx.read_text()
html, n = re.subn(r"<!-- map:start -->.*?<!-- map:end -->",
                  lambda m: f"<!-- map:start -->\n{svg}\n<!-- map:end -->", html, flags=re.S)
assert n == 1, "index.html needs <!-- map:start --> and <!-- map:end --> markers"
idx.write_text(html)
print(f"land path {len(land_d)/1024:.0f} KB, viewBox {W}x{H:.1f}, k={K:.2f}")
