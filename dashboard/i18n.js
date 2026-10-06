"use strict";
// All on-screen text in English (en) and Bahasa Indonesia (id). Values are strings or functions taking arguments.
// Reason sentences come translated from data.json (reasons / reasons_id); hospital and place names are not translated.

const STRINGS = {
  en: {
    "html.lang": "en",
    brand: "Specialist demand",
    "nav.map": "Map", "nav.overview": "Overview", "nav.specialty": "By specialty", "nav.hospital": "Hospitals",
    "nav.region": "Regions", "nav.quality": "Data quality", "nav.about": "How the score works", "nav.settings": "Settings",
    meta: (dl, built, n) => `SIRS data ${dl}<br>Scores built ${built}<br>${n} hospitals`,
    loadFail: msg => `Could not load data.json (${msg}). Start the dashboard with "python app.py".`,
    clickSort: "Click to sort",

    "f.search": "Search", "f.searchPh": "Hospital or kab/kota", "f.prov": "Province", "f.provAll": "All provinces",
    "f.kab": "Kab/kota", "f.all": "All", "f.own": "Ownership", "f.type": "Hospital type", "f.kelas": "Class",
    "f.band": "Beds", "f.spec": "Specialty", "f.specAll": "Any specialty", "f.label": "Need level", "f.clear": "Clear filters",
    "ms.search": "Search…", "ms.clear": "Clear", "ms.nSel": n => `${n} selected`, "ms.none": "No matches",
    "own.Government": "Government", "own.Private": "Private", "own.TNI/Polri": "TNI/Polri", "own.BUMN": "BUMN",
    bands: ["Under 50", "50–99", "100–199", "200–249", "250–499", "500 or more"],
    "cls.notSet": "Not set", "cls.long": c => `Kelas ${c}`, "cls.longNotSet": "Class not set",
    need: ["Low need", "Moderate need", "High need"], levelShort: ["Low", "Moderate", "High"],

    parts: ["missing a basic doctor", "government plan needs it", "fewer than similar hospitals", "few in this area"],
    points: (parts, total) => `${parts} = ${total} of 100`, pointsNone: "0 of 100: no sign of need",
    pillarTitle: (total, pts) => `Need score ${total} of 100 (higher = needs this doctor more). ${pts}`,
    svc: { kanker: "Cancer", jantung: "Heart", stroke: "Stroke", uronefrologi: "Uronephrology", kia: "Maternal & child" },
    dreamsTip: (a, b, c) => `Kemenkes DREAMS: ${a} civil servant (ASN), ${b} hospital-employed (BLUD), ${c} contract.`,
    sirsNote: (main, sub) => sub ? `SIRS: ${main} specialists + ${sub} subspecialists` : `SIRS: ${main}`,
    differs: " (differs)", same: " (same)",
    inferred: "Note: the law names services, not doctors. Which doctor a service needs is this tool's own judgment.",
    readOnly: 'This is a read-only copy. To save, run <code>python app.py</code> on your PC.',
    readOnlyShort: "Read-only copy: run python app.py on your PC to save.",
    pageRef: p => `p. ${p}`, dataLimits: "Data limits",

    notice: share => `<b>Estimates, not facts.</b> Built from hospital-reported government data that nobody has checked on the ground.
      ${share}% of "missing doctor" flags at public hospitals are contradicted by a second Kemenkes source, and private hospitals can't be cross-checked at all.`,
    noticeHide: "Hide this notice",
    "legend.hide": "Hide legend", "legend.show": "Show legend",
    "legend.colorNeed": "Color by need", "legend.colorClass": "Color by class (A–D)",
    "legend.classTitle": "Color: hospital class (kelas)",
    "legend.needTitle": what => `Color: how badly the hospital needs ${what}`,
    "what.one": name => `a ${name.toLowerCase()} doctor`, "what.many": n => `any of the ${n} chosen specialties`,
    "what.any": "its most-needed specialist", "legend.lowOrNone": "Low or no need",
    "legend.letters": "Zoom in close to see the class letter (A, B, C, D, Dp = D Pratama) inside each pin.",
    "legend.shape": "Shape: who owns the hospital", "legend.size": "Size: number of beds",
    sizes: ["Under 100 beds", "100–249", "250–499", "500 or more"],
    "legend.approx": "Approximate location (kab/kota center)",
    "legend.shown": n => `${n} hospitals shown. Click one to see what it needs.`,
    layers: { osm: "Streets (OpenStreetMap)", light: "Light (CARTO)", dark: "Dark (CARTO)", sat: "Satellite (Esri)", topo: "Terrain (OpenTopoMap)",
      roads: "Roads overlay", places: "Place names overlay" },

    "drawer.noNeeds": "No high or moderate needs found for this hospital.",
    "drawer.has": (n, m) => `Has ${n} · similar hospitals have ${m}`,
    "drawer.dreams": (d, differs) => ` · Kemenkes DREAMS count: ${d}${differs ? " (differs from SIRS)" : ""}`,
    "kmk.noneGov": "Not in the KMK 1277/2024 network list (or not matched yet).",
    "kmk.nonePriv": "Not in KMK 1277/2024 (the decree only lists government hospitals).",
    "kmk.targets": t => `KMK 1277/2024 targets: ${t}`,
    "chip.beds": n => `${n} beds`, "chip.approx": "Approximate location",
    "drawer.explain": "Each specialty gets a need score from 0 to 100. Higher means this hospital needs that doctor more. 60 or more is high need.",
    "drawer.highs": (h, m) => `${h ? `${h} high-need specialt${h > 1 ? "ies" : "y"}` : "No high-need specialties"}${m ? `, ${m} moderate` : ""}`,
    "drawer.disclaimer": "These are estimates from hospital-reported government data, not checked on the ground. Confirm with the hospital before acting.",
    "drawer.full": "Full hospital view", "drawer.sirs": "SIRS profile", close: "Close",

    "ov.title": "Overview",
    "ov.lede": (n, spec) => `${n} hospitals in the current filters${spec}. One "need" below means one hospital needing one kind of specialist.`,
    "ov.specOne": name => `, looking at ${name} only`, "ov.specMany": n => `, looking at ${n} chosen specialties`, "ov.specAny": ", every specialty",
    "ov.high": "High needs", "ov.mod": "Moderate needs", "ov.hospHigh": "Hospitals with at least one high need",
    "ov.hard": "Missing a required doctor completely (has zero)",
    "ov.mostNeeded": "Which specialists are needed most (number of hospitals with high need)",
    "ov.barTitle": "Show the ranked list for this specialty", "ov.empty": "No high needs with the current filters.",
    "ov.byProv": "By province", "ov.thProv": "Province", "ov.thHosp": "Hospitals", "ov.thHospHigh": "Hospitals with a high need",
    "ov.thHigh": "High needs", "ov.thHard": "Missing completely",
    "ov.note": "Click a specialty to rank hospitals for it, or a province to filter to it.",

    "sp.title": "By specialty", "sp.pick": "Pick a specialty to rank hospitals by how much they need it. You can also pick several in the Specialty filter.",
    "sp.many": n => `${n} specialties`,
    "sp.lede": n => `${n} rows in the current filters, ranked from most to least in need. Need score runs 0–100: higher means the hospital needs this doctor more. Hover a score to see how it adds up.`,
    "sp.export": n => `Export ${n} rows to CSV`, more: n => `Show ${n} more`,
    "th.rank": "#", "th.hospital": "Hospital", "th.specialty": "Specialty", "th.kab": "Kab/kota", "th.own": "Ownership",
    "th.type": "Type", "th.class": "Class", "th.beds": "Beds", "th.has": "Has now", "th.kemenkes": "Kemenkes count",
    "th.kemenkesTitle": "Second count from Kemenkes DREAMS. Public hospitals and the 7 basic specialists only. Orange = differs from SIRS.",
    "th.similar": "Similar hospitals have", "th.score": "Need score", "th.need": "Need", "th.reason": "Main reason",

    "hm.title": "Hospitals",
    "hm.lede": "Which specialists each hospital needs. Each cell is how many of that doctor the hospital has; the color is how much it needs more. Hover a cell for the reason, click a row for the full breakdown. Uses the filters above.",
    "hm.note": "Click a header to sort; sorting a specialty column ranks hospitals by need score for it.",
    "hm.toggle": (all, n) => all ? "Show the 19 main specialties" : `Show all ${n} specialties`,
    "hm.count": n => `${n} hospitals`, "hm.highs": "High needs", "hm.highsTitle": "Number of specialties with high need",
    "hm.tip": (name, n, total, need, reason) => `${name}: has ${n}. Need score ${total} of 100 (${need.toLowerCase()}).${reason ? " " + reason : ""}`,

    "hd.back": "All hospitals", "hd.map": "Show on map",
    "hd.compare": (peers, type, band) => `Compared with ${peers} similar hospitals (${type}, ${band} beds).`,
    "hd.sub": list => `Counts include subspecialists: ${list}.`,
    "hd.thBasic": "Basic doctor<br>max 35", "hd.thBasicT": "Missing a basic doctor every general hospital should have",
    "hd.thPlan": "Gov. plan<br>max 30", "hd.thPlanT": "The government plan (KMK 1277/2024) for this hospital needs this doctor",
    "hd.thSimilar": "Vs similar<br>max 15", "hd.thSimilarT": "Has fewer than similar hospitals",
    "hd.thArea": "Area<br>max 20", "hd.thAreaT": "Few of these doctors in the kab/kota for its population",
    "hd.thScore": "Need score<br>0–100", "hd.thWhy": "Why",
    "hd.srcPriv": "Private hospital: these counts come from SIRS only and could not be cross-checked.",
    "hd.srcPub": 'Public hospital: orange "Kemenkes count" cells mean the two government sources disagree.',
    "hd.srcNone": "Not in Kemenkes DREAMS, so these counts could not be cross-checked.",
    "hd.selfReported": "Counts are self-reported and may be out of date.",
    "hd.scoreNote": "Need score = the four point columns added up. Higher means the hospital needs that doctor more. 60+ is high need, 30–59 moderate, under 30 low. If a hospital has zero of a doctor it is required to have, it is always high need.",

    "rg.legend": `<span class="lbl l2">None</span> no doctor of this kind in the kab/kota · <span class="lbl l1">Under half</span> less than half of a typical area · <span class="lbl l0">Below typical</span> fewer than a typical area · numbers are doctors per 100,000 people.`,
    "rg.oneTitle": name => `${name} by kab/kota`,
    "rg.oneLede": (n, m) => `Doctors per 100,000 people. A typical kab/kota (the middle one of all ${n}) has ${m}. Areas with the fewest come first.`,
    "rg.thKab": "Kab/kota", "rg.thProv": "Province", "rg.thPop": "Population", "rg.thHosp": "Hospitals", "rg.thDoctors": "Doctors",
    "rg.thPer": "Per 100k people", "rg.thVs": "Compared with typical",
    "rg.title": "Regions",
    "rg.lede": "Doctors per 100,000 people in each kab/kota. Red means none at all. By default it shows the 19 specialties the score looks at; pick one specialty to rank areas for it, or several to compare just those.",
    "rg.typical": "Typical kab/kota", "rg.cellTitle": n => `${n} specialists`,

    "q.title": "Data quality", "q.lede": "What the scores rest on, and what is missing. Fixing items here changes the scores.",
    "q.kmkMatched": "KMK hospitals matched to SIRS", "q.waiting": "Waiting for your review",
    "q.approx": "Hospitals placed at their kab/kota center", "q.noBeds": "Hospitals with no bed count",
    "q.reviewTitle": "KMK match review",
    "q.reviewLede": 'These KMK 1277/2024 hospitals could not be matched automatically. Until you confirm a match, they get no "government plan" points. Your choices are saved to data/kmk_matches_confirmed.csv.',
    "q.nothing": "Nothing to review.", "q.noMatchTitle": "Marked as not in SIRS",
    "q.similarity": p => `similarity ${p}%`, "q.other": "Another government hospital:", "q.otherPh": "Type to search this province",
    "q.notInSirs": "Not in SIRS (keep without government-plan points)", save: "Save",
    "q.pickFirst": "Pick a hospital from the suggestions first.", "q.saving": "Saving and recalculating scores…",
    "q.notSaved": msg => `Not saved: ${msg}. Is app.py still running?`,
    "sc.title": "Spot check: are the high-need flags real?",
    "sc.lede": n => `A fixed random sample of ${n} high-need flags (scripts/spot_check_sample.py). Call the hospital, or check its own doctor schedule, then record what you found. Results are saved to data/spot_check.csv.`,
    "sc.progress": (done, wrong, pct) => `So far ${done} confirmed: the flag was wrong in ${wrong} (${pct}%).`,
    "sc.none": "No flag has been confirmed either way yet.",
    verdicts: { "": "Not checked yet", flag_right: "Flag is right (doctor really missing)", flag_wrong: "Flag is wrong (doctor is there)",
      sirs_right: "SIRS is right", dreams_right: "DREAMS is right", inconclusive: "Couldn't confirm" },
    strata: { contradicted: "SIRS 0, DREAMS has some", both_zero: "Both sources 0", private: "Private (SIRS only)" },
    "sc.thGroup": "Group", "sc.thFound": "Found", "sc.thVerdict": "Verdict", "sc.thSource": "Source / note",
    "sc.found": "Doctors found", "sc.sourcePh": "Source link", "sc.notePh": "Note", "sc.checked": d => `Checked ${d}`,
    "sc.saving": "Saving…", "sc.notSaved": msg => `Not saved: ${msg}`, "sc.source": "source",
    "dr.title": "SIRS vs Kemenkes DREAMS",
    "dr.lede": 'DREAMS is a second Kemenkes source (from SISDMK, the national health worker register). It only covers public hospitals and the 7 basic specialists, but it splits each count into civil servant, hospital-employed and contract staff. Scores still use SIRS; the "Kemenkes count" column lets you check them.',
    "dr.matched": "DREAMS hospitals matched to SIRS", "dr.agree": "Hospital–specialty counts where both sources agree",
    "dr.falseZero": 'SIRS says zero, DREAMS says there is at least one (may be a false "missing" flag)', "dr.dreamsZero": "SIRS has some, DREAMS says zero",
    "dr.disagree": n => `Where the two sources disagree (${n})`, "dr.thDiff": "Difference",
    "dr.unmatched": n => `DREAMS hospitals not matched to SIRS (${n})`, "dr.thName": "DREAMS name", "dr.thClosest": "Closest SIRS hospitals",
    "dr.noneKab": "None in this kab/kota",
    "q.missingTitle": "Inputs that are not available",
    "q.missing": (pop, popNote) => [
      "Operating start date: SIRS doesn't publish it, so the new-hospital boost (+10) is not applied to any hospital.",
      "Official vacancies (SSCASN/PPPK, PGDS): no data loaded, so the vacancy override is off.",
      "Full-time vs part-time: SIRS gives one count per specialty, so raw counts are used. A doctor working at three hospitals is counted at each.",
      `Population: ${pop}. BPS blocks automated downloads; replace data/population_kabkota.csv with BPS figures to use them. ${popNote}`],
    "q.popMissing": list => `No population for: ${list}.`, "q.popOk": "Every kab/kota with a hospital has a population figure.",
    "q.unmappedTitle": n => `Specialty labels that could not be mapped (${n} doctors)`,
    "q.unmappedLede": 'These SIRS labels are ambiguous (for example "Subspesialis Kardiovaskular" can sit under internal medicine or cardiology), so they are left out of every count rather than guessed.',
    "q.thLabel": "SIRS label", "q.thDoctors": "Doctors",
    "q.noBedsTitle": "Hospitals with no bed count", "q.noBedsLede": "They are compared with the smallest hospitals (under 50 beds).", none: "None",

    "st.title": "Settings", "st.lede": "Saved in this browser only.",
    "st.theme": "Theme", "st.system": "Follow my computer", "st.light": "Light", "st.dark": "Dark",
    "st.lang": "Language", "st.en": "English", "st.id": "Bahasa Indonesia",
    "st.note": "Map colors, the legend and every page switch immediately.",
  },

  id: {
    "html.lang": "id",
    brand: "Kebutuhan dokter spesialis",
    "nav.map": "Peta", "nav.overview": "Ringkasan", "nav.specialty": "Per spesialis", "nav.hospital": "Rumah sakit",
    "nav.region": "Wilayah", "nav.quality": "Kualitas data", "nav.about": "Cara kerja skor", "nav.settings": "Pengaturan",
    meta: (dl, built, n) => `Data SIRS ${dl}<br>Skor dibuat ${built}<br>${n} rumah sakit`,
    loadFail: msg => `Gagal memuat data.json (${msg}). Jalankan dasbor dengan "python app.py".`,
    clickSort: "Klik untuk mengurutkan",

    "f.search": "Cari", "f.searchPh": "Rumah sakit atau kab/kota", "f.prov": "Provinsi", "f.provAll": "Semua provinsi",
    "f.kab": "Kab/kota", "f.all": "Semua", "f.own": "Kepemilikan", "f.type": "Jenis RS", "f.kelas": "Kelas",
    "f.band": "Tempat tidur", "f.spec": "Spesialis", "f.specAll": "Semua spesialis", "f.label": "Tingkat kebutuhan", "f.clear": "Hapus filter",
    "ms.search": "Cari…", "ms.clear": "Hapus", "ms.nSel": n => `${n} dipilih`, "ms.none": "Tidak ada yang cocok",
    "own.Government": "Pemerintah", "own.Private": "Swasta", "own.TNI/Polri": "TNI/Polri", "own.BUMN": "BUMN",
    bands: ["Di bawah 50", "50–99", "100–199", "200–249", "250–499", "500 atau lebih"],
    "cls.notSet": "Belum ditetapkan", "cls.long": c => `Kelas ${c}`, "cls.longNotSet": "Kelas belum ditetapkan",
    need: ["Kebutuhan rendah", "Kebutuhan sedang", "Kebutuhan tinggi"], levelShort: ["Rendah", "Sedang", "Tinggi"],

    parts: ["tidak ada dokter dasar", "dibutuhkan rencana pemerintah", "lebih sedikit dari RS serupa", "sedikit di wilayah ini"],
    points: (parts, total) => `${parts} = ${total} dari 100`, pointsNone: "0 dari 100: tidak ada tanda kebutuhan",
    pillarTitle: (total, pts) => `Skor kebutuhan ${total} dari 100 (makin tinggi = makin butuh dokter ini). ${pts}`,
    svc: { kanker: "Kanker", jantung: "Jantung", stroke: "Stroke", uronefrologi: "Uronefrologi", kia: "Ibu & anak" },
    dreamsTip: (a, b, c) => `Kemenkes DREAMS: ${a} ASN, ${b} pegawai BLUD, ${c} kontrak.`,
    sirsNote: (main, sub) => sub ? `SIRS: ${main} spesialis + ${sub} subspesialis` : `SIRS: ${main}`,
    differs: " (berbeda)", same: " (sama)",
    inferred: "Catatan: aturan hanya menyebut layanan, bukan dokter. Dokter mana yang dibutuhkan suatu layanan adalah penilaian alat ini.",
    readOnly: 'Ini salinan baca-saja. Untuk menyimpan, jalankan <code>python app.py</code> di PC Anda.',
    readOnlyShort: "Salinan baca-saja: jalankan python app.py di PC Anda untuk menyimpan.",
    pageRef: p => `hal. ${p}`, dataLimits: "Batasan data",

    notice: share => `<b>Perkiraan, bukan fakta.</b> Dibuat dari data pemerintah yang dilaporkan rumah sakit sendiri dan belum dicek di lapangan.
      ${share}% tanda "dokter tidak ada" di RS pemerintah dibantah oleh sumber Kemenkes kedua, dan RS swasta sama sekali tidak bisa dicek silang.`,
    noticeHide: "Sembunyikan pemberitahuan ini",
    "legend.hide": "Sembunyikan legenda", "legend.show": "Tampilkan legenda",
    "legend.colorNeed": "Warna menurut kebutuhan", "legend.colorClass": "Warna menurut kelas (A–D)",
    "legend.classTitle": "Warna: kelas rumah sakit",
    "legend.needTitle": what => `Warna: seberapa besar rumah sakit membutuhkan ${what}`,
    "what.one": name => `dokter ${name.toLowerCase()}`, "what.many": n => `salah satu dari ${n} spesialis yang dipilih`,
    "what.any": "spesialis yang paling dibutuhkan", "legend.lowOrNone": "Rendah atau tidak butuh",
    "legend.letters": "Perbesar peta untuk melihat huruf kelas (A, B, C, D, Dp = D Pratama) di dalam setiap titik.",
    "legend.shape": "Bentuk: pemilik rumah sakit", "legend.size": "Ukuran: jumlah tempat tidur",
    sizes: ["Di bawah 100 TT", "100–249", "250–499", "500 atau lebih"],
    "legend.approx": "Lokasi perkiraan (pusat kab/kota)",
    "legend.shown": n => `${n} rumah sakit ditampilkan. Klik salah satu untuk melihat kebutuhannya.`,
    layers: { osm: "Jalan (OpenStreetMap)", light: "Terang (CARTO)", dark: "Gelap (CARTO)", sat: "Satelit (Esri)", topo: "Topografi (OpenTopoMap)",
      roads: "Lapisan jalan", places: "Lapisan nama tempat" },

    "drawer.noNeeds": "Tidak ditemukan kebutuhan tinggi atau sedang untuk rumah sakit ini.",
    "drawer.has": (n, m) => `Punya ${n} · RS serupa punya ${m}`,
    "drawer.dreams": (d, differs) => ` · Hitungan Kemenkes DREAMS: ${d}${differs ? " (berbeda dari SIRS)" : ""}`,
    "kmk.noneGov": "Tidak ada di daftar jejaring KMK 1277/2024 (atau belum dicocokkan).",
    "kmk.nonePriv": "Tidak ada di KMK 1277/2024 (keputusan itu hanya mencantumkan RS pemerintah).",
    "kmk.targets": t => `Target KMK 1277/2024: ${t}`,
    "chip.beds": n => `${n} TT`, "chip.approx": "Lokasi perkiraan",
    "drawer.explain": "Setiap spesialis mendapat skor kebutuhan 0 sampai 100. Makin tinggi berarti rumah sakit ini makin butuh dokter itu. 60 ke atas berarti kebutuhan tinggi.",
    "drawer.highs": (h, m) => `${h ? `${h} spesialis dengan kebutuhan tinggi` : "Tidak ada spesialis dengan kebutuhan tinggi"}${m ? `, ${m} sedang` : ""}`,
    "drawer.disclaimer": "Ini perkiraan dari data pemerintah yang dilaporkan rumah sakit, belum dicek di lapangan. Konfirmasi ke rumah sakit sebelum bertindak.",
    "drawer.full": "Lihat detail rumah sakit", "drawer.sirs": "Profil SIRS", close: "Tutup",

    "ov.title": "Ringkasan",
    "ov.lede": (n, spec) => `${n} rumah sakit dalam filter saat ini${spec}. Satu "kebutuhan" di bawah berarti satu rumah sakit membutuhkan satu jenis spesialis.`,
    "ov.specOne": name => `, hanya ${name}`, "ov.specMany": n => `, untuk ${n} spesialis yang dipilih`, "ov.specAny": ", semua spesialis",
    "ov.high": "Kebutuhan tinggi", "ov.mod": "Kebutuhan sedang", "ov.hospHigh": "Rumah sakit dengan minimal satu kebutuhan tinggi",
    "ov.hard": "Sama sekali tidak punya dokter yang diwajibkan",
    "ov.mostNeeded": "Spesialis yang paling dibutuhkan (jumlah rumah sakit dengan kebutuhan tinggi)",
    "ov.barTitle": "Tampilkan peringkat untuk spesialis ini", "ov.empty": "Tidak ada kebutuhan tinggi dengan filter saat ini.",
    "ov.byProv": "Per provinsi", "ov.thProv": "Provinsi", "ov.thHosp": "Rumah sakit", "ov.thHospHigh": "RS dengan kebutuhan tinggi",
    "ov.thHigh": "Kebutuhan tinggi", "ov.thHard": "Tidak punya sama sekali",
    "ov.note": "Klik spesialis untuk melihat peringkat rumah sakit, atau klik provinsi untuk memfilter.",

    "sp.title": "Per spesialis", "sp.pick": "Pilih spesialis untuk mengurutkan rumah sakit menurut kebutuhannya. Anda juga bisa memilih beberapa di filter Spesialis.",
    "sp.many": n => `${n} spesialis`,
    "sp.lede": n => `${n} baris dalam filter saat ini, diurutkan dari yang paling butuh. Skor kebutuhan 0–100: makin tinggi berarti rumah sakit makin butuh dokter ini. Arahkan kursor ke skor untuk melihat rinciannya.`,
    "sp.export": n => `Ekspor ${n} baris ke CSV`, more: n => `Tampilkan ${n} lagi`,
    "th.rank": "#", "th.hospital": "Rumah sakit", "th.specialty": "Spesialis", "th.kab": "Kab/kota", "th.own": "Kepemilikan",
    "th.type": "Jenis", "th.class": "Kelas", "th.beds": "TT", "th.has": "Punya sekarang", "th.kemenkes": "Hitungan Kemenkes",
    "th.kemenkesTitle": "Hitungan kedua dari Kemenkes DREAMS. Hanya RS pemerintah dan 7 spesialis dasar. Oranye = berbeda dari SIRS.",
    "th.similar": "RS serupa punya", "th.score": "Skor kebutuhan", "th.need": "Kebutuhan", "th.reason": "Alasan utama",

    "hm.title": "Rumah sakit",
    "hm.lede": "Spesialis apa yang dibutuhkan setiap rumah sakit. Setiap sel adalah jumlah dokter itu di rumah sakit; warnanya menunjukkan seberapa besar kebutuhannya. Arahkan kursor ke sel untuk alasannya, klik baris untuk rincian lengkap. Mengikuti filter di atas.",
    "hm.note": "Klik judul kolom untuk mengurutkan; mengurutkan kolom spesialis berarti meranking rumah sakit menurut skor kebutuhannya.",
    "hm.toggle": (all, n) => all ? "Tampilkan 19 spesialis utama" : `Tampilkan semua ${n} spesialis`,
    "hm.count": n => `${n} rumah sakit`, "hm.highs": "Kebutuhan tinggi", "hm.highsTitle": "Jumlah spesialis dengan kebutuhan tinggi",
    "hm.tip": (name, n, total, need, reason) => `${name}: punya ${n}. Skor kebutuhan ${total} dari 100 (${need.toLowerCase()}).${reason ? " " + reason : ""}`,

    "hd.back": "Semua rumah sakit", "hd.map": "Lihat di peta",
    "hd.compare": (peers, type, band) => `Dibandingkan dengan ${peers} rumah sakit serupa (${type}, ${band} TT).`,
    "hd.sub": list => `Hitungan termasuk subspesialis: ${list}.`,
    "hd.thBasic": "Dokter dasar<br>maks 35", "hd.thBasicT": "Tidak punya dokter dasar yang seharusnya ada di setiap rumah sakit umum",
    "hd.thPlan": "Rencana pemerintah<br>maks 30", "hd.thPlanT": "Rencana pemerintah (KMK 1277/2024) untuk rumah sakit ini membutuhkan dokter ini",
    "hd.thSimilar": "Vs RS serupa<br>maks 15", "hd.thSimilarT": "Lebih sedikit dari rumah sakit serupa",
    "hd.thArea": "Wilayah<br>maks 20", "hd.thAreaT": "Dokter ini sedikit di kab/kota untuk jumlah penduduknya",
    "hd.thScore": "Skor kebutuhan<br>0–100", "hd.thWhy": "Alasan",
    "hd.srcPriv": "Rumah sakit swasta: hitungan ini hanya dari SIRS dan tidak bisa dicek silang.",
    "hd.srcPub": 'Rumah sakit pemerintah: sel "Hitungan Kemenkes" berwarna oranye berarti dua sumber pemerintah berbeda.',
    "hd.srcNone": "Tidak ada di Kemenkes DREAMS, jadi hitungan ini tidak bisa dicek silang.",
    "hd.selfReported": "Hitungan dilaporkan sendiri dan mungkin sudah usang.",
    "hd.scoreNote": "Skor kebutuhan = jumlah keempat kolom poin. Makin tinggi berarti rumah sakit makin butuh dokter itu. 60+ kebutuhan tinggi, 30–59 sedang, di bawah 30 rendah. Jika rumah sakit tidak punya sama sekali dokter yang diwajibkan, kebutuhannya selalu tinggi.",

    "rg.legend": `<span class="lbl l2">Tidak ada</span> tidak ada dokter jenis ini di kab/kota · <span class="lbl l1">Kurang dari separuh</span> kurang dari separuh daerah pada umumnya · <span class="lbl l0">Di bawah biasa</span> lebih sedikit dari daerah pada umumnya · angka adalah jumlah dokter per 100.000 penduduk.`,
    "rg.oneTitle": name => `${name} per kab/kota`,
    "rg.oneLede": (n, m) => `Dokter per 100.000 penduduk. Kab/kota pada umumnya (nilai tengah dari ${n}) punya ${m}. Daerah dengan jumlah paling sedikit ditampilkan lebih dulu.`,
    "rg.thKab": "Kab/kota", "rg.thProv": "Provinsi", "rg.thPop": "Penduduk", "rg.thHosp": "Rumah sakit", "rg.thDoctors": "Dokter",
    "rg.thPer": "Per 100rb penduduk", "rg.thVs": "Dibanding biasanya",
    "rg.title": "Wilayah",
    "rg.lede": "Dokter per 100.000 penduduk di setiap kab/kota. Merah berarti tidak ada sama sekali. Secara bawaan menampilkan 19 spesialis yang dinilai skor; pilih satu spesialis untuk meranking daerah, atau beberapa untuk membandingkan spesialis itu saja.",
    "rg.typical": "Kab/kota pada umumnya", "rg.cellTitle": n => `${n} spesialis`,

    "q.title": "Kualitas data", "q.lede": "Dasar perhitungan skor, dan apa yang belum tersedia. Memperbaiki item di sini akan mengubah skor.",
    "q.kmkMatched": "RS KMK yang cocok dengan SIRS", "q.waiting": "Menunggu tinjauan Anda",
    "q.approx": "RS yang ditempatkan di pusat kab/kota", "q.noBeds": "RS tanpa jumlah tempat tidur",
    "q.reviewTitle": "Tinjauan pencocokan KMK",
    "q.reviewLede": 'RS KMK 1277/2024 ini tidak bisa dicocokkan otomatis. Sampai Anda mengonfirmasi, RS ini tidak mendapat poin "rencana pemerintah". Pilihan Anda disimpan di data/kmk_matches_confirmed.csv.',
    "q.nothing": "Tidak ada yang perlu ditinjau.", "q.noMatchTitle": "Ditandai tidak ada di SIRS",
    "q.similarity": p => `kemiripan ${p}%`, "q.other": "RS pemerintah lain:", "q.otherPh": "Ketik untuk mencari di provinsi ini",
    "q.notInSirs": "Tidak ada di SIRS (tanpa poin rencana pemerintah)", save: "Simpan",
    "q.pickFirst": "Pilih rumah sakit dari saran terlebih dahulu.", "q.saving": "Menyimpan dan menghitung ulang skor…",
    "q.notSaved": msg => `Tidak tersimpan: ${msg}. Apakah app.py masih berjalan?`,
    "sc.title": "Cek sampel: apakah tanda kebutuhan tinggi itu benar?",
    "sc.lede": n => `Sampel acak tetap berisi ${n} tanda kebutuhan tinggi (scripts/spot_check_sample.py). Telepon rumah sakit, atau cek jadwal dokternya sendiri, lalu catat temuan Anda. Hasil disimpan di data/spot_check.csv.`,
    "sc.progress": (done, wrong, pct) => `Sejauh ini ${done} terkonfirmasi: tandanya salah pada ${wrong} (${pct}%).`,
    "sc.none": "Belum ada tanda yang terkonfirmasi.",
    verdicts: { "": "Belum dicek", flag_right: "Tanda benar (dokter memang tidak ada)", flag_wrong: "Tanda salah (dokternya ada)",
      sirs_right: "SIRS benar", dreams_right: "DREAMS benar", inconclusive: "Tidak bisa dikonfirmasi" },
    strata: { contradicted: "SIRS 0, DREAMS ada", both_zero: "Kedua sumber 0", private: "Swasta (hanya SIRS)" },
    "sc.thGroup": "Kelompok", "sc.thFound": "Ditemukan", "sc.thVerdict": "Kesimpulan", "sc.thSource": "Sumber / catatan",
    "sc.found": "Dokter yang ditemukan", "sc.sourcePh": "Tautan sumber", "sc.notePh": "Catatan", "sc.checked": d => `Dicek ${d}`,
    "sc.saving": "Menyimpan…", "sc.notSaved": msg => `Tidak tersimpan: ${msg}`, "sc.source": "sumber",
    "dr.title": "SIRS vs Kemenkes DREAMS",
    "dr.lede": 'DREAMS adalah sumber Kemenkes kedua (dari SISDMK, registri tenaga kesehatan nasional). Hanya mencakup RS pemerintah dan 7 spesialis dasar, tetapi membagi setiap hitungan menjadi ASN, pegawai BLUD, dan kontrak. Skor tetap memakai SIRS; kolom "Hitungan Kemenkes" untuk mengeceknya.',
    "dr.matched": "RS DREAMS yang cocok dengan SIRS", "dr.agree": "Hitungan RS–spesialis yang sama di kedua sumber",
    "dr.falseZero": 'SIRS bilang nol, DREAMS bilang ada minimal satu (mungkin tanda "tidak ada" yang salah)', "dr.dreamsZero": "SIRS ada, DREAMS bilang nol",
    "dr.disagree": n => `Di mana kedua sumber berbeda (${n})`, "dr.thDiff": "Selisih",
    "dr.unmatched": n => `RS DREAMS yang tidak cocok dengan SIRS (${n})`, "dr.thName": "Nama di DREAMS", "dr.thClosest": "RS SIRS terdekat",
    "dr.noneKab": "Tidak ada di kab/kota ini",
    "q.missingTitle": "Data yang belum tersedia",
    "q.missing": (pop, popNote) => [
      "Tanggal mulai beroperasi: SIRS tidak menerbitkannya, jadi tambahan poin rumah sakit baru (+10) tidak diterapkan.",
      "Lowongan resmi (SSCASN/PPPK, PGDS): belum ada data, jadi aturan lowongan tidak aktif.",
      "Penuh waktu vs paruh waktu: SIRS hanya memberi satu hitungan per spesialis, jadi hitungan mentah yang dipakai. Dokter yang bekerja di tiga RS dihitung di ketiganya.",
      `Penduduk: ${pop}. BPS memblokir unduhan otomatis; ganti data/population_kabkota.csv dengan angka BPS untuk memakainya. ${popNote}`],
    "q.popMissing": list => `Tidak ada data penduduk untuk: ${list}.`, "q.popOk": "Setiap kab/kota yang punya rumah sakit memiliki data penduduk.",
    "q.unmappedTitle": n => `Label spesialis yang tidak bisa dipetakan (${n} dokter)`,
    "q.unmappedLede": 'Label SIRS ini ambigu (misalnya "Subspesialis Kardiovaskular" bisa termasuk penyakit dalam atau jantung), jadi tidak dihitung daripada ditebak.',
    "q.thLabel": "Label SIRS", "q.thDoctors": "Dokter",
    "q.noBedsTitle": "Rumah sakit tanpa jumlah tempat tidur", "q.noBedsLede": "Dibandingkan dengan rumah sakit terkecil (di bawah 50 TT).", none: "Tidak ada",

    "st.title": "Pengaturan", "st.lede": "Hanya disimpan di browser ini.",
    "st.theme": "Tema", "st.system": "Ikuti komputer saya", "st.light": "Terang", "st.dark": "Gelap",
    "st.lang": "Bahasa", "st.en": "English", "st.id": "Bahasa Indonesia",
    "st.note": "Warna peta, legenda, dan semua halaman langsung berubah.",
  },
};

