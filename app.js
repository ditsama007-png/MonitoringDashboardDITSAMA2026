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

function assignIds() {
  Object.keys(DATA).forEach((k) => {
    const pref = k.replace("INSPIRASI_", "").slice(0, 4).toUpperCase();
    (DATA[k] || []).forEach((r, i) => { if (!r.id) r.id = pref + "-" + String(i + 1).padStart(3, "0"); });
  });
}

function render() {
  assignIds();
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
  renderPivot(rows);
  renderDetail(rows);
  renderCalendar(rows);
}

// ---- Kalender kegiatan (di dashboard) ----
let CAL_MONTH = null;   // Date penanda bulan yang ditampilkan
function renderCalendar(rows) {
  const host = $("calendar"); if (!host) return;
  const dated = rows.filter((r) => r.tanggal && !isNaN(new Date(r.tanggal)));
  if (!CAL_MONTH) {
    CAL_MONTH = dated.length ? new Date(dated[0].tanggal) : new Date();
    CAL_MONTH.setDate(1);
  }
  const y = CAL_MONTH.getFullYear(), m = CAL_MONTH.getMonth();
  const nm = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
  if ($("cal-title")) $("cal-title").textContent = nm[m] + " " + y;

  // kegiatan per tanggal (key: YYYY-MM-DD)
  const byDay = {};
  dated.forEach((r) => {
    const d = new Date(r.tanggal);
    if (d.getFullYear() === y && d.getMonth() === m) {
      const key = d.getDate();
      (byDay[key] = byDay[key] || []).push(r.kegiatan || r.jenis || "Kegiatan");
    }
  });

  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;  // Senin=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const hari = ["Sen","Sel","Rab","Kam","Jum","Sab","Min"];
  let html = '<div class="cal-grid cal-head">' + hari.map((h) => `<div class="cal-dow">${h}</div>`).join("") + "</div>";
  html += '<div class="cal-grid">';
  for (let i = 0; i < firstDay; i++) html += '<div class="cal-cell empty"></div>';
  for (let d = 1; d <= daysInMonth; d++) {
    const ev = byDay[d];
    if (ev) {
      html += `<div class="cal-cell has-ev" data-day="${d}"><div class="cal-num">${d}</div>` +
        ev.slice(0, 2).map((e) => `<div class="cal-ev">${e}</div>`).join("") +
        (ev.length > 2 ? `<div class="cal-more">+${ev.length - 2}</div>` : "") + "</div>";
    } else {
      html += `<div class="cal-cell"><div class="cal-num">${d}</div></div>`;
    }
  }
  html += "</div>";
  host.innerHTML = html;

  // klik tanggal berkegiatan -> sorot baris di tabel detail
  host.querySelectorAll(".cal-cell.has-ev").forEach((cell) => {
    cell.addEventListener("click", () => {
      const day = +cell.dataset.day;
      const target = new Date(y, m, day).toDateString();
      const tbody = document.querySelector("#detail-table tbody");
      if (!tbody) return;
      let hit = null;
      // cari baris yang tanggalnya cocok (kolom Tanggal = kolom ke-3)
      [...tbody.querySelectorAll("tr")].forEach((tr) => {
        const cellDate = tr.children[2] ? tr.children[2].textContent.trim() : "";
        if (cellDate && new Date(cellDate).toDateString() === target) hit = tr;
      });
      tbody.querySelectorAll("tr").forEach((tr) => (tr.style.background = ""));
      if (hit) {
        hit.style.background = "#FFF6CC";
        hit.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });
}
function calShift(delta) {
  if (!CAL_MONTH) CAL_MONTH = new Date();
  CAL_MONTH.setMonth(CAL_MONTH.getMonth() + delta);
  renderCalendar(rowsForFilter());
}

function renderPivot(rows) { renderPivotInto("pivot-table", rows); }

function renderPivotInto(tableId, rows, forceProgs) {
  const thead = document.querySelector("#" + tableId + " thead");
  const tbody = document.querySelector("#" + tableId + " tbody");
  const cols = ["Program", "Jml Kegiatan", "Total Anggaran", "Total Realisasi", "Target", "Actual", "Progress"];
  thead.innerHTML = "<tr>" + cols.map((c) => `<th>${c}</th>`).join("") + "</tr>";
  const progs = forceProgs || [...new Set(rows.map((r) => r._prog))];
  if (!progs.length) { tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty">Belum ada data.</td></tr>`; return; }
  let body = "";
  progs.forEach((k) => {
    const pr = rows.filter((r) => r._prog === k);
    const keg = pr.filter((r) => (r.kegiatan || "").trim()).length;
    const ang = pr.reduce((s, r) => s + (+r.anggaran || 0), 0);
    const real = pr.reduce((s, r) => s + (+r.realisasi || 0), 0);
    const tgt = pr.reduce((s, r) => s + (+r.target || 0), 0);
    const act = pr.reduce((s, r) => s + (+r.actual || 0), 0);
    const prog = Math.round(programProgress(pr) * 100);
    body += `<tr><td>${labelOf(k)}</td><td>${keg}</td><td>${fmtRupiah(ang)}</td>
      <td>${fmtRupiah(real)}</td><td>${tgt}</td><td>${act}</td><td>${prog}%</td></tr>`;
  });
  tbody.innerHTML = body;
}

function renderDetail(rows) {
  const thead = document.querySelector("#detail-table thead");
  const tbody = document.querySelector("#detail-table tbody");
  const cols = [["id","ID"],["_prog","Program"],["tanggal","Tanggal"],["kegiatan","Kegiatan"],
    ["anggaran","Anggaran"],["realisasi","Realisasi"],["target","Target"],["actual","Actual"],
    ["level","Level Isu"],["jenis","Milestone"]];
  thead.innerHTML = "<tr>" + cols.map((c) => `<th>${c[1]}</th>`).join("") + "</tr>";
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty">Belum ada data.</td></tr>`; return; }
  tbody.innerHTML = rows.map((r) => "<tr>" + cols.map(([k]) => {
    let v = (k === "_prog") ? labelOf(r._prog) : r[k];
    if (k === "anggaran" || k === "realisasi") v = fmtRupiah(v);
    return `<td>${v ?? ""}</td>`;
  }).join("") + "</tr>").join("");
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
function renderTable() { renderTableFor($("in-program").value, "data-table"); }

function renderTableFor(key, tableId) {
  assignIds();
  const rows = DATA[key] || [];
  const cols = [["id","ID"],["tanggal","Tanggal"],["kegiatan","Kegiatan"],["anggaran","Anggaran"],
    ["realisasi","Realisasi"],["target","Target"],["actual","Actual"],["level","Level Isu"],["jenis","Milestone"]];
  const thead = document.querySelector("#" + tableId + " thead");
  const tbody = document.querySelector("#" + tableId + " tbody");
  if (!thead || !tbody) return;
  thead.innerHTML = "<tr>" + cols.map((c) => `<th>${c[1]}</th>`).join("") + "</tr>";
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="${cols.length}" class="empty">Belum ada data.</td></tr>`; return; }
  tbody.innerHTML = rows.map((r) => "<tr>" + cols.map(([k]) => {
    let v = r[k]; if ((k === "anggaran" || k === "realisasi")) v = fmtRupiah(v);
    return `<td>${v ?? ""}</td>`;
  }).join("") + "</tr>").join("");
}

// -------------------------------------------------------- simpan form -------
let INPUT_MODE = "ongoing";
function setInputMode(m) {
  INPUT_MODE = m;
  if ($("mode-ongoing")) $("mode-ongoing").classList.toggle("active", m === "ongoing");
  if ($("mode-milestone")) $("mode-milestone").classList.toggle("active", m === "milestone");
  if ($("ongoing-only")) $("ongoing-only").style.display = (m === "ongoing") ? "" : "none";
}
function addPesertaRow(kat, ter, had) {
  const box = $("rows-peserta"); if (!box) return;
  const row = document.createElement("div"); row.className = "dyn-row";
  row.innerHTML = '<input class="p-kat" placeholder="mis. SMA"><input class="p-ter" type="number" placeholder="0"><input class="p-had" type="number" placeholder="0"><button type="button" class="dyn-del">✕</button>';
  box.appendChild(row);
  if (kat) row.querySelector(".p-kat").value = kat;
  if (ter) row.querySelector(".p-ter").value = ter;
  if (had) row.querySelector(".p-had").value = had;
  row.querySelector(".dyn-del").addEventListener("click", () => row.remove());
}
function addSDMRow(peran, jml, nama) {
  const box = $("rows-sdm"); if (!box) return;
  const row = document.createElement("div"); row.className = "dyn-row sdm";
  row.innerHTML = '<input class="s-peran" placeholder="mis. Dosen"><input class="s-jml" type="number" placeholder="0"><input class="s-nama" placeholder="nama..."><button type="button" class="dyn-del">✕</button>';
  box.appendChild(row);
  if (peran) row.querySelector(".s-peran").value = peran;
  if (jml) row.querySelector(".s-jml").value = jml;
  if (nama) row.querySelector(".s-nama").value = nama;
  row.querySelector(".dyn-del").addEventListener("click", () => row.remove());
}
function collectPeserta() {
  return [...document.querySelectorAll("#rows-peserta .dyn-row")].map((r) => ({
    kat: r.querySelector(".p-kat").value.trim(),
    ter: r.querySelector(".p-ter").value, had: r.querySelector(".p-had").value,
  })).filter((x) => x.kat);
}
function collectSDM() {
  return [...document.querySelectorAll("#rows-sdm .dyn-row")].map((r) => ({
    peran: r.querySelector(".s-peran").value.trim(),
    jml: r.querySelector(".s-jml").value, nama: r.querySelector(".s-nama").value.trim(),
  })).filter((x) => x.peran);
}
function addIssueRow(nama, level, ket, solve) {
  const box = $("rows-issue"); if (!box) return;
  const row = document.createElement("div"); row.className = "issue-row";
  const opts = (typeof OPSI_LEVEL_ISU !== "undefined" ? OPSI_LEVEL_ISU : ["High", "Medium", "Low", "Tidak Ada"])
    .map((o) => `<option>${o}</option>`).join("");
  row.innerHTML =
    '<div class="grid-2"><label>Nama Isu<input class="i-nama" placeholder="mis. Jadwal bentrok"></label>' +
    '<label>Level<select class="i-level">' + opts + '</select></label></div>' +
    '<div class="grid-2"><label>Keterangan<input class="i-ket" placeholder="penjelasan"></label>' +
    '<label>Problem Solving<input class="i-solve" placeholder="penanganan"></label></div>' +
    '<button type="button" class="btn-ghost i-del" style="margin-bottom:8px;">✕ Hapus issue</button>';
  box.appendChild(row);
  if (nama) row.querySelector(".i-nama").value = nama;
  if (level) row.querySelector(".i-level").value = level;
  if (ket) row.querySelector(".i-ket").value = ket;
  if (solve) row.querySelector(".i-solve").value = solve;
  row.querySelector(".i-del").addEventListener("click", () => row.remove());
}
function collectIssues() {
  return [...document.querySelectorAll("#rows-issue .issue-row")].map((r) => ({
    nama: r.querySelector(".i-nama").value.trim(),
    level: r.querySelector(".i-level").value,
    ket: r.querySelector(".i-ket").value.trim(),
    solve: r.querySelector(".i-solve").value.trim(),
  })).filter((x) => x.nama || x.ket || x.solve);
}

async function simpan() {
  const msg = $("save-msg"); msg.textContent = ""; msg.className = "save-msg";
  if (!SESSION) { msg.textContent = "Anda belum login."; msg.classList.add("err"); return; }
  const program = $("in-program").value;
  if (!canAccessProgram(program)) { msg.textContent = "Anda tak berhak mengisi program ini."; msg.classList.add("err"); return; }

  const record = {
    "Mode": INPUT_MODE === "milestone" ? "Upcoming Milestone" : "On-Going",
    "Tanggal Kegiatan": $("f-tanggal").value,
    "Nama Kegiatan": $("f-kegiatan").value.trim(),
    "Fase Kegiatan": $("f-fase").value.trim(),
    "Lokasi / Alamat": $("f-lokasi").value.trim(),
  };

  if (INPUT_MODE === "ongoing") {
    let totTer = 0, totHad = 0;
    collectPeserta().forEach((p) => {
      record["Peserta " + p.kat + " (terdaftar)"] = p.ter;
      record["Peserta " + p.kat + " (hadir)"] = p.had;
      totTer += +p.ter || 0; totHad += +p.had || 0;
    });
    collectSDM().forEach((s) => {
      record["SDM " + s.peran + " (jumlah)"] = s.jml;
      record["SDM " + s.peran + " (nama)"] = s.nama;
    });
    // Issue paket (hanya yang diisi); kalau tak ada issue -> tak ada kolom issue
    collectIssues().forEach((it, i) => {
      const n = i + 1;
      record["Issue " + n + " Nama"] = it.nama;
      record["Issue " + n + " Level"] = it.level;
      record["Issue " + n + " Keterangan"] = it.ket;
      record["Issue " + n + " Problem Solving"] = it.solve;
    });
    record["Nilai Capaian (%)"] = $("f-nilai").value;
    record["Feedback (%)"] = $("f-feedback").value;
    record["Keberjalanan Kegiatan"] = $("f-keberjalanan").value;
    // Kehadiran otomatis = total hadir / total terdaftar * 100
    if (totTer > 0) record["Kehadiran (%)"] = Math.round((totHad / totTer) * 100);
  }

  const extra = getExtraCols();
  Object.keys(extra).forEach((k) => { record[k] = extra[k]; });

  if (!record["Nama Kegiatan"]) { msg.textContent = "Nama kegiatan wajib diisi."; msg.classList.add("err"); return; }

  if (!API_URL) { msg.textContent = "Tersimpan (mode contoh — belum ke Sheets)."; msg.classList.add("ok"); return; }

  msg.textContent = "Menyimpan...";
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "write_flex", token: SESSION.token, program: program, record: record }),
    });
    const out = await res.json();
    if (out.ok) {
      msg.textContent = "✅ Tersimpan. Isi lagi atau klik 'Tambahkan data lainnya'."; msg.classList.add("ok");
      clearForm();
      await loadFlex(); renderFlexTable(program);
    } else {
      msg.textContent = "❌ " + (out.error || "Gagal menyimpan."); msg.classList.add("err");
    }
  } catch (e) {
    msg.textContent = "❌ Gagal terhubung ke server."; msg.classList.add("err");
  }
}

// kosongkan form ke bentuk awal (untuk input baru)
function clearForm() {
  ["f-tanggal", "f-kegiatan", "f-fase", "f-lokasi", "f-nilai", "f-feedback"].forEach((id) => { if ($(id)) $(id).value = ""; });
  if ($("f-keberjalanan")) $("f-keberjalanan").selectedIndex = 0;
  ["rows-peserta", "rows-sdm", "rows-issue", "extra-cols"].forEach((id) => { if ($(id)) $(id).innerHTML = ""; });
  // seed baris default peserta & SDM lagi
  addPesertaRow("SMA"); addPesertaRow("Universitas"); addSDMRow("Dosen");
  setInputMode("ongoing");
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
  if ($("f-keberjalanan")) $("f-keberjalanan").innerHTML = ["", ...OPSI_KEBERJALANAN].map((o) => `<option>${o}</option>`).join("");
  // checkbox program (untuk sign up)
  const box = $("a-programs");
  if (box) {
    box.innerHTML = PROGRAMS.map((p) =>
      `<label class="prog-item"><input type="checkbox" value="${p.key}" /> ${p.label}</label>`).join("");
    box.addEventListener("change", updateProgSummary);
  }
}
function updateProgSummary() {
  const n = getSelectedPrograms().length;
  const s = $("prog-summary");
  if (s) s.textContent = n ? (n + " program dipilih") : "Pilih program (klik untuk buka)…";
}
function getSelectedPrograms() {
  return [...document.querySelectorAll("#a-programs input:checked")].map((c) => c.value);
}
// Pilihan program hanya muncul saat SIGN UP dan jabatan = PIC
// (Admin & Head Program otomatis akses semua program).
function updateProgramVisibility() {
  const wp = $("wrap-programs"); if (!wp) return;
  const isSignup = (AUTH_MODE === "signup");
  const jab = $("a-jabatan") ? $("a-jabatan").value : "";
  wp.hidden = !(isSignup && jab === "PIC");
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

  // navigasi: dashboard / input / program (lihat) — semua boleh dibuka
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      setActiveNav(btn);
      showView(view);
    });
  });
}

function setActiveNav(btn) {
  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  if (btn) btn.classList.add("active");
}

// ------------------------------------------------ akses per jabatan --------
function isAllAccess(jab) { return (typeof ALL_ACCESS_ROLES !== "undefined") && ALL_ACCESS_ROLES.includes(jab); }
function canAccessProgram(key) {
  if (!SESSION) return false;
  if (isAllAccess(SESSION.jabatan)) return true;
  return (SESSION.programs || []).includes(key);
}
function applyAccess() {
  // Semua menu tampil untuk yang sudah login (program = lihat dashboard saja).
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => { btn.style.display = ""; });
  $("access-label").textContent = SESSION ? (SESSION.nama + " · " + SESSION.jabatan) : "Profil";
}

function showView(view) {
  const isDash = view === "dashboard";
  const isInput = view === "input";
  const isProgram = !isDash && !isInput;

  $("view-dash").hidden = !isDash;
  $("view-input").hidden = !isInput;
  $("view-program").hidden = !isProgram;

  // Control (filter) & judul hanya di dashboard utama
  $("control").style.display = isDash ? "" : "none";
  $("show-control").style.display = isDash ? "" : "none";
  document.querySelector(".title").style.visibility = isDash ? "visible" : "hidden";

  if (isDash) {
    render();
  } else if (isInput) {
    populateInputPrograms();
    renderInput($("in-program").value);
  } else {
    // dashboard per program (lihat saja)
    const p = programByKey(view);
    $("prog-title").textContent = "Dashboard Program · " + (p ? p.label : view);
    renderProgramDash(view);
    renderTableFor(view, "prog-table");
  }
}

// isi dropdown program di Input Data (hanya yang boleh diisi user)
function populateInputPrograms() {
  const sel = $("in-program");
  const allowed = PROGRAMS.filter((p) => canAccessProgram(p.key));
  const list = allowed.length ? allowed : [];
  sel.innerHTML = list.map((p) => `<option value="${p.key}">${p.label}</option>`).join("")
    || '<option value="">(tidak ada program yang bisa Anda isi)</option>';
}

// tampilkan form + pivot + tabel untuk program terpilih di Input Data
let FLEX_CACHE = null;   // {header, rows} dari DataMasuk

function renderInput(key) {
  if (!key) { return; }
  if ($("form-fields")) $("form-fields").hidden = true;
  if ($("btn-show-form")) $("btn-show-form").textContent = "➕ Input Data Baru";
  renderFlexTable(key);
}

async function loadFlex() {
  if (!API_URL) { FLEX_CACHE = FLEX_CACHE || { header: [], rows: [] }; return; }
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "read_flex" }),
    });
    const out = await res.json();
    if (out.ok) FLEX_CACHE = { header: out.header || [], rows: out.rows || [] };
  } catch (e) { console.error("read_flex gagal:", e); }
}

function renderFlexTable(key) {
  const label = labelOf(key);
  const thead = document.querySelector("#flex-table thead");
  const tbody = document.querySelector("#flex-table tbody");
  if (!thead || !tbody) return;
  const flex = FLEX_CACHE || { header: [], rows: [] };
  const header = (flex.header.length ? flex.header : ["ID", "Waktu Input", "Program", "PIC"]);
  const rows = flex.rows.filter((r) => String(r["Program"] || "") === label);
  thead.innerHTML = "<tr>" + header.map((h) => `<th>${h}</th>`).join("") + "<th>Aksi</th></tr>";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${header.length + 1}" class="empty">Belum ada data untuk ${label}.</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r["ID"] || "";
    header.forEach((h) => {
      const td = document.createElement("td");
      td.dataset.col = h;
      td.textContent = (r[h] !== undefined && r[h] !== null) ? r[h] : "";
      tr.appendChild(td);
    });
    const act = document.createElement("td"); act.className = "act-cell"; act.style.whiteSpace = "nowrap";
    act.innerHTML =
      '<button class="mini-btn edit">✎ Edit</button> ' +
      '<button class="mini-btn del">🗑 Hapus</button>' +
      (milestoneNeedsDate(r) ? ' <button class="mini-btn fill' + (milestoneActive(r) ? "" : " off") + '">📅 Isi tanggal</button>' : "");
    tr.appendChild(act);
    tbody.appendChild(tr);

    act.querySelector(".del").addEventListener("click", () => hapusRow(r["ID"], key));
    act.querySelector(".edit").addEventListener("click", () => editRow(tr, r, key));
    const fb = act.querySelector(".fill");
    if (fb) fb.addEventListener("click", () => {
      if (!milestoneActive(r)) { alert("Tombol isi tanggal aktif H-2 sampai H+7 dari tanggal milestone."); return; }
      const d = prompt("Isi tanggal pelaksanaan (YYYY-MM-DD):", r["Tanggal Kegiatan"] || "");
      if (d) updateRow(r["ID"], { "Tanggal Kegiatan": d }, key);
    });
  });
}

function milestoneNeedsDate(r) { return String(r["Mode"] || "") === "Upcoming Milestone"; }
function milestoneActive(r) {
  const t = r["Tanggal Kegiatan"];
  if (!t) return true;                       // belum ada tanggal -> boleh diisi
  const d = new Date(t); if (isNaN(d)) return true;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const from = new Date(d); from.setDate(from.getDate() - 2);
  const to = new Date(d); to.setDate(to.getDate() + 7);
  return now >= from && now <= to;           // aktif H-2 sampai H+7
}

async function hapusRow(id, key) {
  if (!id || !confirm("Hapus baris ini? Tidak bisa dikembalikan.")) return;
  if (!API_URL) { alert("Mode contoh — hapus hanya aktif setelah tersambung ke Sheets."); return; }
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "delete_flex", token: SESSION.token, id: id }) });
    const out = await res.json();
    if (out.ok) { await loadFlex(); renderFlexTable(key); }
    else alert("Gagal hapus: " + (out.error || ""));
  } catch (e) { alert("Gagal terhubung ke server."); }
}

async function updateRow(id, record, key) {
  if (!API_URL) { alert("Mode contoh — edit hanya aktif setelah tersambung ke Sheets."); return; }
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "update_flex", token: SESSION.token, id: id, record: record }) });
    const out = await res.json();
    if (out.ok) { await loadFlex(); renderFlexTable(key); }
    else alert("Gagal simpan: " + (out.error || ""));
  } catch (e) { alert("Gagal terhubung ke server."); }
}

function editRow(tr, r, key) {
  const skip = { "ID": 1, "Waktu Input": 1, "Program": 1, "PIC": 1 };
  [...tr.querySelectorAll("td")].forEach((td) => {
    const col = td.dataset.col;
    if (!col || skip[col]) return;
    const val = td.textContent;
    td.innerHTML = `<input value="${String(val).replace(/"/g, "&quot;")}" style="width:100%;height:30px;">`;
  });
  const act = tr.querySelector(".act-cell");
  act.innerHTML = '<button class="mini-btn ok">✔ OK</button> <button class="mini-btn cancel">Batal</button>';
  act.querySelector(".cancel").addEventListener("click", () => renderFlexTable(key));
  act.querySelector(".ok").addEventListener("click", () => {
    const rec = {};
    [...tr.querySelectorAll("td")].forEach((td) => {
      const col = td.dataset.col; const inp = td.querySelector("input");
      if (col && inp && !skip[col]) rec[col] = inp.value;
    });
    updateRow(r["ID"], rec, key);
  });
}

// ---- Kolom Tambahan (dinamis) ----
function addExtraCol(name, val) {
  const box = $("extra-cols"); if (!box) return;
  const row = document.createElement("div");
  row.className = "extra-row";
  row.innerHTML = '<input class="xcol-name" placeholder="Nama kolom (mis. Sponsor)" />' +
                  '<input class="xcol-val" placeholder="Isi" />' +
                  '<button type="button" class="xcol-del" title="Hapus">✕</button>';
  box.appendChild(row);
  if (name) row.querySelector(".xcol-name").value = name;
  if (val) row.querySelector(".xcol-val").value = val;
  row.querySelector(".xcol-del").addEventListener("click", () => row.remove());
}
function getExtraCols() {
  const out = {};
  document.querySelectorAll("#extra-cols .extra-row").forEach((r) => {
    const n = r.querySelector(".xcol-name").value.trim();
    const v = r.querySelector(".xcol-val").value.trim();
    if (n) out[n] = v;
  });
  return out;
}

// KPI mini-dashboard khusus satu program
function renderProgramDash(key) {
  const rows = (DATA[key] || []).map((r) => ({ ...r, _prog: key }));
  let ang = 0, real = 0, act = 0;
  rows.forEach((r) => { ang += +r.anggaran || 0; real += +r.realisasi || 0; act += +r.actual || 0; });
  const prog = Math.round(programProgress(rows) * 100);
  if ($("pk-progress")) $("pk-progress").textContent = prog + "%";
  if ($("pk-anggaran")) $("pk-anggaran").textContent = fmtRupiah(ang);
  if ($("pk-realisasi")) $("pk-realisasi").textContent = fmtRupiah(real);
  if ($("pk-peserta")) $("pk-peserta").textContent = act.toLocaleString("id-ID");
}

// -------------------------------------------------------- AUTH -------------
let SESSION = null;            // {nama, jabatan, email, token}
let AUTH_MODE = "login";
let DEMO_CODE = null;
const SESSION_KEY = "ditsama_session";

function setAuthMode(mode) {
  AUTH_MODE = mode;   // "login" | "signup" | "forgot"
  const isLogin = mode === "login", isSignup = mode === "signup", isForgot = mode === "forgot";
  $("tab-login").classList.toggle("active", isLogin);
  $("tab-signup").classList.toggle("active", isSignup);
  // tampil/sembunyi kolom sesuai mode
  $("wrap-nama").hidden    = isForgot;                 // forgot tak butuh nama
  $("wrap-jabatan").hidden = !isSignup;
  updateProgramVisibility();                           // pilihan program hanya untuk PIC
  $("wrap-email").hidden   = isLogin;                  // email utk signup & forgot
  $("wrap-code").hidden    = isLogin;                  // kode utk signup & forgot
  $("btn-sendcode").hidden = isLogin;                  // tombol kirim kode
  $("wrap-pass").hidden    = false;
  $("link-forgot").hidden  = !isLogin;
  $("link-backlogin").hidden = isLogin;
  $("a-pass").placeholder = isForgot ? "password BARU" : "password";
  $("auth-sub").textContent =
    isLogin  ? "Masuk cukup dengan nama/username & password." :
    isSignup ? "Daftar: isi data, klik 'Kirim kode', masukkan kode dari email, lalu Daftar." :
               "Lupa password: masukkan email, klik 'Kirim kode', lalu isi kode + password baru.";
  $("btn-auth").textContent = isLogin ? "Masuk" : isSignup ? "Daftar" : "Reset Password";
  $("auth-msg").textContent = "";
}

// kirim kode verifikasi ke email
async function sendCode() {
  const email = $("a-email").value.trim();
  const msg = $("auth-msg"); msg.textContent = ""; msg.className = "save-msg";
  if (!email) { msg.textContent = "Isi email dulu."; msg.classList.add("err"); return; }
  const purpose = (AUTH_MODE === "forgot") ? "reset" : "signup";
  if (!API_URL) {   // demo: tampilkan kode via alert
    DEMO_CODE = String(Math.floor(100000 + Math.random() * 900000));
    alert("MODE DEMO — kode verifikasi kamu: " + DEMO_CODE + "\n(Di versi asli, ini dikirim ke email.)");
    msg.textContent = "Kode dikirim (demo). Cek popup."; msg.classList.add("ok"); return;
  }
  msg.textContent = "Mengirim kode...";
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "send_code", email, purpose }) });
    const out = await res.json();
    if (out.ok) { msg.textContent = "✅ Kode terkirim ke email. Cek inbox/spam."; msg.classList.add("ok"); }
    else { msg.textContent = "❌ " + (out.error || "Gagal kirim kode."); msg.classList.add("err"); }
  } catch (e) { msg.textContent = "❌ Gagal terhubung ke server."; msg.classList.add("err"); }
}

