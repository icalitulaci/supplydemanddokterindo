"""Draw a reproducible spot-check sample of "high need" flags to verify by hand.

Strata (the weak spots found when comparing sources):
  contradicted  - SIRS says 0 of a basic specialist, Kemenkes DREAMS says at least 1
  both_zero     - public hospital where SIRS and DREAMS both say 0
  private       - private hospital flagged high need; only SIRS covers these

Output: data/spot_check.csv. Fill in verified_count, verdict (sirs_right / dreams_right /
flag_right / flag_wrong / inconclusive), source_url, checked_on, note. Existing answers are kept on re-run.
"""
import csv
import json
import os
import random

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(HERE, "dashboard", "data.json")
OUT = os.path.join(HERE, "data", "spot_check.csv")
SEED = 20261006
PER_STRATUM = {"contradicted": 12, "both_zero": 8, "private": 10}
FIELDS = ["stratum", "hospital_id", "hospital", "kab_kota", "province", "ownership", "specialty", "sirs_count",
          "dreams_count", "score", "verified_count", "verdict", "source_url", "checked_on", "note"]


def main():
    d = json.load(open(DATA, encoding="utf8"))
    codes = [s["code"] for s in d["specialties"]]
    pools = {k: [] for k in PER_STRATUM}
    for h in d["hospitals"]:
        for r in h["scores"]:
            if r[8] != 2:
                continue
            code = codes[r[0]]
            dreams = (h.get("dreams") or {}).get(code)
            row = {"hospital_id": h["id"], "hospital": h["name"], "kab_kota": h["kab"], "province": h["prov"],
                   "ownership": h["own"], "specialty": code, "sirs_count": r[1],
                   "dreams_count": dreams[3] if dreams else "", "score": r[7]}
            if dreams and r[1] == 0 and dreams[3] > 0:
                pools["contradicted"].append(row)
            elif dreams and r[1] == 0 and dreams[3] == 0:
                pools["both_zero"].append(row)
            elif h["own"] == "Private":
                pools["private"].append(row)
    rng = random.Random(SEED)
    previous = {}
    if os.path.exists(OUT):
        with open(OUT, encoding="utf8") as f:
            previous = {(r["hospital_id"], r["specialty"]): r for r in csv.DictReader(f)}
    out = []
    for stratum, n in PER_STRATUM.items():
        for row in rng.sample(pools[stratum], min(n, len(pools[stratum]))):
            row["stratum"] = stratum
            old = previous.get((row["hospital_id"], row["specialty"]), {})
            for k in ("verified_count", "verdict", "source_url", "checked_on", "note"):
                row[k] = old.get(k, "")
            out.append(row)
    with open(OUT, "w", newline="", encoding="utf8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        w.writerows(out)
    print({k: len(v) for k, v in pools.items()}, "->", len(out), "sampled ->", OUT)


if __name__ == "__main__":
    main()
