"""Source of truth for data/paintings.json. Edit here, then run: python3 scripts/paintings_src.py"""
import json, pathlib

M = {  # museum -> (city, country, lat, lon, frame)
  "Rijksmuseum": ("Amsterdam", "Netherlands", 52.3600, 4.8852, "ebony"),
  "Mauritshuis": ("The Hague", "Netherlands", 52.0804, 4.3143, "ebony"),
  "Gemäldegalerie": ("Berlin", "Germany", 52.5085, 13.3649, "ebony"),
  "Herzog Anton Ulrich Museum": ("Braunschweig", "Germany", 52.2659, 10.5339, "ebony"),
  "Gemäldegalerie Alte Meister": ("Dresden", "Germany", 51.0531, 13.7339, "gilt"),
  "Städel Museum": ("Frankfurt", "Germany", 50.1031, 8.6741, "ebony"),
  "Kunsthistorisches Museum": ("Vienna", "Austria", 48.2038, 16.3617, "gilt"),
  "Musée du Louvre": ("Paris", "France", 48.8606, 2.3376, "gilt"),
  "The National Gallery": ("London", "United Kingdom", 51.5089, -0.1283, "gilt"),
  "Kenwood House": ("London", "United Kingdom", 51.5713, -0.1676, "gilt"),
  "Royal Collection, Buckingham Palace": ("London", "United Kingdom", 51.5014, -0.1419, "gilt"),
  "Scottish National Gallery": ("Edinburgh", "United Kingdom", 55.9509, -3.1958, "gilt"),
  "National Gallery of Ireland": ("Dublin", "Ireland", 53.3409, -6.2525, "ebony"),
  "The Metropolitan Museum of Art": ("New York", "United States", 40.7794, -73.9632, "ebony"),
  "The Frick Collection": ("New York", "United States", 40.7712, -73.9673, "gilt"),
  "The Leiden Collection": ("New York", "United States", 40.7740, -73.9650, "ebony"),
  "National Gallery of Art": ("Washington, D.C.", "United States", 38.8913, -77.0199, "ebony"),
  "Isabella Stewart Gardner Museum": ("Boston", "United States", 42.3382, -71.0991, "gilt"),
  "National Museum of Western Art": ("Tokyo", "Japan", 35.7155, 139.7757, "gilt"),
}

CONTINENT = {
  "Netherlands": "Europe", "Germany": "Europe", "Austria": "Europe", "France": "Europe",
  "United Kingdom": "Europe", "Ireland": "Europe",
  "United States": "North America",
  "Japan": "Asia",
}

