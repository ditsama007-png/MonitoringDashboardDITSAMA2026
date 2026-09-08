/* =========================================================================
   app.js — logika Dashboard DITSAMA (website statis)
   ========================================================================= */

let DATA = {};       // { programKey: [ {tanggal, kegiatan, ...}, ... ] }
let IS_DEMO = false;

// ---------------------------------------------------------------- helpers ---
const $ = (id) => document.getElementById(id);
const fmtRupiah = (n) => {
  n = Number(n) || 0;
  if (n >= 1e9) return "Rp " + (n / 1e9).toFixed(1).replace(".0", "") + " M";
  if (n >= 1e6) return "Rp " + Math.round(n / 1e6) + " Jt";
  if (n >= 1e3) return "Rp " + Math.round(n / 1e3) + " Rb";
  return "Rp " + Math.round(n);
};
const pct = (x) => Math.round((x || 0) * 100) + "%";
const KEBER_SKOR = { "sesuai rencana": 1, "ada kendala": 0.7, "tidak sesuai rencana": 0.4 };

function programByKey(key) { return PROGRAMS.find((p) => p.key === key); }
function labelOf(key) { const p = programByKey(key); return p ? p.label : key; }

// ---------------------------------------------------------- data contoh ----
function demoData() {
  IS_DEMO = true;
  return {
    SIAP: [
      { tanggal: "2026-07-04", kegiatan: "Kelas SIAP 6-10 Juli", anggaran: 1068000000, realisasi: 141231340,
        target: 500, actual: 440, nilai: 0.85, hadir: 0.9, feedback: 0.8, keberjalanan: "Sesuai Rencana",
        level: "Low", ketisu: "Zoom kurang jelas", jenis: "" },
      { tanggal: "2026-09-05", kegiatan: "Ujian Offline 5 September", anggaran: 926768660, realisasi: 9324000,
        target: 0, actual: 60, nilai: 0, hadir: 0, feedback: 0, keberjalanan: "",
        level: "Tidak Ada", ketisu: "", jenis: "Mengumumkan nilai" },
    ],
    INSPIRASI_EDQ: [
      { tanggal: "2026-06-29", kegiatan: "Day 1 (Opening)", anggaran: 0, realisasi: 0,
        target: 41, actual: 41, nilai: 0.9, hadir: 1, feedback: 0.85, keberjalanan: "Sesuai Rencana",
        level: "Tidak Ada", ketisu: "", jenis: "" },
      { tanggal: "2026-07-01", kegiatan: "Day 3 (Lab Tour)", anggaran: 0, realisasi: 0,
        target: 41, actual: 40, nilai: 0.8, hadir: 0.95, feedback: 0.8, keberjalanan: "Ada Kendala",
        level: "Medium", ketisu: "Timeline padat", jenis: "" },
    ],
    INSPIRASI_SCD: [],
  };
}

// ------------------------------------------------------------ load data -----
async function loadData() {
  if (!API_URL) { DATA = demoData(); return; }
  try {
    const res = await fetch(API_URL + "?action=read");
    const json = await res.json();
    DATA = json.data || {};
    IS_DEMO = false;
  } catch (e) {
    console.error("Gagal ambil data, pakai contoh:", e);
    DATA = demoData();
  }
}

// -------------------------------------------------- perhitungan dashboard ---
function monthLabel(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return "";
  return dt.toLocaleDateString("id-ID", { month: "short", year: "numeric" });
}

function programProgress(rows) {
  const scores = [];
  rows.forEach((r) => {
    const comps = [];
    ["nilai", "hadir", "feedback"].forEach((k) => { if (r[k] > 0) comps.push(Math.min(r[k], 1)); });
    const kb = KEBER_SKOR[(r.keberjalanan || "").toLowerCase()];
    if (kb !== undefined) comps.push(kb);
    if (comps.length) scores.push(comps.reduce((a, b) => a + b, 0) / comps.length);
  });
  return scores.length ? Math.min(scores.reduce((a, b) => a + b, 0) / scores.length, 1) : 0;
}

function statusOf(p) {
  if (p >= 0.8) return ["On Track", "ok"];
  if (p >= 0.6) return ["Attention", "warn"];
  return ["Critical", "crit"];
}

// ------------------------------------------------------------- render -------
let chartFinance, chartParticipant;

