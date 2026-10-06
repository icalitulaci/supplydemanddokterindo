"use strict";
// Specialist demand dashboard. Data comes from dashboard/data.json (build_dashboard.py).
// Score rows: [specIndex, n, peerMedian, A, B, C, D, total, labelIndex, reasonIds, kmkService]

const LABELS = ["Low", "Moderate", "High"];
const LEVEL_VAR = ["--low", "--mod", "--high"];
const SHAPES = { Government: "circle", Private: "diamond", "TNI/Polri": "triangle", BUMN: "square" };
const BANDS = [[0, 50], [50, 100], [100, 200], [200, 250], [250, 500], [500, 1e9]];
const SIZE_STEPS = [[0, 10, "Under 100 beds"], [100, 14, "100–249"], [250, 18, "250–499"], [500, 23, "500 or more"]];
const SERVICE_NAMES = { kanker: "Cancer", jantung: "Heart", stroke: "Stroke", uronefrologi: "Uronephrology", kia: "Maternal & child" };
const JAVA = [[-8.85, 105.1], [-5.85, 114.6]];
const PAGE_SIZE = 300;
// Hospital class (kelas) as SIRS reports it, in size order. "Non Kelas"/"Belum Ditetapkan" become "Not set".
const CLASSES = ["A", "B", "C", "D", "D Pratama", "Not set"];
const CLASS_VAR = ["--kA", "--kB", "--kC", "--kD", "--kDP", "--kX"];
const classOf = h => ({ A: "A", B: "B", C: "C", D: "D", "D PRATAMA": "D Pratama" })[h.kelas] || "Not set";
const classIndex = h => CLASSES.indexOf(classOf(h));
const classBadge = (h, long) => `<span class="kelas" style="--k:var(${CLASS_VAR[classIndex(h)]})">${long ? (classOf(h) === "Not set" ? "Class not set" : "Kelas " + esc(classOf(h))) : esc(classOf(h))}</span>`;
// Kemenkes DREAMS count for the 7 basic specialists at public hospitals: [asn, blud, contract, total]
const dreamsOf = (h, si) => h.dreams ? h.dreams[D.specialties[si].code] || null : null;
const sirsMain = (h, r) => r[1] - (h.sub[D.specialties[r[0]].code] || 0);
function dreamsCell(h, r) {
  const d = dreamsOf(h, r[0]);
  if (!d) return `<td class="r num note" data-sort="">–</td>`;
  const differs = d[3] !== sirsMain(h, r);
  const sub = r[1] - sirsMain(h, r);
  // DREAMS counts base specialists only, so compare against SIRS without its subspecialists.
  const sirsNote = sub ? `SIRS: ${sirsMain(h, r)} specialists + ${sub} subspecialists` : `SIRS: ${r[1]}`;
  return `<td class="r num${differs ? " cell-half" : ""}" data-sort="${d[3]}" title="Kemenkes DREAMS: ${d[0]} civil servant (ASN), ${d[1]} hospital-employed (BLUD), ${d[2]} contract. ${sirsNote}${differs ? " (differs)" : " (same)"}">${d[3]}</td>`;
}
const classShort = h => ({ "D Pratama": "Dp", "Not set": "?" })[classOf(h)] || classOf(h);

let D = null;
const state = { view: "map", selected: null, specLimit: PAGE_SIZE, canSave: false };
const READ_ONLY_NOTE = '<p class="note">This is a read-only copy. To save, run <code>python app.py</code> on your PC.</p>';
// How often the data contradicts itself, computed from the loaded data so the wording stays true after rebuilds.
function accuracyStats() {
  const seven = new Set(["Sp.A", "Sp.B", "Sp.OG", "Sp.PD", "Sp.An", "Sp.Rad", "Sp.PK"]);
  let pairs = 0, within1 = 0, high = 0, contradicted = 0;
  for (const h of D.hospitals) {
    if (!h.dreams) continue;
    for (const r of h.scores) {
      const code = D.specialties[r[0]].code;
      if (!seven.has(code)) continue;
      const d = h.dreams[code][3], main = r[1] - (h.sub[code] || 0);
      pairs++;
      if (Math.abs(d - main) <= 1) within1++;
      if (r[8] === 2) { high++; if (r[1] === 0 && d > 0) contradicted++; }
    }
  }
  const priv = D.hospitals.filter(h => h.own === "Private").length;
  return { pairs, within1, high, contradicted, priv, share: high ? Math.round(contradicted / high * 100) : 0 };
}
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = x => (x == null ? "n/a" : Number.isInteger(x) ? String(x) : x.toFixed(x < 1 ? 2 : 1).replace(/\.0$/, ""));
const bandOf = beds => BANDS.findIndex(([lo, hi]) => beds >= lo && beds < hi);
const NEED_WORDS = ["Low need", "Moderate need", "High need"];
const lbl = i => `<span class="lbl l${i}">${NEED_WORDS[i]}</span>`;
// The four parts of the need score, in plain words: [name, max points, row index]
const PARTS = [["missing a basic doctor", 35, 3], ["government plan needs it", 30, 4], ["fewer than similar hospitals", 15, 5], ["few in this area", 20, 6]];
const specName = i => `${D.specialties[i].name} (${D.specialties[i].code})`;
function pointsText(r) {
  const parts = PARTS.filter(([, , i]) => r[i]).map(([name, , i]) => `+${fmt(r[i])} ${name}`);
  return parts.length ? `${parts.join(", ")} = ${fmt(r[7])} of 100` : "0 of 100: no sign of need";
}
const pillarTitle = r => `Need score ${fmt(r[7])} of 100 (higher = needs this doctor more). ${pointsText(r)}`;
const scoreCell = r => `<span class="score" title="${pillarTitle(r)}">${fmt(r[7])}</span>`;
const provKey = s => { const k = String(s).toLowerCase().replace(/daerah istimewa|d\.i\./g, "di").replace(/[^a-z]/g, ""); return ({ diyogyakarta: "yogyakarta", dkijakarta: "jakarta", daerahkhususjakarta: "jakarta", kepbangkabelitung: "kepulauanbangkabelitung" })[k] || k; };

