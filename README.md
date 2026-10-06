# Loker Dokter: specialist demand dashboard

A map and analysis tool that estimates which Indonesian hospitals need which specialist doctors, and explains why.
Every hospital gets a **need score from 0 to 100 for each specialty. Higher means the hospital needs that doctor more.**

- **Hosted read-only copy:** https://icalitulaci.github.io/lokerdokter/
- **Scoring rules:** [`specialist-demand-dashboard-prompt.md`](specialist-demand-dashboard-prompt.md), also explained in the app under "How the score works".

> **Estimates, not facts.** All data is self-reported by hospitals and doctors in government systems and has not been checked on the ground.
> About 1 in 5 "missing doctor" flags at public hospitals is contradicted by a second Kemenkes source, and private hospitals can't be cross-checked.
> See "How accurate is this data?" in the app before acting on a single hospital's numbers.

## Run it on your PC

Needs Python 3.10+ (no extra packages) and an internet connection for map tiles.

```
python app.py             # opens http://127.0.0.1:8765
python app.py --rebuild   # recompute scores after updating the data
```

Running locally also lets you save KMK match reviews and spot-check results. The hosted copy is read-only.

## Data sources

| File | Source | Refresh with |
|---|---|---|
| `data/hospitals_sirs.json` | SIRS / RS Online, Kemenkes: hospitals, beds, location, staff per specialty | `python sirs_scrape.py` |
| `data/dreams_rsud.csv` | Kemenkes DREAMS: 7 basic specialists at public hospitals, split ASN / BLUD / contract | `python scripts/fetch_dreams_rsud.py` |
| `data/population_kabkota.csv` | Dukcapil (Kemendagri) population per kab/kota | `python scripts/fetch_population.py` |
| `data/kmk1277_kjsu_kia.csv` | KMK HK.01.07/MENKES/1277/2024 network hospitals and target tiers | `scripts/extract_kmk1277.py` (from the PDF) |
| `data/spot_check.csv` | Manual spot check of high-need flags | `python scripts/spot_check_sample.py`, then fill in via the app |

After refreshing any of these, run `python app.py --rebuild`.

## Code

- `scoring.py`: the need score (pure functions). Tests: `python -m unittest tests.test_scoring`
- `specialties.py`, `regions.py`: map SIRS labels and place names to shared codes
- `kmk_match.py`, `dreams_match.py`: match KMK and DREAMS hospitals to SIRS
- `build_dashboard.py`: computes everything into `dashboard/data.json`
- `app.py`: local server; `dashboard/`: the web app (also what GitHub Pages serves)

Earlier exploration outputs (`peta_rs_jawa.*`, `build_map.py`, `java_*`, `specialist_supply_demand_dreams.json`) are kept for reference but are superseded by the dashboard.