function render() {
  $("demo-banner").hidden = !IS_DEMO;
  const rows = rowsForFilter();

  // KPI
  let anggaran = 0, realisasi = 0, actual = 0;
  rows.forEach((r) => { anggaran += +r.anggaran || 0; realisasi += +r.realisasi || 0; actual += +r.actual || 0; });
  // progress keseluruhan = rata-rata progress per program yang tampil
  const progList = [];
  const shownProgs = [...new Set(rows.map((r) => r._prog))];
  shownProgs.forEach((k) => { const pr = programProgress(rows.filter((r) => r._prog === k)); if (pr > 0) progList.push(pr); });
  const overall = progList.length ? progList.reduce((a, b) => a + b, 0) / progList.length : 0;

  $("kpi-progress").textContent = pct(overall);
  $("kpi-anggaran").textContent = fmtRupiah(anggaran);
  $("kpi-realisasi").textContent = fmtRupiah(realisasi);
  $("kpi-peserta").textContent = actual.toLocaleString("id-ID");

  renderPortfolio(rows, shownProgs);
  renderFinance(rows);
  renderParticipant(rows);
  renderIssues(rows);
  renderMilestones(rows);
}

function renderPortfolio(rows, progs) {
  const el = $("portfolio-list"); el.innerHTML = "";
  if (!progs.length) { el.innerHTML = '<div class="empty">Belum ada data.</div>'; return; }
  progs.forEach((k) => {
    const pr = rows.filter((r) => r._prog === k);
    const kegCount = pr.filter((r) => (r.kegiatan || "").trim()).length;
    const msCount = pr.filter((r) => (r.jenis || "").trim()).length;
    const total = kegCount + msCount;
    const prog = programProgress(pr);
    const [stat, cls] = statusOf(prog);
    const p = Math.round(prog * 100);
    el.insertAdjacentHTML("beforeend",
      `<div class="port">
        <div class="nm">${labelOf(k)}<small>Kegiatan selesai / total</small></div>
        <div class="cnt">${kegCount} / ${total}</div>
        <div><div class="bar"><span style="width:${Math.min(p,100)}%"></span></div>
             <div class="pct">${p}%</div></div>
        <div class="badge ${cls}">${stat}</div>
      </div>`);
  });
}

function aggByMonth(rows, fields) {
  const map = {};
  rows.forEach((r) => {
    const m = monthLabel(r.tanggal); if (!m) return;
    if (!map[m]) { map[m] = {}; fields.forEach((f) => (map[m][f] = 0)); map[m]._d = new Date(r.tanggal); }
    fields.forEach((f) => (map[m][f] += +r[f] || 0));
  });
  return Object.keys(map).map((m) => ({ m, ...map[m] })).sort((a, b) => a._d - b._d);
}

function renderFinance(rows) {
  const agg = aggByMonth(rows, ["anggaran", "realisasi"]);
  const ctx = $("chart-finance");
  if (chartFinance) chartFinance.destroy();
  chartFinance = new Chart(ctx, {
    type: "bar",
    data: { labels: agg.map((a) => a.m),
      datasets: [
        { label: "Anggaran", data: agg.map((a) => a.anggaran), backgroundColor: "#9EC1E6" },
        { label: "Realisasi", data: agg.map((a) => a.realisasi), backgroundColor: "#2F6FB0" },
      ] },
    options: { responsive: true, plugins: { legend: { position: "top" } },
      scales: { y: { ticks: { callback: (v) => fmtRupiah(v) } } } },
  });
}

function renderParticipant(rows) {
  const agg = aggByMonth(rows, ["target", "actual"]);
  let ct = 0, ca = 0;
  const labels = [], tData = [], aData = [];
  agg.forEach((a) => { ct += a.target; ca += a.actual; labels.push(a.m); tData.push(ct); aData.push(ca); });
  const ctx = $("chart-participant");
  if (chartParticipant) chartParticipant.destroy();
  chartParticipant = new Chart(ctx, {
    type: "line",
    data: { labels,
      datasets: [
        { label: "Target", data: tData, borderColor: "#9EC1E6", borderDash: [6, 4], tension: .3 },
        { label: "Actual", data: aData, borderColor: "#1B3A6B", backgroundColor: "rgba(47,111,176,.1)", fill: true, tension: .3 },
      ] },
    options: { responsive: true, plugins: { legend: { position: "top" } } },
  });
}

