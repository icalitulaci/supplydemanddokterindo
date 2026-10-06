"""Map SIRS staff labels to the specialty codes used by the scoring rules.

Subspecialists count toward their parent specialty (prompt: "Specialty codes").
Labels that can't be mapped are returned as None and listed on the Data quality screen.
"""
import re

NAMES = {
    "Sp.PD": "Internal medicine", "Sp.A": "Pediatrics", "Sp.OG": "Obstetrics-gynecology", "Sp.B": "General surgery",
    "Sp.An": "Anesthesiology", "Sp.Rad": "Radiology", "Sp.PK": "Clinical pathology", "Sp.PA": "Anatomical pathology",
    "Sp.JP": "Cardiology", "Sp.BTKV": "Thoracic-cardiovascular surgery", "Sp.N": "Neurology", "Sp.BS": "Neurosurgery",
    "Sp.KFR": "Physical medicine & rehabilitation", "Sp.U": "Urology", "Sp.Onk.Rad": "Radiation oncology",
    "Sp.KN": "Nuclear medicine", "Sp.BA": "Pediatric surgery", "Sp.M": "Ophthalmology", "Sp.THT-KL": "ENT",
    # Other specialties kept from the data (score through pillars C and D)
    "Sp.OT": "Orthopedics & traumatology", "Sp.P": "Pulmonology", "Sp.DVE": "Dermatology & venereology",
    "Sp.KJ": "Psychiatry", "Sp.GK": "Clinical nutrition", "Sp.BP": "Plastic surgery", "Sp.MK": "Clinical microbiology",
    "Sp.F": "Forensic medicine", "Sp.Ak": "Medical acupuncture", "Sp.OK": "Occupational medicine",
    "Sp.And": "Andrology", "Sp.EM": "Emergency medicine", "Sp.KO": "Sports medicine",
    "Sp.KKLP": "Family & primary care medicine", "Sp.FK": "Clinical pharmacology", "Sp.KP": "Aviation medicine",
    "Sp.ParK": "Clinical parasitology", "Sp.KL": "Marine medicine",
}

# Plain "a doctor who…" nouns for reason sentences
DOCTOR = {
    "Sp.PD": "internist", "Sp.A": "pediatrician", "Sp.OG": "OB-GYN", "Sp.B": "general surgeon",
    "Sp.An": "anesthesiologist", "Sp.Rad": "radiologist", "Sp.PK": "clinical pathologist",
    "Sp.PA": "anatomical pathologist", "Sp.JP": "cardiologist", "Sp.BTKV": "heart and chest surgeon",
    "Sp.N": "neurologist", "Sp.BS": "neurosurgeon", "Sp.KFR": "rehabilitation doctor", "Sp.U": "urologist",
    "Sp.Onk.Rad": "radiation oncologist", "Sp.KN": "nuclear medicine doctor", "Sp.BA": "pediatric surgeon",
    "Sp.M": "eye doctor", "Sp.THT-KL": "ENT doctor", "Sp.OT": "orthopedic surgeon", "Sp.P": "lung doctor",
    "Sp.DVE": "dermatologist", "Sp.KJ": "psychiatrist", "Sp.GK": "clinical nutrition doctor", "Sp.BP": "plastic surgeon",
    "Sp.MK": "clinical microbiologist", "Sp.F": "forensic doctor", "Sp.Ak": "acupuncture doctor",
    "Sp.OK": "occupational medicine doctor", "Sp.And": "andrologist", "Sp.EM": "emergency medicine doctor",
    "Sp.KO": "sports medicine doctor", "Sp.KKLP": "family medicine doctor", "Sp.FK": "clinical pharmacologist",
    "Sp.KP": "aviation medicine doctor", "Sp.ParK": "clinical parasitologist", "Sp.KL": "marine medicine doctor",
}


def doctor(code):
    return f"{DOCTOR[code]} ({code})" if code in DOCTOR else code


# Abbreviation inside the SIRS label's parentheses -> code
ABBR = {"sp.s": "Sp.N", "sp.kk": "Sp.DVE", "sp.rm": "Sp.KFR", "sp. b vaskular": "Sp.B", "an-kna": "Sp.An",
        "sp. kklp": "Sp.KKLP", "sp.pk": "Sp.PK"}
