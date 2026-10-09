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
WOBBLE = 0.22                 # pen wobble amplitude in viewBox units
WAVE = 6.0                    # pen wobble wavelength in viewBox units
SECOND_PASS_AREA = 4          # only rings at least this big get the second pen line

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

def noise1(s, seed):
    """Smooth 1-D value noise in [-1, 1]: cosine-interpolated random knots, one per unit."""
    i = math.floor(s); f = s - i
    def knot(k):
        h = (k * 374761393 + seed * 668265263) & 0xFFFFFFFF
        h = ((h ^ (h >> 13)) * 1274126177) & 0xFFFFFFFF
        return (h & 0xFFFF) / 32767.5 - 1
    t = (1 - math.cos(f * math.pi)) / 2
    return knot(i) * (1 - t) + knot(i + 1) * t

def wobble(pts, seed, closed=True):
    """A hand-drawn line: subdivide long runs, then push each point along its normal
    by smooth noise in arc length. Closed rings get the drift spread out so they meet."""
    dense = [pts[0]]
    for (x0, y0), (x1, y1) in zip(pts, pts[1:]):
        n = int(math.hypot(x1 - x0, y1 - y0) / (WAVE / 3))
        for k in range(1, n + 1):
            dense.append((x0 + (x1 - x0) * k / (n + 1), y0 + (y1 - y0) * k / (n + 1)))
        dense.append((x1, y1))
    s = [0.0]
    for (x0, y0), (x1, y1) in zip(dense, dense[1:]):
        s.append(s[-1] + math.hypot(x1 - x0, y1 - y0))
    L = s[-1] or 1
    def off(d): return noise1(d / WAVE, seed) + 0.35 * noise1(d / (WAVE / 3.3), seed + 101)
    o0, o1 = off(0), off(L)
    out = []
    for i, (x, y) in enumerate(dense):
        a, b = dense[max(i - 1, 0)], dense[min(i + 1, len(dense) - 1)]
        dx, dy = b[0] - a[0], b[1] - a[1]; m = math.hypot(dx, dy) or 1
        o = off(s[i]) - ((o1 - o0) * s[i] / L if closed else 0)
        out.append((x - dy / m * o * WOBBLE, y + dx / m * o * WOBBLE))
    return out

def fmt(pts):
    return "M" + "L".join(f"{num(x)},{num(y)}" for x, y in pts) + "Z"

def ring_d(coords, seed):
    """Two pen lines for one ring of coastline (the second only for larger landmasses)."""
    if max(c[1] for c in coords) < LAT_MIN: return "", ""
    pts = dp([proj(*c[:2]) for c in coords], TOL)
    if len(pts) < 4: return "", ""
    # Drop specks: at world scale their water-lining reads as noise, not islands.
    area = abs(sum(x0 * y1 - x1 * y0 for (x0, y0), (x1, y1) in zip(pts, pts[1:] + pts[:1]))) / 2
    if area < MIN_AREA: return "", ""
    first = fmt(wobble(pts, seed))
    second = fmt(wobble(pts, seed + 7919)) if area >= SECOND_PASS_AREA else ""
    return first, second

def num(v):
    return f"{v:.2f}".rstrip("0").rstrip(".")

land, land2 = [], []
seed = 1
for f in json.loads((ROOT / "scripts/ne_50m_land.geojson").read_text())["features"]:
    g = f["geometry"]
    polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
    for poly in polys:
        for ring in poly:
            a, b = ring_d(ring, seed); seed += 1
            land.append(a); land2.append(b)
land_d = "".join(land)
land2_d = "".join(land2)

def line(pts):
    return "M" + "L".join(f"{x:.1f},{y:.1f}" for x, y in pts)

# Pencilled meridians and parallels, every 30°.
grat = []
for lon in range(-150, 180, 30):
    grat.append(line([proj(lon, lat) for lat in range(LAT_MIN, LAT_MAX + 1, 2)]))
for lat in range(-30, LAT_MAX + 1, 30):
    grat.append(line([proj(lon, lat) for lon in range(-180, 181, 5)]))
grat_d = "".join(grat)

# The sea is the projected globe outline cropped to the latitude band.
edge = [proj(180, lat) for lat in range(LAT_MIN, LAT_MAX + 1)] + \
       [proj(-180, lat) for lat in range(LAT_MAX, LAT_MIN - 1, -1)]
sea_d = line(edge) + "Z"
edge_d = fmt(wobble(edge, 4001)) + fmt(wobble(edge, 4002))

