"use strict";
// Specialist demand dashboard. Data comes from dashboard/data.json (build_dashboard.py); text from i18n.js.
// Score rows: [specIndex, n, peerMedian, A, B, C, D, total, labelIndex, reasonIds, kmkService]

const LABELS = ["Low", "Moderate", "High"]; // CSV export keeps English labels
const LEVEL_VAR = ["--low", "--mod", "--high"];
const OWNERS = ["Government", "Private", "TNI/Polri", "BUMN"];
const SHAPES = { Government: "circle", Private: "diamond", "TNI/Polri": "triangle", BUMN: "square" };
const BANDS = [[0, 50], [50, 100], [100, 200], [200, 250], [250, 500], [500, 1e9]];
const SIZE_STEPS = [[0, 10], [100, 14], [250, 18], [500, 23]];
const JAVA = [[-8.85, 105.1], [-5.85, 114.6]];
const PAGE_SIZE = 300, HOSP_PAGE = 200, CORE = 19;
// Hospital class (kelas) as SIRS reports it, in size order. "Non Kelas"/"Belum Ditetapkan" become "Not set".
const CLASSES = ["A", "B", "C", "D", "D Pratama", "Not set"];
const CLASS_VAR = ["--kA", "--kB", "--kC", "--kD", "--kDP", "--kX"];

// ---------- settings: language and theme ----------
const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* storage blocked: setting lasts this visit only */ } },
};
let lang = store.get("lang", "en") === "id" ? "id" : "en";
let theme = store.get("theme", "system");
const t = (key, ...args) => { const v = STRINGS[lang][key] ?? STRINGS.en[key]; return typeof v === "function" ? v(...args) : v; };
const num = n => Number(n).toLocaleString(lang === "id" ? "id-ID" : "en-US");
function applyTheme() {
  if (theme === "light" || theme === "dark") document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
}

// ---------- helpers ----------
let D = null;
const state = { view: "map", selected: null, specLimit: PAGE_SIZE, hospLimit: HOSP_PAGE, allSpecs: false, canSave: false };
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();
const fmt = x => (x == null ? "n/a" : Number.isInteger(x) ? String(x) : x.toFixed(x < 1 ? 2 : 1).replace(/\.0$/, ""));
const bandOf = beds => BANDS.findIndex(([lo, hi]) => beds >= lo && beds < hi);
const lbl = i => `<span class="lbl l${i}">${t("need")[i]}</span>`;
const specLabel = i => lang === "id" ? D.specialties[i].name_id : D.specialties[i].name;
const specName = i => `${specLabel(i)} (${D.specialties[i].code})`;
const ownName = o => t(`own.${o}`);
const reasonText = i => (lang === "id" && D.reasons_id ? D.reasons_id[i] : D.reasons[i]);
const provKey = s => { const k = String(s).toLowerCase().replace(/daerah istimewa|d\.i\./g, "di").replace(/[^a-z]/g, ""); return ({ diyogyakarta: "yogyakarta", dkijakarta: "jakarta", daerahkhususjakarta: "jakarta", kepbangkabelitung: "kepulauanbangkabelitung" })[k] || k; };

const classOf = h => ({ A: "A", B: "B", C: "C", D: "D", "D PRATAMA": "D Pratama" })[h.kelas] || "Not set";
const classIndex = h => CLASSES.indexOf(classOf(h));
const className = c => c === "Not set" ? t("cls.notSet") : c;
const classBadge = (h, long) => {
  const c = classOf(h);
  const text = long ? (c === "Not set" ? t("cls.longNotSet") : t("cls.long", c)) : className(c);
  return `<span class="kelas" style="--k:var(${CLASS_VAR[classIndex(h)]})">${esc(text)}</span>`;
};
const classShort = h => ({ "D Pratama": "Dp", "Not set": "?" })[classOf(h)] || classOf(h);

function pointsText(r) {
  const names = t("parts");
  const parts = [3, 4, 5, 6].filter(i => r[i]).map(i => `+${fmt(r[i])} ${names[i - 3]}`);
  return parts.length ? t("points", parts.join(", "), fmt(r[7])) : t("pointsNone");
}
const pillarTitle = r => t("pillarTitle", fmt(r[7]), pointsText(r));
const scoreCell = r => `<span class="score" title="${esc(pillarTitle(r))}">${fmt(r[7])}</span>`;

// Kemenkes DREAMS count for the 7 basic specialists at public hospitals: [asn, blud, contract, total]
const dreamsOf = (h, si) => h.dreams ? h.dreams[D.specialties[si].code] || null : null;
const sirsMain = (h, r) => r[1] - (h.sub[D.specialties[r[0]].code] || 0);
function dreamsCell(h, r) {
  const d = dreamsOf(h, r[0]);
  if (!d) return `<td class="r num note" data-sort="">–</td>`;
  const main = sirsMain(h, r), differs = d[3] !== main;
  // DREAMS counts base specialists only, so compare against SIRS without its subspecialists.
  const tip = `${t("dreamsTip", d[0], d[1], d[2])} ${t("sirsNote", main, r[1] - main)}${differs ? t("differs") : t("same")}`;
  return `<td class="r num${differs ? " cell-half" : ""}" data-sort="${d[3]}" title="${esc(tip)}">${d[3]}</td>`;
}

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