# Labels without a usable abbreviation
PLAIN = [("ofthalmologi", "Sp.M"), ("bedah orthopedi", "Sp.OT"), ("patologi forensik", "Sp.F"), ("gizi medik", "Sp.GK"),
         ("radioterapi", "Sp.Onk.Rad"), ("kedokteran kelautan", "Sp.KL"), ("kedokteran nuklir", "Sp.KN")]
# Subspecialist group text -> parent (checked in order, most specific first)
SUB_GROUP = [("bedah saraf", "Sp.BS"), ("bedah anak", "Sp.BA"), ("bedah plastik", "Sp.BP"), ("penyakit dalam", "Sp.PD"),
             ("obstetri", "Sp.OG"), ("anestesi", "Sp.An"), ("jantung", "Sp.JP"), ("orthopaedi", "Sp.OT"),
             ("telinga", "Sp.THT-KL"), ("radiologi", "Sp.Rad"), ("patologi klinik", "Sp.PK"), ("paru", "Sp.P"),
             ("kedokteran fisik", "Sp.KFR"), ("urologi", "Sp.U"), ("kedokteran jiwa", "Sp.KJ"), ("kulit", "Sp.DVE"),
             ("kedokteran nuklir", "Sp.KN"), ("gizi klinik", "Sp.GK"), ("mata", "Sp.M"), ("saraf", "Sp.N"),
             ("anak", "Sp.A"), ("bedah", "Sp.B")]
# Subspecialist labels recorded without a group: keyword in the label -> parent
SUB_TYPE = [("bedah jantung", "Sp.BTKV"), ("bedah toraks", "Sp.BTKV"), ("feto maternal", "Sp.OG"),
            ("onkologi ginekologi", "Sp.OG"), ("obstetri", "Sp.OG"), ("uroginekologi", "Sp.OG"),
            ("fertilitas", "Sp.OG"), ("patologi anatomi", "Sp.PA"), ("patologi", "Sp.PA"), ("nuklir", "Sp.KN"),
            ("bakteriologi", "Sp.MK"), ("mikologi", "Sp.MK"), ("virologi", "Sp.MK"), ("forensik", "Sp.F"),
            ("bedah vaskular", "Sp.B"), ("nefrologi", "Sp.PD"), ("endokrin", "Sp.PD"), ("neurobehaviour", "Sp.N"),
            ("neuro", "Sp.N")]


def is_doctor_specialist(group, typ):
    t, g = typ.lower(), group.lower()
    if "gigi" in t or "gigi" in g:
        return False  # dental specialists are outside the scoring rules
    return "spesialis" in t or "subspesialis" in g or "spesialis" in g


def normalize(group, typ):
    """Return (code or None, is_subspecialist)."""
    t, g = typ.lower().strip(), group.lower().strip()
    sub = "subspesialis" in g or "subspesialis" in t or "sub spesialis" in t
    if not sub:
        m = re.search(r"\(([^)]+)\)\s*$", typ)
        if m:
            abbr = m.group(1).strip()
            code = ABBR.get(abbr.lower())
            if code:
                return code, False
            for c in NAMES:
                if c.lower() == abbr.lower():
                    return c, False
        for key, code in PLAIN:
            if key in t:
                return code, False
        return None, False
    if "kualifikasi tambahan" in g and "lainnya" not in g:
        for key, code in SUB_GROUP:
            if key in g:
                return code, True
    for key, code in SUB_GROUP[:3] + [("urologi", "Sp.U"), ("bedah plastik", "Sp.BP"), ("kedokteran nuklir", "Sp.KN"), ("gizi klinik", "Sp.GK")]:
        if g.startswith("subspesialis " + key):
            return code, True
    m = re.match(r"dokter (gigi )?spesialis (.+?) subspesialis", t)
    if m:
        code, _ = normalize("", "Dokter Spesialis " + m.group(2))
        if code:
            return code, True
    for key, code in SUB_TYPE:
        if key in t:
            return code, True
    return None, True
