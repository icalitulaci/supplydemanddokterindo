"""Attach Kemenkes DREAMS counts (7 basic specialists, ASN/BLUD/contract) to SIRS hospitals.

DREAMS has no hospital codes, so rows are matched by name among non-private SIRS hospitals in the
same kab/kota (DREAMS kab codes are BPS codes, the same as data/population_kabkota.csv).
Ambiguous rows are left unmatched and listed on the Data quality screen.
"""
import csv
import os
from collections import defaultdict

from kmk_match import similarity

HERE = os.path.dirname(os.path.abspath(__file__))
DREAMS_CSV = os.path.join(HERE, "data", "dreams_rsud.csv")
SPECS = ["Sp.A", "Sp.B", "Sp.OG", "Sp.PD", "Sp.An", "Sp.Rad", "Sp.PK"]
PRIVATE = ("SWASTA/LAINNYA", "Perusahaan", "Perorangan")


def is_candidate(h):
    return h["pemilik"] not in PRIVATE and not h["pemilik"].startswith("Organisasi")


def accept(scored):
    if not scored or scored[0][0] < 0.9:
        return False
    runner_up = scored[1][0] if len(scored) > 1 else 0
    # Clear winner, or an exact name match when the runner-up isn't also exact (e.g. RSUD vs RS AL Sabang).
    return scored[0][0] - runner_up >= 0.1 or (scored[0][0] >= 0.99 and runner_up < 0.99)


def match(hospitals):
    """Sets h['dreams'] = {code: [asn, blud, kontrak, total]} on matched hospitals.
    Returns (number of DREAMS rows, list of unmatched rows with their best candidates)."""
    if not os.path.exists(DREAMS_CSV):
        return 0, []
    with open(DREAMS_CSV, encoding="utf8") as f:
        rows = list(csv.DictReader(f))
    by_kab = defaultdict(list)
    for h in hospitals:
        if is_candidate(h):
            by_kab[h["kab_id"]].append(h)
    used, unmatched = set(), []
    for row in rows:
        pool = [h for h in by_kab.get(row["kab_code"], []) if h["kode"] not in used]
        scored = sorted(((similarity(row["nama"], h["nama"]), h) for h in pool), key=lambda t: -t[0])
        counts = {s: [int(row[f"{s}_{k}"]) for k in ("asn", "blud", "kontrak", "total")] for s in SPECS}
        if accept(scored):
            h = scored[0][1]
            h["dreams"] = counts
            used.add(h["kode"])
        else:
            unmatched.append({"nama": row["nama"], "kab_kota": row["kab_kota"].title(), "kelas": row["kelas"],
                              "candidates": [{"kode": h["kode"], "nama": h["nama"], "score": round(s, 2)} for s, h in scored[:2]]})
    return len(rows), unmatched
