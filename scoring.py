"""Specialist demand score per (hospital, specialty), as defined in specialist-demand-dashboard-prompt.md.

Pure functions only; data loading lives in build_dashboard.py.
Every reason is produced in English and Indonesian: pillars return (score, (en, id)) pairs.
"""
from specialties import DOCTOR, DOCTOR_ID, doctor, doctor_id


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
FLOOR_ID = {
    "Sp.An": "untuk menjalankan layanan bedah dan ICU (PP 28/2024 Ps. 821)",
    "Sp.B": "untuk menjalankan layanan bedah (PP 28/2024 Ps. 821)",
    "Sp.PK": "untuk menjalankan laboratorium (PP 28/2024 Ps. 821)",
    "Sp.Rad": "untuk menjalankan rontgen dan pemindaian (PP 28/2024 Ps. 821)",
    "Sp.PD": "sebagai salah satu dari 4 spesialis dasar (Permenkes 3/2020 Ps. 8)",
    "Sp.A": "sebagai salah satu dari 4 spesialis dasar (Permenkes 3/2020 Ps. 8)",
    "Sp.OG": "sebagai salah satu dari 4 spesialis dasar (Permenkes 3/2020 Ps. 8)",
}

TIERS = ["Madya", "Utama", "Paripurna"]
SERVICE_NAMES = {"kanker": "cancer", "jantung": "heart", "stroke": "stroke",
                 "uronefrologi": "kidney and urinary", "kia": "mother and child"}
SERVICE_NAMES_ID = {"kanker": "kanker", "jantung": "jantung", "stroke": "stroke",
                    "uronefrologi": "ginjal dan saluran kemih", "kia": "ibu dan anak"}
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
        return 35, (f"Has no {doctor(specialty)}. A general hospital needs one {FLOOR[specialty]}.",
                    f"Tidak ada {doctor_id(specialty)}. Rumah sakit umum membutuhkannya {FLOOR_ID[specialty]}.")
    if n <= 1:
        return 12, (f"Has only 1 {doctor(specialty)}. One doctor can't be on call 24/7 alone.",
                    f"Hanya ada 1 {doctor_id(specialty)}. Satu dokter tidak bisa jaga 24 jam sendirian.")
    return 0, None


def pillar_b(specialty, tiers, counts):
    """Returns (score, (en, id) reason, (service, tier) or None) for the highest-scoring service."""
    best = (0, None, None)
    n = counts.get(specialty, 0)
    for service, tier, either in required_for(tiers).get(specialty, []):
        plan_en = f"Government plan (KMK 1277/2024) wants {SERVICE_NAMES[service]} care here at {tier} level. "
        plan_id = f"Rencana pemerintah (KMK 1277/2024) menargetkan layanan {SERVICE_NAMES_ID[service]} tingkat {tier} di sini. "
        if either:
            score = 0 if any(counts.get(s, 0) > 0 for s in EITHER) else 30
            reason = ((plan_en + "That needs a radiation oncologist or a nuclear medicine doctor. Has neither.",
                       plan_id + "Itu membutuhkan dokter spesialis onkologi radiasi atau kedokteran nuklir. Keduanya belum ada.")
                      if score else None)
        elif n == 0:
            score, reason = 30, (plan_en + f"That needs a {doctor(specialty)}. Has none.",
                                 plan_id + f"Itu membutuhkan {doctor_id(specialty)}. Belum ada.")
        elif n <= 1 and tier in ("Utama", "Paripurna"):
            score, reason = 10, (plan_en + f"That needs more than 1 {doctor(specialty)}. Has only 1.",
                                 plan_id + f"Itu membutuhkan lebih dari 1 {doctor_id(specialty)}. Baru ada 1.")
        else:
            score, reason = 0, None
        if score > best[0]:
            best = (score, reason, (service, tier))
    return best


def pillar_c(n, m, band_label=None, peer_label=None, peer_count=None):
    if not m or m <= n:
        return 0, None
    c = round(15 * min((m - n) / m, 1), 2)
    if peer_label:
        who_en = f"{peer_label}, {band_label} beds" + (f", {peer_count} hospitals" if peer_count else "")
        who_id = f"{peer_label}, {band_label} tempat tidur" + (f", {peer_count} rumah sakit" if peer_count else "")
    else:
        who_en, who_id = "same type and size", "jenis dan ukuran sama"
    return c, (f"Similar hospitals ({who_en}) usually have {fmt(m)}. This one has {fmt(n)}.",
               f"Rumah sakit serupa ({who_id}) biasanya punya {fmt(m)}. Rumah sakit ini punya {fmt(n)}.")


def pillar_d(specialty, relevant, kab_total, density, national_median, kab_name):
    if density is None:
        return None, ("Area check skipped: no population data for this kab/kota.",
                      "Pengecekan wilayah dilewati: tidak ada data penduduk untuk kab/kota ini.")
    if not relevant:
        return 0, None
    if kab_total == 0:
        return 20, (f"No {doctor(specialty)} at any hospital in {kab_name}.",
                    f"Tidak ada {doctor_id(specialty)} di rumah sakit mana pun di {kab_name}.")
    if density < 0.5 * national_median:
        return 12, (f"{kab_name} has less than half the usual number of {DOCTOR_PL(specialty)} for its population.",
                    f"Jumlah {doctor_id(specialty)} di {kab_name} kurang dari separuh jumlah biasa untuk penduduknya.")
    if density < national_median:
        return 6, (f"{kab_name} has fewer {DOCTOR_PL(specialty)} for its population than most areas.",
                   f"Jumlah {doctor_id(specialty)} di {kab_name} untuk penduduknya lebih sedikit dari kebanyakan daerah.")
    return 0, None


def label_for(total, n, a, b):
    label = "High" if total >= 60 else "Moderate" if total >= 30 else "Low"
    if n == 0 and (a > 0 or b > 0):
        label = "High"  # hard-gap override
    return label


def score_pair(*, specialty, general, tiers, counts, peer_median, kab_total, density, national_median,
               kab_name, band_label=None, peer_label=None, peer_count=None, new_hospital=None):
    n = counts.get(specialty, 0)
    a, ra = pillar_a(specialty, general, n)
    b, rb, b_service = pillar_b(specialty, tiers, counts)
    c, rc = pillar_c(n, peer_median, band_label, peer_label, peer_count)
    relevant = (general and specialty in FLOOR) or specialty in required_for(tiers) or (peer_median or 0) >= 1
    d, rd = pillar_d(specialty, relevant, kab_total, density, national_median, kab_name)
    boost = 10 if new_hospital and relevant else 0
    pairs = [r for r in (ra, rb, rc, rd) if r]
    if boost:
        pairs.append(("New hospital (open less than 2 years).", "Rumah sakit baru (buka kurang dari 2 tahun)."))
    total = min(round(a + b + c + (d or 0) + boost, 2), 100)
    return {"specialty": specialty, "n": n, "A": a, "B": b, "C": c, "D": d, "boost": boost,
            "total": total, "label": label_for(total, n, a, b),
            "reasons": [en for en, _ in pairs], "reasons_id": [id_ for _, id_ in pairs],
            "b_service": b_service, "relevant": relevant}
