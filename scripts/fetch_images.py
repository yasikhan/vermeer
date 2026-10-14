"""Download each painting's public-domain image from Wikimedia Commons into images/.

Run once (and again after adding a painting): python3 scripts/fetch_images.py
Existing files are skipped, so this fills in whichever size (frame or large) is missing. The stolen Concert is shown as an empty frame, so it is not fetched.
"""
import json, pathlib, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
UA = {"User-Agent": "vermeer-map/0.1 (static site build script; contact via github.com/yasikhan)"}
API = "https://commons.wikimedia.org/w/api.php"

def get(url, tries=6):
    for i in range(tries):
        try:
            return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=60)
        except urllib.error.HTTPError as e:
            if e.code != 429 or i == tries - 1:
                raise
            wait = int(e.headers.get("Retry-After") or 0) or 5 * 2 ** i
            print(f"  rate limited, waiting {wait}s"); time.sleep(wait)

# Frames never render taller than ~500 CSS px, so their images cap the long edge at 1000px for retina.
# The large copy is only loaded once a picture is lifted out and magnified.
SIZES = [("image", 1000), ("large", 3000)]

missing = []
for p in json.loads((ROOT / "data/paintings.json").read_text()):
    if p.get("stolen"):
        continue
    todo = [(ROOT / p[key], edge) for key, edge in SIZES if not (ROOT / p[key]).exists()]
    if not todo:
        continue
    q = urllib.parse.urlencode({"action": "query", "titles": "File:" + p["commons"], "prop": "imageinfo",
                                "iiprop": "url|size", "format": "json"})
    page = next(iter(json.load(get(f"{API}?{q}"))["query"]["pages"].values()))
    info = (page.get("imageinfo") or [None])[0]
    if not info:
        missing.append(p["id"]); print("missing on Commons:", p["commons"]); continue
    for dest, edge in todo:
        # Ask for a thumb a little over the target long edge (Commons thumbs are sized by width),
        # or the original if it's smaller than that.
        w, h = info["width"], info["height"]
        edge = min(edge, max(w, h))  # never enlarge a small original
        want = round(edge * 1.2 * w / max(w, h))
        if want < w:
            q = urllib.parse.urlencode({"action": "query", "titles": "File:" + p["commons"], "prop": "imageinfo",
                                        "iiprop": "url", "iiurlwidth": want, "format": "json"})
            url = next(iter(json.load(get(f"{API}?{q}"))["query"]["pages"].values()))["imageinfo"][0]["thumburl"]
        else:
            url = info["url"]
        data = get(url).read()
        dest.parent.mkdir(parents=True, exist_ok=True)
        if data[:4] == b"\x89PNG" or data[:2] == b"II" or data[:2] == b"MM":
            # PNG and TIFF sources: re-encode to JPEG with macOS sips.
            tmp = dest.with_suffix(".src"); tmp.write_bytes(data)
            subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "normal", str(tmp), "--out", str(dest)],
                           check=True, capture_output=True)
            tmp.unlink()
        else:
            dest.write_bytes(data)
        # sips ignores a bare number for JPEG quality; "normal" is roughly quality 80.
        subprocess.run(["sips", "-Z", str(edge), "-s", "formatOptions", "normal", str(dest)], check=True, capture_output=True)
        print(f"{p['id']:22} {edge:5d} {dest.stat().st_size//1024:5d} KB  {url.rsplit('/',1)[-1][:60]}")
        time.sleep(3)

if missing:
    sys.exit(f"{len(missing)} missing: {', '.join(missing)}")
