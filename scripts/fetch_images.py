"""Download each painting's public-domain image from Wikimedia Commons into images/.

Run once (and again after adding a painting): python3 scripts/fetch_images.py
Existing files are skipped. The stolen Concert is shown as an empty frame, so it is not fetched.
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

missing = []
for p in json.loads((ROOT / "data/paintings.json").read_text()):
    dest = ROOT / p["image"]
    if p.get("stolen") or dest.exists():
        continue
    q = urllib.parse.urlencode({"action": "query", "titles": "File:" + p["commons"], "prop": "imageinfo",
                                "iiprop": "url", "iiurlwidth": 1200, "format": "json"})
    page = next(iter(json.load(get(f"{API}?{q}"))["query"]["pages"].values()))
    info = (page.get("imageinfo") or [None])[0]
    if not info:
        missing.append(p["id"]); print("missing on Commons:", p["commons"]); continue
    url = info["thumburl"]
    data = get(url).read()
    dest.parent.mkdir(exist_ok=True)
    if data[:4] == b"\x89PNG":
        # PNG sources come back as PNG thumbs; re-encode to JPEG with macOS sips.
        tmp = dest.with_suffix(".png"); tmp.write_bytes(data)
        subprocess.run(["sips", "-s", "format", "jpeg", "-s", "formatOptions", "85", str(tmp), "--out", str(dest)],
                       check=True, capture_output=True)
        tmp.unlink(); data = dest.read_bytes()
    else:
        dest.write_bytes(data)
    # Frames never render taller than ~500 CSS px, so cap the long edge at 1000px for retina.
    subprocess.run(["sips", "-Z", "1000", "-s", "formatOptions", "82", str(dest)], check=True, capture_output=True)
    data = dest.read_bytes()
    print(f"{p['id']:22} {len(data)//1024:5d} KB  {url.rsplit('/',1)[-1][:60]}")
    time.sleep(3)

if missing:
    sys.exit(f"{len(missing)} missing: {', '.join(missing)}")
