"""Download population per kab/kota into data/population_kabkota.csv.

Source: Dukcapil Kemendagri public GIS service (AGR_VISUAL_KAB_FIX), field JUMLAH_PENDUDUK.
BPS blocks automated downloads, so this registry count is used instead. To use BPS figures,
replace the CSV with the same columns (kab_code, provinsi, kab_kota, population).
kab_code = province number * 100 + kab number, the same 4-digit code that starts every SIRS hospital code.
"""
import csv
import json
import os
import urllib.parse
import urllib.request

URL = "https://gis.dukcapil.kemendagri.go.id/arcgis/rest/services/AGR_VISUAL_KAB_FIX/MapServer/3/query"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "population_kabkota.csv")


def main():
    rows, offset = [], 0
    while True:
        params = dict(where="1=1", outFields="nama_prop,nama_kab,no_prop,no_kab,jumlah_penduduk",
                      returnGeometry="false", resultOffset=offset, resultRecordCount=1000, f="json")
        req = urllib.request.Request(URL + "?" + urllib.parse.urlencode(params), headers={"User-Agent": "Mozilla/5.0"})
        page = [f["attributes"] for f in json.loads(urllib.request.urlopen(req, timeout=90).read())["features"]]
        rows += page
        if len(page) < 1000:
            break
        offset += 1000
    rows.sort(key=lambda r: (r["no_prop"], r["no_kab"]))
    with open(OUT, "w", newline="", encoding="utf8") as f:
        w = csv.writer(f)
        w.writerow(["kab_code", "provinsi", "kab_kota", "population"])
        for r in rows:
            w.writerow([f"{r['no_prop']:02d}{r['no_kab']:02d}", r["nama_prop"].title(), r["nama_kab"].title(), r["jumlah_penduduk"]])
    print(f"{len(rows)} kab/kota, total {sum(r['jumlah_penduduk'] for r in rows):,} -> {OUT}")


if __name__ == "__main__":
    main()
