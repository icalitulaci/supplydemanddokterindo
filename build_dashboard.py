"""Compute demand scores for every (hospital, specialty) and write dashboard/data.json.

Inputs (see README section in specialist-demand-dashboard-prompt.md):
  data/hospitals_sirs.json        <- sirs_scrape.py
  data/population_kabkota.csv     <- scripts/fetch_population.py
  data/kmk1277_kjsu_kia.csv       (+ data/kmk_matches_confirmed.csv from the review screen)
"""
import csv
import json
import os
import statistics
import time
from collections import Counter, defaultdict

import dreams_match
import kmk_match
from regions import kab_key, kab_match, province_key
from scoring import BANDS, FLOOR, band_index, required_for, score_pair
from specialties import NAMES, is_doctor_specialist, normalize

HERE = os.path.dirname(os.path.abspath(__file__))
SIRS = os.path.join(HERE, "data", "hospitals_sirs.json")
POP = os.path.join(HERE, "data", "population_kabkota.csv")
OUT = os.path.join(HERE, "dashboard", "data.json")
SPECIALTIES = list(NAMES)
LABELS = ["Low", "Moderate", "High"]
PLACEHOLDER = (-2.4185588, 108.4919086)  # SIRS default point used when a hospital never set its location
MIN_PEERS = 10


def ownership(owner):
    if owner in ("Pemkab", "Pemkot", "Pemprop", "Kemkes", "Kementerian Lain"):
        return "Government"
    if owner.startswith("TNI") or owner == "POLRI":
        return "TNI/Polri"
    if owner == "BUMN":
        return "BUMN"
    return "Private"


def in_indonesia(lat, lng):
    return lat is not None and lng is not None and -11.5 < lat < 6.5 and 94 < lng < 141.5


def fix_coords(hospitals):
    """Repair swapped coordinates; place missing/implausible ones at the kab/kota center (flagged approx)."""
    for h in hospitals:
        h["approx"] = False
        lat, lng = h.get("lat"), h.get("lng")
        if (lat, lng) == PLACEHOLDER:
            h["lat"] = h["lng"] = None
        elif not in_indonesia(lat, lng) and in_indonesia(lng, lat):
            h["lat"], h["lng"] = lng, lat
        elif not in_indonesia(lat, lng):
            h["lat"] = h["lng"] = None
    groups = defaultdict(list)
    for h in hospitals:
        if h["lat"] is not None:
            groups[h["kab_id"]].append(h)
    centers = {k: (statistics.median(x["lat"] for x in v), statistics.median(x["lng"] for x in v)) for k, v in groups.items()}
    for i, h in enumerate(hospitals):
        c = centers.get(h["kab_id"])
        far = h["lat"] is not None and c and len(groups[h["kab_id"]]) >= 3 and (abs(h["lat"] - c[0]) + abs(h["lng"] - c[1])) > 1.5
        if (h["lat"] is None or far) and c:
            # Spread approximate pins slightly so they don't stack on one point.
            h["lat"] = c[0] + ((i * 37) % 11 - 5) * 0.004
            h["lng"] = c[1] + ((i * 53) % 11 - 5) * 0.004
            h["approx"] = True


def peer_groups(hospitals):
    """Peer = same kind and bed band, merged with neighbouring bands until it has MIN_PEERS hospitals."""
    by_kind = defaultdict(lambda: defaultdict(list))
    for h in hospitals:
        by_kind[h["kind"]][band_index(h["beds"])].append(h)
    groups = {}
    for kind, bands in by_kind.items():
        for b in range(len(BANDS)):
            if not bands.get(b):
                continue
            lo = hi = b
            members = list(bands[b])
            while len(members) < MIN_PEERS and (lo > 0 or hi < len(BANDS) - 1):
                # Grow toward whichever neighbour is closer to the original band, alternating.
                if lo > 0 and (b - lo <= hi - b or hi == len(BANDS) - 1):
                    lo -= 1
                    members += bands.get(lo, [])
                else:
                    hi += 1
                    members += bands.get(hi, [])
            label = BANDS[lo][2] if lo == hi else f"{BANDS[lo][2].split('–')[0].rstrip('≥<')}–{BANDS[hi][2].split('–')[-1].lstrip('≥<')}"
            if lo != hi and hi == len(BANDS) - 1:
                label = f"≥{BANDS[lo][0]}"
            if lo == 0 and lo != hi:
                label = f"<{BANDS[hi][1]}"
            medians = {s: statistics.median(m["counts"].get(s, 0) for m in members) for s in SPECIALTIES}
            groups[(kind, b)] = {"kind": kind, "band": label, "size": len(members), "medians": medians}
    return groups