# id, title, year, museum, commons file, height cm, width cm, note
P = [
  ("milkmaid", "The Milkmaid", "c. 1660", "Rijksmuseum", "Johannes Vermeer - Het melkmeisje - Google Art Project.jpg", 45.5, 41, None),
  ("little-street", "The Little Street", "c. 1658", "Rijksmuseum", "Johannes Vermeer - Gezicht op huizen in Delft, bekend als 'Het straatje' - Google Art Project.jpg", 54.3, 44, None),
  ("woman-reading-letter", "Woman Reading a Letter", "c. 1663", "Rijksmuseum", "Vermeer, Johannes - Woman reading a letter - ca. 1662-1663.jpg", 46.6, 39.1, None),
  ("love-letter", "The Love Letter", "c. 1669–70", "Rijksmuseum", "Johannes Vermeer - 'De liefdesbrief' - Google Art Project.jpg", 44, 38.5, None),
  ("pearl-earring", "Girl with a Pearl Earring", "c. 1665", "Mauritshuis", "1665 Girl with a Pearl Earring.jpg", 44.5, 39, None),
  ("view-of-delft", "View of Delft", "c. 1660–61", "Mauritshuis", "Johannes Vermeer - View of Delft - 92 - Mauritshuis.jpg", 96.5, 115.7, None),
  ("diana", "Diana and Her Nymphs", "c. 1653–54", "Mauritshuis", "Johannes Vermeer - Diana and her Nymphs - 406 - Mauritshuis.jpg", 97.8, 104.6, None),
  ("glass-of-wine", "The Glass of Wine", "c. 1658–60", "Gemäldegalerie", "Jan Vermeer van Delft - The Glass of Wine - Google Art Project.jpg", 67.7, 79.6, None),
  ("pearl-necklace", "Woman with a Pearl Necklace", "c. 1662–64", "Gemäldegalerie", "Jan Vermeer van Delft - Young Woman with a Pearl Necklace - Google Art Project.jpg", 55, 45, None),
  ("girl-wine-glass", "The Girl with the Wine Glass", "c. 1659–60", "Herzog Anton Ulrich Museum", "Jan Vermeer van Delft 006.jpg", 78, 67.5, None),
  ("procuress", "The Procuress", "1656", "Gemäldegalerie Alte Meister", "Johannes Vermeer - The Procuress - Google Art Project.jpg", 143, 130, None),
  ("open-window", "Girl Reading a Letter at an Open Window", "c. 1657–59", "Gemäldegalerie Alte Meister", "Jan Vermeer van Delft - Brieflezend meisje bij het venster (ca. 1657-59).jpg", 83, 64.5, None),
  ("geographer", "The Geographer", "1669", "Städel Museum", "Johannes Vermeer, Der Geograf, 1669.png", 51.6, 45.4, None),
  ("art-of-painting", "The Art of Painting", "c. 1666–68", "Kunsthistorisches Museum", "Jan Vermeer - The Art of Painting - Google Art Project.jpg", 120, 100, None),
  ("lacemaker", "The Lacemaker", "c. 1669–70", "Musée du Louvre", "Johannes Vermeer - The lacemaker (c.1669-1671).jpg", 24.5, 21, None),
  ("astronomer", "The Astronomer", "1668", "Musée du Louvre", "Johannes Vermeer - The Astronomer - 1668.jpg", 50.8, 46.3, None),
  ("standing-virginal", "A Young Woman Standing at a Virginal", "c. 1670–72", "The National Gallery", "Jan Vermeer van Delft - Jonge vrouw staande bij een virginaal (ca. 1670-72).jpg", 51.7, 45.2, None),
  ("seated-virginal", "A Young Woman Seated at a Virginal", "c. 1670–72", "The National Gallery", "Jan Vermeer van Delft - Jonge vrouw aan een virginaal (ca. 1670-72).jpg", 51.5, 45.5, None),
  ("guitar-player", "The Guitar Player", "c. 1672", "Kenwood House", "Jan Vermeer van Delft 013.jpg", 53, 46.3, None),
  ("music-lesson", "The Music Lesson", "c. 1662–65", "Royal Collection, Buckingham Palace", "Johannes Vermeer - Lady at the Virginal with a Gentleman, 'The Music Lesson' - Google Art Project.jpg", 74.1, 64.6, "On view when Buckingham Palace opens to visitors, or when lent to the King's Gallery."),
  ("martha-mary", "Christ in the House of Martha and Mary", "c. 1654–55", "Scottish National Gallery", "Johannes (Jan) Vermeer - Christ in the House of Martha and Mary - Google Art Project.jpg", 158.5, 141.5, None),
  ("letter-maid", "Woman Writing a Letter, with Her Maid", "c. 1670", "National Gallery of Ireland", "Woman writing a letter, with her maid, by Johannes Vermeer.jpg", 71.1, 58.4, None),
  ("water-pitcher", "Young Woman with a Water Pitcher", "c. 1662", "The Metropolitan Museum of Art", "Jan Vermeer van Delft 019.jpg", 45.7, 40.6, None),
  ("maid-asleep", "A Maid Asleep", "c. 1656–57", "The Metropolitan Museum of Art", "Vermeer young women sleeping.jpg", 87.6, 76.5, None),
  ("lute", "Young Woman with a Lute", "c. 1662–63", "The Metropolitan Museum of Art", "Vermeer - Woman with a Lute near a window.jpg", 51.4, 45.7, None),
  ("study-young-woman", "Study of a Young Woman", "c. 1665–67", "The Metropolitan Museum of Art", "Vermeer-Portrait of a Young Woman.jpg", 44.5, 40, None),
  ("catholic-faith", "Allegory of the Catholic Faith", "c. 1670–72", "The Metropolitan Museum of Art", "Johannes Vermeer, Allegory of the Catholic Faith, The Metropolitan Museum of Art.jpg", 114.3, 88.9, None),
  ("officer", "Officer and Laughing Girl", "c. 1657", "The Frick Collection", "Johannes Vermeer - De Soldaat en het Lachende Meisje - Google Art Project.jpg", 50.5, 46, None),
  ("interrupted", "Girl Interrupted at Her Music", "c. 1658–59", "The Frick Collection", "Vermeer Girl Interrupted at Her Music.jpg", 39.4, 44.5, None),
  ("mistress-maid", "Mistress and Maid", "c. 1664–67", "The Frick Collection", "Vermeer Lady Maidservant Holding Letter.jpg", 90.2, 78.7, None),
  ("leiden-virginal", "Young Woman Seated at a Virginal", "c. 1670–72", "The Leiden Collection", "Young Woman Seated at a Virginal, Johannes Vermeer, 1670-1672, oil on canvas, 25.5 by 20.1 cm, The Leiden Collection.jpg", 25.2, 20, "Privately owned. Seen only when lent to exhibitions."),
  ("balance", "Woman Holding a Balance", "c. 1664", "National Gallery of Art", "Johannes Vermeer - Woman Holding a Balance - Google Art Project.jpg", 42.5, 38, None),
  ("lady-writing", "A Lady Writing", "c. 1665", "National Gallery of Art", "A Lady Writing by Johannes Vermeer, 1665-6.png", 45, 40, None),
  ("red-hat", "Girl with the Red Hat", "c. 1666–67", "National Gallery of Art", "Vermeer - Girl with a Red Hat.JPG", 22.8, 18, None),
  ("flute", "Girl with a Flute", "c. 1665–75", "National Gallery of Art", "Attributed to Johannes Vermeer, Girl with a Flute, probably 1665-1675, NGA 1237.jpg", 20, 17.8, "Since 2022 the museum credits an associate in Vermeer's studio."),
  ("concert", "The Concert", "c. 1664", "Isabella Stewart Gardner Museum", "Vermeer The Concert.jpg", 72.5, 64.7, "Stolen in 1990 and never recovered. The empty frame still hangs in the Dutch Room."),
  ("praxedis", "Saint Praxedis", "1655", "National Museum of Western Art", "Vermeer saint praxedis.jpg", 101.6, 82.6, "Privately owned, on long-term loan. The attribution is still debated."),
]

