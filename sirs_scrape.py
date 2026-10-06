"""Download hospital locations and staff counts for every Indonesian hospital from SIRS Kemenkes.

Source: https://sirs.kemkes.go.id/fo/ (public "RS Online" pages)
  - rekap_rs_all            -> national hospital list (code, name, owner, class, type)
  - list_prop_noncovid      -> hospital coordinates
  - profile_rs/<code>       -> beds, services and staff (SDM) per hospital

Output: data/hospitals_sirs.json (one record per hospital, all staff types kept as reported).
Pass --java to limit the download to the six Java provinces.
Raw profile pages are cached in the system temp folder so re-runs only fetch what is missing;
pass --refresh to download everything again.
"""
import concurrent.futures as cf
import json
import os
import re
import sys
import tempfile
import time
import urllib.request

BASE = "https://sirs.kemkes.go.id/fo"
JAVA = {"DKI Jakarta", "Jawa Barat", "Jawa Tengah", "Yogyakarta", "Jawa Timur", "Banten"}
HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(tempfile.gettempdir(), "sirs_profiles")
OUT = os.path.join(HERE, "data", "hospitals_sirs.json")


def fetch(url, tries=3):
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            return urllib.request.urlopen(req, timeout=90).read()
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(3)


def cells(tr):
    return [re.sub(r"\s+", " ", re.sub(r"<[^>]+>", "", c)).strip()
            for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, flags=re.S)]


def parse_profile(html):
    html = re.sub(r"<(script|style).*?</\1>", "", html, flags=re.S)
    beds, services, staff = {}, [], {}
    for table in re.findall(r"<table.*?</table>", html, flags=re.S):
        rows = [r for r in (cells(tr) for tr in re.findall(r"<tr.*?</tr>", table, flags=re.S)) if r]
        if not rows:
            continue
        width = len(rows[0])
        # Tables are told apart by column count: beds (no, class, count),
        # services (no, name), staff (no, group, type, count).
        if width == 3:
            for r in rows:
                if r[2].isdigit():
                    beds[r[1]] = int(r[2])
        elif width == 2:
            services += [r[1] for r in rows]
        elif width == 4:
            for r in rows:
                if r[3].isdigit():
                    key = (r[1], r[2])
                    staff[key] = staff.get(key, 0) + int(r[3])
    return {
        "beds": beds,
        "beds_total": sum(beds.values()),
        "services": services,
        "staff": [{"group": g, "type": t, "count": n} for (g, t), n in staff.items()],
    }


def main():
    refresh = "--refresh" in sys.argv
    os.makedirs(CACHE, exist_ok=True)

    java_only = "--java" in sys.argv
    hospitals = [h for h in json.loads(fetch(f"{BASE}/home/rekap_rs_all"))["data"] if not java_only or h["nama_prop"] in JAVA]
    coords_raw = json.loads(fetch(f"{BASE}/home/list_prop_noncovid?id=0"))["rs"]
    coords_raw = coords_raw if isinstance(coords_raw, list) else list(coords_raw.values())
    coords = {}
    for c in coords_raw:
        k = c.get("koordinat")
        if isinstance(k, list) and len(k) >= 2:
            coords[str(c["kode"])] = (float(k[0]), float(k[1]))

    def get_profile(h):
        path = os.path.join(CACHE, f"{h['kode']}.html")
        if refresh or not os.path.exists(path) or os.path.getsize(path) < 20000:
            open(path, "wb").write(fetch(f"{BASE}/home/profile_rs/{h['kode']}"))
            time.sleep(0.3)  # stay gentle with a public government server
        return parse_profile(open(path, encoding="utf8", errors="ignore").read())

    with cf.ThreadPoolExecutor(6) as pool:
        profiles = list(pool.map(get_profile, hospitals))

    out = []
    for h, p in zip(hospitals, profiles):
        lat, lng = coords.get(h["kode"], (None, None))
        out.append({
            "kode": h["kode"], "nama": h["nama"].strip(), "provinsi": h["nama_prop"], "kab_kota": h["kab"],
            "alamat": h["alamat"].strip(), "telepon": h["TELEPON"], "pemilik": h["pemilik"].strip(),
            "kelas": h["kelas"], "jenis": h["jenis"], "lat": lat, "lng": lng,
            "profile_url": f"{BASE}/home/profile_rs/{h['kode']}", **p,
        })
    meta = {"source": BASE, "downloaded": time.strftime("%Y-%m-%d"), "count": len(out)}
    json.dump({"meta": meta, "hospitals": out}, open(OUT, "w", encoding="utf8"), ensure_ascii=False)
    print(f"{len(out)} hospitals, {sum(1 for h in out if h['lat'] is not None)} with coordinates -> {OUT}")


if __name__ == "__main__":
    main()
