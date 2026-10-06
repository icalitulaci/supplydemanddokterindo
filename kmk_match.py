"""Match KMK 1277/2024 network hospitals to SIRS hospitals.

Only government hospitals (Pemkab, Pemkot, Pemprop, Kemkes) are candidates, compared within the
same kab/kota first (falling back to the whole province when the KMK row's kab/kota can't be resolved).
Matches above AUTO_ACCEPT are accepted automatically; the rest go to the review queue.
Decisions made on the review screen are kept in data/kmk_matches_confirmed.csv and always win.
"""
import csv
import os
import re
from difflib import SequenceMatcher

from regions import kab_key, province_key

HERE = os.path.dirname(os.path.abspath(__file__))
KMK_CSV = os.path.join(HERE, "data", "kmk1277_kjsu_kia.csv")
CONFIRMED_CSV = os.path.join(HERE, "data", "kmk_matches_confirmed.csv")
GOV_OWNERS = {"Pemkab", "Pemkot", "Pemprop", "Kemkes"}
AUTO_ACCEPT = 0.9
MARGIN = 0.1  # best candidate must beat the runner-up by this much
SERVICES = ["kanker", "jantung", "stroke", "uronefrologi", "kia"]

PREFIXES = [r"rumah sakit umum daerah", r"rumah sakit umum pusat", r"rumah sakit umum", r"rumah sakit khusus",
            r"rumah sakit", r"rs umum daerah", r"rs umum pusat", r"rs umum", r"rsud", r"rsup", r"rsu", r"rsk", r"rs",
            r"upt", r"uptd"]
STOP = {"dr", "drs", "h", "hj", "prof", "ir", "kab", "kabupaten", "kota", "provinsi", "daerah", "umum", "dan", "tk", "kelas"}


def name_tokens(name):
    s = name.lower()
    s = re.sub(r"[.,'’()/-]", " ", s)
    for p in PREFIXES:
        s = re.sub(rf"\b{p}\b", " ", s)
    return [t for t in s.split() if t not in STOP]


def similarity(a, b):
    ta, tb = name_tokens(a), name_tokens(b)
    if not ta or not tb:
        return 0.0
    seq = SequenceMatcher(None, " ".join(ta), " ".join(tb)).ratio()
    overlap = len(set(ta) & set(tb)) / max(1, min(len(set(ta)), len(set(tb))))
    return round(max(seq, 0.5 * seq + 0.5 * overlap), 3)


def kind_matches(kmk_name, sirs_hospital):
    """Block auto-matches across hospital kinds: general vs specialty (RSUD vs RS Mata),
    and central (RSUP, Kemenkes-owned) vs regional."""
    special = ("mata", "jiwa", "paru", "kanker", "jantung", "ibu dan anak", "bersalin", "otak", "orthopedi", "ortopedi")
    a, b = kmk_name.lower(), sirs_hospital["nama"].lower()
    if not all((k in a) == (k in b) for k in special):
        return False
    return ("umum pusat" in a) == (sirs_hospital["pemilik"] == "Kemkes") or not ("umum pusat" in a or "umum daerah" in a)


def kmk_key(row):
    return f"{row['provinsi']}|{row['no']}"


def load_kmk():
    with open(KMK_CSV, encoding="utf8") as f:
        return list(csv.DictReader(f))


def load_confirmed():
    if not os.path.exists(CONFIRMED_CSV):
        return {}
    with open(CONFIRMED_CSV, encoding="utf8") as f:
        return {r["kmk_key"]: r["sirs_kode"] for r in csv.DictReader(f)}


def save_confirmed(kmk_key_value, sirs_kode):
    """sirs_kode '' records 'no match in SIRS'."""
    rows = load_confirmed()
    rows[kmk_key_value] = sirs_kode
    with open(CONFIRMED_CSV, "w", newline="", encoding="utf8") as f:
        w = csv.writer(f)
        w.writerow(["kmk_key", "sirs_kode"])
        for k, v in sorted(rows.items()):
            w.writerow([k, v])


def match_all(hospitals):
    """Returns list of dicts, one per KMK row, with status auto/confirmed/review/unmatched."""
    gov = [h for h in hospitals if h["pemilik"] in GOV_OWNERS]
    by_prov = {}
    for h in gov:
        by_prov.setdefault(province_key(h["provinsi"]), []).append(h)
    confirmed = load_confirmed()
    out = []
    for row in load_kmk():
        key = kmk_key(row)
        tiers = {s: row[s] for s in SERVICES if row[s]}
        pool = by_prov.get(province_key(row["provinsi"]), [])
        kk = kab_key(row["kab_kota"])
        same_kab = [h for h in pool if kab_key(h["kab_kota"]) == kk or kab_key(h["kab_kota"]).removeprefix("k:") == kk.removeprefix("k:")]
        scored = sorted(((similarity(row["nama_rs"], h["nama"]) + (0.05 if h in same_kab else 0), h) for h in pool),
                        key=lambda x: -x[0])
        candidates = [{"kode": h["kode"], "nama": h["nama"], "kab_kota": h["kab_kota"], "score": round(min(s, 1), 3)}
                      for s, h in scored[:5]]
        rec = {"kmk_key": key, "provinsi": row["provinsi"], "nama_rs": row["nama_rs"], "kab_kota": row["kab_kota"],
               "tiers": tiers, "halaman_pdf": row["halaman_pdf"], "candidates": candidates, "sirs_kode": None}
        if key in confirmed:
            rec["sirs_kode"] = confirmed[key] or None
            rec["status"] = "confirmed" if confirmed[key] else "no_match"
        elif (candidates and candidates[0]["score"] >= AUTO_ACCEPT and scored[0][1] in same_kab
              and (len(candidates) < 2 or candidates[0]["score"] - candidates[1]["score"] >= MARGIN)
              and kind_matches(row["nama_rs"], scored[0][1])):
            rec["sirs_kode"] = candidates[0]["kode"]
            rec["status"] = "auto"
        else:
            rec["status"] = "review"
        out.append(rec)
    # One SIRS hospital can't be two KMK rows: send later duplicates to review.
    seen = {}
    for rec in out:
        if rec["status"] == "auto":
            if rec["sirs_kode"] in seen:
                rec["status"], rec["sirs_kode"] = "review", None
            else:
                seen[rec["sirs_kode"]] = rec["kmk_key"]
    return out