// Long "How the score works" page, one function per language.
const ABOUT = {
  en: (acc, D, esc) => `
    <h1>How to read the need score</h1>
    <p class="lede">Every hospital gets a need score for every kind of specialist, from 0 to 100.
      <b>Higher means the hospital needs that doctor more.</b> 0 means we found no sign it needs one.</p>
    <ul>
      <li><span class="lbl l2">High need</span> 60 or more, or the hospital has zero of a doctor it is required to have.</li>
      <li><span class="lbl l1">Moderate need</span> 30 to 59.</li>
      <li><span class="lbl l0">Low need</span> under 30.</li>
    </ul>
    <h2>Where the points come from</h2>
    <p>The score is four checks added together. Each check can add points; none takes points away.</p>
    <ul>
      <li><b>Missing a basic doctor: up to 35 points.</b> Every general hospital (RSU) should have an anesthesiologist, general surgeon, lab doctor (clinical pathologist), radiologist, internist, pediatrician and OB-GYN. Has none: +35. Has only one: +12, because one doctor can't be on call day and night alone. Specialty hospitals (RSIA, eye hospitals and so on) skip this check.</li>
      <li><b>Government plan needs it: up to 30 points.</b> The KMK 1277/2024 decree tells 578 government hospitals to build cancer, heart, stroke, kidney and mother-and-child services to a set level (Madya, then Utama, then Paripurna). Each level needs certain doctors. Has none: +30. Has only one at Utama or Paripurna level: +10. Private hospitals are not in the decree, so they never get these points.</li>
      <li><b>Fewer than similar hospitals: up to 15 points.</b> We compare with hospitals of the same type and size. If similar hospitals usually have 2 and this one has 0, that's +15; if it has 1, +7.5.</li>
      <li><b>Few in this area: up to 20 points.</b> We count these doctors per 100,000 people in the kab/kota. None in the whole kab/kota: +20. Less than half of a typical area: +12. Below a typical area: +6. This only counts if the hospital should plausibly have that doctor, so a small clinic-sized hospital doesn't "need" a heart surgeon just because the area has none.</li>
    </ul>
    <p><b>Example:</b> a 53-bed general hospital with no general surgeon gets +35 (missing a basic doctor) + 15 (similar hospitals have 1) + 12 (the area has few) = <b>62, high need</b>.</p>
    <h2 id="limits">How accurate is this data?</h2>
    <p>Good enough to see patterns, not to trust one hospital's numbers without checking. All sources are filled in by hospitals and doctors themselves in government systems; nobody has verified them on the ground.</p>
    <ul>
      <li><b>The two government sources mostly agree.</b> For the 7 basic specialists at public hospitals, SIRS and Kemenkes DREAMS are within one doctor of each other in ${acc.within1.toLocaleString()} of ${acc.pairs.toLocaleString()} cases (${Math.round(acc.within1 / Math.max(acc.pairs, 1) * 100)}%). Their totals also match the figures Kemenkes publishes.</li>
      <li><b>About 1 in 5 "missing doctor" flags may be false.</b> Of ${acc.high} high-need flags for basic specialists at public hospitals, ${acc.contradicted} (${acc.share}%) come from SIRS saying zero while DREAMS says at least one. Check these before acting.</li>
      <li><b>Private hospitals can't be cross-checked.</b> ${acc.priv.toLocaleString()} of ${D.hospitals.length.toLocaleString()} hospitals are private, and only SIRS covers them.</li>
      <li><b>"Has 1" may mean a visiting doctor.</b> SIRS counts a doctor at every hospital where they work. In Java there are about 2.6 hospital posts per orthopedic surgeon.</li>
      <li><b>Some records are wrong or old.</b> For example, RSUD Galesong (Takalar) stopped services in May 2025 but is still listed as staffed. ${D.quality.approx_location} hospitals have no usable map location and ${D.quality.missing_beds.length} have no bed count.</li>
      <li><b>"Need" is not a job opening.</b> The score knows nothing about patient numbers, budgets or whether the hospital is hiring.</li>
    </ul>
    <div class="table-wrap"><table><thead><tr><th>What you want to know</th><th>How much to trust it</th></tr></thead><tbody>
      <tr><td>Which specialties are scarce, nationally or by province</td><td>Good</td></tr>
      <tr><td>Which areas lack a specialty</td><td>Fairly good</td></tr>
      <tr><td>Whether a public hospital is missing a basic specialist</td><td>Check it: about 1 in 5 flags is contradicted</td></tr>
      <tr><td>Whether a private hospital needs someone</td><td>Low: one self-reported source</td></tr>
      <tr><td>Whether a hospital is actually hiring</td><td>Not covered by this data</td></tr>
    </tbody></table></div>
    <p>The spot check under Data quality measures the real error rate as hospitals are called.</p>
    <h2>What the law does and doesn't say</h2>
    <ul>
      <li><b>No regulation sets a required number of specialists.</b> The laws name services a hospital must offer, not doctors.</li>
      <li><b>PP 28/2024 (Pasal 821)</b> lists services every hospital must offer, such as surgery, intensive care, a lab and radiology.</li>
      <li><b>Permenkes 3/2020 (Pasal 8)</b> names four basic specialties: internal medicine, pediatrics, surgery and OB-GYN.</li>
      <li><b>KMK 1277/2024</b> sets the government's cancer, heart, stroke, kidney and mother-and-child targets for 578 hospitals.</li>
      <li>Turning "this hospital must offer surgery" into "this hospital needs a surgeon and an anesthesiologist" is this tool's own judgment.</li>
    </ul>
    <h2>Limits to keep in mind</h2>
    <ul>
      <li>Doctor counts come from SIRS, where hospitals report their own staff. They can be out of date, and a doctor who works at three hospitals is counted at all three.</li>
      <li>Private hospitals can score at most 70, because the government-plan check doesn't apply to them. To compare a private and a government hospital, look at the need level and the reasons, not the raw number.</li>
      <li>Population comes from Dukcapil (Kemendagri), not BPS.</li>
      <li>The point values are a first version. Check them against hospitals you know and adjust.</li>
    </ul>
    <h2>Sources</h2>
    <ul>
      <li>Hospitals and staff: SIRS / RS Online, Kemenkes (sirs.kemkes.go.id), downloaded ${esc(D.meta.sirs_downloaded)}.</li>
      <li>KMK HK.01.07/MENKES/1277/2024: <a href="kmk.pdf" target="_blank" rel="noopener">local copy</a> (keslan.kemkes.go.id).</li>
      <li>Permenkes 3/2020: peraturan.bpk.go.id/Download/144763 · PP 28/2024: peraturan.bpk.go.id/Details/294077</li>
      <li>Population: ${esc(D.meta.population_source)}.</li>
    </ul>`,

  id: (acc, D, esc) => `
    <h1>Cara membaca skor kebutuhan</h1>
    <p class="lede">Setiap rumah sakit mendapat skor kebutuhan untuk setiap jenis spesialis, dari 0 sampai 100.
      <b>Makin tinggi berarti rumah sakit makin membutuhkan dokter itu.</b> 0 berarti tidak ditemukan tanda kebutuhan.</p>
    <ul>
      <li><span class="lbl l2">Kebutuhan tinggi</span> 60 ke atas, atau rumah sakit sama sekali tidak punya dokter yang diwajibkan.</li>
      <li><span class="lbl l1">Kebutuhan sedang</span> 30 sampai 59.</li>
      <li><span class="lbl l0">Kebutuhan rendah</span> di bawah 30.</li>
    </ul>
    <h2>Dari mana poinnya</h2>
    <p>Skor adalah jumlah empat pengecekan. Setiap pengecekan hanya bisa menambah poin, tidak mengurangi.</p>
    <ul>
      <li><b>Tidak ada dokter dasar: maksimal 35 poin.</b> Setiap rumah sakit umum (RSU) seharusnya punya dokter spesialis anestesi, bedah, patologi klinik, radiologi, penyakit dalam, anak, dan kandungan. Tidak ada: +35. Hanya satu: +12, karena satu dokter tidak bisa jaga siang dan malam sendirian. Rumah sakit khusus (RSIA, RS mata, dan sebagainya) tidak melalui pengecekan ini.</li>
      <li><b>Dibutuhkan rencana pemerintah: maksimal 30 poin.</b> KMK 1277/2024 menugaskan 578 rumah sakit pemerintah membangun layanan kanker, jantung, stroke, ginjal, serta ibu dan anak sampai tingkat tertentu (Madya, lalu Utama, lalu Paripurna). Setiap tingkat membutuhkan dokter tertentu. Tidak ada: +30. Hanya satu di tingkat Utama atau Paripurna: +10. Rumah sakit swasta tidak termasuk dalam keputusan ini, jadi tidak pernah mendapat poin ini.</li>
      <li><b>Lebih sedikit dari RS serupa: maksimal 15 poin.</b> Dibandingkan dengan rumah sakit sejenis dan seukuran. Jika RS serupa biasanya punya 2 dan RS ini punya 0, itu +15; jika punya 1, +7,5.</li>
      <li><b>Sedikit di wilayah ini: maksimal 20 poin.</b> Dihitung jumlah dokter ini per 100.000 penduduk di kab/kota. Tidak ada sama sekali di kab/kota: +20. Kurang dari separuh daerah pada umumnya: +12. Di bawah daerah pada umumnya: +6. Ini hanya dihitung jika rumah sakit memang wajar punya dokter itu, jadi RS kecil tidak dianggap "butuh" dokter bedah jantung hanya karena di daerahnya tidak ada.</li>
    </ul>
    <p><b>Contoh:</b> rumah sakit umum 53 tempat tidur tanpa dokter spesialis bedah mendapat +35 (tidak ada dokter dasar) + 15 (RS serupa punya 1) + 12 (di wilayahnya sedikit) = <b>62, kebutuhan tinggi</b>.</p>
    <h2 id="limits">Seberapa akurat data ini?</h2>
    <p>Cukup untuk melihat pola, tetapi angka satu rumah sakit jangan dipercaya tanpa dicek. Semua sumber diisi sendiri oleh rumah sakit dan dokter di sistem pemerintah; belum ada yang memverifikasi di lapangan.</p>
    <ul>
      <li><b>Kedua sumber pemerintah umumnya sama.</b> Untuk 7 spesialis dasar di RS pemerintah, SIRS dan Kemenkes DREAMS selisihnya paling banyak satu dokter pada ${acc.within1.toLocaleString("id-ID")} dari ${acc.pairs.toLocaleString("id-ID")} kasus (${Math.round(acc.within1 / Math.max(acc.pairs, 1) * 100)}%). Totalnya juga sesuai dengan angka yang diterbitkan Kemenkes.</li>
      <li><b>Sekitar 1 dari 5 tanda "dokter tidak ada" mungkin salah.</b> Dari ${acc.high} tanda kebutuhan tinggi untuk spesialis dasar di RS pemerintah, ${acc.contradicted} (${acc.share}%) berasal dari SIRS yang bilang nol padahal DREAMS bilang minimal satu. Cek dulu sebelum bertindak.</li>
      <li><b>RS swasta tidak bisa dicek silang.</b> ${acc.priv.toLocaleString("id-ID")} dari ${D.hospitals.length.toLocaleString("id-ID")} rumah sakit adalah swasta, dan hanya SIRS yang mencakupnya.</li>
      <li><b>"Punya 1" bisa berarti dokter tamu.</b> SIRS menghitung dokter di setiap rumah sakit tempat ia bekerja. Di Jawa ada sekitar 2,6 posisi RS per dokter spesialis ortopedi.</li>
      <li><b>Sebagian data salah atau usang.</b> Contohnya, RSUD Galesong (Takalar) berhenti melayani sejak Mei 2025 tetapi masih tercatat punya staf. ${D.quality.approx_location} rumah sakit tidak punya lokasi peta yang bisa dipakai dan ${D.quality.missing_beds.length} tidak punya jumlah tempat tidur.</li>
      <li><b>"Kebutuhan" bukan lowongan kerja.</b> Skor ini tidak tahu jumlah pasien, anggaran, atau apakah rumah sakit sedang merekrut.</li>
    </ul>
    <div class="table-wrap"><table><thead><tr><th>Yang ingin Anda ketahui</th><th>Seberapa bisa dipercaya</th></tr></thead><tbody>
      <tr><td>Spesialis mana yang langka, secara nasional atau per provinsi</td><td>Baik</td></tr>
      <tr><td>Daerah mana yang kekurangan suatu spesialis</td><td>Cukup baik</td></tr>
      <tr><td>Apakah RS pemerintah tidak punya spesialis dasar</td><td>Cek dulu: sekitar 1 dari 5 tanda dibantah</td></tr>
      <tr><td>Apakah RS swasta butuh dokter</td><td>Rendah: hanya satu sumber yang dilaporkan sendiri</td></tr>
      <tr><td>Apakah rumah sakit benar-benar sedang merekrut</td><td>Tidak tercakup data ini</td></tr>
    </tbody></table></div>
    <p>Cek sampel di Kualitas data mengukur tingkat kesalahan sebenarnya seiring rumah sakit ditelepon.</p>
    <h2>Apa yang diatur dan tidak diatur hukum</h2>
    <ul>
      <li><b>Tidak ada aturan yang menetapkan jumlah wajib dokter spesialis.</b> Aturan menyebut layanan yang wajib ada, bukan dokternya.</li>
      <li><b>PP 28/2024 (Pasal 821)</b> menyebut layanan yang wajib ada di setiap rumah sakit, seperti bedah, perawatan intensif, laboratorium, dan radiologi.</li>
      <li><b>Permenkes 3/2020 (Pasal 8)</b> menyebut empat spesialis dasar: penyakit dalam, anak, bedah, dan kandungan.</li>
      <li><b>KMK 1277/2024</b> menetapkan target layanan kanker, jantung, stroke, ginjal, serta ibu dan anak untuk 578 rumah sakit.</li>
      <li>Menerjemahkan "rumah sakit ini wajib punya layanan bedah" menjadi "rumah sakit ini butuh dokter bedah dan dokter anestesi" adalah penilaian alat ini sendiri.</li>
    </ul>
    <h2>Batasan yang perlu diingat</h2>
    <ul>
      <li>Jumlah dokter berasal dari SIRS, tempat rumah sakit melaporkan stafnya sendiri. Bisa usang, dan dokter yang bekerja di tiga rumah sakit dihitung di ketiganya.</li>
      <li>RS swasta maksimal mendapat skor 70, karena pengecekan rencana pemerintah tidak berlaku. Untuk membandingkan RS swasta dan pemerintah, lihat tingkat kebutuhan dan alasannya, bukan angka mentahnya.</li>
      <li>Data penduduk berasal dari Dukcapil (Kemendagri), bukan BPS.</li>
      <li>Nilai poin ini versi pertama. Cocokkan dengan rumah sakit yang Anda kenal lalu sesuaikan.</li>
    </ul>
    <h2>Sumber</h2>
    <ul>
      <li>Rumah sakit dan staf: SIRS / RS Online, Kemenkes (sirs.kemkes.go.id), diunduh ${esc(D.meta.sirs_downloaded)}.</li>
      <li>KMK HK.01.07/MENKES/1277/2024: <a href="kmk.pdf" target="_blank" rel="noopener">salinan lokal</a> (keslan.kemkes.go.id).</li>
      <li>Permenkes 3/2020: peraturan.bpk.go.id/Download/144763 · PP 28/2024: peraturan.bpk.go.id/Details/294077</li>
      <li>Penduduk: ${esc(D.meta.population_source)}.</li>
    </ul>`,
};
