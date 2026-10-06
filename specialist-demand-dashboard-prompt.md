# Build a specialist demand dashboard for Indonesian hospitals

## Your task

Build a dashboard that tells a doctor-recruitment team **which specialists each Indonesian hospital is likely to need**, and **why**.

For every pair of (hospital, specialty), compute a demand score from 0 to 100, a label (High / Moderate / Low), and a plain-language list of reasons. The dashboard must show the reasons, not just the number. Users have to be able to check every score themselves.

Follow the scoring rules in this document exactly. Do not invent extra signals, regulations, or targets. If an input you need is missing, show that in the UI ("data not available") and do not guess.

---

## Inputs

### 1. Hospital dataset (provided by the user)
This covers every hospital in Indonesia, sourced from SIRS / RS Online, Kemenkes. Before writing code, inspect the file and map its columns to these fields. Ask the user if a field can't be found.

| Field | Needed for | Notes |
|---|---|---|
| `hospital_id` | everything | unique key |
| `hospital_name` | display, KMK matching | |
| `province`, `kab_kota` | pillar D, KMK matching | |
| `hospital_type` | pillars A, C | general (RS umum) vs specialty (RS khusus), plus the specialty kind for RS khusus (e.g. RSIA, RS jiwa) |
| `beds` | pillar C | total bed count |
| `ownership` | filter only | government / private / TNI-Polri / BUMN |
| `operational_since` | new-hospital boost | optional |
| specialist counts | everything | one count per specialty. If the data separates full-time and part-time, keep both |

### 2. `data/kmk1277_kjsu_kia.csv` (provided with this prompt)
This was extracted from **KMK HK.01.07/MENKES/1277/2024** (Rumah Sakit Jejaring Pengampuan Pelayanan KJSU-KIA, signed 24 July 2024). It lists **578 hospitals in 38 provinces** and each hospital's **target capability tier** for five priority services.

Columns: `provinsi, no, nama_rs, kab_kota, kanker, jantung, stroke, uronefrologi, kia, halaman_pdf`
- Tier values: `Madya` < `Utama` < `Paripurna`. An empty cell means the hospital has no target for that service. This is real data, not a parsing gap: some cities split services between two hospitals, and specialty hospitals only carry their own service.
- `halaman_pdf` is the page in the source PDF, so a user can check any row.
- **Every hospital in this list is government-owned**: about 28 Kemenkes hospitals (RSUP and national centers) and about 550 regional-government hospitals (RSUD, plus Pemda-run RSU and RS Pratama). It has no private, TNI/Polri or BUMN hospitals. The decree selects about one target hospital per kab/kota and one Utama/Paripurna hospital per province. So when matching, only search government hospitals in the dataset. Private hospitals never get pillar B; this is expected, not a matching failure.

### 3. Population per kab/kota (BPS)
Use the latest BPS population figures per kab/kota. If they aren't provided, ask for them. Pillar D can't be computed without population, so show it as unavailable rather than skipping it silently.

### 4. Optional: official vacancies
These are open SSCASN (CASN/PPPK) slots or PGDS placements per hospital and specialty. If present, they trigger an override (see below). If absent, hide that feature.

---

## Background: what the regulations actually say

Show this in an "About this score" panel. The dashboard must **never claim that regulation requires a specific number of specialists**, because none does:

- **Permenkes 3/2020:** hospital classes A/B/C/D depend only on bed count (A ≥250, B ≥200, C ≥100, D ≥50). In its appendix, every specialist is marked "+/-" (optional) for every class. Staffing follows the hospital's own workload analysis (Pasal 11(6)). Pasal 8(4) defines the 4 basic specialist services: internal medicine, pediatrics, surgery, and obstetrics-gynecology.
- **PP 28/2024 Pasal 820–821:** hospitals are classified by service capability. Every hospital must provide **at least** these services: medical, intensive care, surgery, nursing/midwifery, pharmacy, laboratory, radiology, blood, nutrition, mortuary, central sterilization, and facility maintenance. It names services, **not** specialists.
- **KMK 1277/2024:** assigns network hospitals a target tier per service and defines each tier by the services it must provide. It also does not name specialists.

So the mapping from services to specialists below is **this tool's own inference**. Label it that way in the UI, e.g. "Inferred: surgery and intensive care require Sp.An".

---

## Specialty codes

Normalize the dataset's specialty names to these codes. Subspecialties (e.g. Sp.PD-KHOM, Sp.A(K) neonatology) count toward their **parent** code. Only use them on their own if the dataset records them separately.

`Sp.PD` internal medicine · `Sp.A` pediatrics · `Sp.OG` obstetrics-gynecology · `Sp.B` general surgery · `Sp.An` anesthesiology · `Sp.Rad` radiology · `Sp.PK` clinical pathology · `Sp.PA` anatomical pathology · `Sp.JP` cardiology · `Sp.BTKV` thoracic-cardiovascular surgery · `Sp.N` neurology · `Sp.BS` neurosurgery · `Sp.KFR` physical medicine and rehabilitation · `Sp.U` urology · `Sp.Onk.Rad` radiation oncology · `Sp.KN` nuclear medicine · `Sp.BA` pediatric surgery · `Sp.M` ophthalmology · `Sp.THT-KL` ENT. Keep any other specialties in the data. They can still score through pillars C and D.