async function doAuth() {
  const nama = $("a-nama").value.trim(), jab = $("a-jabatan").value,
        email = $("a-email").value.trim(), pass = $("a-pass").value, code = $("a-code").value.trim();
  const msg = $("auth-msg"); msg.textContent = ""; msg.className = "save-msg";

  if (AUTH_MODE === "login") {
    if (!nama || !pass) { msg.textContent = "Isi nama & password."; msg.classList.add("err"); return; }
  } else if (AUTH_MODE === "signup") {
    if (!nama || !jab || !email || !pass || !code) { msg.textContent = "Lengkapi semua kolom + kode."; msg.classList.add("err"); return; }
    if (jab === "PIC" && getSelectedPrograms().length === 0) { msg.textContent = "Pilih minimal satu program."; msg.classList.add("err"); return; }
  } else { // forgot
    if (!email || !code || !pass) { msg.textContent = "Isi email, kode, & password baru."; msg.classList.add("err"); return; }
  }
  if (!API_URL) return demoAuth(nama, jab, email, pass, code, msg);   // mode contoh

  const action = AUTH_MODE === "forgot" ? "reset" : AUTH_MODE;
  const programs = getSelectedPrograms();
  msg.textContent = "Memproses...";
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, nama, jabatan: jab, email, password: pass, code, programs }) });
    const out = await res.json();
    if (!out.ok) { msg.textContent = "❌ " + (out.error || "Gagal."); msg.classList.add("err"); return; }
    if (AUTH_MODE === "signup") { msg.textContent = "✅ Terdaftar. Silakan login."; msg.classList.add("ok"); setAuthMode("login"); return; }
    if (AUTH_MODE === "forgot") { msg.textContent = "✅ Password diubah. Silakan login."; msg.classList.add("ok"); setAuthMode("login"); return; }
    loginSuccess({ nama: out.user.nama, jabatan: out.user.jabatan, email: out.user.email, programs: out.user.programs || [], token: out.token });
  } catch (e) { msg.textContent = "❌ Gagal terhubung ke server."; msg.classList.add("err"); }
}

