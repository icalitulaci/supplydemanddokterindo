"""Extract KMK HK.01.07/MENKES/1277/2024 Lampiran B (KJSU-KIA network hospitals + target strata) to CSV."""
import sys, re, csv, pymupdf

SERVICES = ["kanker", "jantung", "stroke", "uronefrologi", "kia"]
TIERS = {"Madya", "Utama", "Paripurna", "Dasar"}

def words(page):
    """Words from horizontal body-text spans only (drops the 48pt rotated watermark)."""
    out = []
    for b in page.get_text("rawdict")["blocks"]:
        for l in b.get("lines", []):
            if abs(l["dir"][1]) > 0.01:
                continue
            for s in l["spans"]:
                if s["size"] > 20:
                    continue
                bold = "Bold" in s["font"]
                cur = []
                for ch in s["chars"] + [{"c": " ", "bbox": (0, 0, 0, 0)}]:
                    if ch["c"].isspace():
                        if cur:
                            x0 = min(c["bbox"][0] for c in cur); x1 = max(c["bbox"][2] for c in cur)
                            y0 = min(c["bbox"][1] for c in cur); y1 = max(c["bbox"][3] for c in cur)
                            out.append(dict(t="".join(c["c"] for c in cur), x0=x0, x1=x1, y0=y0, y1=y1, yc=(y0+y1)/2, xc=(x0+x1)/2, bold=bold))
                            cur = []
                    else:
                        cur.append(ch)
    return out

def main(pdf, out_csv):
    doc = pymupdf.open(pdf)
    rows, province, cols = [], None, None
    cur = None
    for pno in range(6, doc.page_count):
        ws = words(doc[pno])
        if any(w["t"].startswith("Strata") for w in ws) or any(w["t"] == "STRATIFIKASI" for w in ws):
            break
        hdr = {w["t"]: w for w in ws if w["bold"] and w["t"] in ("Kab/Kota", "Kanker", "Jantung", "Stroke", "Uronefrologi", "KIA")}
        if len(hdr) == 6:
            centers = [hdr[k]["xc"] for k in ("Kanker", "Jantung", "Stroke", "Uronefrologi", "KIA")]
            cols = dict(kab_left=hdr["Kab/Kota"]["x0"] - 15, kanker_left=hdr["Kanker"]["x0"] - 25, centers=centers,
                        hdr_bottom=hdr["Kanker"]["y1"])
        if cols is None:
            continue
        body = [w for w in ws if w["y0"] > cols["hdr_bottom"] and w["t"] != "jdih.kemkes.go.id" and not re.fullmatch(r"-\s*\d+\s*-|-|\d+", w["t"]) or (w["y0"] > cols["hdr_bottom"] and re.fullmatch(r"\d+\.", w["t"]))]
        body = [w for w in body if "jdih" not in w["t"]]
        body.sort(key=lambda w: (round(w["yc"]), w["x0"]))
        for w in body:
            if w["bold"]:
                # province heading like "A. Provinsi Aceh"
                if w["t"] == "Provinsi":
                    province = []
                if province is not None and isinstance(province, list):
                    if w["t"] != "Provinsi":
                        province.append(w["t"])
                continue
            if isinstance(province, list):
                province = " ".join(province)
            if w["xc"] < cols["kab_left"]:
                # numbering is normally its own token ("10."), but sometimes glued to the name ("10.Rumah")
                m = re.fullmatch(r"(\d+)\.(.*)", w["t"])
                if m and w["x0"] < cols["kab_left"] - 150:
                    cur = dict(provinsi=province, no=int(m.group(1)), nama=[m.group(2)] if m.group(2) else [], kabkota=[], **{s: "" for s in SERVICES}, page=pno + 1)
                    rows.append(cur)
                elif cur is not None:
                    cur["nama"].append(w["t"])
            elif w["xc"] < cols["kanker_left"]:
                if cur is not None:
                    cur["kabkota"].append(w["t"])
            elif cur is not None and w["t"] in TIERS:
                i = min(range(5), key=lambda k: abs(cols["centers"][k] - w["xc"]))
                svc = SERVICES[i]
                if cur[svc]:
                    print(f"WARN dup tier p{pno+1} #{cur['no']} {svc}: {cur[svc]} / {w['t']}", file=sys.stderr)
                cur[svc] = w["t"]
    if isinstance(province, list):
        province = " ".join(province)
    with open(out_csv, "w", newline="", encoding="utf-8") as f:
        wr = csv.writer(f)
        wr.writerow(["provinsi", "no", "nama_rs", "kab_kota"] + SERVICES + ["halaman_pdf"])
        for r in rows:
            wr.writerow([r["provinsi"], r["no"], " ".join(r["nama"]), " ".join(r["kabkota"])] + [r[s] for s in SERVICES] + [r["page"]])
    print(len(rows), "rows", file=sys.stderr)

if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