Specialist count `n`: full-time = 1, part-time/visiting = 0.5 (if the data distinguishes them). Otherwise use the raw count.

---

## The score

The score is computed per (hospital `h`, specialty `s`). There are four pillars, and their maximums add up to 100.

### Pillar A: mandatory services (max 35), RS umum only

Floor set, inferred from the PP 28/2024 Pasal 821 services and the Permenkes 3/2020 Pasal 8(4) basic specialties:

| Specialty | Why |
|---|---|
| Sp.An | intensive care and surgery (PP 28 Ps. 821 b, c) |
| Sp.B | surgery (Ps. 821 c), and a basic specialty |
| Sp.PK | laboratory (Ps. 821 f) |
| Sp.Rad | radiology (Ps. 821 g) |
| Sp.PD, Sp.A, Sp.OG | basic specialties (Permenkes 3/2020 Ps. 8(4)) |

- `n = 0` → **35**. Reason: "No {s}; needed for {service} (PP 28/2024 Ps. 821)"
- `0 < n ≤ 1` → **12**. Reason: "Only 1 {s}; one specialist can't cover 24/7 call alone"
- otherwise → 0
- RS khusus → A = 0 always

### Pillar B: KJSU-KIA target tier (max 30)

Only applies to hospitals matched to a row in the KMK CSV. For each service where the hospital has a tier, the **required set is cumulative** (Utama includes Madya; Paripurna includes Utama):

| Service | Madya | Utama adds | Paripurna adds |
|---|---|---|---|
| Kanker (cancer) | Sp.B, Sp.PD, Sp.PA, Sp.PK, Sp.Rad | **either** Sp.Onk.Rad **or** Sp.KN | **both** Sp.Onk.Rad and Sp.KN |
| Jantung (heart) | Sp.JP | Sp.BTKV, Sp.An | Sp.A (pediatric cardiology) |
| Stroke | Sp.N, Sp.Rad | Sp.BS | Sp.KFR |
| Uronefrologi (uronephrology) | Sp.PD, Sp.U | Sp.A (pediatric nephrology), Sp.PA | none |
| KIA (maternal and child health) | Sp.OG, Sp.A, Sp.An, Sp.BA | Sp.M, Sp.THT-KL | Sp.BTKV (pediatric heart surgery) |

Where these come from, i.e. the services the KMK lists for each tier:
- **Cancer:** Madya = basic tumor surgery, systemic therapy, pathology, radiology. Utama = adds radiotherapy and/or nuclear medicine.
- **Heart:** Madya = non-invasive care and adult cath lab. Utama = adds adult cardiac surgery. Paripurna = adds pediatric cath and pediatric cardiac surgery.
- **Stroke:** Madya = thrombolysis and non-surgical vascular intervention. Utama = adds surgical vascular intervention. Paripurna = adds rehabilitation.
- **Uronephrology:** Madya = hemodialysis/CAPD and urinary stone surgery. Utama = adds pediatric dialysis, CAKUT surgery, kidney biopsy.
- **KIA:** Madya = PONEK spesialistik and simple pediatric surgery. Utama = adds PONEK subspesialistik and eye/ENT screening. Paripurna = adds pediatric cardiac surgery.

Rules:
- If `s` is in any required set for `h`, take the **highest-scoring** service. Don't add services together.
- `n = 0` → **30**. Reason: "KMK 1277/2024 targets {service} {tier}; no {s}"
- `0 < n ≤ 1` and the tier is Utama or Paripurna → **10**
- "Either" group: if both are 0, give both specialties 30. If either one is present, the group is satisfied and both score 0.

### Pillar C: peer gap (max 15)

- Peer group = same `hospital_type` (and the same specialty kind for RS khusus) **and** the same bed band. Bed bands: `<50`, `50–99`, `100–199`, `200–249`, `250–499`, `≥500` (the lower edges match the Permenkes class thresholds).
- If the peer group has fewer than 10 hospitals, merge it with the nearest band until it has 10 or more.
- `m` = median of `n` for specialty `s` across the peer group (counting zeros).
- `C = 15 × min((m − n) / m, 1)` if `m > n`, otherwise 0. If `m = 0`, C = 0.
- Reason: "Hospitals like this one (type, {band} beds) usually have {m}; this one has {n}"

### Pillar D: regional scarcity (max 20)

- `density(kab, s)` = sum of `n` across all hospitals in the kab/kota ÷ population × 100,000
- `M` = national median of `density(·, s)` across all kab/kota (counting zeros)
- **Relevance gate:** apply D **only if** `s` is relevant to `h`, meaning `s` is in h's pillar A floor set, **or** in h's pillar B required set, **or** the peer median `m ≥ 1`. Otherwise D = 0. Without this gate, a 30-bed hospital would show demand for a cardiac surgeon just because its region has none.
- Total kab/kota count of `s` = 0 → **20**. Reason: "No {s} anywhere in {kab_kota}"
- `density < 0.5 × M` → **12**
- `density < M` → **6**
- otherwise 0