// ---------- filters ----------
const F = () => ({
  q: $("f-q").value.trim().toLowerCase(), prov: $("f-prov").value, kab: $("f-kab").value, own: $("f-own").value,
  type: $("f-type").value, kelas: $("f-kelas").value, band: $("f-band").value, spec: $("f-spec").value, label: $("f-label").value,
});
function hospitalPasses(h, f) {
  if (f.prov && h.prov !== f.prov) return false;
  if (f.kab && h.kab_id !== f.kab) return false;
  if (f.own && h.own !== f.own) return false;
  if (f.type && h.type !== f.type) return false;
  if (f.kelas && classOf(h) !== f.kelas) return false;
  if (f.band !== "" && bandOf(h.beds) !== +f.band) return false;
  if (f.q && !(h.name.toLowerCase().includes(f.q) || h.kab.toLowerCase().includes(f.q))) return false;
  return true;
}
function levelOf(h, f) { return f.spec !== "" ? h.scores[+f.spec][8] : h.maxLevel; }
function visibleHospitals(f = F()) {
  return D.hospitals.filter(h => hospitalPasses(h, f) && (f.label === "" || levelOf(h, f) === +f.label));
}
// (hospital, specialty) pairs that pass every filter, including need level
function visiblePairs(f = F()) {
  const out = [];
  for (const h of D.hospitals) {
    if (!hospitalPasses(h, f)) continue;
    const rows = f.spec !== "" ? [h.scores[+f.spec]] : h.scores;
    for (const r of rows) if (f.label === "" || r[8] === +f.label) out.push([h, r]);
  }
  return out;
}
function fillSelect(sel, items, keepFirst = true) {
  const first = keepFirst ? sel.options[0].outerHTML : "";
  sel.innerHTML = first + items.map(([v, t]) => `<option value="${esc(v)}">${esc(t)}</option>`).join("");
}
function refreshKabOptions() {
  const prov = $("f-prov").value, cur = $("f-kab").value;
  const kabs = new Map();
  D.hospitals.forEach(h => { if (!prov || h.prov === prov) kabs.set(h.kab_id, prov ? h.kab : `${h.kab}, ${h.prov}`); });
  fillSelect($("f-kab"), [...kabs].sort((a, b) => a[1].localeCompare(b[1])));
  $("f-kab").value = kabs.has(cur) ? cur : "";
}

// ---------- reasons ----------
function reasonsHTML(h, r, tag = "div") {
  return r[9].map(i => {
    let t = esc(D.reasons[i]);
    if (D.reasons[i].includes("KMK 1277") && h.kmk) t += ` <a href="kmk.pdf#page=${h.kmk.page}" target="_blank" rel="noopener">p. ${h.kmk.page}</a>`;
    if (D.reasons[i].startsWith("Similar hospitals")) t = t.replace(/\)/, `, ${h.peers} hospitals)`);
    return `<${tag}>${t}</${tag}>`;
  }).join("");
}
const inferred = r => (D.specialties[r[0]].floor && r[3] > 0) || r[4] > 0 ? '<div class="note">Note: the law names services, not doctors. Which doctor a service needs is this tool\'s own judgment.</div>' : "";

