"""Specialist demand score per (hospital, specialty), as defined in specialist-demand-dashboard-prompt.md.

Pure functions only; data loading lives in build_dashboard.py.
"""
from specialties import DOCTOR, doctor


def DOCTOR_PL(code):
    """Plural for area sentences, e.g. 'anesthesiologists (Sp.An)'."""
    return f"{DOCTOR[code]}s ({code})" if code in DOCTOR else code


FLOOR = {  # Pillar A: inferred from PP 28/2024 Ps. 821 services and Permenkes 3/2020 Ps. 8(4)
    "Sp.An": "to run surgery and the ICU (PP 28/2024 Ps. 821)",
    "Sp.B": "to run surgery (PP 28/2024 Ps. 821)",
    "Sp.PK": "to run the lab (PP 28/2024 Ps. 821)",
    "Sp.Rad": "to run X-ray and scans (PP 28/2024 Ps. 821)",
    "Sp.PD": "as one of the 4 basic specialties (Permenkes 3/2020 Ps. 8)",
    "Sp.A": "as one of the 4 basic specialties (Permenkes 3/2020 Ps. 8)",
    "Sp.OG": "as one of the 4 basic specialties (Permenkes 3/2020 Ps. 8)",
}

TIERS = ["Madya", "Utama", "Paripurna"]
SERVICE_NAMES = {"kanker": "cancer", "jantung": "heart", "stroke": "stroke",
                 "uronefrologi": "kidney and urinary", "kia": "mother and child"}
EITHER = ("Sp.Onk.Rad", "Sp.KN")  # cancer Utama needs one of these, not both

# Specialists added at each tier (cumulative). EITHER marks the cancer Utama either/or group.
REQUIRED = {
    "kanker": {"Madya": ["Sp.B", "Sp.PD", "Sp.PA", "Sp.PK", "Sp.Rad"], "Utama": [EITHER], "Paripurna": ["Sp.Onk.Rad", "Sp.KN"]},
    "jantung": {"Madya": ["Sp.JP"], "Utama": ["Sp.BTKV", "Sp.An"], "Paripurna": ["Sp.A"]},
    "stroke": {"Madya": ["Sp.N", "Sp.Rad"], "Utama": ["Sp.BS"], "Paripurna": ["Sp.KFR"]},
    "uronefrologi": {"Madya": ["Sp.PD", "Sp.U"], "Utama": ["Sp.A", "Sp.PA"], "Paripurna": []},
    "kia": {"Madya": ["Sp.OG", "Sp.A", "Sp.An", "Sp.BA"], "Utama": ["Sp.M", "Sp.THT-KL"], "Paripurna": ["Sp.BTKV"]},
}

BANDS = [(0, 50, "<50"), (50, 100, "50–99"), (100, 200, "100–199"), (200, 250, "200–249"), (250, 500, "250–499"), (500, 10 ** 9, "≥500")]


def band_index(beds):
    for i, (lo, hi, _) in enumerate(BANDS):
        if lo <= (beds or 0) < hi:
            return i
    return 0


def fmt(x):
    return f"{x:g}"


def required_for(tiers):
    """{specialty: [(service, tier, is_either)]} for a hospital's KMK tiers."""
    out = {}
    for service, tier in tiers.items():
        if tier not in TIERS:
            continue
        for t in TIERS[: TIERS.index(tier) + 1]:
            # Paripurna requires both cancer specialists outright, which supersedes the Utama either/or.
            for item in REQUIRED[service][t]:
                if item == EITHER:
                    if tier == "Paripurna" and service == "kanker":
                        continue
                    for s in EITHER:
                        out.setdefault(s, []).append((service, tier, True))
                else:
                    out.setdefault(item, []).append((service, tier, False))
    return out


def pillar_a(specialty, general, n):
    if not general or specialty not in FLOOR:
        return 0, None
    if n == 0:
        return 35, f"Has no {doctor(specialty)}. A general hospital needs one {FLOOR[specialty]}."
    if n <= 1:
        return 12, f"Has only 1 {doctor(specialty)}. One doctor can't be on call 24/7 alone."
    return 0, None


def pillar_b(specialty, tiers, counts):
    """Returns (score, reason, (service, tier) or None) for the highest-scoring service."""
    best = (0, None, None)
    n = counts.get(specialty, 0)
    for service, tier, either in required_for(tiers).get(specialty, []):
        if either:
            group_has_one = any(counts.get(s, 0) > 0 for s in EITHER)
            score = 0 if group_has_one else 30
            reason = (f"Government plan (KMK 1277/2024) wants {SERVICE_NAMES[service]} care here at {tier} level. "
                      "That needs a radiation oncologist or a nuclear medicine doctor. Has neither." if score else None)
        elif n == 0:
            score, reason = 30, (f"Government plan (KMK 1277/2024) wants {SERVICE_NAMES[service]} care here at {tier} level. "
                                 f"That needs a {doctor(specialty)}. Has none.")
        elif n <= 1 and tier in ("Utama", "Paripurna"):
            score, reason = 10, (f"Government plan (KMK 1277/2024) wants {SERVICE_NAMES[service]} care here at {tier} level. "
                                 f"That needs more than 1 {doctor(specialty)}. Has only 1.")
        else:
            score, reason = 0, None
        if score > best[0]:
            best = (score, reason, (service, tier))
    return best


def pillar_c(n, m, band_label=None, peer_label=None):
    if not m or m <= n:
        return 0, None
    c = round(15 * min((m - n) / m, 1), 2)
    who = f"{peer_label}, {band_label} beds" if peer_label else "same type and size"
    return c, f"Similar hospitals ({who}) usually have {fmt(m)}. This one has {fmt(n)}."


def pillar_d(specialty, relevant, kab_total, density, national_median, kab_name):
    if density is None:
        return None, "Area check skipped: no population data for this kab/kota."
    if not relevant:
        return 0, None
    if kab_total == 0:
        return 20, f"No {doctor(specialty)} at any hospital in {kab_name}."
    if density < 0.5 * national_median:
        return 12, f"{kab_name} has less than half the usual number of {DOCTOR_PL(specialty)} for its population."
    if density < national_median:
        return 6, f"{kab_name} has fewer {DOCTOR_PL(specialty)} for its population than most areas."
    return 0, None


def label_for(total, n, a, b):
    label = "High" if total >= 60 else "Moderate" if total >= 30 else "Low"
    if n == 0 and (a > 0 or b > 0):
        label = "High"  # hard-gap override
    return label


def score_pair(*, specialty, general, tiers, counts, peer_median, kab_total, density, national_median,
               kab_name, band_label=None, peer_label=None, new_hospital=None):
    n = counts.get(specialty, 0)
    reasons = []
    a, ra = pillar_a(specialty, general, n)
    b, rb, b_service = pillar_b(specialty, tiers, counts)
    c, rc = pillar_c(n, peer_median, band_label, peer_label)
    relevant = (general and specialty in FLOOR) or specialty in required_for(tiers) or (peer_median or 0) >= 1
    d, rd = pillar_d(specialty, relevant, kab_total, density, national_median, kab_name)
    boost = 10 if new_hospital and relevant else 0
    for r in (ra, rb, rc, rd):
        if r:
            reasons.append(r)
    if boost:
        reasons.append("New hospital (open less than 2 years).")
    total = min(round(a + b + c + (d or 0) + boost, 2), 100)
    return {"specialty": specialty, "n": n, "A": a, "B": b, "C": c, "D": d, "boost": boost,
            "total": total, "label": label_for(total, n, a, b), "reasons": reasons,
            "b_service": b_service, "relevant": relevant}