function renderIssues(rows) {
  const order = { High: 0, Medium: 1, Low: 2 };
  const items = rows.filter((r) => ["High", "Medium", "Low"].includes(r.level))
    .sort((a, b) => order[a.level] - order[b.level]);
  const el = $("issues-list"); el.innerHTML = "";
  if (!items.length) { el.innerHTML = '<div class="empty">Tidak ada issue. 🎉</div>'; return; }
  items.slice(0, 8).forEach((r) => {
    el.insertAdjacentHTML("beforeend",
      `<div class="issue ${r.level.toLowerCase()}">
        <div class="t">${r.ketisu || r.kegiatan || "-"}<small>${labelOf(r._prog)}</small></div>
        <div class="lv">${r.level}</div>
      </div>`);
  });
}

function renderMilestones(rows) {
  const items = rows.filter((r) => (r.jenis || "").trim())
    .filter((r) => r.tanggal)
    .sort((a, b) => new Date(a.tanggal) - new Date(b.tanggal));
  const el = $("milestones-list"); el.innerHTML = "";
  if (!items.length) { el.innerHTML = '<div class="empty">Belum ada milestone.</div>'; return; }
  items.slice(0, 8).forEach((r) => {
    const d = new Date(r.tanggal);
    const day = isNaN(d) ? "--" : d.getDate();
    const mon = isNaN(d) ? "" : d.toLocaleDateString("id-ID", { month: "short" });
    el.insertAdjacentHTML("beforeend",
      `<div class="ms">
        <div class="d">${day}<br><small>${mon}</small></div>
        <div class="ti">${r.jenis}<small>${labelOf(r._prog)}</small></div>
      </div>`);
  });
}

// ------------------------------------------------------ tabel data form -----
function renderTable() {
  const key = $("in-program").value;
  const rows = DATA[key] || [];
  const cols = [["tanggal","Tanggal"],["kegiatan","Kegiatan"],["anggaran","Anggaran"],
    ["realisasi","Realisasi"],["target","Target"],["actual","Actual"],["level","Level Isu"],["jenis","Milestone"]];
  const thead = document.querySelector("#data-table thead");
  const tbody = document.querySelector("#data-table tbody");
  thead.innerHTML = "<tr>" + cols.map((c) => `<th>${c[1]}</th>`).join("") + "</tr>";
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty">Belum ada data.</td></tr>`; return; }
  tbody.innerHTML = rows.map((r) => "<tr>" + cols.map(([k]) => {
    let v = r[k]; if ((k === "anggaran" || k === "realisasi")) v = fmtRupiah(v);
    return `<td>${v ?? ""}</td>`;
  }).join("") + "</tr>").join("");
}

// -------------------------------------------------------- simpan form -------
async function simpan() {
  const msg = $("save-msg"); msg.textContent = ""; msg.className = "save-msg";
  const payload = {
    program: $("in-program").value,
    pic: $("in-pic").value.trim(),
    password: $("in-pass").value,
    row: {
      tanggal: $("f-tanggal").value,
      kegiatan: $("f-kegiatan").value.trim(),
      anggaran: $("f-anggaran").value, realisasi: $("f-realisasi").value,
      target: $("f-target").value, actual: $("f-actual").value,
      nilai: $("f-nilai").value, hadir: $("f-hadir").value, feedback: $("f-feedback").value,
      keberjalanan: $("f-keberjalanan").value, level: $("f-level").value,
      ketisu: $("f-ketisu").value.trim(), jenis: $("f-jenis").value.trim(),
    },
  };
  if (!payload.kegiatan) { msg.textContent = "Nama kegiatan wajib diisi."; msg.classList.add("err"); return; }
  if (!payload.pic || !payload.password) { msg.textContent = "PIC & password wajib diisi."; msg.classList.add("err"); return; }

  if (!API_URL) {   // mode demo: simpan sementara di memori
    (DATA[payload.program] = DATA[payload.program] || []).push({ ...payload.row });
    msg.textContent = "Tersimpan (mode contoh — belum ke Sheets)."; msg.classList.add("ok");
    renderTable(); rebuildFilters(); render(); return;
  }

  msg.textContent = "Menyimpan...";
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "write", ...payload }),
    });
    const out = await res.json();
    if (out.ok) {
      msg.textContent = "✅ Tersimpan ke Sheets."; msg.classList.add("ok");
      await loadData(); renderTable(); rebuildFilters(); render();
    } else {
      msg.textContent = "❌ " + (out.error || "Gagal (cek password/PIC)."); msg.classList.add("err");
    }
  } catch (e) {
    msg.textContent = "❌ Gagal terhubung ke server."; msg.classList.add("err");
  }
}