// ---------- multi-select filters ----------
// Each filter is a dropdown of checkboxes; nothing ticked means "all".
const MS = {};
function msDefine(key, label, allText, options, { search = false } = {}) {
  const prev = MS[key];
  MS[key] = { key, label, allText, options, search, values: prev ? prev.values : new Set() };
  const valid = new Set(options.map(o => String(o[0])));
  for (const v of [...MS[key].values]) if (!valid.has(v)) MS[key].values.delete(v);
}
function msButtonText(m) {
  if (!m.values.size) return m.allText;
  if (m.values.size === 1) { const v = [...m.values][0]; return (m.options.find(o => String(o[0]) === v) || [, v])[1]; }
  return t("ms.nSel", m.values.size);
}
function msHTML(m) {
  return `<div class="f ms" data-ms="${m.key}"><span>${esc(m.label)}</span>
    <button type="button" class="ms-btn${m.values.size ? " active" : ""}" aria-haspopup="true" aria-expanded="false">${esc(msButtonText(m))}</button>
    <div class="ms-pop" hidden>
      ${m.search ? `<input type="search" placeholder="${esc(t("ms.search"))}" aria-label="${esc(m.label)}">` : ""}
      <div class="ms-actions"><span class="ms-count">${m.values.size ? esc(t("ms.nSel", m.values.size)) : ""}</span><button type="button" class="ghost" data-act="clear">${esc(t("ms.clear"))}</button></div>
      <div class="ms-list">${m.options.map(([v, text]) => `<label><input type="checkbox" value="${esc(v)}"${m.values.has(String(v)) ? " checked" : ""}> ${esc(text)}</label>`).join("")}</div>
    </div></div>`;
}
function msWire(root) {
  root.querySelectorAll(".ms").forEach(box => {
    const m = MS[box.dataset.ms], btn = box.querySelector(".ms-btn"), pop = box.querySelector(".ms-pop");
    const refresh = () => {
      btn.textContent = msButtonText(m);
      btn.classList.toggle("active", m.values.size > 0);
      box.querySelector(".ms-count").textContent = m.values.size ? t("ms.nSel", m.values.size) : "";
    };
    btn.onclick = e => {
      e.stopPropagation();
      const open = pop.hidden;
      closeAllMs();
      pop.hidden = !open;
      btn.setAttribute("aria-expanded", String(open));
      // Open toward the left when the dropdown would run off the right edge of the window.
      pop.classList.remove("right");
      if (open && pop.getBoundingClientRect().right > window.innerWidth - 8) pop.classList.add("right");
      if (open) pop.querySelector("input")?.focus();
    };
    pop.onclick = e => e.stopPropagation();
    pop.querySelectorAll("input[type=checkbox]").forEach(cb => cb.onchange = () => {
      cb.checked ? m.values.add(cb.value) : m.values.delete(cb.value);
      refresh();
      onFilterChange(m.key);
    });
    pop.querySelector("[data-act=clear]").onclick = () => {
      m.values.clear();
      pop.querySelectorAll("input[type=checkbox]").forEach(cb => cb.checked = false);
      refresh();
      onFilterChange(m.key);
    };
    const s = pop.querySelector("input[type=search]");
    if (s) s.oninput = () => {
      const q = s.value.trim().toLowerCase();
      pop.querySelectorAll(".ms-list label").forEach(l => l.hidden = q && !l.textContent.toLowerCase().includes(q));
    };
  });
}
function closeAllMs() {
  document.querySelectorAll(".ms-pop").forEach(p => { p.hidden = true; p.parentElement.querySelector(".ms-btn")?.setAttribute("aria-expanded", "false"); });
}
function setFilter(key, values) {
  MS[key].values = new Set(values.map(String));
  if (key === "prov") defineKab();
  renderFilters();
}
function defineKab() {
  const provs = MS.prov.values, kabs = new Map();
  D.hospitals.forEach(h => { if (!provs.size || provs.has(h.prov)) kabs.set(h.kab_id, provs.size === 1 ? h.kab : `${h.kab}, ${h.prov}`); });
  msDefine("kab", t("f.kab"), t("f.all"), [...kabs].sort((a, b) => a[1].localeCompare(b[1])), { search: true });
}
function defineFilters() {
  msDefine("prov", t("f.prov"), t("f.provAll"), [...new Set(D.hospitals.map(h => h.prov))].sort().map(p => [p, p]), { search: true });
  defineKab();
  msDefine("own", t("f.own"), t("f.all"), OWNERS.map(o => [o, ownName(o)]));
  msDefine("type", t("f.type"), t("f.all"), [...new Set(D.hospitals.map(h => h.type))].sort().map(x => [x, x]));
  msDefine("kelas", t("f.kelas"), t("f.all"), CLASSES.map(c => [c, c === "Not set" ? t("cls.notSet") : t("cls.long", c)]));
  msDefine("band", t("f.band"), t("f.all"), t("bands").map((b, i) => [i, b]));
  msDefine("spec", t("f.spec"), t("f.specAll"), D.specialties.map((s, i) => [i, specName(i)]), { search: true });
  msDefine("label", t("f.label"), t("f.all"), [[2, t("levelShort")[2]], [1, t("levelShort")[1]], [0, t("levelShort")[0]]]);
}
let searchText = "";
function renderFilters() {
  const form = $("filters");
  form.innerHTML = `<label class="f" for="f-q">${esc(t("f.search"))}<input id="f-q" type="search" placeholder="${esc(t("f.searchPh"))}" value="${esc(searchText)}"></label>
    ${["prov", "kab", "own", "type", "kelas", "band", "spec", "label"].map(k => msHTML(MS[k])).join("")}
    <button type="button" id="f-reset" class="ghost">${esc(t("f.clear"))}</button>`;
  msWire(form);
  let timer;
  $("f-q").oninput = e => { searchText = e.target.value; clearTimeout(timer); timer = setTimeout(() => onFilterChange("q"), 200); };
  $("f-reset").onclick = () => { searchText = ""; Object.values(MS).forEach(m => m.values.clear()); defineKab(); renderFilters(); onFilterChange("reset"); };
}
function onFilterChange(key) {
  if (key === "prov") {
    defineKab();
    const box = document.querySelector('.ms[data-ms="kab"]');
    if (box) { const tmp = document.createElement("div"); tmp.innerHTML = msHTML(MS.kab); box.replaceWith(tmp.firstElementChild); msWire($("filters")); }
  }
  state.specLimit = PAGE_SIZE;
  state.hospLimit = HOSP_PAGE;
  render();
}
const F = () => ({
  q: searchText.trim().toLowerCase(),
  prov: MS.prov.values, kab: MS.kab.values, own: MS.own.values, type: MS.type.values, kelas: MS.kelas.values,
  band: new Set([...MS.band.values].map(Number)), label: new Set([...MS.label.values].map(Number)),
  spec: [...MS.spec.values].map(Number).sort((a, b) => a - b),
});
function hospitalPasses(h, f) {
  if (f.prov.size && !f.prov.has(h.prov)) return false;
  if (f.kab.size && !f.kab.has(h.kab_id)) return false;
  if (f.own.size && !f.own.has(h.own)) return false;
  if (f.type.size && !f.type.has(h.type)) return false;
  if (f.kelas.size && !f.kelas.has(classOf(h))) return false;
  if (f.band.size && !f.band.has(bandOf(h.beds))) return false;
  if (f.q && !(h.name.toLowerCase().includes(f.q) || h.kab.toLowerCase().includes(f.q))) return false;
  return true;
}
// With several specialties chosen, a hospital's level is its most urgent one among them.
function levelOf(h, f) { return f.spec.length ? Math.max(...f.spec.map(i => h.scores[i][8])) : h.maxLevel; }
function visibleHospitals(f = F()) {
  return D.hospitals.filter(h => hospitalPasses(h, f) && (!f.label.size || f.label.has(levelOf(h, f))));
}
// (hospital, specialty) pairs that pass every filter, including need level
function visiblePairs(f = F()) {
  const out = [];
  for (const h of D.hospitals) {
    if (!hospitalPasses(h, f)) continue;
    const rows = f.spec.length ? f.spec.map(i => h.scores[i]) : h.scores;
    for (const r of rows) if (!f.label.size || f.label.has(r[8])) out.push([h, r]);
  }
  return out;
}

// ---------- reasons ----------
function reasonsHTML(h, r, tag = "div", limit) {
  return r[9].slice(0, limit ?? r[9].length).map(i => {
    let text = esc(reasonText(i));
    if (D.reasons[i].includes("KMK 1277") && h.kmk) text += ` <a href="kmk.pdf#page=${h.kmk.page}" target="_blank" rel="noopener">${t("pageRef", h.kmk.page)}</a>`;
    return `<${tag}>${text}</${tag}>`;
  }).join("");
}
const inferred = r => (D.specialties[r[0]].floor && r[3] > 0) || r[4] > 0 ? `<div class="note">${esc(t("inferred"))}</div>` : "";

