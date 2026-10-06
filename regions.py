"""Normalize province and kab/kota names so SIRS, Dukcapil and KMK spellings line up."""
import re

PROVINCE_ALIASES = {"diyogyakarta": "yogyakarta", "daerahkhususjakarta": "jakarta", "kepbangkabelitung": "kepulauanbangkabelitung", "dkijakarta": "jakarta"}
KAB_ALIASES = {"tobasamosir": "toba", "mahakamhulu": "mahakamulu", "kepsiautagulandangbiaro": "kepulauansiautagulandangbiaro",
               "malukutenggarabarat": "kepulauantanimbar", "pangkajenedankepulauan": "pangkajenekepulauan"}


def province_key(name):
    s = re.sub(r"[^a-z]", "", (name or "").lower().replace("daerah istimewa", "di").replace("d.i.", "di"))
    s = s.replace("provinsi", "")
    return PROVINCE_ALIASES.get(s, s)


def kab_key(name):
    """'Kota X' -> 'k:x', 'Kab. X' / 'X' -> 'x'. Parenthetical new names win over old ones."""
    s = (name or "").lower().strip()
    paren = re.search(r"\(([^)]+)\)", s)
    if paren:
        s = re.sub(r"\([^)]*\)", "", s).strip()
        alt = paren.group(1)
        if "kep." in alt or "kepulauan" in alt or len(alt) > 4:
            s = alt
    s = s.replace("kabupaten", "").replace("kab.", "").replace("kep.", "kepulauan ").strip()
    city = bool(re.match(r"^kota\b", s))
    s = re.sub(r"^kota\s*", "", s)
    s = re.sub(r"[^a-z]", "", s)
    s = KAB_ALIASES.get(s, s)
    return ("k:" if city else "") + s


def kab_match(key, keys):
    """Find key in keys, tolerating a missing 'Kota' prefix on either side when unambiguous."""
    if key in keys:
        return key
    bare = key[2:] if key.startswith("k:") else key
    options = [k for k in keys if (k[2:] if k.startswith("k:") else k) == bare]
    return options[0] if len(options) == 1 else None
