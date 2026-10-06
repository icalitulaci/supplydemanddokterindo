"""Build peta_rs_jawa.html (clickable hospital/specialist map) from java_hospitals_sirs.json.

Run sirs_scrape.py first. The province outlines come from SIRS's own boundary file.
"""
import json
import os
import re
import urllib.request
from collections import Counter, defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "java_hospitals_sirs.json")
OUT = os.path.join(HERE, "peta_rs_jawa.html")
TEMPLATE = os.path.join(HERE, "peta_rs_jawa.template.html")
PROV_URL = "https://sirs.kemkes.go.id/fo/mapgeo/koordinat?id=0&mapfile=json%2Fprovinsi.json"
LEAFLET_CSS_URL = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css"
JAVA_PROV ={"31", "32", "33", "34", "35", "36"}

# Same specialty entered under a different label by some hospitals.
ALIASES = {"Dokter Spesialis Bedah Orthopedi": "Dokter Spesialis Orthopedi & Traumatologi (Sp.OT)"}


def category(group, typ):
    """Bucket a SIRS staff row; None means it is not a doctor."""
    g, t = group.lower(), typ.lower()
    if "subspesialis" in g or "subspesialis" in t or "kualifikasi tambahan" in t:
        return "sub"
    if "dokter gigi spesialis" in t or g == "pelayanan medik spesialis gigi":
        return "gigi"
    if g == "pelayanan medik spesialis dasar":
        return "dasar"
    if "spesialis" in t:
        return "lain"
    if t in ("dokter", "dokter gigi") or g == "pelayanan medik umum":
        return "umum"
    return None


def in_java(lat, lng):
    return lat is not None and -9 < lat < -5 and 105 < lng < 115.5


def fix_coords(hospitals):
    """SIRS has placeholder/swapped coordinates for some hospitals; repair or approximate them."""
    for h in hospitals:
        lat, lng = h["lat"], h["lng"]
        h["approx"] = 0
        if lat is not None and not in_java(lat, lng) and in_java(lng, lat):
            h["lat"], h["lng"] = lng, lat
    centroids = defaultdict(list)
    for h in hospitals:
        if in_java(h["lat"], h["lng"]):
            centroids[(h["provinsi"], h["kab_kota"])].append((h["lat"], h["lng"]))
    for i, h in enumerate(hospitals):
        if in_java(h["lat"], h["lng"]):
            continue
        pts = centroids.get((h["provinsi"], h["kab_kota"]))
        if not pts:
            h["lat"] = h["lng"] = None
            continue
        # Spread approximate pins a little so they don't stack on one point.
        h["lat"] = sum(p[0] for p in pts) / len(pts) + ((i * 37) % 11 - 5) * 0.004
        h["lng"] = sum(p[1] for p in pts) / len(pts) + ((i * 53) % 11 - 5) * 0.004
        h["approx"] = 1


def simplify(coords, nd=3):
    out = []
    for p in coords:
        q = [round(p[0], nd), round(p[1], nd)]
        if not out or q != out[-1]:
            out.append(q)
    return out


def province_outlines():
    req = urllib.request.Request(PROV_URL, headers={"User-Agent": "Mozilla/5.0"})
    geo = json.loads(urllib.request.urlopen(req, timeout=120).read())
    feats = []
    for f in geo["features"]:
        if f["properties"]["KODE_BPS"] not in JAVA_PROV:
            continue
        g = f["geometry"]
        polys = g["coordinates"] if g["type"] == "MultiPolygon" else [g["coordinates"]]
        polys = [[simplify(ring) for ring in poly] for poly in polys]
        polys = [p for p in polys if len(p[0]) > 6]  # drop specks of tiny islets
        feats.append({"type": "Feature", "properties": {"n": f["properties"]["PROVINSI"]},
                      "geometry": {"type": "MultiPolygon", "coordinates": polys}})
    return {"type": "FeatureCollection", "features": feats}


def main():
    data = json.load(open(SRC, encoding="utf8"))
    hospitals = data["hospitals"]
    fix_coords(hospitals)

    types, cats, index = [], [], {}
    rows = []
    for h in hospitals:
        counts = Counter()
        for s in h["staff"]:
            typ = ALIASES.get(s["type"], s["type"]).strip()
            cat = category(s["group"], typ)
            if cat is None or s["count"] <= 0:
                continue
            if typ not in index:
                index[typ] = len(types)
                types.append(typ)
                cats.append(cat)
            counts[index[typ]] += s["count"]
        flat = [v for k, n in sorted(counts.items()) for v in (k, n)]
        lat = round(h["lat"], 5) if h["lat"] is not None else None
        lng = round(h["lng"], 5) if h["lng"] is not None else None
        rows.append([h["kode"], h["nama"], h["provinsi"], h["kab_kota"], h["pemilik"], h["kelas"], h["jenis"],
                     h["beds_total"], lat, lng, h["approx"], h["alamat"], h["telepon"], flat])

    payload = {"meta": data["meta"], "types": types, "cats": cats, "rows": rows, "prov": province_outlines()}
    page = open(TEMPLATE, encoding="utf8").read()
    # Published pages may only load scripts from CDNs, so Leaflet's stylesheet is inlined.
    leaflet_css = urllib.request.urlopen(LEAFLET_CSS_URL, timeout=60).read().decode("utf8")
    page = page.replace("/*__LEAFLET_CSS__*/", re.sub(r"url\(images/[^)]*\)", "none", leaflet_css))
    js = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    open(OUT, "w", encoding="utf8").write(page.replace("/*__DATA__*/null", js))
    print(f"{len(rows)} hospitals, {len(types)} doctor types, "
          f"{sum(1 for r in rows if r[10])} approximate, {sum(1 for r in rows if r[8] is None)} unplaced -> {OUT}"
          f" ({os.path.getsize(OUT) // 1024} KB)")


if __name__ == "__main__":
    main()
