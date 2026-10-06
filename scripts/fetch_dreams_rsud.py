"""Download DREAMS (Kemenkes) staffing of the 7 basic specialists for every public hospital in Indonesia.

Source: https://dreams.kemkes.go.id/user/kekosongan_dev/RS/prov/<code>, one page per province.
DREAMS draws on SISDMK and splits each specialty into ASN (civil servant), BLUD (hospital-employed)
and Kontrak (contract). It only covers government hospitals and only these 7 specialties.

Output: data/dreams_rsud.csv, one row per hospital.
"""
import csv
import os
import re
import time
import urllib.request

BASE = "https://dreams.kemkes.go.id/user/kekosongan_dev/RS"
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "dreams_rsud.csv")
SPECS = ["Sp.A", "Sp.B", "Sp.OG", "Sp.PD", "Sp.An", "Sp.Rad", "Sp.PK"]  # column order on the page
KINDS = ["asn", "blud", "kontrak", "total"]


def fetch(url):
    for attempt in range(3):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            return urllib.request.urlopen(req, timeout=120).read().decode("utf8", "ignore")
        except Exception:
            if attempt == 2:
                raise
            time.sleep(3)


def text(cell):
    return re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", cell)).strip()


def parse(html, prov_code):
    rows = []
    for tr in re.findall(r"<tr class=\"[^\"]*\">(.*?)</tr>", html, flags=re.S):
        kab = re.search(r"/kab/(\d+)\"", tr)
        cells = [text(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S)]
        if not kab or len(cells) < 5 + 28:
            continue
        nums = cells[-28:]
        if not all(n.isdigit() for n in nums):
            continue
        row = {"prov_code": prov_code, "kab_code": kab.group(1), "kab_kota": cells[0], "nama": cells[1],
               "kelas": cells[2].replace("Kelas ", ""), "dtpk": cells[3], "blu": cells[4]}
        for i, s in enumerate(SPECS):
            for j, k in enumerate(KINDS):
                row[f"{s}_{k}"] = int(nums[i * 4 + j])
        rows.append(row)
    return rows


def main():
    national = fetch(BASE)
    provs = sorted(set(re.findall(r"kekosongan_dev/RS/prov/(\d+)", national)))
    rows = []
    for p in provs:
        rows += parse(fetch(f"{BASE}/prov/{p}"), p)
        time.sleep(0.5)  # gentle with a public government server
    fields = ["prov_code", "kab_code", "kab_kota", "nama", "kelas", "dtpk", "blu"] + [f"{s}_{k}" for s in SPECS for k in KINDS]
    with open(OUT, "w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    complete = sum(1 for r in rows if all(r[f"{s}_total"] > 0 for s in SPECS))
    print(f"{len(provs)} provinces, {len(rows)} hospitals, {complete} with all 7 basic specialists -> {OUT}")


if __name__ == "__main__":
    main()