// ---------- map ----------
let map, markerLayer, layersControl, legendMin = false, colorBy = store.get("colorBy", "need");
const LETTER_ZOOM = 10; // from this zoom on, pins grow and show the class letter
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
const BASE_LAYERS = {
  osm: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png", 19, "osm"],
  light: ["https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", 19, "carto"],
  dark: ["https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", 19, "carto"],
  sat: ["https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", 19, "esri"],
  topo: ["https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png", 17, "topo"],
};
const OVERLAYS = {
  roads: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}",
  places: "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}",
};
const tileLayers = {};
function initMap() {
  map = L.map("map", { zoomControl: true, minZoom: 5 }).fitBounds(JAVA);
  const osm = "&copy; <a href='https://www.openstreetmap.org/copyright'>OpenStreetMap</a> contributors";
  const attrib = { osm, carto: osm + " &copy; CARTO", esri: "Imagery &copy; Esri", topo: osm + " &copy; OpenTopoMap" };
  for (const [k, [url, maxZoom, a]] of Object.entries(BASE_LAYERS)) tileLayers[k] = L.tileLayer(url, { maxZoom, attribution: attrib[a] });
  for (const [k, url] of Object.entries(OVERLAYS)) tileLayers[k] = L.tileLayer(url, { maxZoom: 19, attribution: "&copy; Esri" });
  (tileLayers[store.get("basemap", "osm")] || tileLayers.osm).addTo(map);
  buildLayersControl();
  map.on("baselayerchange", e => store.set("basemap", Object.keys(tileLayers).find(k => tileLayers[k] === e.layer) || "osm"));
  markerLayer = L.layerGroup().addTo(map);
  let lastLetters = false;
  map.on("zoomend", () => { const on = map.getZoom() >= LETTER_ZOOM; if (on !== lastLetters) { lastLetters = on; renderMap(); } });
  const renderer = L.canvas({ padding: 0.5, tolerance: 4 });
  D.hospitals.forEach(h => {
    if (h.lat == null) return;
    h.marker = new ShapeMarker([h.lat, h.lng], { renderer, shape: SHAPES[h.own] })
      .bindTooltip(() => `${esc(h.name)} · ${esc(classOf(h) === "Not set" ? t("cls.longNotSet") : t("cls.long", classOf(h)))}`, { direction: "top", offset: [0, -6] })
      .on("click", () => selectHospital(h));
  });
}
// Rebuilt when the language changes, so layer names follow it.
function buildLayersControl() {
  if (layersControl) layersControl.remove();
  const names = t("layers");
  const base = Object.fromEntries(Object.keys(BASE_LAYERS).map(k => [names[k], tileLayers[k]]));
  const over = Object.fromEntries(Object.keys(OVERLAYS).map(k => [names[k], tileLayers[k]]));
  // Top left, under the zoom buttons, so the hospital drawer on the right never covers it.
  layersControl = L.control.layers(base, over, { position: "topleft" }).addTo(map);
}
function renderNotice() {
  const el = $("notice");
  let hidden = false;
  try { hidden = sessionStorage.getItem("noticeHidden") === "1"; } catch (e) { /* storage blocked: show it */ }
  if (hidden) { el.hidden = true; return; }
  el.hidden = false;
  el.innerHTML = `<span>${t("notice", accuracyStats().share)} <a href="#about">${esc(t("dataLimits"))}</a></span>
    <button type="button" class="close" id="noticeClose" aria-label="${esc(t("noticeHide"))}">×</button>`;
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
  renderLegend(f, list.length);
}
function renderLegend(f, shown) {
  const el = $("legend");
  el.className = "legend" + (legendMin ? " min" : "");
  const what = f.spec.length === 1 ? t("what.one", specLabel(f.spec[0])) : f.spec.length > 1 ? t("what.many", f.spec.length) : t("what.any");
  const need = t("need");
  const sw = (lvl, label) => `<span>${shapeSVG("circle", 12, css(LEVEL_VAR[lvl]), css("--panel"))}${esc(label)}</span>`;
  const shp = own => `<span>${shapeSVG(SHAPES[own], 13, css("--muted"), css("--panel"))}${esc(ownName(own))}</span>`;
  el.innerHTML = `
    <button type="button" class="ghost legend-toggle" id="legendToggle">${esc(legendMin ? t("legend.show") : t("legend.hide"))}</button>
    <div class="seg" role="group">
      <button type="button" class="${colorBy === "need" ? "" : "ghost"}" data-color="need">${esc(t("legend.colorNeed"))}</button>
      <button type="button" class="${colorBy === "class" ? "" : "ghost"}" data-color="class">${esc(t("legend.colorClass"))}</button></div>
    ${colorBy === "class"
      ? `<div><h4>${esc(t("legend.classTitle"))}</h4><div class="row">${CLASSES.map((c, i) => `<span>${shapeSVG("circle", 12, css(CLASS_VAR[i]), css("--panel"))}${esc(c === "Not set" ? t("cls.notSet") : t("cls.long", c))}</span>`).join("")}</div></div>`
      : `<div><h4>${esc(t("legend.needTitle", what))}</h4><div class="row">${sw(2, need[2])}${sw(1, need[1])}${sw(0, t("legend.lowOrNone"))}</div></div>`}
    <div class="note">${esc(t("legend.letters"))}</div>
    <div><h4>${esc(t("legend.shape"))}</h4><div class="row">${OWNERS.map(shp).join("")}</div></div>
    <div><h4>${esc(t("legend.size"))}</h4><div class="row">${SIZE_STEPS.map(([, px], i) => `<span>${shapeSVG("circle", px, "transparent", css("--muted"))}${esc(t("sizes")[i])}</span>`).join("")}</div></div>
    <div class="row"><span>${shapeSVG("circle", 13, css("--low"), css("--approx"), true, 2)}${esc(t("legend.approx"))}</span></div>
    <div class="note">${esc(t("legend.shown", num(shown)))}</div>`;
  $("legendToggle").onclick = () => { legendMin = !legendMin; renderLegend(f, shown); };
  el.querySelectorAll("[data-color]").forEach(b => b.onclick = () => { colorBy = b.dataset.color; store.set("colorBy", colorBy); renderMap(); });
}