// mode contoh (localStorage + kode DEMO_CODE)
function demoAuth(nama, jab, email, pass, code, msg) {
  let store = [];
  try { store = JSON.parse(localStorage.getItem("ditsama_users") || "[]"); } catch (e) {}
  if (AUTH_MODE === "signup") {
    if (code !== DEMO_CODE || !DEMO_CODE) { msg.textContent = "Kode salah (klik Kirim kode dulu)."; msg.classList.add("err"); return; }
    if (store.some((u) => u.nama.toLowerCase() === nama.toLowerCase())) { msg.textContent = "Nama sudah terdaftar."; msg.classList.add("err"); return; }
    store.push({ nama, jabatan: jab, email, password: pass, programs: getSelectedPrograms() });
    localStorage.setItem("ditsama_users", JSON.stringify(store));
    DEMO_CODE = null;
    msg.textContent = "✅ Terdaftar (demo). Silakan login."; msg.classList.add("ok"); setAuthMode("login"); return;
  }
  if (AUTH_MODE === "forgot") {
    if (code !== DEMO_CODE || !DEMO_CODE) { msg.textContent = "Kode salah (klik Kirim kode dulu)."; msg.classList.add("err"); return; }
    const idx = store.findIndex((u) => (u.email || "").toLowerCase() === email.toLowerCase());
    if (idx < 0) { msg.textContent = "Email tidak terdaftar."; msg.classList.add("err"); return; }
    store[idx].password = pass; localStorage.setItem("ditsama_users", JSON.stringify(store));
    DEMO_CODE = null;
    msg.textContent = "✅ Password diubah (demo). Silakan login."; msg.classList.add("ok"); setAuthMode("login"); return;
  }
  const u = store.find((x) => x.nama.toLowerCase() === nama.toLowerCase() && x.password === pass);
  if (!u) { msg.textContent = "Nama/password salah, atau belum sign up."; msg.classList.add("err"); return; }
  loginSuccess({ nama: u.nama, jabatan: u.jabatan, email: u.email, programs: u.programs || [], token: "demo" });
}

