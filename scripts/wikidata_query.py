"""One-time helper: list Vermeer paintings on Wikidata with collection, image and size."""
import json, urllib.parse, urllib.request

Q = """
SELECT ?p ?pLabel ?collLabel ?img ?h ?w ?inc WHERE {
  ?p wdt:P170 wd:Q41264; wdt:P31 wd:Q3305213.
  OPTIONAL { ?p wdt:P195 ?coll. }
  OPTIONAL { ?p wdt:P18 ?img. }
  OPTIONAL { ?p wdt:P2048 ?h. }
  OPTIONAL { ?p wdt:P2049 ?w. }
  OPTIONAL { ?p wdt:P571 ?inc. }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
}"""
url = "https://query.wikidata.org/sparql?format=json&query=" + urllib.parse.quote(Q)
req = urllib.request.Request(url, headers={"User-Agent": "vermeer-map/0.1 (personal site build script)"})
rows = json.load(urllib.request.urlopen(req))["results"]["bindings"]
for r in rows:
    g = lambda k: r.get(k, {}).get("value", "")
    print(" | ".join([g("p").rsplit("/",1)[-1], g("pLabel"), g("collLabel"), urllib.parse.unquote(g("img").rsplit("/",1)[-1]), g("h"), g("w"), g("inc")[:4]]))