function needsHTML(h) {
  const f = F();
  let rows = h.scores.filter(r => r[8] > 0).sort((a, b) => b[8] - a[8] || b[7] - a[7]);
  if (f.spec.length) rows = [...f.spec.map(i => h.scores[i]), ...rows.filter(r => !f.spec.includes(r[0]))];
  if (!rows.length) return `<p class="note">${esc(t("drawer.noNeeds"))}</p>`;
  return rows.map(r => {
    const d = dreamsOf(h, r[0]);
    return `<div class="need">
      <div class="need-head"><b>${esc(specName(r[0]))}</b><span>${lbl(r[8])} <span class="num">${fmt(r[7])}</span></span></div>
      <div class="pillars">${esc(t("drawer.has", fmt(r[1]), fmt(r[2])))}${d ? esc(t("drawer.dreams", d[3], d[3] !== sirsMain(h, r))) : ""}<br>${esc(pointsText(r))}</div>
      ${r[9].length ? `<ul>${reasonsHTML(h, r, "li")}</ul>` : ""}${inferred(r)}</div>`;
  }).join("");
}
function kmkLine(h) {
  if (!h.kmk) return esc(h.own === "Government" ? t("kmk.noneGov") : t("kmk.nonePriv"));
  const tiers = Object.entries(h.kmk.tiers).map(([s, tier]) => `${t("svc")[s]} ${tier}`).join(" · ");
  return `${esc(t("kmk.targets", tiers))} <a href="kmk.pdf#page=${h.kmk.page}" target="_blank" rel="noopener">${t("pageRef", h.kmk.page)}</a>`;
}
function chipsHTML(h) {
  return `<div class="chips"><span class="chip">${esc(ownName(h.own))} · ${esc(h.owner)}</span><span class="chip">${esc(h.type)}</span>
    ${classBadge(h, true)}<span class="chip">${esc(t("chip.beds", h.beds))}</span>
    ${h.approx ? `<span class="chip warn">${esc(t("chip.approx"))}</span>` : ""}</div>`;
}
function openDrawer(h) {
  const dr = $("drawer");
  const highs = h.scores.filter(r => r[8] === 2).length, mods = h.scores.filter(r => r[8] === 1).length;
  dr.innerHTML = `<button type="button" class="close" id="drawerClose" aria-label="${esc(t("close"))}">×</button>
    <h2>${esc(h.name)}</h2>${chipsHTML(h)}
    <div class="meta-text">${esc(h.address)}<br>${esc(h.kab)}, ${esc(h.prov)}<br>${kmkLine(h)}</div>
    <p class="note">${esc(t("drawer.explain"))}</p>
    <div><b>${esc(t("drawer.highs", highs, mods))}</b></div>
    <div class="needs">${needsHTML(h)}</div>
    <p class="note">${esc(t("drawer.disclaimer"))} <a href="#about">${esc(t("dataLimits"))}</a></p>
    <div class="toolbar"><button type="button" id="drawerFull">${esc(t("drawer.full"))}</button>
      <a href="https://sirs.kemkes.go.id/fo/home/profile_rs/${h.id}" target="_blank" rel="noopener">${esc(t("drawer.sirs"))}</a></div>`;
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
  const pairs = visiblePairs({ ...f, label: new Set() });
  const hs = new Set(pairs.map(p => p[0]));
  const high = pairs.filter(p => p[1][8] === 2), mod = pairs.filter(p => p[1][8] === 1);
  const hard = pairs.filter(([, r]) => r[1] === 0 && (r[3] > 0 || r[4] > 0));
  const hospHigh = new Set(high.map(p => p[0]));
  const bySpec = new Map();
  high.forEach(([, r]) => bySpec.set(r[0], (bySpec.get(r[0]) || 0) + 1));
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
  const specText = f.spec.length === 1 ? t("ov.specOne", specName(f.spec[0])) : f.spec.length ? t("ov.specMany", f.spec.length) : t("ov.specAny");
  $("view-overview").innerHTML = `
    <h1>${esc(t("ov.title"))}</h1>
    <p class="lede">${esc(t("ov.lede", num(hs.size), specText))}</p>
    <div class="kpis">
      <div class="kpi high"><b>${num(high.length)}</b><span>${esc(t("ov.high"))}</span></div>
      <div class="kpi mod"><b>${num(mod.length)}</b><span>${esc(t("ov.mod"))}</span></div>
      <div class="kpi"><b>${num(hospHigh.size)}</b><span>${esc(t("ov.hospHigh"))}</span></div>
      <div class="kpi"><b>${num(hard.length)}</b><span>${esc(t("ov.hard"))}</span></div>
    </div>
    <h2>${esc(t("ov.mostNeeded"))}</h2>
    <div class="bars">${specRows.length ? specRows.map(([si, n]) => `<div class="bar-row" data-spec="${si}" title="${esc(t("ov.barTitle"))}">
      <span>${esc(specName(si))}</span><span class="bar-track"><i style="width:${(n / max) * 100}%"></i></span><span class="num">${num(n)}</span></div>`).join("")
      : `<p class="empty">${esc(t("ov.empty"))}</p>`}</div>
    <h2>${esc(t("ov.byProv"))}</h2>
    <div class="table-wrap"><table><thead><tr><th>${esc(t("ov.thProv"))}</th><th class="r">${esc(t("ov.thHosp"))}</th><th class="r">${esc(t("ov.thHospHigh"))}</th><th class="r">${esc(t("ov.thHigh"))}</th><th class="r">${esc(t("ov.thHard"))}</th></tr></thead>
    <tbody>${provRows.map(([p, v]) => `<tr class="click" data-prov="${esc(p)}"><td>${esc(p)}</td><td class="r num">${num(v.hs.size)}</td><td class="r num">${num(v.highH.size)}</td><td class="r num">${num(v.high)}</td><td class="r num">${num(v.hard)}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">${esc(t("ov.note"))}</p>`;
  $("view-overview").querySelectorAll(".bar-row").forEach(el => el.onclick = () => { setFilter("spec", [el.dataset.spec]); location.hash = "#specialty"; render(); });
  $("view-overview").querySelectorAll("tr[data-prov]").forEach(el => el.onclick = () => { setFilter("prov", [el.dataset.prov]); render(); });
}