// ---------- map ----------
let map, markerLayer, legendMin = false;
function markerSize(beds) { let s = SIZE_STEPS[0][1]; for (const [lo, px] of SIZE_STEPS) if (beds >= lo) s = px; return s; }
function shapeSVG(shape, size, fill, stroke, dashed, strokeW = 1.5) {
  const p = strokeW, w = size, c = w / 2, dash = dashed ? ` stroke-dasharray="3 2"` : "";
  const attrs = `fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"${dash}`;
  const body = shape === "circle" ? `<circle cx="${c}" cy="${c}" r="${c - p}" ${attrs}/>`
    : shape === "diamond" ? `<polygon points="${c},${p} ${w - p},${c} ${c},${w - p} ${p},${c}" ${attrs}/>`
    : shape === "triangle" ? `<polygon points="${c},${p} ${w - p},${w - p} ${p},${w - p}" ${attrs}/>`
    : `<rect x="${p + 1}" y="${p + 1}" width="${w - 2 * p - 2}" height="${w - 2 * p - 2}" ${attrs}/>`;
  return `<svg width="${w}" height="${w}" viewBox="0 0 ${w} ${w}" aria-hidden="true">${body}</svg>`;
}
// Pins are drawn on one shared canvas: thousands of HTML markers made panning and zooming lag.
const ShapeMarker = L.CircleMarker.extend({
  options: { shape: "circle" },
  _updatePath() {
    const r = this._renderer;
    if (!r._drawing || this._empty()) return;
    const { x, y } = this._point, s = this._radius, ctx = r._ctx;
    ctx.beginPath();
    if (this.options.shape === "diamond") { ctx.moveTo(x, y - s * 1.15); ctx.lineTo(x + s * 1.15, y); ctx.lineTo(x, y + s * 1.15); ctx.lineTo(x - s * 1.15, y); ctx.closePath(); }
    else if (this.options.shape === "triangle") { ctx.moveTo(x, y - s * 1.15); ctx.lineTo(x + s * 1.1, y + s * 0.85); ctx.lineTo(x - s * 1.1, y + s * 0.85); ctx.closePath(); }
    else if (this.options.shape === "square") { ctx.rect(x - s * 0.88, y - s * 0.88, s * 1.76, s * 1.76); }
    else { ctx.arc(x, y, s, 0, Math.PI * 2); }
    r._fillStroke(ctx, this);
    if (this.options.label) {
      ctx.font = `700 ${Math.max(9, Math.round(s * 1.05))}px ${css("--font-body")}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#fff";
      ctx.fillText(this.options.label, x, y + (this.options.shape === "triangle" ? s * 0.25 : 0.5));
    }
  },
});
let colorBy = "need";
try { colorBy = localStorage.getItem("colorBy") || "need"; } catch (e) { /* storage blocked: use default */ }
const LETTER_ZOOM = 10; // from this zoom on, pins grow and show the class letter
function styleFor(h, level, selected) {
  const letters = map.getZoom() >= LETTER_ZOOM;
  return {
    radius: (markerSize(h.beds) + (selected ? 6 : 0) + (letters ? 8 : 0)) / 2,
    fillColor: css(colorBy === "class" ? CLASS_VAR[classIndex(h)] : LEVEL_VAR[level]), fillOpacity: 1,
    label: letters ? classShort(h) : null,
    color: selected ? css("--ink") : h.approx ? css("--approx") : css("--panel"),
    weight: selected ? 2.5 : h.approx ? 2 : 1.2, dashArray: h.approx ? "3 2" : null,
  };
}
function initMap() {
  map = L.map("map", { zoomControl: true, minZoom: 5 }).fitBounds(JAVA);
  const osm = "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";
  const base = {
    "Streets (OpenStreetMap)": L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: osm }),
    "Light (CARTO)": L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, attribution: osm + " &copy; CARTO" }),
    "Dark (CARTO)": L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", { maxZoom: 19, attribution: osm + " &copy; CARTO" }),
    "Satellite (Esri)": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "Imagery &copy; Esri" }),
    "Terrain (OpenTopoMap)": L.tileLayer("https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", { maxZoom: 17, attribution: osm + " &copy; OpenTopoMap" }),
  };
  const overlays = {
    "Roads overlay": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "&copy; Esri" }),
    "Place names overlay": L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}", { maxZoom: 19, attribution: "&copy; Esri" }),
  };
  let chosen = "Streets (OpenStreetMap)";
  try { chosen = localStorage.getItem("basemap") || chosen; } catch (e) { /* storage blocked: use default */ }
  (base[chosen] || base["Streets (OpenStreetMap)"]).addTo(map);
  // Top left, under the zoom buttons, so the hospital drawer on the right never covers it.
  L.control.layers(base, overlays, { position: "topleft" }).addTo(map);
  map.on("baselayerchange", e => { try { localStorage.setItem("basemap", e.name); } catch (err) { /* ignore */ } });
  markerLayer = L.layerGroup().addTo(map);
  let lastLetters = false;
  map.on("zoomend", () => { const on = map.getZoom() >= LETTER_ZOOM; if (on !== lastLetters) { lastLetters = on; renderMap(); } });
  const renderer = L.canvas({ padding: 0.5, tolerance: 4 });
  D.hospitals.forEach(h => {
    if (h.lat == null) return;
    h.marker = new ShapeMarker([h.lat, h.lng], { renderer, shape: SHAPES[h.own] })
      .bindTooltip(() => `${esc(h.name)} · Kelas ${esc(classOf(h))}`, { direction: "top", offset: [0, -6] })
      .on("click", () => selectHospital(h));
  });
}
function renderNotice() {
  const el = $("notice");
  let hidden = false;
  try { hidden = sessionStorage.getItem("noticeHidden") === "1"; } catch (e) { /* storage blocked: show it */ }
  if (hidden) { el.hidden = true; return; }
  const a = accuracyStats();
  el.hidden = false;
  el.innerHTML = `<span><b>Estimates, not facts.</b> Built from hospital-reported government data that nobody has checked on the ground.
    ${a.share}% of "missing doctor" flags at public hospitals are contradicted by a second Kemenkes source, and private hospitals can't be cross-checked at all.
    <a href="#about">Data limits</a></span><button type="button" class="close" id="noticeClose" aria-label="Hide this notice">×</button>`;
  $("noticeClose").onclick = () => { try { sessionStorage.setItem("noticeHidden", "1"); } catch (e) { /* ignore */ } el.hidden = true; };
}
function renderMap() {
  renderNotice();
  const f = F();
  markerLayer.clearLayers();
  // Canvas draws in insertion order: Low first, High on top, the selected hospital last.
  const list = visibleHospitals(f).filter(h => h.marker)
    .map(h => [h, levelOf(h, f), h === state.selected])
    .sort((a, b) => a[2] - b[2] || a[1] - b[1]);
  for (const [h, level, sel] of list) markerLayer.addLayer(h.marker.setStyle(styleFor(h, level, sel)));
  const shown = list.length;
  renderLegend(f, shown);
}
function renderLegend(f, shown) {
  const el = $("legend");
  el.className = "legend" + (legendMin ? " min" : "");
  const what = f.spec !== "" ? `a ${esc(D.specialties[+f.spec].name.toLowerCase())} doctor` : "its most-needed specialist";
  const sw = (lvl, label) => `<span>${shapeSVG("circle", 12, css(LEVEL_VAR[lvl]), css("--panel"))}${label}</span>`;
  const shp = (own) => `<span>${shapeSVG(SHAPES[own], 13, css("--muted"), css("--panel"))}${own}</span>`;
  el.innerHTML = `
    <button type="button" class="ghost legend-toggle" id="legendToggle">${legendMin ? "Show legend" : "Hide legend"}</button>
    <div class="seg" role="group" aria-label="Color pins by">
      <button type="button" class="${colorBy === "need" ? "" : "ghost"}" data-color="need">Color by need</button>
      <button type="button" class="${colorBy === "class" ? "" : "ghost"}" data-color="class">Color by class (A–D)</button></div>
    ${colorBy === "class"
      ? `<div><h4>Color: hospital class (kelas)</h4><div class="row">${CLASSES.map((c, i) => `<span>${shapeSVG("circle", 12, css(CLASS_VAR[i]), css("--panel"))}${c === "Not set" ? c : "Kelas " + c}</span>`).join("")}</div></div>`
      : `<div><h4>Color: how badly the hospital needs ${what}</h4><div class="row">${sw(2, "High need")}${sw(1, "Moderate need")}${sw(0, "Low or no need")}</div></div>`}
    <div class="note">Zoom in close to see the class letter (A, B, C, D, Dp = D Pratama) inside each pin.</div>
    <div><h4>Shape: who owns the hospital</h4><div class="row">${Object.keys(SHAPES).map(shp).join("")}</div></div>
    <div><h4>Size: number of beds</h4><div class="row">${SIZE_STEPS.map(([, px, t]) => `<span>${shapeSVG("circle", px, "transparent", css("--muted"))}${t}</span>`).join("")}</div></div>
    <div class="row"><span>${shapeSVG("circle", 13, css("--low"), css("--approx"), true, 2)}Approximate location (kab/kota center)</span></div>
    <div class="note">${shown.toLocaleString()} hospitals shown. Click one to see what it needs.</div>`;
  $("legendToggle").onclick = () => { legendMin = !legendMin; renderLegend(f, shown); };
  el.querySelectorAll("[data-color]").forEach(b => b.onclick = () => {
    colorBy = b.dataset.color;
    try { localStorage.setItem("colorBy", colorBy); } catch (e) { /* ignore */ }
    renderMap();
  });
}

function needsHTML(h, onlyNeeds = true) {
  const f = F();
  let rows = h.scores.filter(r => !onlyNeeds || r[8] > 0).sort((a, b) => b[8] - a[8] || b[7] - a[7]);
  if (f.spec !== "") rows = [h.scores[+f.spec], ...rows.filter(r => r[0] !== +f.spec)];
  if (!rows.length) return '<p class="note">No high or moderate needs found for this hospital.</p>';
  return rows.map(r => `<div class="need">
      <div class="need-head"><b>${esc(specName(r[0]))}</b><span>${lbl(r[8])} <span class="num">${fmt(r[7])}</span></span></div>
      <div class="pillars">Has ${fmt(r[1])} · similar hospitals have ${fmt(r[2])}${dreamsOf(h, r[0]) ? ` · Kemenkes DREAMS count: ${dreamsOf(h, r[0])[3]}${dreamsOf(h, r[0])[3] !== sirsMain(h, r) ? " (differs from SIRS)" : ""}` : ""}<br>${pointsText(r)}</div>
      ${r[9].length ? `<ul>${reasonsHTML(h, r, "li")}</ul>` : ""}${inferred(r)}</div>`).join("");
}
function kmkLine(h) {
  if (!h.kmk) return h.own === "Government" ? "Not in the KMK 1277/2024 network list (or not matched yet)." : "Not in KMK 1277/2024 (the decree only lists government hospitals).";
  const t = Object.entries(h.kmk.tiers).map(([s, t]) => `${SERVICE_NAMES[s]} ${t}`).join(" · ");
  return `KMK 1277/2024 targets: ${esc(t)} <a href="kmk.pdf#page=${h.kmk.page}" target="_blank" rel="noopener">p. ${h.kmk.page}</a>`;
}
function chipsHTML(h) {
  return `<div class="chips"><span class="chip">${esc(h.own)} · ${esc(h.owner)}</span><span class="chip">${esc(h.type)}</span>
    ${classBadge(h, true)}<span class="chip">${h.beds} beds</span>
    ${h.approx ? '<span class="chip warn">Approximate location</span>' : ""}</div>`;
}
function openDrawer(h) {
  const dr = $("drawer");
  const highs = h.scores.filter(r => r[8] === 2).length, mods = h.scores.filter(r => r[8] === 1).length;
  dr.innerHTML = `<button type="button" class="close" id="drawerClose" aria-label="Close">×</button>
    <h2>${esc(h.name)}</h2>${chipsHTML(h)}
    <div class="meta-text">${esc(h.address)}<br>${esc(h.kab)}, ${esc(h.prov)}<br>${kmkLine(h)}</div>
    <p class="note">Each specialty gets a need score from 0 to 100. Higher means this hospital needs that doctor more. 60 or more is high need.</p>
    <div><b>${highs ? `${highs} high-need specialt${highs > 1 ? "ies" : "y"}` : "No high-need specialties"}</b>${mods ? `, ${mods} moderate` : ""}</div>
    <div class="needs">${needsHTML(h)}</div>
    <p class="note">These are estimates from hospital-reported government data, not checked on the ground. Confirm with the hospital before acting. <a href="#about">Data limits</a></p>
    <div class="toolbar"><button type="button" id="drawerFull">Full hospital view</button>
      <a href="https://sirs.kemkes.go.id/fo/home/profile_rs/${h.id}" target="_blank" rel="noopener">SIRS profile</a></div>`;
  dr.hidden = false;
  $("drawerClose").onclick = () => { dr.hidden = true; state.selected = null; renderMap(); };
  $("drawerFull").onclick = () => { location.hash = "#hospital"; };
}
function selectHospital(h, fly) {
  state.selected = h;
  if (state.view === "map") {
    if (fly && h.lat != null) map.flyTo([h.lat, h.lng], Math.max(map.getZoom(), 12), { duration: 0.6 });
    openDrawer(h);
    renderMap();
  } else {
    location.hash = "#hospital";
    render();
  }
}

// ---------- overview ----------
function renderOverview() {
  const f = F();
  const pairs = visiblePairs({ ...f, label: "" });
  const hs = new Set(pairs.map(p => p[0]));
  const high = pairs.filter(p => p[1][8] === 2), mod = pairs.filter(p => p[1][8] === 1);
  const hard = pairs.filter(([, r]) => r[1] === 0 && (r[3] > 0 || r[4] > 0));
  const hospHigh = new Set(high.map(p => p[0]));
  const bySpec = new Map();
  high.forEach(([h, r]) => bySpec.set(r[0], (bySpec.get(r[0]) || 0) + 1));
  const specRows = [...bySpec].sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...bySpec.values());
  const byProv = new Map();
  for (const [h, r] of pairs) {
    const p = byProv.get(h.prov) || { hs: new Set(), highH: new Set(), hard: 0, high: 0 };
    p.hs.add(h);
    if (r[8] === 2) { p.high++; p.highH.add(h); }
    if (r[1] === 0 && (r[3] > 0 || r[4] > 0)) p.hard++;
    byProv.set(h.prov, p);
  }
  const provRows = [...byProv].sort((a, b) => b[1].hard - a[1].hard);
  $("view-overview").innerHTML = `
    <h1>Overview</h1>
    <p class="lede">${hs.size.toLocaleString()} hospitals in the current filters${f.spec !== "" ? `, looking at ${esc(specName(+f.spec))} only` : ", every specialty"}. One "need" below means one hospital needing one kind of specialist.</p>
    <div class="kpis">
      <div class="kpi high"><b>${high.length.toLocaleString()}</b><span>High needs</span></div>
      <div class="kpi mod"><b>${mod.length.toLocaleString()}</b><span>Moderate needs</span></div>
      <div class="kpi"><b>${hospHigh.size.toLocaleString()}</b><span>Hospitals with at least one high need</span></div>
      <div class="kpi"><b>${hard.length.toLocaleString()}</b><span>Missing a required doctor completely (has zero)</span></div>
    </div>
    <h2>Which specialists are needed most (number of hospitals with high need)</h2>
    <div class="bars">${specRows.length ? specRows.map(([si, n]) => `<div class="bar-row" data-spec="${si}" title="Show the ranked list for this specialty">
      <span>${esc(specName(si))}</span><span class="bar-track"><i style="width:${(n / max) * 100}%"></i></span><span class="num">${n}</span></div>`).join("")
      : '<p class="empty">No high needs with the current filters.</p>'}</div>
    <h2>By province</h2>
    <div class="table-wrap"><table><thead><tr><th>Province</th><th class="r">Hospitals</th><th class="r">Hospitals with a high need</th><th class="r">High needs</th><th class="r">Missing completely</th></tr></thead>
    <tbody>${provRows.map(([p, v]) => `<tr class="click" data-prov="${esc(p)}"><td>${esc(p)}</td><td class="r num">${v.hs.size}</td><td class="r num">${v.highH.size}</td><td class="r num">${v.high}</td><td class="r num">${v.hard}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">Click a specialty to rank hospitals for it, or a province to filter to it.</p>`;
  $("view-overview").querySelectorAll(".bar-row").forEach(el => el.onclick = () => { $("f-spec").value = el.dataset.spec; location.hash = "#specialty"; render(); });
  $("view-overview").querySelectorAll("tr[data-prov]").forEach(el => el.onclick = () => { $("f-prov").value = el.dataset.prov; refreshKabOptions(); render(); });
}

// ---------- specialty ----------
function specialtyRows(f) {
  return visiblePairs(f).sort((a, b) => b[1][7] - a[1][7] || a[1][1] - b[1][1] || b[0].beds - a[0].beds);
}
function renderSpecialty() {
  const f = F(), el = $("view-specialty");
  if (f.spec === "") {
    el.innerHTML = `<h1>By specialty</h1><p class="lede">Pick a specialty to rank hospitals by how much they need it.</p>
      <div class="bars">${D.specialties.map((s, i) => `<div class="bar-row" data-spec="${i}"><span>${esc(specName(i))}</span><span></span><span></span></div>`).join("")}</div>`;
    el.querySelectorAll(".bar-row").forEach(r => r.onclick = () => { $("f-spec").value = r.dataset.spec; render(); });
    return;
  }
  const si = +f.spec;
  const rows = specialtyRows(f).map((p, i) => [p[0], p[1], i + 1]);
  const st = sortState["view-specialty:0"];
  if (st) {
    const key = SPEC_SORT_KEYS[st.col];
    if (key) rows.sort((a, b) => compareValues(key(a), key(b), st.dir));
  }
  const shown = rows.slice(0, state.specLimit);
  el.innerHTML = `<h1>${esc(specName(si))}</h1>
    <p class="lede">${rows.length.toLocaleString()} hospitals in the current filters, ranked from most to least in need. Need score runs 0–100: higher means the hospital needs this doctor more. Hover a score to see how it adds up.</p>
    <div class="toolbar"><button type="button" id="exportCsv">Export ${rows.length.toLocaleString()} rows to CSV</button></div>
    <div class="table-wrap"><table data-sortmode="data"><thead><tr><th class="r">#</th><th>Hospital</th><th>Kab/kota</th><th>Ownership</th><th>Type</th><th>Class</th><th class="r">Beds</th>
      <th class="r">Has now</th><th class="r" title="Second count from Kemenkes DREAMS. Public hospitals and the 7 basic specialists only. Orange = differs from SIRS.">Kemenkes count</th><th class="r">Similar hospitals have</th><th class="r">Need score</th><th>Need</th><th>Main reason</th></tr></thead>
    <tbody>${shown.map(([h, r, rank]) => `<tr class="click" data-id="${h.id}"><td class="r num">${rank}</td><td>${esc(h.name)}</td><td>${esc(h.kab)}<div class="note">${esc(h.prov)}</div></td>
      <td>${esc(h.own)}</td><td>${esc(h.type)}</td><td>${classBadge(h)}</td><td class="r num">${h.beds}</td><td class="r num">${fmt(r[1])}</td>${dreamsCell(h, r)}<td class="r num">${fmt(r[2])}</td>
      <td class="r">${scoreCell(r)}</td><td data-sort="${r[8]}">${lbl(r[8])}</td><td class="reasons">${r[9].length ? reasonsHTML(h, { ...r, 9: r[9].slice(0, 1) }) : ""}</td></tr>`).join("")}</tbody></table></div>
    ${rows.length > shown.length ? `<div class="toolbar" style="margin-top:12px"><button type="button" class="ghost" id="more">Show ${Math.min(PAGE_SIZE, rows.length - shown.length)} more</button></div>` : ""}`;
  el.querySelectorAll("tr[data-id]").forEach(tr => tr.onclick = () => selectHospital(D.byId.get(tr.dataset.id)));
  $("exportCsv").onclick = () => exportCsv(rows, `demand_${D.specialties[si].code}.csv`);
  if ($("more")) $("more").onclick = () => { state.specLimit += PAGE_SIZE; renderSpecialty(); makeSortable(el); };
}
function exportCsv(rows, filename) {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["hospital_id", "hospital", "province", "kab_kota", "ownership", "owner", "type", "beds", "specialty", "count", "peer_median",
    "A_mandatory", "B_kmk", "C_peer", "D_regional", "total", "label", "reasons"];
  const lines = rows.map(([h, r]) => [h.id, h.name, h.prov, h.kab, h.own, h.owner, h.type, h.beds, D.specialties[r[0]].code, r[1], r[2],
    r[3], r[4], r[5], r[6] ?? "n/a", r[7], LABELS[r[8]], r[9].map(i => D.reasons[i]).join(" | ")].map(q).join(","));
  const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- hospital ----------
function renderHospital() {
  const el = $("view-hospital"), h = state.selected;
  if (!h) {
    const list = visibleHospitals().sort((a, b) => b.maxTotal - a.maxTotal).slice(0, 60);
    el.innerHTML = `<h1>Hospital</h1><p class="lede">Pick a hospital from the map, or from this list (most urgent first, using the filters above).</p>
      <div class="table-wrap"><table><thead><tr><th>Hospital</th><th>Kab/kota</th><th>Ownership</th><th>Class</th><th class="r">Beds</th><th>Highest need</th></tr></thead>
      <tbody>${list.map(x => `<tr class="click" data-id="${x.id}"><td>${esc(x.name)}</td><td>${esc(x.kab)}, ${esc(x.prov)}</td><td>${esc(x.own)}</td><td data-sort="${classIndex(x)}">${classBadge(x)}</td><td class="r num">${x.beds}</td><td data-sort="${x.maxLevel}">${lbl(x.maxLevel)}</td></tr>`).join("")}</tbody></table></div>`;
    el.querySelectorAll("tr[data-id]").forEach(tr => tr.onclick = () => selectHospital(D.byId.get(tr.dataset.id)));
    return;
  }
  const rows = [...h.scores].sort((a, b) => b[7] - a[7] || b[2] - a[2]);
  const subNote = Object.keys(h.sub).length ? `Counts include subspecialists: ${Object.entries(h.sub).map(([c, n]) => `${esc(c)} ${n}`).join(", ")}.` : "";
  el.innerHTML = `<div class="toolbar"><button type="button" class="ghost" id="backList">All hospitals</button><button type="button" class="ghost" id="showMap">Show on map</button></div>
    <h1>${esc(h.name)}</h1>${chipsHTML(h)}
    <p class="lede" style="margin-top:8px">${esc(h.address)} · ${esc(h.kab)}, ${esc(h.prov)}<br>${kmkLine(h)}<br>
    Compared with ${h.peers} similar hospitals (${esc(h.type)}, ${esc(h.band)} beds). ${subNote}
    <a href="https://sirs.kemkes.go.id/fo/home/profile_rs/${h.id}" target="_blank" rel="noopener">SIRS profile</a></p>
    <div class="table-wrap"><table><thead><tr><th>Specialty</th><th class="r">Has now</th><th class="r" title="Second count from Kemenkes DREAMS. Public hospitals and the 7 basic specialists only. Orange = differs from SIRS.">Kemenkes count</th><th class="r">Similar hospitals have</th><th class="r" title="Missing a basic doctor every general hospital should have">Basic doctor<br>max 35</th><th class="r" title="The government plan (KMK 1277/2024) for this hospital needs this doctor">Gov. plan<br>max 30</th><th class="r" title="Has fewer than similar hospitals">Vs similar<br>max 15</th><th class="r" title="Few of these doctors in the kab/kota for its population">Area<br>max 20</th>
      <th class="r">Need score<br>0–100</th><th>Need</th><th>Why</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(specName(r[0]))}</td><td class="r num">${fmt(r[1])}</td>${dreamsCell(h, r)}<td class="r num">${fmt(r[2])}</td>
      <td class="r num">${fmt(r[3])}</td><td class="r num">${fmt(r[4])}</td><td class="r num">${fmt(r[5])}</td><td class="r num">${r[6] == null ? "n/a" : fmt(r[6])}</td>
      <td class="r num"><b>${fmt(r[7])}</b></td><td data-sort="${r[8]}">${lbl(r[8])}</td><td class="reasons">${reasonsHTML(h, r)}${r[8] ? inferred(r) : ""}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">${h.own === "Private" ? "Private hospital: these counts come from SIRS only and could not be cross-checked." : h.dreams ? "Public hospital: orange \"Kemenkes count\" cells mean the two government sources disagree." : "Not in Kemenkes DREAMS, so these counts could not be cross-checked."} Counts are self-reported and may be out of date. <a href="#about">Data limits</a></p>
    <p class="note">Need score = the four point columns added up. Higher means the hospital needs that doctor more. 60+ is high need, 30–59 moderate, under 30 low. If a hospital has zero of a doctor it is required to have, it is always high need.</p>`;
  $("backList").onclick = () => { state.selected = null; renderHospital(); };
  $("showMap").onclick = () => { location.hash = "#map"; setTimeout(() => selectHospital(h, true), 50); };
}

// ---------- regions ----------
function renderRegion() {
  const f = F(), el = $("view-region");
  const kabProv = new Map();
  D.hospitals.forEach(h => kabProv.set(h.kab_id, h.prov));
  let kabs = D.kabs.filter(k => (!f.prov || provKey(kabProv.get(k.id) || k.prov) === provKey(f.prov)) && (!f.kab || k.id === f.kab));
  const cls = (count, dens, m) => count === 0 ? "cell-zero" : dens < 0.5 * m ? "cell-half" : dens < m ? "cell-below" : "";
  const dens = (k, si) => k.pop ? k.totals[si] / k.pop * 1e5 : null;
  const legend = `<p class="note"><span class="lbl l2">None</span> no doctor of this kind in the kab/kota ·
    <span class="lbl l1">Under half</span> less than half of a typical area · <span class="lbl l0">Below typical</span> fewer than a typical area · numbers are doctors per 100,000 people.</p>`;
  if (f.spec !== "") {
    const si = +f.spec, m = D.national_median[si];
    kabs = kabs.sort((a, b) => (dens(a, si) ?? 0) - (dens(b, si) ?? 0) || b.pop - a.pop);
    el.innerHTML = `<h1>${esc(specName(si))} by kab/kota</h1><p class="lede">Doctors per 100,000 people. A typical kab/kota (the middle one of all ${D.kabs.length}) has ${fmt(m)}. Areas with the fewest come first.</p>${legend}
      <div class="table-wrap"><table><thead><tr><th>Kab/kota</th><th>Province</th><th class="r">Population</th><th class="r">Hospitals</th><th class="r">Doctors</th><th class="r">Per 100k people</th><th class="r">Compared with typical</th></tr></thead>
      <tbody>${kabs.map(k => { const d = dens(k, si); return `<tr><td>${esc(k.kab)}</td><td>${esc(k.prov)}</td><td class="r num">${k.pop.toLocaleString()}</td><td class="r num">${k.hospitals}</td>
        <td class="r num ${cls(k.totals[si], d, m)}">${k.totals[si]}</td><td class="r num ${cls(k.totals[si], d, m)}">${fmt(d)}</td><td class="r num">${m ? fmt(d / m) + "×" : "n/a"}</td></tr>`; }).join("")}</tbody></table></div>`;
    return;
  }
  const core = D.specialties.map((s, i) => i).slice(0, 19);
  kabs = kabs.sort((a, b) => a.prov.localeCompare(b.prov) || a.kab.localeCompare(b.kab));
  el.innerHTML = `<h1>Regions</h1><p class="lede">Doctors per 100,000 people in each kab/kota, for the 19 specialties the score looks at. Red means none at all. Pick a specialty in the filter bar to rank areas for it.</p>${legend}
    <div class="table-wrap"><table><thead><tr><th>Kab/kota</th><th class="r">Population</th>${core.map(i => `<th class="r" title="${esc(D.specialties[i].name)}">${esc(D.specialties[i].code)}</th>`).join("")}</tr>
      <tr><td class="note">Typical kab/kota</td><td></td>${core.map(i => `<td class="r num note">${fmt(D.national_median[i])}</td>`).join("")}</tr></thead>
    <tbody>${kabs.map(k => `<tr><td>${esc(k.kab)}<div class="note">${esc(k.prov)}</div></td><td class="r num">${k.pop.toLocaleString()}</td>
      ${core.map(i => { const d = dens(k, i); return `<td class="r num ${cls(k.totals[i], d, D.national_median[i])}" title="${k.totals[i]} specialists">${fmt(d)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

// ---------- data quality ----------
function renderQuality() {
  const q = D.quality, el = $("view-quality");
  const govByProv = new Map();
  D.hospitals.forEach(h => { if (["Pemkab", "Pemkot", "Pemprop", "Kemkes"].includes(h.owner)) { const k = provKey(h.prov); (govByProv.get(k) || govByProv.set(k, []).get(k)).push(h); } });
  const missingBeds = q.missing_beds.map(id => D.byId.get(id)).filter(Boolean);
  el.innerHTML = `<h1>Data quality</h1>
    <p class="lede">What the scores rest on, and what is missing. Fixing items here changes the scores.</p>
    <div class="kpis">
      <div class="kpi"><b>${q.kmk_matched} / ${q.kmk_total}</b><span>KMK hospitals matched to SIRS</span></div>
      <div class="kpi ${q.review.length ? "mod" : ""}"><b>${q.review.length}</b><span>Waiting for your review</span></div>
      <div class="kpi"><b>${q.approx_location}</b><span>Hospitals placed at their kab/kota center</span></div>
      <div class="kpi"><b>${missingBeds.length}</b><span>Hospitals with no bed count</span></div>
    </div>
    <h2>KMK match review</h2>
    <p class="lede">These KMK 1277/2024 hospitals could not be matched automatically. Until you confirm a match, they get no "government plan" points. Your choices are saved to data/kmk_matches_confirmed.csv.</p>
    <div id="reviewList">${q.review.length ? q.review.map((m, i) => reviewItem(m, i, govByProv.get(provKey(m.provinsi)) || [])).join("") : '<p class="empty">Nothing to review.</p>'}</div>
    ${q.no_match.length ? `<h2>Marked as not in SIRS</h2><ul class="prose">${q.no_match.map(m => `<li>${esc(m.nama_rs)} (${esc(m.kab_kota)}, ${esc(m.provinsi)})</li>`).join("")}</ul>` : ""}
    ${spotCheckHTML()}
    <h2>SIRS vs Kemenkes DREAMS</h2>
    <p class="lede">DREAMS is a second Kemenkes source (from SISDMK, the national health worker register). It only covers public hospitals and the 7 basic specialists, but it splits each count into civil servant, hospital-employed and contract staff. Scores still use SIRS; the "Kemenkes count" column lets you check them.</p>
    <div class="kpis">
      <div class="kpi"><b>${q.dreams_matched} / ${q.dreams_total}</b><span>DREAMS hospitals matched to SIRS</span></div>
      <div class="kpi"><b>${(q.dreams_pairs - q.dreams_disagree.length).toLocaleString()} / ${q.dreams_pairs.toLocaleString()}</b><span>Hospital–specialty counts where both sources agree</span></div>
      <div class="kpi mod"><b>${q.dreams_disagree.filter(x => x[2] === 0 && x[3] > 0).length}</b><span>SIRS says zero, DREAMS says there is at least one (may be a false "missing" flag)</span></div>
      <div class="kpi"><b>${q.dreams_disagree.filter(x => x[2] > 0 && x[3] === 0).length}</b><span>SIRS has some, DREAMS says zero</span></div>
    </div>
    <h2>Where the two sources disagree (${q.dreams_disagree.length})</h2>
    <div class="table-wrap" style="max-height:420px;overflow-y:auto"><table><thead><tr><th>Hospital</th><th>Kab/kota</th><th>Specialty</th><th class="r">SIRS</th><th class="r">DREAMS</th><th class="r">Difference</th></tr></thead><tbody>
      ${q.dreams_disagree.map(([id, code, a, b]) => { const h = D.byId.get(id); return `<tr class="click" data-id="${id}"><td>${esc(h.name)}</td><td>${esc(h.kab)}, ${esc(h.prov)}</td><td>${esc(code)}</td><td class="r num${a === 0 ? " cell-zero" : ""}">${a}</td><td class="r num${b === 0 ? " cell-zero" : ""}">${b}</td><td class="r num">${b - a > 0 ? "+" : ""}${b - a}</td></tr>`; }).join("")}</tbody></table></div>
    ${q.dreams_unmatched.length ? `<h2>DREAMS hospitals not matched to SIRS (${q.dreams_unmatched.length})</h2>
      <div class="table-wrap"><table><thead><tr><th>DREAMS name</th><th>Kab/kota</th><th>Class</th><th>Closest SIRS hospitals</th></tr></thead><tbody>
      ${q.dreams_unmatched.map(u => `<tr><td>${esc(u.nama)}</td><td>${esc(u.kab_kota)}</td><td>${esc(u.kelas)}</td><td class="note">${u.candidates.map(c => `${esc(c.nama)} (${Math.round(c.score * 100)}%)`).join("<br>") || "None in this kab/kota"}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <h2>Inputs that are not available</h2>
    <ul class="prose">
      <li>Operating start date: SIRS doesn't publish it, so the new-hospital boost (+10) is not applied to any hospital.</li>
      <li>Official vacancies (SSCASN/PPPK, PGDS): no data loaded, so the vacancy override is off.</li>
      <li>Full-time vs part-time: SIRS gives one count per specialty, so raw counts are used. A doctor working at three hospitals is counted at each.</li>
      <li>Population: ${esc(D.meta.population_source)}. BPS blocks automated downloads; replace data/population_kabkota.csv with BPS figures to use them.${q.missing_population.length ? ` No population for: ${esc(q.missing_population.join(", "))}.` : " Every kab/kota with a hospital has a population figure."}</li>
    </ul>
    <h2>Specialty labels that could not be mapped (${q.unmapped_labels.reduce((s, x) => s + x[1], 0)} doctors)</h2>
    <p class="lede">These SIRS labels are ambiguous (for example "Subspesialis Kardiovaskular" can sit under internal medicine or cardiology), so they are left out of every count rather than guessed.</p>
    <div class="table-wrap"><table><thead><tr><th>SIRS label</th><th class="r">Doctors</th></tr></thead><tbody>${q.unmapped_labels.map(([t, n]) => `<tr><td>${esc(t)}</td><td class="r num">${n}</td></tr>`).join("")}</tbody></table></div>
    <h2>Hospitals with no bed count</h2>
    <p class="lede">They are compared with the smallest hospitals (under 50 beds).</p>
    <div class="table-wrap"><table><thead><tr><th>Hospital</th><th>Kab/kota</th><th>Type</th><th>Class</th></tr></thead><tbody>${missingBeds.map(h => `<tr class="click" data-id="${h.id}"><td>${esc(h.name)}</td><td>${esc(h.kab)}, ${esc(h.prov)}</td><td>${esc(h.type)}</td><td data-sort="${classIndex(h)}">${classBadge(h)}</td></tr>`).join("") || '<tr><td>None</td></tr>'}</tbody></table></div>`;
  el.querySelectorAll("tr[data-id]").forEach(tr => tr.onclick = () => selectHospital(D.byId.get(tr.dataset.id)));
  el.querySelectorAll("form.review").forEach(form => form.addEventListener("submit", saveReview));
  el.querySelectorAll("tr.spot button").forEach(b => b.addEventListener("click", saveSpot));
}
const VERDICTS = { "": "Not checked yet", flag_right: "Flag is right (doctor really missing)", flag_wrong: "Flag is wrong (doctor is there)",
  sirs_right: "SIRS is right", dreams_right: "DREAMS is right", inconclusive: "Couldn't confirm" };
function spotCheckHTML() {
  const rows = D.quality.spot_check || [];
  if (!rows.length) return "";
  const done = rows.filter(r => r.verdict && r.verdict !== "inconclusive");
  const wrong = done.filter(r => ["flag_wrong", "dreams_right"].includes(r.verdict)).length;
  const counts = rows.reduce((m, r) => (m[r.verdict || ""] = (m[r.verdict || ""] || 0) + 1, m), {});
  const STRATA = { contradicted: "SIRS 0, DREAMS has some", both_zero: "Both sources 0", private: "Private (SIRS only)" };
  return `<h2>Spot check: are the high-need flags real?</h2>
    <p class="lede">A fixed random sample of ${rows.length} high-need flags (scripts/spot_check_sample.py). Call the hospital, or check its own doctor schedule, then record what you found. Results are saved to data/spot_check.csv.
      ${done.length ? `So far ${done.length} confirmed: the flag was wrong in ${wrong} (${Math.round(wrong / done.length * 100)}%).` : "No flag has been confirmed either way yet."}</p>
    <div class="chips">${Object.entries(counts).map(([k, n]) => `<span class="chip">${esc(VERDICTS[k] || k)}: ${n}</span>`).join("")}</div>
    ${state.canSave ? "" : READ_ONLY_NOTE}
    <div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>Group</th><th>Hospital</th><th>Specialty</th><th class="r">SIRS</th><th class="r">DREAMS</th><th class="r">Found</th><th>Verdict</th><th>Source / note</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="spot" data-h="${esc(r.hospital_id)}" data-s="${esc(r.specialty)}"><td>${esc(STRATA[r.stratum] || r.stratum)}</td>
      <td>${esc(r.hospital)}<div class="note">${esc(r.kab_kota)}, ${esc(r.province)}</div></td><td>${esc(r.specialty)}</td>
      <td class="r num">${esc(r.sirs_count)}</td><td class="r num">${esc(r.dreams_count || "–")}</td>
      ${state.canSave
        ? `<td class="r"><input class="sc-n" type="number" min="0" value="${esc(r.verified_count)}" aria-label="Doctors found" style="width:4.5em"></td>
           <td><select class="sc-v" aria-label="Verdict">${Object.entries(VERDICTS).map(([k, t]) => `<option value="${k}" ${k === r.verdict ? "selected" : ""}>${esc(t)}</option>`).join("")}</select></td>
           <td><input class="sc-u" type="text" placeholder="Source link" value="${esc(r.source_url)}" aria-label="Source link"><input class="sc-note" type="text" placeholder="Note" value="${esc(r.note)}" aria-label="Note"></td>
           <td><button type="button">Save</button><div class="status note">${r.checked_on ? "Checked " + esc(r.checked_on) : ""}</div></td>`
        : `<td class="r num">${esc(r.verified_count || "–")}</td><td data-sort="${esc(r.verdict)}">${esc(VERDICTS[r.verdict] || r.verdict)}</td>
           <td class="note">${r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">source</a> · ` : ""}${esc(r.note)}${r.checked_on ? ` (${esc(r.checked_on)})` : ""}</td><td></td>`}</tr>`).join("")}</tbody></table></div>`;
}
async function saveSpot(e) {
  const tr = e.target.closest("tr"), status = tr.querySelector(".status");
  e.target.disabled = true;
  status.textContent = "Saving…";
  const body = { hospital_id: tr.dataset.h, specialty: tr.dataset.s, verified_count: tr.querySelector(".sc-n").value,
    verdict: tr.querySelector(".sc-v").value, source_url: tr.querySelector(".sc-u").value, note: tr.querySelector(".sc-note").value };
  try {
    const res = await fetch("api/spotcheck", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || "Server error");
    await loadData();
    render();
  } catch (err) {
    status.textContent = `Not saved: ${err.message}`;
    e.target.disabled = false;
  }
}
function reviewItem(m, i, gov) {
  const tiers = Object.entries(m.tiers).map(([s, t]) => `${SERVICE_NAMES[s]} ${t}`).join(" · ");
  const opts = gov.map(h => `<option value="${h.id} — ${esc(h.name)} (${esc(h.kab)})"></option>`).join("");
  return `<form class="review" data-key="${esc(m.kmk_key)}">
    <h3>${esc(m.nama_rs)}</h3>
    <div class="note">${esc(m.kab_kota)}, ${esc(m.provinsi)} · ${esc(tiers)} · <a href="kmk.pdf#page=${m.halaman_pdf}" target="_blank" rel="noopener">KMK p. ${m.halaman_pdf}</a></div>
    ${m.candidates.map((c, j) => `<label><input type="radio" name="c${i}" value="${c.kode}" ${j === 0 ? "checked" : ""}> ${esc(c.nama)} <span class="note">${esc(c.kab_kota)} · similarity ${Math.round(c.score * 100)}%</span></label>`).join("")}
    <label><input type="radio" name="c${i}" value="other"> Another government hospital:
      <input type="text" list="gov${i}" placeholder="Type to search this province"><datalist id="gov${i}">${opts}</datalist></label>
    <label><input type="radio" name="c${i}" value=""> Not in SIRS (keep without pillar B)</label>
    <div class="row"><button type="submit" ${state.canSave ? "" : "disabled"}>Save</button><span class="status">${state.canSave ? "" : "Read-only copy: run python app.py on your PC to save."}</span></div></form>`;
}
async function saveReview(e) {
  e.preventDefault();
  const form = e.target, status = form.querySelector(".status"), btn = form.querySelector("button");
  const choice = form.querySelector("input[type=radio]:checked")?.value ?? "";
  let kode = choice;
  if (choice === "other") {
    kode = (form.querySelector("input[type=text]").value.match(/^(\S+) —/) || [])[1];
    if (!kode) { status.textContent = "Pick a hospital from the suggestions first."; return; }
  }
  btn.disabled = true;
  status.textContent = "Saving and recalculating scores…";
  try {
    const res = await fetch("api/match", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ kmk_key: form.dataset.key, sirs_kode: kode }) });
    const out = await res.json();
    if (!out.ok) throw new Error(out.error || "Server error");
    await loadData();
    render();
  } catch (err) {
    status.textContent = `Not saved: ${err.message}. Is app.py still running?`;
    btn.disabled = false;
  }
}

// ---------- about ----------
function renderAbout() {
  const acc = accuracyStats();
  $("view-about").innerHTML = `<div class="prose">
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
    </ul></div>`;
}

// ---------- shell ----------
// ---------- sortable tables ----------
// Click a header: ascending, click again: descending. Empty and "n/a" cells always go last.
const sortState = {};
const SPEC_SORT_KEYS = [
  x => x[2], x => x[0].name.toLowerCase(), x => x[0].kab.toLowerCase(), x => x[0].own, x => x[0].type, x => classIndex(x[0]), x => x[0].beds,
  x => x[1][1], x => (dreamsOf(x[0], x[1][0]) || [null, null, null, null])[3], x => x[1][2], x => x[1][7], x => x[1][8], x => (D.reasons[x[1][9][0]] || null),
];
function cellValue(td) {
  if (!td) return null;
  const raw = (td.dataset.sort ?? td.innerText).trim();
  if (raw === "" || raw === "n/a") return null;
  const num = raw.replace(/[,×%\s]/g, "");
  return /^-?\d+(\.\d+)?$/.test(num) ? Number(num) : raw.toLowerCase();
}
function compareValues(a, b, dir) {
  if (a === null || a === undefined) return b === null || b === undefined ? 0 : 1;
  if (b === null || b === undefined) return -1;
  const c = typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), undefined, { numeric: true });
  return dir === "asc" ? c : -c;
}
function markHeaders(table, st) {
  table.querySelectorAll("thead th").forEach(th => {
    th.setAttribute("aria-sort", st && th.cellIndex === st.col ? (st.dir === "asc" ? "ascending" : "descending") : "none");
  });
}
function sortTable(table, st) {
  markHeaders(table, st);
  if (!st || table.dataset.sortmode === "data") return;
  const body = table.tBodies[0];
  const rows = [...body.rows];
  if (rows.length < 2) return;
  rows.sort((a, b) => compareValues(cellValue(a.cells[st.col]), cellValue(b.cells[st.col]), st.dir));
  body.append(...rows);
}
function makeSortable(container) {
  container.querySelectorAll("table").forEach((table, i) => {
    if (!table.tHead) return;
    const key = `${container.id}:${i}`;
    table.querySelectorAll("thead th").forEach(th => {
      th.tabIndex = 0;
      th.title = th.title || "Click to sort";
      const go = () => {
        const cur = sortState[key];
        sortState[key] = { col: th.cellIndex, dir: cur && cur.col === th.cellIndex && cur.dir === "asc" ? "desc" : "asc" };
        if (table.dataset.sortmode === "data") { render(); return; }
        sortTable(table, sortState[key]);
      };
      th.onclick = go;
      th.onkeydown = e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); } };
    });
    sortTable(table, sortState[key]);
  });
}

function render() {
  const view = (location.hash || "#map").slice(1);
  state.view = ["map", "overview", "specialty", "hospital", "region", "quality", "about"].includes(view) ? view : "map";
  document.querySelectorAll(".rail a").forEach(a => a.classList.toggle("on", a.dataset.view === state.view));
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== `view-${state.view}`);
  $("filters").hidden = state.view === "about";
  $("reviewBadge").hidden = !D.quality.review.length;
  $("reviewBadge").textContent = D.quality.review.length;
  ({
    map: () => { map.invalidateSize(); renderMap(); if (state.selected) openDrawer(state.selected); else $("drawer").hidden = true; },
    overview: renderOverview, specialty: renderSpecialty, hospital: renderHospital, region: renderRegion, quality: renderQuality, about: renderAbout,
  })[state.view]();
  if (state.view !== "map") makeSortable($(`view-${state.view}`));
}
async function loadData() {
  const res = await fetch("data.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`data.json: ${res.status}`);
  const keepId = state.selected?.id;
  const old = D?.byId;
  D = await res.json();
  D.byId = new Map();
  for (const h of D.hospitals) {
    D.byId.set(h.id, h);
    h.maxLevel = Math.max(...h.scores.map(r => r[8]));
    h.maxTotal = Math.max(...h.scores.map(r => r[7]));
    if (old?.get(h.id)?.marker) h.marker = old.get(h.id).marker.off("click").on("click", () => selectHospital(h));
  }
  state.selected = keepId ? D.byId.get(keepId) : null;
  $("meta").innerHTML = `SIRS data ${esc(D.meta.sirs_downloaded)}<br>Scores built ${esc(D.meta.built)}<br>${D.hospitals.length.toLocaleString()} hospitals`;
}
async function start() {
  try {
    await loadData();
  } catch (err) {
    $("loading").textContent = `Could not load data.json (${err.message}). Start the dashboard with "python app.py".`;
    return;
  }
  try { state.canSave = (await fetch("api/ping", { cache: "no-store" })).ok; } catch (e) { state.canSave = false; }
  const provs = [...new Set(D.hospitals.map(h => h.prov))].sort();
  fillSelect($("f-prov"), provs.map(p => [p, p]));
  fillSelect($("f-type"), [...new Set(D.hospitals.map(h => h.type))].sort().map(t => [t, t]));
  fillSelect($("f-spec"), D.specialties.map((s, i) => [i, `${s.name} (${s.code})`]));
  refreshKabOptions();
  initMap();
  let timer;
  $("filters").addEventListener("input", e => {
    if (e.target.id === "f-prov") refreshKabOptions();
    state.specLimit = PAGE_SIZE;
    clearTimeout(timer);
    timer = setTimeout(render, e.target.id === "f-q" ? 200 : 0);
  });
  $("filters").addEventListener("submit", e => e.preventDefault());
  $("f-reset").onclick = () => { $("filters").reset(); refreshKabOptions(); render(); };
  window.addEventListener("hashchange", render);
  $("loading").hidden = true;
  render();
}
start();