# A portolan compass rose in the North Atlantic, with rhumb lines running out of it
# in all 32 directions, the way Blaeu and his contemporaries laid out a sea chart.
RX, RY = proj(-40, 31)
R = 26
rhumb_d = "".join(
    f"M{RX:.1f},{RY:.1f}L{RX + 1400 * math.cos(math.radians(a * 11.25)):.1f},{RY + 1400 * math.sin(math.radians(a * 11.25)):.1f}"
    for a in range(32))
def star(n, r_out, r_in, rot=0):
    """Points of an n-pointed star as (tip, left shoulder, right shoulder) triples."""
    out = []
    for i in range(n):
        a = math.radians(rot + i * 360 / n - 90)
        da = math.radians(180 / n)
        tip = (RX + r_out * math.cos(a), RY + r_out * math.sin(a))
        l = (RX + r_in * math.cos(a - da), RY + r_in * math.sin(a - da))
        r = (RX + r_in * math.cos(a + da), RY + r_in * math.sin(a + da))
        out.append((tip, l, r))
    return out
def tri(*p): return "M" + "L".join(f"{x:.2f},{y:.2f}" for x, y in p) + "Z"
# Back to front: eight half-winds, the four diagonals, then the four cardinal points.
# Each point is split down its spine, one half shaded, as engravers drew them.
rose_layers = []
for n, ro, ri, rot in [(8, R * 0.5, R * 0.1, 22.5), (4, R * 0.74, R * 0.13, 45), (4, R, R * 0.16, 0)]:
    pts = star(n, ro, ri, rot)
    light = "".join(tri(tip, l, (RX, RY)) for tip, l, r in pts)
    dark = "".join(tri(tip, r, (RX, RY)) for tip, l, r in pts)
    rose_layers.append(f'<path class="rose-light" d="{light}"/><path class="rose-dark" d="{dark}"/>')
rose_rings = (f'<circle cx="{RX:.1f}" cy="{RY:.1f}" r="{R * 0.74:.1f}"/>'
              f'<circle cx="{RX:.1f}" cy="{RY:.1f}" r="{R * 0.68:.1f}"/>')

svg = f'''<svg class="map-svg" id="mapSvg" viewBox="0 0 {W} {H:.1f}" data-k="{K:.4f}" data-tx="{TX:.2f}" data-ty="{TY:.2f}" data-lat-min="{LAT_MIN}" data-lat-max="{LAT_MAX}" role="img" aria-label="World map of the cities where Vermeer's paintings hang">
  <defs>
    <path id="land" d="{land_d}"/>
    <clipPath id="seaClip"><path d="{sea_d}"/></clipPath>
    <clipPath id="landClip"><use href="#land"/></clipPath>
    <pattern id="hatch" patternUnits="userSpaceOnUse" width="2.4" height="2.4" patternTransform="rotate(45)">
      <line class="hatch-line" x1="0" y1="0" x2="0" y2="2.4"/>
    </pattern>
  </defs>
  <g clip-path="url(#seaClip)">
    <path class="sea" d="{sea_d}"/>
    <path class="graticule" d="{grat_d}"/>
    <path class="rhumb" d="{rhumb_d}"/>
    <use href="#land" class="ripple r3"/><use href="#land" class="ripple-gap r3g"/>
    <use href="#land" class="ripple r2"/><use href="#land" class="ripple-gap r2g"/>
    <use href="#land" class="ripple r1"/><use href="#land" class="ripple-gap r1g"/>
    <use href="#land" class="land"/>
    <g clip-path="url(#landClip)">
      <use href="#land" class="wash"/>
      <use href="#land" class="hatch"/>
    </g>
    <use href="#land" class="coast"/>
    <path class="coast coast2" d="{land2_d}"/>
    <g class="rose">
      <g class="rose-rings">{rose_rings}</g>
      {"".join(rose_layers)}
    </g>
  </g>
  <path class="globe-edge" d="{edge_d}"/>
</svg>'''

idx = ROOT / "index.html"
html = idx.read_text()
html, n = re.subn(r"<!-- map:start -->.*?<!-- map:end -->",
                  lambda m: f"<!-- map:start -->\n{svg}\n<!-- map:end -->", html, flags=re.S)
assert n == 1, "index.html needs <!-- map:start --> and <!-- map:end --> markers"
idx.write_text(html)
print(f"land paths {len(land_d)/1024:.0f} + {len(land2_d)/1024:.0f} KB, viewBox {W}x{H:.1f}, k={K:.2f}")