// ---------- specialty ----------
const SPEC_SORT_KEYS = [
  x => x[2], x => x[0].name.toLowerCase(), x => specLabel(x[1][0]).toLowerCase(), x => x[0].kab.toLowerCase(), x => x[0].own,
  x => x[0].type, x => classIndex(x[0]), x => x[0].beds, x => x[1][1], x => (dreamsOf(x[0], x[1][0]) || [null, null, null, null])[3],
  x => x[1][2], x => x[1][7], x => x[1][8], x => (x[1][9].length ? reasonText(x[1][9][0]) : null),
];
function renderSpecialty() {
  const f = F(), el = $("view-specialty");
  if (!f.spec.length) {
    el.innerHTML = `<h1>${esc(t("sp.title"))}</h1><p class="lede">${esc(t("sp.pick"))}</p>
      <div class="bars">${D.specialties.map((s, i) => `<div class="bar-row" data-spec="${i}"><span>${esc(specName(i))}</span><span></span><span></span></div>`).join("")}</div>`;
    el.querySelectorAll(".bar-row").forEach(r => r.onclick = () => { setFilter("spec", [r.dataset.spec]); render(); });
    return;
  }
  const rows = visiblePairs(f).sort((a, b) => b[1][7] - a[1][7] || a[1][1] - b[1][1] || b[0].beds - a[0].beds).map((p, i) => [p[0], p[1], i + 1]);
  const st = sortState["view-specialty:0"];
  if (st && SPEC_SORT_KEYS[st.col]) rows.sort((a, b) => compareValues(SPEC_SORT_KEYS[st.col](a), SPEC_SORT_KEYS[st.col](b), st.dir));
  const shown = rows.slice(0, state.specLimit);
  const title = f.spec.length === 1 ? specName(f.spec[0]) : `${t("sp.many", f.spec.length)}: ${f.spec.map(i => D.specialties[i].code).join(", ")}`;
  el.innerHTML = `<h1>${esc(title)}</h1>
    <p class="lede">${esc(t("sp.lede", num(rows.length)))}</p>
    <div class="toolbar"><button type="button" id="exportCsv">${esc(t("sp.export", num(rows.length)))}</button></div>
    <div class="table-wrap"><table data-sortmode="data"><thead><tr><th class="r">${t("th.rank")}</th><th>${esc(t("th.hospital"))}</th><th>${esc(t("th.specialty"))}</th><th>${esc(t("th.kab"))}</th><th>${esc(t("th.own"))}</th><th>${esc(t("th.type"))}</th><th>${esc(t("th.class"))}</th><th class="r">${esc(t("th.beds"))}</th>
      <th class="r">${esc(t("th.has"))}</th><th class="r" title="${esc(t("th.kemenkesTitle"))}">${esc(t("th.kemenkes"))}</th><th class="r">${esc(t("th.similar"))}</th><th class="r">${esc(t("th.score"))}</th><th>${esc(t("th.need"))}</th><th>${esc(t("th.reason"))}</th></tr></thead>
    <tbody>${shown.map(([h, r, rank]) => `<tr class="click" data-id="${h.id}"><td class="r num">${rank}</td><td>${esc(h.name)}</td><td>${esc(D.specialties[r[0]].code)}</td><td>${esc(h.kab)}<div class="note">${esc(h.prov)}</div></td>
      <td>${esc(ownName(h.own))}</td><td>${esc(h.type)}</td><td>${classBadge(h)}</td><td class="r num">${h.beds}</td><td class="r num">${fmt(r[1])}</td>${dreamsCell(h, r)}<td class="r num">${fmt(r[2])}</td>
      <td class="r">${scoreCell(r)}</td><td data-sort="${r[8]}">${lbl(r[8])}</td><td class="reasons">${reasonsHTML(h, r, "div", 1)}</td></tr>`).join("")}</tbody></table></div>
    ${rows.length > shown.length ? `<div class="toolbar" style="margin-top:12px"><button type="button" class="ghost" id="more">${esc(t("more", Math.min(PAGE_SIZE, rows.length - shown.length)))}</button></div>` : ""}`;
  el.querySelectorAll("tr[data-id]").forEach(tr => tr.onclick = () => selectHospital(D.byId.get(tr.dataset.id)));
  $("exportCsv").onclick = () => exportCsv(rows, `demand_${f.spec.map(i => D.specialties[i].code).join("_")}.csv`);
  if ($("more")) $("more").onclick = () => { state.specLimit += PAGE_SIZE; renderSpecialty(); makeSortable(el); };
}
function exportCsv(rows, filename) {
  const q = v => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const head = ["hospital_id", "hospital", "province", "kab_kota", "ownership", "owner", "type", "class", "beds", "specialty", "count", "peer_median",
    "A_mandatory", "B_kmk", "C_peer", "D_regional", "total", "label", "reasons"];
  const lines = rows.map(([h, r]) => [h.id, h.name, h.prov, h.kab, h.own, h.owner, h.type, classOf(h), h.beds, D.specialties[r[0]].code, r[1], r[2],
    r[3], r[4], r[5], r[6] ?? "n/a", r[7], LABELS[r[8]], r[9].map(reasonText).join(" | ")].map(q).join(","));
  const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\r\n")], { type: "text/csv" });
  const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download: filename });
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ---------- hospitals ----------
// Hospital × specialty grid: rows are hospitals, cells show doctors on staff, colored by need level.
function renderHospitalMatrix(el) {
  const f = F();
  const cols = state.allSpecs ? D.specialties.map((_, i) => i) : D.specialties.map((_, i) => i).slice(0, CORE);
  f.spec.forEach(i => { if (!cols.includes(i)) cols.push(i); });
  const chosen = new Set(f.spec);
  const highCount = x => x.scores.filter(r => r[8] === 2).length;
  // Fixed columns, then one per specialty; each entry is the value a header click sorts by.
  const keys = [x => x.name.toLowerCase(), x => x.kab.toLowerCase(), x => classIndex(x), x => x.beds, x => highCount(x), ...cols.map(si => x => x.scores[si][7])];
  let list = visibleHospitals(f).sort((a, b) => highCount(b) - highCount(a) || b.maxTotal - a.maxTotal);
  const st = sortState["view-hospital:0"];
  if (st && keys[st.col]) list = list.sort((a, b) => compareValues(keys[st.col](a), keys[st.col](b), st.dir));
  const shown = list.slice(0, state.hospLimit);
  const need = t("need");
  const cell = (x, si) => {
    const r = x.scores[si];
    const tip = t("hm.tip", specLabel(si), fmt(r[1]), fmt(r[7]), need[r[8]], r[9].length ? reasonText(r[9][0]) : "");
    return `<td class="r num need-${r[8]}${chosen.has(si) ? " col-hl" : ""}" title="${esc(tip)}">${fmt(r[1])}</td>`;
  };
  el.innerHTML = `<h1>${esc(t("hm.title"))}</h1>
    <p class="lede">${esc(t("hm.lede"))}</p>
    <p class="note">${lbl(2)} ${lbl(1)} ${lbl(0)} · ${esc(t("hm.note"))}</p>
    <div class="toolbar"><button type="button" class="ghost" id="toggleSpecs">${esc(t("hm.toggle", state.allSpecs, D.specialties.length))}</button>
      <span class="note">${esc(t("hm.count", num(list.length)))}</span></div>
    <div class="table-wrap matrix"><table data-sortmode="data"><thead><tr><th>${esc(t("th.hospital"))}</th><th>${esc(t("th.kab"))}</th><th>${esc(t("th.class"))}</th><th class="r">${esc(t("th.beds"))}</th><th class="r" title="${esc(t("hm.highsTitle"))}">${esc(t("hm.highs"))}</th>
      ${cols.map(si => `<th class="r${chosen.has(si) ? " col-hl" : ""}" title="${esc(specLabel(si))}">${esc(D.specialties[si].code)}</th>`).join("")}</tr></thead>
    <tbody>${shown.map(x => `<tr class="click" data-id="${x.id}"><td class="sticky">${esc(x.name)}<div class="note">${esc(ownName(x.own))} · ${esc(x.type)}</div></td>
      <td>${esc(x.kab)}<div class="note">${esc(x.prov)}</div></td><td>${classBadge(x)}</td><td class="r num">${x.beds}</td><td class="r num"><b>${highCount(x)}</b></td>
      ${cols.map(si => cell(x, si)).join("")}</tr>`).join("")}</tbody></table></div>
    ${list.length > shown.length ? `<div class="toolbar" style="margin-top:12px"><button type="button" class="ghost" id="moreHosp">${esc(t("more", Math.min(HOSP_PAGE, list.length - shown.length)))}</button></div>` : ""}`;
  el.querySelectorAll("tr[data-id]").forEach(tr => tr.onclick = () => selectHospital(D.byId.get(tr.dataset.id)));
  $("toggleSpecs").onclick = () => { state.allSpecs = !state.allSpecs; delete sortState["view-hospital:0"]; render(); };
  if ($("moreHosp")) $("moreHosp").onclick = () => { state.hospLimit += HOSP_PAGE; renderHospitalMatrix(el); makeSortable(el); };
}
function renderHospital() {
  const el = $("view-hospital"), h = state.selected;
  if (!h) { renderHospitalMatrix(el); return; }
  const rows = [...h.scores].sort((a, b) => b[7] - a[7] || b[2] - a[2]);
  const subNote = Object.keys(h.sub).length ? t("hd.sub", Object.entries(h.sub).map(([c, n]) => `${c} ${n}`).join(", ")) : "";
  const src = h.own === "Private" ? t("hd.srcPriv") : h.dreams ? t("hd.srcPub") : t("hd.srcNone");
  const th = (key, title) => `<th class="r"${title ? ` title="${esc(t(title))}"` : ""}>${t(key)}</th>`;
  el.innerHTML = `<div class="toolbar"><button type="button" class="ghost" id="backList">${esc(t("hd.back"))}</button><button type="button" class="ghost" id="showMap">${esc(t("hd.map"))}</button></div>
    <h1>${esc(h.name)}</h1>${chipsHTML(h)}
    <p class="lede" style="margin-top:8px">${esc(h.address)} · ${esc(h.kab)}, ${esc(h.prov)}<br>${kmkLine(h)}<br>
    ${esc(t("hd.compare", h.peers, h.type, h.band))} ${esc(subNote)}
    <a href="https://sirs.kemkes.go.id/fo/home/profile_rs/${h.id}" target="_blank" rel="noopener">${esc(t("drawer.sirs"))}</a></p>
    <div class="table-wrap"><table><thead><tr><th>${esc(t("th.specialty"))}</th><th class="r">${esc(t("th.has"))}</th><th class="r" title="${esc(t("th.kemenkesTitle"))}">${esc(t("th.kemenkes"))}</th><th class="r">${esc(t("th.similar"))}</th>
      ${th("hd.thBasic", "hd.thBasicT")}${th("hd.thPlan", "hd.thPlanT")}${th("hd.thSimilar", "hd.thSimilarT")}${th("hd.thArea", "hd.thAreaT")}${th("hd.thScore")}<th>${esc(t("th.need"))}</th><th>${esc(t("hd.thWhy"))}</th></tr></thead>
    <tbody>${rows.map(r => `<tr><td>${esc(specName(r[0]))}</td><td class="r num">${fmt(r[1])}</td>${dreamsCell(h, r)}<td class="r num">${fmt(r[2])}</td>
      <td class="r num">${fmt(r[3])}</td><td class="r num">${fmt(r[4])}</td><td class="r num">${fmt(r[5])}</td><td class="r num">${r[6] == null ? "n/a" : fmt(r[6])}</td>
      <td class="r num"><b>${fmt(r[7])}</b></td><td data-sort="${r[8]}">${lbl(r[8])}</td><td class="reasons">${reasonsHTML(h, r)}${r[8] ? inferred(r) : ""}</td></tr>`).join("")}</tbody></table></div>
    <p class="note">${esc(src)} ${esc(t("hd.selfReported"))} <a href="#about">${esc(t("dataLimits"))}</a></p>
    <p class="note">${esc(t("hd.scoreNote"))}</p>`;
  $("backList").onclick = () => { state.selected = null; render(); };
  $("showMap").onclick = () => { location.hash = "#map"; setTimeout(() => selectHospital(h, true), 50); };
}