function loginSuccess(sess) {
  SESSION = sess;
  $("auth-gate").style.display = "none";
  applyAccess();
  setActiveNav(document.querySelector('.nav-item[data-view="dashboard"]'));
  showView("dashboard");
  // tampilkan overlay blur + minta Password Akses dulu
  askAccessPassword();
}

function askAccessPassword() {
  $("app").classList.add("blurred");
  $("acc-pass").value = "";
  $("acc-msg").textContent = ""; $("acc-msg").className = "save-msg";
  $("access-overlay").hidden = false;
}
async function checkAccessPassword() {
  const val = $("acc-pass").value;
  const msg = $("acc-msg");
  if (!API_URL) {   // mode demo (tanpa server): langsung buka, tak ada cek password
    unlockDashboard();
    return;
  }
  msg.textContent = "Memeriksa..."; msg.className = "save-msg";
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "check_access", password: val }) });
    const out = await res.json();
    if (out.ok) { unlockDashboard(); }
    else { msg.textContent = "Password Akses salah."; msg.className = "save-msg err"; }
  } catch (e) { msg.textContent = "Gagal terhubung ke server."; msg.className = "save-msg err"; }
}
function unlockDashboard() {
  $("access-overlay").hidden = true;
  $("app").classList.remove("blurred");
}