### Boost and overrides

- **New hospital:** if `operational_since` is within the last 24 months, add **+10** for relevant specialties (same gate as D). Cap the total at 100.
- **Total** = min(A + B + C + D + boost, 100).
- **Label:** ≥ 60 **High**, 30–59 **Moderate**, < 30 **Low**.
- **Hard-gap override:** if `n = 0` **and** (A > 0 **or** B > 0), the label is at least **High**, whatever the total.
- **Vacancy override:** an open SSCASN/PPPK or PGDS slot for (h, s) → **High**. Reason: "Official vacancy open: {source}"

---

## Matching KMK hospitals to the hospital dataset

KMK names are long official names (e.g. "Rumah Sakit Umum Daerah Dr. Zainoel Abidin"), and they won't match the dataset exactly.

1. Normalize both sides: lowercase; expand or strip `RSUD`, `RSUP`, `RSU`, `RS`, "Rumah Sakit Umum Daerah/Pusat", `Dr.`/`dr.`; remove punctuation; normalize `Kota X`/`Kab. X`.
2. Only compare candidates **within the same kab/kota** (normalize "Kota" prefixes and old names, e.g. "Maluku Tenggara Barat (Kep. Tanimbar)").
3. Use fuzzy token similarity. Auto-accept above a high threshold. Send everything else to a **review queue screen** where the user confirms or picks a match. Save the confirmed matches.
4. Show match coverage, e.g. "571 / 578 KMK hospitals matched". An unmatched KMK hospital means pillar B is missing for that hospital, so flag it.

---

## Dashboard screens

1. **Overview:** counts of High/Moderate/Low gaps. Top specialties by number of High hospitals. Map or province table of hard gaps. Filters: province, kab/kota, ownership, hospital type, bed band, specialty, label.
2. **Specialty view:** pick a specialty and see a ranked list of hospitals that need it, with score, label and the main reason. This is the screen recruiters will use most, so make it fast and exportable to CSV.
3. **Hospital view:** a hospital's profile (type, beds, KMK tiers) and a table of every specialty with count, peer median, A/B/C/D breakdown, total, label and reasons.
4. **Region view:** kab/kota density per specialty against the national median, with "nobody here" cells highlighted.
5. **Data quality:** KMK match coverage and review queue, hospitals missing beds/type/population, specialty names that couldn't be normalized.
6. **About this score:** the background section and rules above, written for non-technical users, including the caveats.

UI rules: sentence-case labels (no ALL CAPS). Every score shows its pillar breakdown on hover or expand. Every KMK-based reason links to its `halaman_pdf` page. Ask the user which UI language they want (Bahasa Indonesia or English) before building.

---

## Test cases (your implementation must reproduce these)

Assume the population and density data make the D rule stated in each case apply.

| # | Setup | Expected |
|---|---|---|
| 1 | RS umum, 120 beds, not in KMK. Sp.An n=0, peer median 2. No Sp.An in the kab/kota | A 35 + B 0 + C 15 + D 20 = **70, High** |
| 2 | RS umum in KMK, jantung Madya. Sp.JP n=0, peer median 1. Kab density < 0.5×M | A 0 + B 30 + C 15 + D 12 = **57**, label **High** (hard-gap override) |
| 3 | RS umum, 80 beds, not in KMK. Sp.PD n=1, peer median 2. Kab density ≥ M | A 12 + C 7.5 = **19.5, Low** |
| 4 | RS umum, 300 beds, not in KMK. Sp.BTKV n=0, peer median 0. None in the kab/kota | not in floor, no KMK, m=0 → gate fails → **0, Low** |
| 5 | KMK hospital, kanker Utama. Sp.Onk.Rad n=0, Sp.KN n=1 | "either" group satisfied → B = 0 for both |
| 6 | KMK hospital, stroke Paripurna. Sp.KFR n=0, peer median 1. Kab density ≥ M | B 30 + C 15 = **45**, label **High** (override) |
| 7 | RS khusus (RSIA), KMK kia Madya. Sp.BA n=0, peer median 0. None in kab/kota | A 0 (RS khusus) + B 30 + C 0 + D 20 (gate passes via B) = **50**, label **High** |

Write these as automated tests before building the UI.

---

## Known limitations (show in the About panel)

- The mapping from services to specialists is inferred; it is not regulation.
- SIRS counts may be out of date or may mix in part-time staff.
- The KMK covers 578 government network hospitals only. All other hospitals, including every private hospital, score on A, C and D, so their maximum is 70 before overrides. When comparing private and government hospitals, use the label and pillar breakdown, not the raw total.
- The weights (35/30/15/20) and thresholds are a first version. Tune them against hospitals the team knows well.

Sources: Permenkes 3/2020 (peraturan.bpk.go.id/Download/144763), PP 28/2024 (peraturan.bpk.go.id/Details/294077), KMK HK.01.07/MENKES/1277/2024 (jdih.kemkes.go.id).