// ---------- regions ----------
function renderRegion() {
  const f = F(), el = $("view-region");
  const kabProv = new Map();
  D.hospitals.forEach(h => kabProv.set(h.kab_id, h.prov));
  const provs = new Set([...f.prov].map(provKey));
  let kabs = D.kabs.filter(k => (!provs.size || provs.has(provKey(kabProv.get(k.id) || k.prov))) && (!f.kab.size || f.kab.has(k.id)));
  const cls = (count, dens, m) => count === 0 ? "cell-zero" : dens < 0.5 * m ? "cell-half" : dens < m ? "cell-below" : "";
  const dens = (k, si) => k.pop ? k.totals[si] / k.pop * 1e5 : null;
  const legend = `<p class="note">${t("rg.legend")}</p>`;
  if (f.spec.length === 1) {
    const si = f.spec[0], m = D.national_median[si];
    kabs = kabs.sort((a, b) => (dens(a, si) ?? 0) - (dens(b, si) ?? 0) || b.pop - a.pop);
    el.innerHTML = `<h1>${esc(t("rg.oneTitle", specName(si)))}</h1><p class="lede">${esc(t("rg.oneLede", D.kabs.length, fmt(m)))}</p>${legend}
      <div class="table-wrap"><table><thead><tr><th>${esc(t("rg.thKab"))}</th><th>${esc(t("rg.thProv"))}</th><th class="r">${esc(t("rg.thPop"))}</th><th class="r">${esc(t("rg.thHosp"))}</th><th class="r">${esc(t("rg.thDoctors"))}</th><th class="r">${esc(t("rg.thPer"))}</th><th class="r">${esc(t("rg.thVs"))}</th></tr></thead>
      <tbody>${kabs.map(k => { const d = dens(k, si); return `<tr><td>${esc(k.kab)}</td><td>${esc(k.prov)}</td><td class="r num">${num(k.pop)}</td><td class="r num">${k.hospitals}</td>
        <td class="r num ${cls(k.totals[si], d, m)}">${k.totals[si]}</td><td class="r num ${cls(k.totals[si], d, m)}">${fmt(d)}</td><td class="r num">${m ? fmt(d / m) + "×" : "n/a"}</td></tr>`; }).join("")}</tbody></table></div>`;
    return;
  }
  const cols = f.spec.length ? f.spec : D.specialties.map((s, i) => i).slice(0, CORE);
  kabs = kabs.sort((a, b) => a.prov.localeCompare(b.prov) || a.kab.localeCompare(b.kab));
  el.innerHTML = `<h1>${esc(t("rg.title"))}</h1><p class="lede">${esc(t("rg.lede"))}</p>${legend}
    <div class="table-wrap"><table><thead><tr><th>${esc(t("rg.thKab"))}</th><th class="r">${esc(t("rg.thPop"))}</th>${cols.map(i => `<th class="r" title="${esc(specLabel(i))}">${esc(D.specialties[i].code)}</th>`).join("")}</tr>
      <tr><td class="note">${esc(t("rg.typical"))}</td><td></td>${cols.map(i => `<td class="r num note">${fmt(D.national_median[i])}</td>`).join("")}</tr></thead>
    <tbody>${kabs.map(k => `<tr><td>${esc(k.kab)}<div class="note">${esc(k.prov)}</div></td><td class="r num">${num(k.pop)}</td>
      ${cols.map(i => { const d = dens(k, i); return `<td class="r num ${cls(k.totals[i], d, D.national_median[i])}" title="${esc(t("rg.cellTitle", k.totals[i]))}">${fmt(d)}</td>`; }).join("")}</tr>`).join("")}</tbody></table></div>`;
}