function logout() {
  SESSION = null;
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  $("profile-modal").hidden = true;
  $("a-pass").value = "";
  $("auth-gate").style.display = "";
}

function openProfile() {
  if (!SESSION) { $("auth-gate").style.display = ""; return; }
  const progText = isAllAccess(SESSION.jabatan)
    ? "Semua program"
    : ((SESSION.programs || []).map(labelOf).join(", ") || "-");
  $("profile-info").innerHTML =
    "<b>" + SESSION.nama + "</b><br>Jabatan: " + SESSION.jabatan +
    "<br>Email: " + (SESSION.email || "-") +
    "<br>Akses program: " + progText;
  $("profile-modal").hidden = false;
}

function restoreSession() {
  try { const s = JSON.parse(localStorage.getItem(SESSION_KEY)); if (s && s.nama) { SESSION = s; return true; } } catch (e) {}
  return false;
}

async function init() {
  initSelects();
  initToggles();
  $("a-jabatan").innerHTML = JABATAN.map((j) => `<option>${j}</option>`).join("");

  // --- AUTH dulu (biar form login langsung benar, tak tergantung data) ---
  $("tab-login").addEventListener("click", () => setAuthMode("login"));
  $("tab-signup").addEventListener("click", () => setAuthMode("signup"));
  $("btn-auth").addEventListener("click", doAuth);
  $("btn-sendcode").addEventListener("click", sendCode);
  $("link-forgot").addEventListener("click", (e) => { e.preventDefault(); setAuthMode("forgot"); });
  $("link-backlogin").addEventListener("click", (e) => { e.preventDefault(); setAuthMode("login"); });
  $("btn-access").addEventListener("click", openProfile);
  $("a-jabatan").addEventListener("change", updateProgramVisibility);
  $("btn-show-form").addEventListener("click", () => {
    const ff = $("form-fields");
    ff.hidden = !ff.hidden;
    $("btn-show-form").textContent = ff.hidden ? "➕ Input Data Baru" : "✖ Tutup Form";
    if (!ff.hidden) {
      setInputMode("ongoing");
      if ($("rows-peserta") && !$("rows-peserta").children.length) { addPesertaRow("SMA"); addPesertaRow("Universitas"); }
      if ($("rows-sdm") && !$("rows-sdm").children.length) { addSDMRow("Dosen"); }
      ff.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  });
  if ($("mode-ongoing")) $("mode-ongoing").addEventListener("click", () => setInputMode("ongoing"));
  if ($("mode-milestone")) $("mode-milestone").addEventListener("click", () => setInputMode("milestone"));
  if ($("add-peserta")) $("add-peserta").addEventListener("click", () => addPesertaRow());
  if ($("add-sdm")) $("add-sdm").addEventListener("click", () => addSDMRow());
  if ($("add-issue")) $("add-issue").addEventListener("click", () => addIssueRow());
  if ($("btn-add-more")) $("btn-add-more").addEventListener("click", () => {
    clearForm();
    const ff = $("form-fields"); if (ff) ff.hidden = false;
    if ($("btn-show-form")) $("btn-show-form").textContent = "✖ Tutup Form";
    $("f-kegiatan").focus();
  });
  $("btn-acc").addEventListener("click", checkAccessPassword);
  $("acc-pass").addEventListener("keydown", (e) => { if (e.key === "Enter") checkAccessPassword(); });
  $("btn-logout").addEventListener("click", logout);
  $("btn-profile-close").addEventListener("click", () => { $("profile-modal").hidden = true; });
  setAuthMode("login");
  // Selalu WAJIB login tiap buka halaman (tidak mengingat sesi lama)
  SESSION = null;
  try { localStorage.removeItem(SESSION_KEY); } catch (e) {}
  $("auth-gate").style.display = "";

  // --- lalu muat data dashboard (dibungkus try/catch supaya tak ganggu login) ---
  try {
    await loadData();
    rebuildFilters();
    render();
  } catch (e) { console.error("Gagal muat data:", e); }

  $("btn-simpan").addEventListener("click", simpan);
  $("in-program").addEventListener("change", () => renderInput($("in-program").value));
  $("btn-refresh").addEventListener("click", async () => { await loadData(); rebuildFilters(); renderTable(); render(); });
  if ($("cal-prev")) $("cal-prev").addEventListener("click", () => calShift(-1));
  if ($("cal-next")) $("cal-next").addEventListener("click", () => calShift(1));
  if ($("btn-add-col")) $("btn-add-col").addEventListener("click", () => addExtraCol());
  loadFlex();
  ["flt-program", "flt-bulan", "flt-kegiatan", "flt-level"].forEach((id) =>
    $(id).addEventListener("change", () => { if (id === "flt-program") rebuildFilters(); render(); }));
}

window.addEventListener("DOMContentLoaded", init);