# Paintings I've seen in person: id -> year (or True if the year is lost). Add as you go.
SEEN = {
  "officer": 2026, "interrupted": 2026, "mistress-maid": 2026,   # the Frick
  "balance": 2023, "red-hat": 2023, "flute": 2023,               # National Gallery of Art
  "view-of-delft": 2022, "pearl-earring": 2022,                  # Mauritshuis
  "milkmaid": 2023, "woman-reading-letter": 2023,                # Rijksmuseum
  "leiden-virginal": 2023,                                       # the Leiden Collection
  "guitar-player": 2024,                                         # Kenwood House
  "art-of-painting": 2025,                                       # Kunsthistorisches Museum
}

out = []
for pid, title, year, museum, commons, h, w, note in P:
    city, country, lat, lon, frame = M[museum]
    d = dict(id=pid, title=title, year=year, museum=museum, city=city, country=country,
             continent=CONTINENT[country],
             lat=lat, lon=lon, heightCm=h, widthCm=w, frame=frame, commons=commons,
             image=f"images/{pid}.jpg")
    if pid == "concert": d["stolen"] = True
    if note: d["note"] = note
    if pid in SEEN: d["seen"] = SEEN[pid]
    out.append(d)
root = pathlib.Path(__file__).resolve().parent.parent
(root / "data/paintings.json").write_text(json.dumps(out, ensure_ascii=False, indent=1))
print(len(out), "paintings,", len({p['city'] for p in out}), "cities,", len(SEEN), "seen")