// ---------- data quality ----------
function renderQuality() {
  const q = D.quality, el = $("view-quality");
  const govByProv = new Map();
  D.hospitals.forEach(h => { if (["Pemkab", "Pemkot", "Pemprop", "Kemkes"].includes(h.owner)) { const k = provKey(h.prov); (govByProv.get(k) || govByProv.set(k, []).get(k)).push(h); } });
  const missingBeds = q.missing_beds.map(id => D.byId.get(id)).filter(Boolean);
  const popNote = q.missing_population.length ? t("q.popMissing", q.missing_population.join(", ")) : t("q.popOk");
  el.innerHTML = `<h1>${esc(t("q.title"))}</h1>
    <p class="lede">${esc(t("q.lede"))}</p>
    <div class="kpis">
      <div class="kpi"><b>${q.kmk_matched} / ${q.kmk_total}</b><span>${esc(t("q.kmkMatched"))}</span></div>
      <div class="kpi ${q.review.length ? "mod" : ""}"><b>${q.review.length}</b><span>${esc(t("q.waiting"))}</span></div>
      <div class="kpi"><b>${q.approx_location}</b><span>${esc(t("q.approx"))}</span></div>
      <div class="kpi"><b>${missingBeds.length}</b><span>${esc(t("q.noBeds"))}</span></div>
    </div>
    <h2>${esc(t("q.reviewTitle"))}</h2>
    <p class="lede">${esc(t("q.reviewLede"))}</p>
    <div id="reviewList">${q.review.length ? q.review.map((m, i) => reviewItem(m, i, govByProv.get(provKey(m.provinsi)) || [])).join("") : `<p class="empty">${esc(t("q.nothing"))}</p>`}</div>
    ${q.no_match.length ? `<h2>${esc(t("q.noMatchTitle"))}</h2><ul class="prose">${q.no_match.map(m => `<li>${esc(m.nama_rs)} (${esc(m.kab_kota)}, ${esc(m.provinsi)})</li>`).join("")}</ul>` : ""}
    ${spotCheckHTML()}
    <h2>${esc(t("dr.title"))}</h2>
    <p class="lede">${esc(t("dr.lede"))}</p>
    <div class="kpis">
      <div class="kpi"><b>${q.dreams_matched} / ${q.dreams_total}</b><span>${esc(t("dr.matched"))}</span></div>
      <div class="kpi"><b>${num(q.dreams_pairs - q.dreams_disagree.length)} / ${num(q.dreams_pairs)}</b><span>${esc(t("dr.agree"))}</span></div>
      <div class="kpi mod"><b>${q.dreams_disagree.filter(x => x[2] === 0 && x[3] > 0).length}</b><span>${esc(t("dr.falseZero"))}</span></div>
      <div class="kpi"><b>${q.dreams_disagree.filter(x => x[2] > 0 && x[3] === 0).length}</b><span>${esc(t("dr.dreamsZero"))}</span></div>
    </div>
    <h2>${esc(t("dr.disagree", q.dreams_disagree.length))}</h2>
    <div class="table-wrap" style="max-height:420px;overflow-y:auto"><table><thead><tr><th>${esc(t("th.hospital"))}</th><th>${esc(t("th.kab"))}</th><th>${esc(t("th.specialty"))}</th><th class="r">SIRS</th><th class="r">DREAMS</th><th class="r">${esc(t("dr.thDiff"))}</th></tr></thead><tbody>
      ${q.dreams_disagree.map(([id, code, a, b]) => { const h = D.byId.get(id); return `<tr class="click" data-id="${id}"><td>${esc(h.name)}</td><td>${esc(h.kab)}, ${esc(h.prov)}</td><td>${esc(code)}</td><td class="r num${a === 0 ? " cell-zero" : ""}">${a}</td><td class="r num${b === 0 ? " cell-zero" : ""}">${b}</td><td class="r num">${b - a > 0 ? "+" : ""}${b - a}</td></tr>`; }).join("")}</tbody></table></div>
    ${q.dreams_unmatched.length ? `<h2>${esc(t("dr.unmatched", q.dreams_unmatched.length))}</h2>
      <div class="table-wrap"><table><thead><tr><th>${esc(t("dr.thName"))}</th><th>${esc(t("th.kab"))}</th><th>${esc(t("th.class"))}</th><th>${esc(t("dr.thClosest"))}</th></tr></thead><tbody>
      ${q.dreams_unmatched.map(u => `<tr><td>${esc(u.nama)}</td><td>${esc(u.kab_kota)}</td><td>${esc(u.kelas)}</td><td class="note">${u.candidates.map(c => `${esc(c.nama)} (${Math.round(c.score * 100)}%)`).join("<br>") || esc(t("dr.noneKab"))}</td></tr>`).join("")}</tbody></table></div>` : ""}
    <h2>${esc(t("q.missingTitle"))}</h2>
    <ul class="prose">${t("q.missing", D.meta.population_source, popNote).map(x => `<li>${esc(x)}</li>`).join("")}</ul>
    <h2>${esc(t("q.unmappedTitle", q.unmapped_labels.reduce((s, x) => s + x[1], 0)))}</h2>
    <p class="lede">${esc(t("q.unmappedLede"))}</p>
    <div class="table-wrap"><table><thead><tr><th>${esc(t("q.thLabel"))}</th><th class="r">${esc(t("q.thDoctors"))}</th></tr></thead><tbody>${q.unmapped_labels.map(([x, n]) => `<tr><td>${esc(x)}</td><td class="r num">${n}</td></tr>`).join("")}</tbody></table></div>
    <h2>${esc(t("q.noBedsTitle"))}</h2>
    <p class="lede">${esc(t("q.noBedsLede"))}</p>
    <div class="table-wrap"><table><thead><tr><th>${esc(t("th.hospital"))}</th><th>${esc(t("th.kab"))}</th><th>${esc(t("th.type"))}</th><th>${esc(t("th.class"))}</th></tr></thead><tbody>${missingBeds.map(h => `<tr class="click" data-id="${h.id}"><td>${esc(h.name)}</td><td>${esc(h.kab)}, ${esc(h.prov)}</td><td>${esc(h.type)}</td><td data-sort="${classIndex(h)}">${classBadge(h)}</td></tr>`).join("") || `<tr><td>${esc(t("none"))}</td></tr>`}</tbody></table></div>`;
  el.querySelectorAll("tr[data-id]").forEach(tr => tr.onclick = () => selectHospital(D.byId.get(tr.dataset.id)));
  el.querySelectorAll("form.review").forEach(form => form.addEventListener("submit", saveReview));
  el.querySelectorAll("tr.spot button").forEach(b => b.addEventListener("click", saveSpot));
}
function spotCheckHTML() {
  const rows = D.quality.spot_check || [];
  if (!rows.length) return "";
  const verdicts = t("verdicts"), strata = t("strata");
  const done = rows.filter(r => r.verdict && r.verdict !== "inconclusive");
  const wrong = done.filter(r => ["flag_wrong", "dreams_right"].includes(r.verdict)).length;
  const counts = rows.reduce((m, r) => (m[r.verdict || ""] = (m[r.verdict || ""] || 0) + 1, m), {});
  return `<h2>${esc(t("sc.title"))}</h2>
    <p class="lede">${esc(t("sc.lede", rows.length))} ${esc(done.length ? t("sc.progress", done.length, wrong, Math.round(wrong / done.length * 100)) : t("sc.none"))}</p>
    <div class="chips">${Object.entries(counts).map(([k, n]) => `<span class="chip">${esc(verdicts[k] || k)}: ${n}</span>`).join("")}</div>
    ${state.canSave ? "" : `<p class="note">${t("readOnly")}</p>`}
    <div class="table-wrap" style="margin-top:10px"><table><thead><tr><th>${esc(t("sc.thGroup"))}</th><th>${esc(t("th.hospital"))}</th><th>${esc(t("th.specialty"))}</th><th class="r">SIRS</th><th class="r">DREAMS</th><th class="r">${esc(t("sc.thFound"))}</th><th>${esc(t("sc.thVerdict"))}</th><th>${esc(t("sc.thSource"))}</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr class="spot" data-h="${esc(r.hospital_id)}" data-s="${esc(r.specialty)}"><td>${esc(strata[r.stratum] || r.stratum)}</td>
      <td>${esc(r.hospital)}<div class="note">${esc(r.kab_kota)}, ${esc(r.province)}</div></td><td>${esc(r.specialty)}</td>
      <td class="r num">${esc(r.sirs_count)}</td><td class="r num">${esc(r.dreams_count || "–")}</td>
      ${state.canSave
        ? `<td class="r"><input class="sc-n" type="number" min="0" value="${esc(r.verified_count)}" aria-label="${esc(t("sc.found"))}" style="width:4.5em"></td>
           <td><select class="sc-v" aria-label="${esc(t("sc.thVerdict"))}">${Object.entries(verdicts).map(([k, x]) => `<option value="${k}" ${k === r.verdict ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></td>
           <td><input class="sc-u" type="text" placeholder="${esc(t("sc.sourcePh"))}" value="${esc(r.source_url)}" aria-label="${esc(t("sc.sourcePh"))}"><input class="sc-note" type="text" placeholder="${esc(t("sc.notePh"))}" value="${esc(r.note)}" aria-label="${esc(t("sc.notePh"))}"></td>
           <td><button type="button">${esc(t("save"))}</button><div class="status note">${r.checked_on ? esc(t("sc.checked", r.checked_on)) : ""}</div></td>`
        : `<td class="r num">${esc(r.verified_count || "–")}</td><td data-sort="${esc(r.verdict)}">${esc(verdicts[r.verdict] || r.verdict)}</td>
           <td class="note">${r.source_url ? `<a href="${esc(r.source_url)}" target="_blank" rel="noopener">${esc(t("sc.source"))}</a> · ` : ""}${esc(r.note)}${r.checked_on ? ` (${esc(r.checked_on)})` : ""}</td><td></td>`}</tr>`).join("")}</tbody></table></div>`;
}
async function postJSON(url, body) {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const out = await res.json();
  if (!out.ok) throw new Error(out.error || "Server error");
}
async function saveSpot(e) {
  const tr = e.target.closest("tr"), status = tr.querySelector(".status");
  e.target.disabled = true;
  status.textContent = t("sc.saving");
  try {
    await postJSON("api/spotcheck", { hospital_id: tr.dataset.h, specialty: tr.dataset.s, verified_count: tr.querySelector(".sc-n").value,
      verdict: tr.querySelector(".sc-v").value, source_url: tr.querySelector(".sc-u").value, note: tr.querySelector(".sc-note").value });
    await loadData();
    render();
  } catch (err) {
    status.textContent = t("sc.notSaved", err.message);
    e.target.disabled = false;
  }
}
function reviewItem(m, i, gov) {
  const tiers = Object.entries(m.tiers).map(([s, tier]) => `${t("svc")[s]} ${tier}`).join(" · ");
  const opts = gov.map(h => `<option value="${h.id} — ${esc(h.name)} (${esc(h.kab)})"></option>`).join("");
  return `<form class="review" data-key="${esc(m.kmk_key)}">
    <h3>${esc(m.nama_rs)}</h3>
    <div class="note">${esc(m.kab_kota)}, ${esc(m.provinsi)} · ${esc(tiers)} · <a href="kmk.pdf#page=${m.halaman_pdf}" target="_blank" rel="noopener">KMK ${t("pageRef", m.halaman_pdf)}</a></div>
    ${m.candidates.map((c, j) => `<label><input type="radio" name="c${i}" value="${c.kode}" ${j === 0 ? "checked" : ""}> ${esc(c.nama)} <span class="note">${esc(c.kab_kota)} · ${esc(t("q.similarity", Math.round(c.score * 100)))}</span></label>`).join("")}
    <label><input type="radio" name="c${i}" value="other"> ${esc(t("q.other"))}
      <input type="text" list="gov${i}" placeholder="${esc(t("q.otherPh"))}"><datalist id="gov${i}">${opts}</datalist></label>
    <label><input type="radio" name="c${i}" value=""> ${esc(t("q.notInSirs"))}</label>
    <div class="row"><button type="submit" ${state.canSave ? "" : "disabled"}>${esc(t("save"))}</button><span class="status">${state.canSave ? "" : esc(t("readOnlyShort"))}</span></div></form>`;
}
async function saveReview(e) {
  e.preventDefault();
  const form = e.target, status = form.querySelector(".status"), btn = form.querySelector("button");
  const choice = form.querySelector("input[type=radio]:checked")?.value ?? "";
  let kode = choice;
  if (choice === "other") {
    kode = (form.querySelector("input[type=text]").value.match(/^(\S+) —/) || [])[1];
    if (!kode) { status.textContent = t("q.pickFirst"); return; }
  }
  btn.disabled = true;
  status.textContent = t("q.saving");
  try {
    await postJSON("api/match", { kmk_key: form.dataset.key, sirs_kode: kode });
    await loadData();
    render();
  } catch (err) {
    status.textContent = t("q.notSaved", err.message);
    btn.disabled = false;
  }
}

// ---------- about & settings ----------
function renderAbout() {
  $("view-about").innerHTML = `<div class="prose">${ABOUT[lang](accuracyStats(), D, esc)}</div>`;
}
function renderSettings() {
  const radio = (name, value, cur, label) => `<label><input type="radio" name="${name}" value="${value}"${value === cur ? " checked" : ""}> ${esc(label)}</label>`;
  $("view-settings").innerHTML = `<h1>${esc(t("st.title"))}</h1><p class="lede">${esc(t("st.lede"))}</p>
    <div class="settings">
      <fieldset><legend>${esc(t("st.theme"))}</legend>
        ${radio("theme", "system", theme, t("st.system"))}${radio("theme", "light", theme, t("st.light"))}${radio("theme", "dark", theme, t("st.dark"))}</fieldset>
      <fieldset><legend>${esc(t("st.lang"))}</legend>
        ${radio("lang", "en", lang, t("st.en"))}${radio("lang", "id", lang, t("st.id"))}</fieldset>
      <p class="note">${esc(t("st.note"))}</p>
    </div>`;
  $("view-settings").querySelectorAll("input[name=theme]").forEach(r => r.onchange = () => {
    theme = r.value; store.set("theme", theme); applyTheme(); render();
  });
  $("view-settings").querySelectorAll("input[name=lang]").forEach(r => r.onchange = () => {
    lang = r.value; store.set("lang", lang); applyLanguage();
  });
}
// Everything with text is rebuilt; filter choices survive because MS keeps the selected values.
function applyLanguage() {
  document.documentElement.lang = t("html.lang");
  renderRail();
  defineFilters();
  renderFilters();
  if (map) buildLayersControl();
  render();
}
const VIEWS = ["map", "overview", "specialty", "hospital", "region", "quality", "about", "settings"];
function renderRail() {
  $("rail").innerHTML = `<div class="brand">${esc(t("brand"))}</div>
    ${VIEWS.map(v => `<a href="#${v}" data-view="${v}">${esc(t(`nav.${v}`))}${v === "quality" ? ' <span class="badge" id="reviewBadge" hidden></span>' : ""}</a>`).join("")}
    <div class="rail-foot" id="meta">${D ? t("meta", esc(D.meta.sirs_downloaded), esc(D.meta.built), num(D.hospitals.length)) : ""}</div>`;
}

// ---------- sortable tables ----------
// Click a header: ascending, click again: descending. Empty and "n/a" cells always go last.
const sortState = {};
function cellValue(td) {
  if (!td) return null;
  const raw = (td.dataset.sort ?? td.innerText).trim();
  if (raw === "" || raw === "n/a") return null;
  const n = raw.replace(/[,.×%\s]/g, m => (m === "." && /^\d{1,3}(\.\d{3})+$/.test(raw.replace(/\s/g, "")) ? "" : m === "." ? "." : ""));
  return /^-?\d+(\.\d+)?$/.test(n) ? Number(n) : raw.toLowerCase();
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
      th.title = th.title || t("clickSort");
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

// ---------- shell ----------
function render() {
  const view = (location.hash || "#map").slice(1);
  state.view = VIEWS.includes(view) ? view : "map";
  document.querySelectorAll(".rail a").forEach(a => a.classList.toggle("on", a.dataset.view === state.view));
  document.querySelectorAll(".view").forEach(v => v.hidden = v.id !== `view-${state.view}`);
  $("filters").hidden = state.view === "about" || state.view === "settings";
  const badge = $("reviewBadge");
  if (badge) { badge.hidden = !D.quality.review.length; badge.textContent = D.quality.review.length; }
  ({
    map: () => { map.invalidateSize(); renderMap(); if (state.selected) openDrawer(state.selected); else $("drawer").hidden = true; },
    overview: renderOverview, specialty: renderSpecialty, hospital: renderHospital, region: renderRegion,
    quality: renderQuality, about: renderAbout, settings: renderSettings,
  })[state.view]();
  if (!["map", "settings"].includes(state.view)) makeSortable($(`view-${state.view}`));
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
  renderRail();
}
async function start() {
  applyTheme();
  document.documentElement.lang = t("html.lang");
  try {
    await loadData();
  } catch (err) {
    $("loading").textContent = t("loadFail", err.message);
    return;
  }
  try { state.canSave = (await fetch("api/ping", { cache: "no-store" })).ok; } catch (e) { state.canSave = false; }
  defineFilters();
  renderFilters();
  initMap();
  document.addEventListener("click", closeAllMs);
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeAllMs(); });
  // Re-color the map when the computer switches light/dark while "Follow my computer" is on.
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => { if (theme === "system") render(); });
  window.addEventListener("hashchange", render);
  $("loading").hidden = true;
  render();
}
start();