def load_spot_check():
    path = os.path.join(HERE, "data", "spot_check.csv")
    if not os.path.exists(path):
        return []
    with open(path, encoding="utf8") as f:
        return list(csv.DictReader(f))


def main():
    started = time.time()
    data = json.load(open(SIRS, encoding="utf8"))
    hospitals = data["hospitals"]

    # Population, keyed by (province, kab) with the same normalization as SIRS
    pops = {}
    with open(POP, encoding="utf8") as f:
        for r in csv.DictReader(f):
            pops.setdefault(province_key(r["provinsi"]), {})[kab_key(r["kab_kota"])] = r
    kabs = {}
    for prov_rows in pops.values():
        for r in prov_rows.values():
            kabs[r["kab_code"]] = {"id": r["kab_code"], "provinsi": r["provinsi"], "kab_kota": r["kab_kota"],
                                   "population": int(r["population"]), "totals": Counter(), "hospitals": 0}

    unmapped = Counter()
    for h in hospitals:
        prov_rows = pops.get(province_key(h["provinsi"]), {})
        k = kab_match(kab_key(h["kab_kota"]), prov_rows)
        h["kab_id"] = prov_rows[k]["kab_code"] if k else f"x:{h['provinsi']}|{h['kab_kota']}"
        counts, sub = Counter(), Counter()
        for s in h["staff"]:
            if not is_doctor_specialist(s["group"], s["type"]) or s["count"] <= 0:
                continue
            code, is_sub = normalize(s["group"], s["type"])
            if code is None:
                unmapped[s["type"]] += s["count"]
                continue
            counts[code] += s["count"]
            if is_sub:
                sub[code] += s["count"]
        h["counts"], h["sub"] = counts, sub
        h["beds"] = h.get("beds_total") or 0
        h["general"] = h["jenis"] == "RSU"
        h["kind"] = "RSU" if h["general"] else h["jenis"]
        if h["kab_id"] in kabs:
            kabs[h["kab_id"]]["totals"].update(counts)
            kabs[h["kab_id"]]["hospitals"] += 1
    fix_coords(hospitals)

    density = {kid: {s: k["totals"].get(s, 0) / k["population"] * 1e5 for s in SPECIALTIES}
               for kid, k in kabs.items() if k["population"] > 0}
    national_median = {s: statistics.median(d[s] for d in density.values()) for s in SPECIALTIES}

    dreams_total, dreams_unmatched = dreams_match.match(hospitals)
    # SIRS vs DREAMS: compare SIRS specialists without subspecialists, as DREAMS counts base specialties.
    disagreements = []
    for h in hospitals:
        for code, (_, _, _, total) in h.get("dreams", {}).items():
            sirs = h["counts"].get(code, 0) - h["sub"].get(code, 0)
            if sirs != total:
                disagreements.append([h["kode"], code, sirs, total])

    matches = kmk_match.match_all(hospitals)
    tiers_by_hospital, kmk_by_hospital = {}, {}
    for m in matches:
        if m["sirs_kode"]:
            tiers_by_hospital[m["sirs_kode"]] = m["tiers"]
            kmk_by_hospital[m["sirs_kode"]] = {"tiers": m["tiers"], "page": m["halaman_pdf"], "nama": m["nama_rs"]}

    groups = peer_groups(hospitals)
    reason_table, reason_index = [], {}

    def rid(text):
        if text not in reason_index:
            reason_index[text] = len(reason_table)
            reason_table.append(text)
        return reason_index[text]

    out_h = []
    label_counts = Counter()
    for h in hospitals:
        g = groups[(h["kind"], band_index(h["beds"]))]
        tiers = tiers_by_hospital.get(h["kode"], {})
        kab = kabs.get(h["kab_id"])
        scores = []
        for si, s in enumerate(SPECIALTIES):
            r = score_pair(specialty=s, general=h["general"], tiers=tiers, counts=h["counts"],
                           peer_median=g["medians"][s], kab_total=kab["totals"].get(s, 0) if kab else 0,
                           density=density.get(h["kab_id"], {}).get(s) if kab else None,
                           national_median=national_median[s], kab_name=kab["kab_kota"] if kab else h["kab_kota"],
                           band_label=g["band"], peer_label=h["kind"])
            label_counts[r["label"]] += 1
            # Compact row: specialty, n, peer median, A, B, C, D, total, label, reason ids, KMK service
            scores.append([si, r["n"], g["medians"][s], r["A"], r["B"], r["C"], r["D"], r["total"],
                           LABELS.index(r["label"]), [rid(x) for x in r["reasons"]],
                           f"{r['b_service'][0]}|{r['b_service'][1]}" if r["b_service"] else None])
        out_h.append({
            "id": h["kode"], "name": h["nama"], "prov": h["provinsi"], "kab": h["kab_kota"], "kab_id": h["kab_id"],
            "owner": h["pemilik"], "own": ownership(h["pemilik"]), "kelas": h["kelas"], "type": h["jenis"],
            "general": h["general"], "beds": h["beds"], "band": g["band"], "peers": g["size"],
            "lat": round(h["lat"], 5) if h["lat"] is not None else None,
            "lng": round(h["lng"], 5) if h["lng"] is not None else None, "approx": h["approx"],
            "address": h["alamat"], "phone": h["telepon"], "kmk": kmk_by_hospital.get(h["kode"]),
            "sub": dict(h["sub"]), "scores": scores, "dreams": h.get("dreams"),
        })

    quality = {
        "kmk_total": len(matches),
        "kmk_matched": sum(1 for m in matches if m["sirs_kode"]),
        "kmk_status": dict(Counter(m["status"] for m in matches)),
        "review": [m for m in matches if m["status"] in ("review",)],
        "no_match": [m for m in matches if m["status"] == "no_match"],
        "missing_beds": [h["kode"] for h in hospitals if not h["beds"]],
        "missing_population": sorted({h["kab_kota"] for h in hospitals if h["kab_id"] not in kabs}),
        "approx_location": sum(1 for h in hospitals if h["approx"]),
        "no_location": sum(1 for h in hospitals if h["lat"] is None),
        "unmapped_labels": unmapped.most_common(),
        "dreams_total": dreams_total,
        "dreams_matched": sum(1 for h in hospitals if h.get("dreams")),
        "dreams_unmatched": dreams_unmatched,
        "dreams_pairs": sum(len(h["dreams"]) for h in hospitals if h.get("dreams")),
        "dreams_disagree": disagreements,
        "spot_check": load_spot_check(),
        "operational_since": False,
        "vacancies": False,
    }
    payload = {
        "meta": {"built": time.strftime("%Y-%m-%d %H:%M"), "sirs_downloaded": data["meta"]["downloaded"],
                 "population_source": "Dukcapil Kemendagri (AGR_VISUAL_KAB_FIX), total "
                                      f"{sum(k['population'] for k in kabs.values()):,}"},
        "specialties": [{"code": s, "name": NAMES[s], "floor": s in FLOOR} for s in SPECIALTIES],
        "national_median": [round(national_median[s], 4) for s in SPECIALTIES],
        "kabs": [{"id": k["id"], "prov": k["provinsi"], "kab": k["kab_kota"], "pop": k["population"],
                  "hospitals": k["hospitals"], "totals": [k["totals"].get(s, 0) for s in SPECIALTIES]} for k in kabs.values()],
        "reasons": reason_table,
        "hospitals": out_h,
        "quality": quality,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(out_h)} hospitals × {len(SPECIALTIES)} specialties; labels {dict(label_counts)}; "
          f"KMK matched {quality['kmk_matched']}/{quality['kmk_total']}; "
          f"{os.path.getsize(OUT) // 1024} KB in {time.time() - started:.1f}s")
    return payload


if __name__ == "__main__":
    main()