// ------------------------------------------------------------- filters ------
function rebuildFilters() {
  // Program
  fillSelect($("flt-program"), ["Semua", ...PROGRAMS.map((p) => p.label)], selValue($("flt-program")));
  // kumpulkan semua baris
  const all = [];
  Object.keys(DATA).forEach((k) => (DATA[k] || []).forEach((r) => all.push({ ...r, _prog: k })));
  // Bulan
  const bulan = [...new Set(all.map((r) => monthLabel(r.tanggal)).filter(Boolean))]
    .sort((a, b) => new Date("1 " + a) - new Date("1 " + b));
  fillSelect($("flt-bulan"), ["Semua", ...bulan], selValue($("flt-bulan")));
  // Kegiatan (menyesuaikan program terpilih)
  const fp = $("flt-program").value;
  const keg = [...new Set(all.filter((r) => fp === "Semua" || labelOf(r._prog) === fp)
    .map((r) => r.kegiatan).filter(Boolean))].sort();
  fillSelect($("flt-kegiatan"), ["Semua", ...keg], selValue($("flt-kegiatan")));
  // Level Isu
  fillSelect($("flt-level"), ["Semua", "High", "Medium", "Low"], selValue($("flt-level")));
}
function selValue(sel) { return sel && sel.value ? sel.value : "Semua"; }
function fillSelect(sel, opts, keep) {
  const val = opts.includes(keep) ? keep : opts[0];
  sel.innerHTML = opts.map((o) => `<option ${o === val ? "selected" : ""}>${o}</option>`).join("");
}

// mapping label program di filter -> key
function filterProgramToKey(label) {
  if (label === "Semua") return "Semua";
  const p = PROGRAMS.find((x) => x.label === label);
  return p ? p.key : "Semua";
}
// override rowsForFilter agar pakai label->key
function rowsForFilter() {
  const fpLabel = $("flt-program").value, fb = $("flt-bulan").value,
        fk = $("flt-kegiatan").value, fl = $("flt-level").value;
  const fp = filterProgramToKey(fpLabel);
  let rows = [];
  Object.keys(DATA).forEach((k) => {
    if (fp !== "Semua" && k !== fp) return;
    (DATA[k] || []).forEach((r) => rows.push({ ...r, _prog: k }));
  });
  if (fb !== "Semua") rows = rows.filter((r) => monthLabel(r.tanggal) === fb);
  if (fk !== "Semua") rows = rows.filter((r) => r.kegiatan === fk);
  if (fl !== "Semua") rows = rows.filter((r) => (r.level || "") === fl);
  return rows;
}

// -------------------------------------------------------------- init --------
function initSelects() {
  // program form
  $("in-program").innerHTML = PROGRAMS.map((p) => `<option value="${p.key}">${p.label}</option>`).join("");
  $("f-keberjalanan").innerHTML = ["", ...OPSI_KEBERJALANAN].map((o) => `<option>${o}</option>`).join("");
  $("f-level").innerHTML = OPSI_LEVEL_ISU.map((o) => `<option>${o}</option>`).join("");
}

function initToggles() {
  // ☰ di rail: sembunyikan/tampilkan menu utama
  const rail = $("rail"), control = $("control");
  const toggleRail = () => rail.classList.toggle("hide");
  const toggleControl = () => control.classList.toggle("hide");
  $("hamb").addEventListener("click", toggleRail);
  $("show-rail").addEventListener("click", toggleRail);
  $("chev-control").addEventListener("click", toggleControl);
  $("show-control").addEventListener("click", toggleControl);

  // navigasi: dashboard vs form per program
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      showView(btn.dataset.view);
    });
  });
}

function showView(view) {
  const isDash = view === "dashboard";
  $("view-dash").hidden = !isDash;
  $("view-form").hidden = isDash;
  if (isDash) {
    render();
  } else {
    // view = key program -> siapkan form program itu
    $("in-program").value = view;
    const p = programByKey(view);
    $("form-title").textContent = "Form Input · " + (p ? p.label : view);
    renderTable();
  }
}

async function init() {
  initSelects();
  initToggles();
  await loadData();
  rebuildFilters();
  renderTable();
  render();

  $("btn-simpan").addEventListener("click", simpan);
  $("in-program").addEventListener("change", renderTable);
  $("btn-refresh").addEventListener("click", async () => { await loadData(); rebuildFilters(); renderTable(); render(); });
  ["flt-program", "flt-bulan", "flt-kegiatan", "flt-level"].forEach((id) =>
    $(id).addEventListener("change", () => { if (id === "flt-program") rebuildFilters(); render(); }));

  showView("dashboard");   // mulai dari dashboard
}

window.addEventListener("DOMContentLoaded", init);
