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

function progressStatus(p) {
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
  $("demo-banner").hidden = true;
  const rows = flexRowsFiltered();

  // KPI baru (dari DataMasuk)
  let totHadir = 0, totDaftar = 0;
  rows.forEach((r) => { totHadir += r.actual || 0; totDaftar += r.target || 0; });
  const shownProgs = [...new Set(rows.map((r) => r._prog))];
  const progList = [];
  shownProgs.forEach((k) => { const pr = programProgress(rows.filter((r) => r._prog === k)); if (pr > 0) progList.push(pr); });
  const overall = progList.length ? progList.reduce((a, b) => a + b, 0) / progList.length : 0;

  const totKeg = rows.filter((r) => (r.kegiatan || "").trim()).length;
  const totSelesai = rows.filter((r) => (r.kegiatan || "").trim() && r.status === "Selesai").length;
  if ($("kpi-progress")) $("kpi-progress").textContent = totKeg > 0 ? Math.round(totSelesai / totKeg * 100) + "%" : "0%";
  if ($("kpi-keg")) $("kpi-keg").textContent = totKeg;
  if ($("kpi-upcoming")) $("kpi-upcoming").textContent = rows.filter((r) => r.status === "Upcoming").length;
  if ($("kpi-ongoing")) $("kpi-ongoing").textContent = rows.filter((r) => r.status === "On-Going").length;
  if ($("kpi-selesai")) $("kpi-selesai").textContent = totSelesai;

  renderPortfolio(rows, shownProgs);
  renderIssues(rows);
  renderMilestones(rows);
  renderPivot(rows);
  renderDetail(rows);
  renderCalendar(rows);
  renderDashGantt();
  renderPeserta();
}

// ---- konversi baris DataMasuk -> bentuk standar yang dipakai render lama ----
function keyFromStored(p) {
  p = String(p || "");
  const f = PROGRAMS.find((x) => x.key === p || x.label === p);
  return f ? f.key : p;
}
function sumColsMatch(r, re) {
  let s = 0; Object.keys(r).forEach((k) => { if (re.test(k)) s += num(r[k]); }); return s;
}
function primaryIssue(r) {
  const rank = { High: 3, Medium: 2, Low: 1 };
  let best = "", bestName = "", bestPihak = "", bestSolve = "";
  Object.keys(r).forEach((k) => {
    const m = /^Issue \d+ Level$/.exec(k) || (k === "Level Isu" ? [k] : null);
    if (m) {
      const lv = String(r[k] || "");
      if (rank[lv] && (!best || rank[lv] > rank[best])) {
        best = lv;
        if (k === "Level Isu") {
          bestName = r["Keterangan Isu"] || "";
          bestPihak = r["Issue dengan pihak"] || "";
          bestSolve = r["Penanganan"] || "";
        } else {
          const base = k.replace(" Level", "");
          bestName = r[k.replace("Level", "Nama")] || "";
          bestPihak = r[base + " Pihak (penyelenggara)"] || "";
          bestSolve = r[base + " Problem Solving"] || "";
        }
      }
    }
  });
  return { level: best, name: bestName, pihak: bestPihak, solve: bestSolve };
}
function flexToStd(r) {
  const iss = primaryIssue(r);
  return {
    id: r["ID"] || "",
    _prog: keyFromStored(r["Program"]),
    kegiatan: r["Nama Kegiatan"] || "",
    tanggal: r["Tanggal Kegiatan"] || "",
    anggaran: sumColsMatch(r, /anggaran/i),
    realisasi: sumColsMatch(r, /realisasi/i),
    target: sumColsMatch(r, /^Peserta .+ \(terdaftar\)$/i),
    actual: sumColsMatch(r, /^Peserta .+ \(hadir\)$/i),
    nilai: num(r["Nilai Capaian (%)"]) / 100,
    hadir: num(r["Kehadiran (%)"]) / 100,
    feedback: num(r["Feedback (%)"]) / 100,
    keberjalanan: r["Keberjalanan Kegiatan"] || "",
    level: iss.level,
    ketisu: iss.name || r["Keterangan Isu"] || "",
    issuePihak: iss.pihak || "",
    issueSolve: iss.solve || "",
    pic: r["PIC"] || "",
    jenis: String(r["Mode"] || "") === "Upcoming Milestone" ? (r["Nama Kegiatan"] || "Milestone") : "",
    status: statusOf(r),
  };
}
function flexRowsFiltered() {
  const flex = FLEX_CACHE || { rows: [] };
  let rows = flex.rows.map(flexToStd);
  const fpLabel = selValue($("flt-program")), fb = selValue($("flt-bulan")),
        fk = selValue($("flt-kegiatan")), fl = selValue($("flt-level"));
  const fp = filterProgramToKey(fpLabel);
  if (fp && fp !== "Semua") rows = rows.filter((r) => r._prog === fp);
  if (fb && fb !== "Semua") rows = rows.filter((r) => monthLabel(r.tanggal) === fb);
  if (fk && fk !== "Semua") rows = rows.filter((r) => r.kegiatan === fk);
  if (fl && fl !== "Semua") rows = rows.filter((r) => (r.level || "") === fl);
  return rows;
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
    const total = pr.filter((r) => (r.kegiatan || "").trim()).length;
    const selesai = pr.filter((r) => (r.kegiatan || "").trim() && r.status === "Selesai").length;
    const prog = programProgress(pr);
    const [stat, cls] = progressStatus(prog);
    const p = Math.round(prog * 100);
    el.insertAdjacentHTML("beforeend",
      `<div class="port">
        <div class="nm">${labelOf(k)}<small>Kegiatan selesai / total</small></div>
        <div class="cnt">${selesai} / ${total}</div>
        <div><div class="bar"><span style="width:${Math.min(p,100)}%"></span></div>
             <div class="pct">${p}% <small style="font-weight:400;color:#6B7688;">Nilai Performance</small></div></div>
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
  if (!document.getElementById("chart-finance")) return;
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
  if (!document.getElementById("chart-participant")) return;
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

// ===== Analisis Peserta dari DataMasuk (ikut filter Program & Bulan) =====
let chartPesertaKeg = null;
function renderPeserta() {
  const flex = FLEX_CACHE || { header: [], rows: [] };
  // filter dari kontrol dashboard
  const fp = selValue($("flt-program"));   // "Semua" atau label program
  const fb = selValue($("flt-bulan"));      // "Semua" atau "YYYY-MM"
  let rows = flex.rows.slice();
  if (fp && fp !== "Semua") rows = rows.filter((r) => labelFromStored(r["Program"]) === fp);
  if (fb && fb !== "Semua") rows = rows.filter((r) => monthKey(r["Tanggal Kegiatan"]) === fb);

  // kolom peserta: "Peserta X (terdaftar)" / "(hadir)"
  const header = flex.header || [];
  const catSet = {};
  header.forEach((h) => {
    let m = /^Peserta (.+) \(terdaftar\)$/.exec(h); if (m) catSet[m[1]] = 1;
    m = /^Peserta (.+) \(hadir\)$/.exec(h); if (m) catSet[m[1]] = 1;
  });
  const cats = Object.keys(catSet);

  // agregasi per kegiatan (baris) + per kategori
  let totDaftar = 0, totHadir = 0, jmlKeg = 0;
  const perKat = {}; cats.forEach((c) => perKat[c] = { ter: 0, had: 0 });
  const kegLabels = [], kegTer = [], kegHad = [];
  rows.forEach((r) => {
    let rowTer = 0, rowHad = 0, ada = false;
    cats.forEach((c) => {
      const ter = num(r["Peserta " + c + " (terdaftar)"]);
      const had = num(r["Peserta " + c + " (hadir)"]);
      if (ter || had) ada = true;
      perKat[c].ter += ter; perKat[c].had += had;
      rowTer += ter; rowHad += had;
    });
    if (ada) {
      jmlKeg++; totDaftar += rowTer; totHadir += rowHad;
      kegLabels.push((r["Nama Kegiatan"] || "-").slice(0, 18));
      kegTer.push(rowTer); kegHad.push(rowHad);
    }
  });

  if ($("ps-keg")) $("ps-keg").textContent = jmlKeg;
  if ($("ps-daftar")) $("ps-daftar").textContent = totDaftar.toLocaleString("id-ID");
  if ($("ps-hadir")) $("ps-hadir").textContent = totHadir.toLocaleString("id-ID");
  if ($("ps-rate")) $("ps-rate").textContent = totDaftar > 0 ? Math.round(totHadir / totDaftar * 100) + "%" : "0%";

  // chart per kegiatan
  const ctx = $("chart-peserta-keg");
  if (ctx && typeof Chart !== "undefined") {
    if (chartPesertaKeg) chartPesertaKeg.destroy();
    chartPesertaKeg = new Chart(ctx, {
      type: "bar",
      data: { labels: kegLabels.length ? kegLabels : ["(belum ada data)"],
        datasets: [
          { label: "Terdaftar", data: kegTer, backgroundColor: "#9EC1E6" },
          { label: "Hadir", data: kegHad, backgroundColor: "#2F6FB0" },
        ] },
      options: { responsive: true, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true } } },
    });
  }

  // tabel per kategori
  const thead = document.querySelector("#peserta-kategori thead");
  const tbody = document.querySelector("#peserta-kategori tbody");
  if (thead) thead.innerHTML = "<tr><th>Jenis</th><th>Terdaftar</th><th>Hadir</th><th>% Hadir</th></tr>";
  if (tbody) {
    if (!cats.length) { tbody.innerHTML = '<tr><td colspan="4" class="empty">Belum ada data peserta.</td></tr>'; }
    else tbody.innerHTML = cats.map((c) => {
      const t = perKat[c].ter, h = perKat[c].had;
      const pct = t > 0 ? Math.round(h / t * 100) + "%" : "0%";
      return `<tr><td>${c}</td><td>${t}</td><td>${h}</td><td>${pct}</td></tr>`;
    }).join("");
  }

  // ---- SDM terlibat per peran (jumlah) ----
  const sdmSet = {};
  header.forEach((h) => { const m = /^SDM (.+) \(jumlah\)$/.exec(h); if (m) sdmSet[m[1]] = 1; });
  const sdmPeran = Object.keys(sdmSet);
  const perSDM = {}; sdmPeran.forEach((p) => perSDM[p] = 0);
  rows.forEach((r) => { sdmPeran.forEach((p) => { perSDM[p] += num(r["SDM " + p + " (jumlah)"]); }); });
  const sthead = document.querySelector("#peserta-sdm thead");
  const stbody = document.querySelector("#peserta-sdm tbody");
  if (sthead) sthead.innerHTML = "<tr><th>Peran SDM</th><th>Jumlah Terlibat</th></tr>";
  if (stbody) {
    const filled = sdmPeran.filter((p) => perSDM[p] > 0);
    if (!filled.length) { stbody.innerHTML = '<tr><td colspan="2" class="empty">Belum ada data SDM.</td></tr>'; }
    else {
      let tot = 0; filled.forEach((p) => tot += perSDM[p]);
      stbody.innerHTML = filled.map((p) => `<tr><td>${p}</td><td>${perSDM[p]}</td></tr>`).join("") +
        `<tr><td><b>Total SDM</b></td><td><b>${tot}</b></td></tr>`;
    }
  }
}
function monthKey(v) {
  if (!v) return "";
  const d = new Date(v); if (isNaN(d)) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0");
}

function renderIssues(rows) {
  const order = { High: 0, Medium: 1, Low: 2 };
  const items = rows.filter((r) => ["High", "Medium", "Low"].includes(r.level))
    .sort((a, b) => order[a.level] - order[b.level]);
  const el = $("issues-list"); el.innerHTML = "";
  if (!items.length) { el.innerHTML = '<div class="empty">Tidak ada issue. 🎉</div>'; return; }
  items.slice(0, 8).forEach((r, i) => {
    const wrap = document.createElement("div");
    wrap.innerHTML =
      `<div class="issue ${r.level.toLowerCase()}">
        <div class="t">${r.ketisu || r.kegiatan || "-"}<small>${labelOf(r._prog)}</small></div>
        <button class="mini-btn issue-detail" type="button">Detail</button>
        <div class="lv">${r.level}</div>
      </div>
      <div class="issue-info" hidden>
        <div><b>PIC:</b> ${r.pic || "-"}</div>
        <div><b>Keterangan Issue:</b> ${r.ketisu || "-"}</div>
        <div><b>Issue dengan pihak (penyelenggara):</b> ${r.issuePihak || "-"}</div>
        <div><b>Problem Solving:</b> ${r.issueSolve || "-"}</div>
      </div>`;
    const info = wrap.querySelector(".issue-info");
    wrap.querySelector(".issue-detail").addEventListener("click", () => { info.hidden = !info.hidden; });
    el.appendChild(wrap);
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
let EDIT_ID = null;   // kalau sedang mengisi/edit baris milestone tertentu
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
function addSDMRow(peran, jml) {
  const box = $("rows-sdm"); if (!box) return;
  const row = document.createElement("div"); row.className = "sdm-block";
  row.innerHTML =
    '<div class="grid-2"><label>Peran<input class="s-peran" placeholder="mis. Dosen"></label>' +
    '<label>Jumlah<input class="s-jml" type="number" placeholder="0"></label></div>' +
    '<div class="sub" style="margin:2px 0 4px;">Daftar nama + unggah SK (file → Google Drive)</div>' +
    '<div class="sdm-names"></div>' +
    '<button type="button" class="btn-ghost s-addname">➕ Tambah nama</button> ' +
    '<button type="button" class="btn-ghost s-delrole" style="color:#DC2626;">✕ Hapus peran</button>';
  box.appendChild(row);
  if (peran) row.querySelector(".s-peran").value = peran;
  if (jml) row.querySelector(".s-jml").value = jml;
  const names = row.querySelector(".sdm-names");
  addSDMName(names);   // satu nama awal
  row.querySelector(".s-addname").addEventListener("click", () => addSDMName(names));
  row.querySelector(".s-delrole").addEventListener("click", () => row.remove());
}
function addSDMName(container, nama, link) {
  const nr = document.createElement("div"); nr.className = "sdm-name-row";
  nr.innerHTML =
    '<input class="s-nama" placeholder="nama orang">' +
    '<button type="button" class="btn-ghost s-upload"><i>📎</i> Unggah SK</button>' +
    '<span class="s-status"></span>' +
    '<input type="file" class="s-file" accept="application/pdf,image/*" hidden>' +
    '<button type="button" class="s-namedel" title="Hapus nama">✕</button>';
  container.appendChild(nr);
  if (nama) nr.querySelector(".s-nama").value = nama;
  const statusEl = nr.querySelector(".s-status");
  if (link) { statusEl.dataset.link = link; statusEl.innerHTML = '<a href="' + link + '" target="_blank">SK ✓</a>'; }
  const fileInput = nr.querySelector(".s-file");
  nr.querySelector(".s-upload").addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => uploadSK(nr));
  nr.querySelector(".s-namedel").addEventListener("click", () => nr.remove());
}
async function uploadSK(nr) {
  const file = nr.querySelector(".s-file").files[0];
  const statusEl = nr.querySelector(".s-status");
  if (!file) return;
  // format nama file: Jabatan_Nama
  const block = nr.closest(".sdm-block");
  const peran = (block.querySelector(".s-peran").value.trim() || "SDM").replace(/\s+/g, "");
  const nama = (nr.querySelector(".s-nama").value.trim() || "Tanpa Nama").replace(/\s+/g, "");
  const ext = (file.name.split(".").pop() || "pdf");
  const fname = peran + "_" + nama + "." + ext;
  if (!API_URL) { statusEl.textContent = "(demo) " + fname; return; }
  statusEl.textContent = "Mengunggah...";
  try {
    const b64 = await fileToBase64(file);
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "upload_sk", token: SESSION.token, name: fname, mime: file.type, data: b64 }) });
    const out = await res.json();
    if (out.ok) { statusEl.dataset.link = out.url; statusEl.innerHTML = '<a href="' + out.url + '" target="_blank">✓ ' + out.name + '</a>'; }
    else statusEl.textContent = "❌ " + (out.error || "gagal");
  } catch (e) { statusEl.textContent = "❌ gagal unggah"; }
}
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
function collectPeserta() {
  return [...document.querySelectorAll("#rows-peserta .dyn-row")].map((r) => ({
    kat: r.querySelector(".p-kat").value.trim(),
    ter: r.querySelector(".p-ter").value, had: r.querySelector(".p-had").value,
  })).filter((x) => x.kat);
}
function collectSDM() {
  return [...document.querySelectorAll("#rows-sdm .sdm-block")].map((b) => ({
    peran: b.querySelector(".s-peran").value.trim(),
    jml: b.querySelector(".s-jml").value,
    names: [...b.querySelectorAll(".sdm-name-row")].map((nr) => ({
      nama: nr.querySelector(".s-nama").value.trim(),
      link: nr.querySelector(".s-status").dataset.link || "",
    })).filter((n) => n.nama),
  })).filter((x) => x.peran);
}
function addIssueRow(nama, level, pihak, solve) {
  const box = $("rows-issue"); if (!box) return;
  const row = document.createElement("div"); row.className = "issue-row";
  const opts = (typeof OPSI_LEVEL_ISU !== "undefined" ? OPSI_LEVEL_ISU : ["Tidak Ada", "High", "Medium", "Low"])
    .map((o) => `<option>${o}</option>`).join("");
  row.innerHTML =
    '<div class="grid-2"><label>Tentukan Level Isu dulu<select class="i-level">' + opts + '</select></label><div></div></div>' +
    '<div class="i-detail" hidden>' +
      '<div class="grid-2"><label>Nama Isu<input class="i-nama" placeholder="mis. Jadwal bentrok"></label>' +
      '<label>Issue dengan pihak siapa (penyelenggara)?<input class="i-pihak" placeholder="mis. sekolah / mitra"></label></div>' +
      '<div class="grid-2"><label>Problem Solving<input class="i-solve" placeholder="penanganan yang dilakukan"></label><div></div></div>' +
    '</div>' +
    '<button type="button" class="btn-ghost i-del" style="margin-bottom:8px;">✕ Hapus issue</button>';
  box.appendChild(row);
  const lvl = row.querySelector(".i-level");
  const detail = row.querySelector(".i-detail");
  const sync = () => { detail.hidden = (lvl.value === "Tidak Ada" || lvl.value === ""); };
  lvl.addEventListener("change", sync);
  if (level) lvl.value = level;
  sync();
  if (nama) row.querySelector(".i-nama").value = nama;
  if (pihak) row.querySelector(".i-pihak").value = pihak;
  if (solve) row.querySelector(".i-solve").value = solve;
  row.querySelector(".i-del").addEventListener("click", () => row.remove());
}
function collectIssues() {
  return [...document.querySelectorAll("#rows-issue .issue-row")].map((r) => ({
    level: r.querySelector(".i-level").value,
    nama: r.querySelector(".i-nama").value.trim(),
    pihak: r.querySelector(".i-pihak").value.trim(),
    solve: r.querySelector(".i-solve").value.trim(),
  })).filter((x) => x.level && x.level !== "Tidak Ada");   // hanya yang benar-benar ada issue
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
      s.names.forEach((n, i) => {
        record["SDM " + s.peran + " - Nama " + (i + 1)] = n.nama;
        if (n.link) record["SK " + s.peran + " (" + n.nama + ")"] = n.link;
      });
    });
    // Issue paket (hanya yang diisi); kalau tak ada issue -> tak ada kolom issue
    collectIssues().forEach((it, i) => {
      const n = i + 1;
      record["Issue " + n + " Level"] = it.level;
      record["Issue " + n + " Nama"] = it.nama;
      record["Issue " + n + " Pihak (penyelenggara)"] = it.pihak;
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
  // Kalau sedang mengisi milestone (EDIT_ID ada) -> update baris itu (jadi On-Going)
  const body = EDIT_ID
    ? { action: "update_flex", token: SESSION.token, id: EDIT_ID, record: record }
    : { action: "write_flex", token: SESSION.token, program: program, record: record };
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    const out = await res.json();
    if (out.ok) {
      msg.textContent = EDIT_ID ? "✅ Milestone terisi & tersimpan." : "✅ Tersimpan. Isi lagi atau klik 'Tambahkan data lainnya'.";
      msg.classList.add("ok");
      EDIT_ID = null;
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
  EDIT_ID = null;
  ["f-tanggal", "f-kegiatan", "f-fase", "f-lokasi", "f-nilai", "f-feedback"].forEach((id) => { if ($(id)) $(id).value = ""; });
  if ($("f-keberjalanan")) $("f-keberjalanan").selectedIndex = 0;
  ["rows-peserta", "rows-sdm", "rows-issue", "extra-cols"].forEach((id) => { if ($(id)) $(id).innerHTML = ""; });
  // seed baris default peserta & SDM lagi
  addPesertaRow("SMA"); addPesertaRow("Universitas"); addSDMRow("Dosen");
  setInputMode("ongoing");
}

// tampilkan milestone aktif (di atas tabel) + tombol Isi
// milestone upcoming per program (belum lewat): dipakai untuk badge & daftar
function upcomingMilestones(key) {
  const label = labelOf(key);
  const flex = FLEX_CACHE || { rows: [] };
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return flex.rows.filter((r) => {
    const p = String(r["Program"] || "");
    if (!(p === key || p === label)) return false;
    if (String(r["Mode"] || "") !== "Upcoming Milestone") return false;
    const t = r["Tanggal Kegiatan"];
    if (!t) return true;                       // belum ada tanggal -> tetap upcoming
    const d = new Date(t); if (isNaN(d)) return true;
    return d >= now;                           // hanya yang belum lewat
  });
}

// status otomatis dari TANGGAL (konsisten di tabel, KPI, portfolio):
//  Upcoming  : hari ini < H-2
//  On-Going  : H-2 <= hari ini <= H+7
//  Selesai   : hari ini > H+7
function statusOf(r) {
  const t = r["Tanggal Kegiatan"];
  if (!t) return String(r["Mode"] || "") === "Upcoming Milestone" ? "Upcoming" : "On-Going";
  const d = new Date(t); if (isNaN(d)) return "On-Going";
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const from = new Date(d); from.setDate(from.getDate() - 2);
  const to = new Date(d); to.setDate(to.getDate() + 7);
  if (now < from) return "Upcoming";
  if (now > to) return "Selesai";
  return "On-Going";
}

// kartu Upcoming Milestone di halaman program
function renderProgramMilestones(key) {
  const host = $("prog-milestones"); if (!host) return;
  const items = upcomingMilestones(key);
  if (!items.length) { host.innerHTML = ""; return; }
  host.innerHTML =
    '<div class="card">' +
    '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">' +
      '<h3 style="margin:0;">Upcoming Milestone</h3>' +
      '<span class="notif-badge">' + items.length + '</span></div>' +
    items.map((r) => {
      const nm = r["Nama Kegiatan"] || "(tanpa nama)";
      const tg = r["Tanggal Kegiatan"] || "(belum ada tanggal)";
      const id = r["ID"] || "";
      return '<div class="ms-row"><div><b>' + nm + '</b>' +
        '<div class="sub">📅 ' + tg + '</div></div>' +
        '<div style="white-space:nowrap;">' +
        '<button class="mini-btn ok ms-fill" data-id="' + id + '">✍ Isi data</button> ' +
        '<button class="mini-btn ms-edit" data-id="' + id + '">✎ Edit</button></div></div>';
    }).join("") + '</div>';
  host.querySelectorAll(".ms-fill, .ms-edit").forEach((btn) => {
    btn.addEventListener("click", () => {
      const row = items.find((x) => String(x["ID"]) === btn.dataset.id);
      if (row) { gotoInputForMilestone(key); fillMilestone(row); }
    });
  });
}

// badge notif jumlah milestone di tiap menu program
function renderNavBadges() {
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    const v = btn.dataset.view;
    if (v === "dashboard" || v === "input") return;
    let badge = btn.querySelector(".nav-badge");
    const n = upcomingMilestones(v).length;
    if (n > 0) {
      if (!badge) { badge = document.createElement("span"); badge.className = "nav-badge"; btn.appendChild(badge); }
      badge.textContent = n;
    } else if (badge) { badge.remove(); }
  });
}

// pindah ke Input Data untuk mengisi milestone program tertentu
function gotoInputForMilestone(key) {
  const navInput = document.querySelector('.nav-item[data-view="input"]');
  setActiveNav(navInput); showView("input");
  if ($("in-program")) { $("in-program").value = key; renderInput(key); }
}

function fillMilestone(row) {
  const ff = $("form-fields"); if (ff) ff.hidden = false;
  if ($("btn-show-form")) $("btn-show-form").textContent = "✖ Tutup Form";
  clearForm();
  EDIT_ID = row["ID"] || null;
  if ($("f-kegiatan")) $("f-kegiatan").value = row["Nama Kegiatan"] || "";
  if ($("f-tanggal")) $("f-tanggal").value = toDateInput(row["Tanggal Kegiatan"]);
  if ($("f-fase")) $("f-fase").value = row["Fase Kegiatan"] || "";
  if ($("f-lokasi")) $("f-lokasi").value = row["Lokasi / Alamat"] || "";
  setInputMode("ongoing");
  ff.scrollIntoView({ behavior: "smooth", block: "start" });
}
function toDateInput(v) {
  if (!v) return "";
  const d = new Date(v); if (isNaN(d)) return "";
  return d.toISOString().slice(0, 10);
}

// ------------------------------------------------------------- filters ------
function rebuildFilters() {
  // Program
  fillSelect($("flt-program"), ["Semua", ...PROGRAMS.map((p) => p.label)], selValue($("flt-program")));
  // kumpulkan semua baris dari DataMasuk (dikonversi)
  const all = ((FLEX_CACHE && FLEX_CACHE.rows) || []).map(flexToStd);
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
  const isFinancial = view === "financial";
  const isProgram = !isDash && !isInput && !isFinancial;

  $("view-dash").hidden = !isDash;
  $("view-input").hidden = !isInput;
  $("view-financial").hidden = !isFinancial;
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
  } else if (isFinancial) {
    renderFinancial();
  } else {
    // dashboard per program (lihat saja) — data dari DataMasuk
    const p = programByKey(view);
    $("prog-title").textContent = "Dashboard Program · " + (p ? p.label : view);
    renderProgramDash(view);
    renderProgramMilestones(view);
    renderGantt(view);
    renderMitra(view);
    renderProgFlexTable(view);
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

let FIN_CACHE = null;
async function loadFin() {
  if (!API_URL) { FIN_CACHE = FIN_CACHE || { rows: [] }; return; }
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "read_fin" }) });
    const out = await res.json();
    if (out.ok) FIN_CACHE = { rows: out.rows || [] };
  } catch (e) { console.error("read_fin gagal:", e); }
}

async function loadFlex() {
  if (!API_URL) { FLEX_CACHE = FLEX_CACHE || { header: [], rows: [] }; buildColHistory(); return; }
  try {
    const res = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "read_flex" }),
    });
    const out = await res.json();
    if (out.ok) FLEX_CACHE = { header: out.header || [], rows: out.rows || [] };
  } catch (e) { console.error("read_flex gagal:", e); }
  buildColHistory();
  renderNavBadges();
  if ($("view-dash") && !$("view-dash").hidden) renderPeserta();
}

// riwayat semua nama kolom yang pernah ada (dari semua program) -> datalist
function buildColHistory() {
  const dl = $("col-history"); if (!dl) return;
  const sys = { "ID": 1, "Waktu Input": 1, "Program": 1, "PIC": 1, "Mode": 1 };
  const cols = ((FLEX_CACHE && FLEX_CACHE.header) || []).filter((h) => h && !sys[h]);
  dl.innerHTML = [...new Set(cols)].map((c) => `<option value="${String(c).replace(/"/g, "&quot;")}">`).join("");
}

function renderFlexTable(key) {
  const label = labelOf(key);
  const thead = document.querySelector("#flex-table thead");
  const tbody = document.querySelector("#flex-table tbody");
  if (!thead || !tbody) return;
  const flex = FLEX_CACHE || { header: [], rows: [] };
  const header = (flex.header.length ? flex.header : ["ID", "Waktu Input", "Program", "PIC"]).filter((h) => h !== "Mode");
  // tampilkan semua data untuk program terpilih (cocokkan kode ATAU label)
  const rows = flex.rows.filter((r) => {
    const p = String(r["Program"] || "");
    return p === key || p === label;
  });
  thead.innerHTML = "<tr><th>Status</th>" + header.map((h) => `<th>${h}</th>`).join("") + "<th>Aksi</th></tr>";
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="${header.length + 2}" class="empty">Belum ada data untuk ${label}.</td></tr>`;
    return;
  }
  tbody.innerHTML = "";
  rows.forEach((r) => {
    const tr = document.createElement("tr");
    tr.dataset.id = r["ID"] || "";
    const st = statusOf(r);
    const stTd = document.createElement("td");
    stTd.innerHTML = '<span class="status-badge st-' + st.toLowerCase().replace(/[^a-z]/g, "") + '">' + st + '</span>';
    tr.appendChild(stTd);
    header.forEach((h) => {
      const td = document.createElement("td");
      td.dataset.col = h;
      let v = (r[h] !== undefined && r[h] !== null) ? r[h] : "";
      if (h === "Tanggal Kegiatan") v = fmtTanggal(v);
      td.textContent = v;
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

// format tanggal -> dd/mm/yyyy
function fmtTanggal(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return v;
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return dd + "/" + mm + "/" + d.getFullYear();
}

// tabel program (read-only) dari DataMasuk
// ===== Timeline Gantt per fase =====
function drawGantt(host, items) {
  if (!host) return;
  if (!items.length) { host.innerHTML = '<div class="empty">Belum ada data fase.</div>'; return; }
  const byFase = {};
  items.forEach((x) => {
    const f = x.fase;
    if (!byFase[f]) byFase[f] = { min: x.d, max: x.d, count: 0 };
    if (x.d < byFase[f].min) byFase[f].min = x.d;
    if (x.d > byFase[f].max) byFase[f].max = x.d;
    byFase[f].count++;
  });
  let gMin = items[0].d, gMax = items[0].d;
  items.forEach((x) => { if (x.d < gMin) gMin = x.d; if (x.d > gMax) gMax = x.d; });
  const span = Math.max((gMax - gMin) / 86400000, 1);
  const warna = { "persiapan": "#2F6FB0", "pelaksanaan": "#16A34A", "pelaporan": "#F59E0B", "proses": "#8B5CF6", "evaluasi": "#DC2626" };
  const fmt = (d) => String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
  let html = '<div class="gantt">';
  Object.keys(byFase).sort((a, b) => byFase[a].min - byFase[b].min).forEach((f) => {
    const o = byFase[f];
    const left = ((o.min - gMin) / 86400000) / span * 100;
    const width = Math.max(((o.max - o.min) / 86400000 + 1) / span * 100, 2);
    const c = warna[f.toLowerCase()] || "#64748B";
    html += '<div class="gantt-row"><div class="gantt-lab">' + f + '</div>' +
      '<div class="gantt-track"><div class="gantt-bar" style="left:' + left + '%;width:' + width + '%;background:' + c + ';" title="' + f + ': ' + fmt(o.min) + '–' + fmt(o.max) + '">' +
      '<span>' + fmt(o.min) + '–' + fmt(o.max) + ' · ' + o.count + ' hari</span></div></div></div>';
  });
  html += '<div class="gantt-axis"><span>' + fmt(gMin) + '</span><span>' + fmt(gMax) + '</span></div></div>';
  host.innerHTML = html;
}
function ganttItems(rawRows) {
  return rawRows.map((r) => ({ d: new Date(r["Tanggal Kegiatan"]), fase: String(r["Fase Kegiatan"] || "").trim() }))
    .filter((x) => x.fase && !isNaN(x.d));
}
function renderGantt(key) {
  const label = labelOf(key);
  const flex = FLEX_CACHE || { rows: [] };
  const raw = flex.rows.filter((r) => { const p = String(r["Program"] || ""); return p === key || p === label; });
  drawGantt($("prog-gantt"), ganttItems(raw));
}

// palet warna per program (indeks stabil sesuai urutan PROGRAMS)
const PROG_COLORS = ["#2F6FB0", "#16A34A", "#F59E0B", "#8B5CF6", "#DC2626", "#0EA5E9", "#DB2777", "#65A30D", "#9333EA"];
function progColor(key) {
  const i = PROGRAMS.findIndex((p) => p.key === key);
  return PROG_COLORS[(i < 0 ? 0 : i) % PROG_COLORS.length];
}

// versi dashboard utama: timeline fase PER PROGRAM (warna beda) + legenda
function renderDashGantt() {
  const host = $("dash-gantt"); if (!host) return;
  const flex = FLEX_CACHE || { rows: [] };
  const fpLabel = selValue($("flt-program")), fb = selValue($("flt-bulan"));
  const fp = filterProgramToKey(fpLabel);
  let raw = flex.rows.slice();
  if (fp && fp !== "Semua") raw = raw.filter((r) => keyFromStored(r["Program"]) === fp);
  if (fb && fb !== "Semua") raw = raw.filter((r) => monthLabel(r["Tanggal Kegiatan"]) === fb);

  // kumpulkan (program, fase, tanggal)
  const data = raw.map((r) => ({ prog: keyFromStored(r["Program"]), d: new Date(r["Tanggal Kegiatan"]), fase: String(r["Fase Kegiatan"] || "").trim() }))
    .filter((x) => x.fase && !isNaN(x.d));
  if (!data.length) { host.innerHTML = '<div class="empty">Belum ada data fase.</div>'; return; }

  // batas waktu global
  let gMin = data[0].d, gMax = data[0].d;
  data.forEach((x) => { if (x.d < gMin) gMin = x.d; if (x.d > gMax) gMax = x.d; });
  const span = Math.max((gMax - gMin) / 86400000, 1);
  const fmt = (d) => String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");

  // group per program -> per fase (rentang)
  const progs = [...new Set(data.map((x) => x.prog))];
  let html = '<div class="gantt">';
  progs.forEach((pk) => {
    const rowsP = data.filter((x) => x.prog === pk);
    const byFase = {};
    rowsP.forEach((x) => {
      if (!byFase[x.fase]) byFase[x.fase] = { min: x.d, max: x.d, count: 0 };
      if (x.d < byFase[x.fase].min) byFase[x.fase].min = x.d;
      if (x.d > byFase[x.fase].max) byFase[x.fase].max = x.d;
      byFase[x.fase].count++;
    });
    const c = progColor(pk);
    Object.keys(byFase).sort((a, b) => byFase[a].min - byFase[b].min).forEach((f) => {
      const o = byFase[f];
      const left = ((o.min - gMin) / 86400000) / span * 100;
      const width = Math.max(((o.max - o.min) / 86400000 + 1) / span * 100, 2);
      html += '<div class="gantt-row"><div class="gantt-lab">' + labelOf(pk) + ' · ' + f + '</div>' +
        '<div class="gantt-track"><div class="gantt-bar" style="left:' + left + '%;width:' + width + '%;background:' + c + ';" title="' + labelOf(pk) + ' - ' + f + ': ' + fmt(o.min) + '–' + fmt(o.max) + '">' +
        '<span>' + fmt(o.min) + '–' + fmt(o.max) + '</span></div></div></div>';
    });
  });
  html += '<div class="gantt-axis"><span>' + fmt(gMin) + '</span><span>' + fmt(gMax) + '</span></div></div>';
  // legenda program
  html += '<div class="gantt-legend">' + progs.map((pk) =>
    '<span><i style="background:' + progColor(pk) + '"></i>' + labelOf(pk) + '</span>').join("") + '</div>';
  host.innerHTML = html;
}

// ubah link Google Drive jadi URL gambar thumbnail
function driveThumb(url) {
  if (!url) return "";
  const m = String(url).match(/[-\w]{25,}/);
  return m ? ("https://drive.google.com/thumbnail?id=" + m[0] + "&sz=w400") : "";
}
// showcase Mitra: logo + nama (dari kolom SDM Mitra + SK Mitra)
function renderMitra(key) {
  const host = $("prog-mitra"); if (!host) return;
  const label = labelOf(key);
  const flex = FLEX_CACHE || { rows: [] };
  const rows = flex.rows.filter((r) => { const p = String(r["Program"] || ""); return p === key || p === label; });
  const mitra = [];
  rows.forEach((r) => {
    Object.keys(r).forEach((k) => {
      const m = /^SDM Mitra - Nama \d+$/.exec(k);
      if (m && String(r[k] || "").trim()) {
        const nama = String(r[k]).trim();
        const logo = driveThumb(r["SK Mitra (" + nama + ")"] || "");
        if (!mitra.some((x) => x.nama === nama)) mitra.push({ nama, logo });
      }
    });
  });
  if (!mitra.length) { host.innerHTML = '<div class="empty">Belum ada data mitra.</div>'; return; }
  host.innerHTML = '<div class="mitra-grid">' + mitra.map((mt) => {
    const img = mt.logo
      ? '<img src="' + mt.logo + '" alt="' + mt.nama + '" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\';">'
      : "";
    const initials = mt.nama.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
    return '<div class="mitra-card">' + img +
      '<div class="mitra-ph"' + (mt.logo ? ' style="display:none;"' : "") + '>' + initials + '</div>' +
      '<div class="mitra-nm">' + mt.nama + '</div></div>';
  }).join("") + "</div>";
}

function renderProgFlexTable(key) {
  const label = labelOf(key);
  const thead = document.querySelector("#prog-table thead");
  const tbody = document.querySelector("#prog-table tbody");
  if (!thead || !tbody) return;
  const flex = FLEX_CACHE || { header: [], rows: [] };
  const header = (flex.header.length ? flex.header : ["ID", "Waktu Input", "Program", "PIC"]).filter((h) => h !== "Mode");
  const rows = flex.rows.filter((r) => { const p = String(r["Program"] || ""); return p === key || p === label; });
  thead.innerHTML = "<tr><th>Status</th>" + header.map((h) => `<th>${h}</th>`).join("") + "</tr>";
  if (!rows.length) { tbody.innerHTML = `<tr><td colspan="${header.length + 1}" class="empty">Belum ada data untuk ${label}.</td></tr>`; return; }
  tbody.innerHTML = rows.map((r) => {
    const st = statusOf(r);
    return '<tr><td><span class="status-badge st-' + st.toLowerCase().replace(/[^a-z]/g, "") + '">' + st + "</span></td>" +
      header.map((h) => {
        let v = (r[h] !== undefined && r[h] !== null) ? r[h] : "";
        if (h === "Tanggal Kegiatan") v = fmtTanggal(v);
        return "<td>" + v + "</td>";
      }).join("") + "</tr>";
  }).join("");
}

// Financial: rekap anggaran/realisasi dari DataMasuk (kolom yang mengandung 'Anggaran'/'Realisasi')
function renderFinancial() {
  const fin = FIN_CACHE || { rows: [] };
  const perProg = {};
  fin.rows.forEach((r) => {
    const prog = labelFromStored(r["Program"]);
    perProg[prog] = perProg[prog] || { ang: 0, real: 0 };
    perProg[prog].ang += num(r["Anggaran"]);
    perProg[prog].real += num(r["Realisasi"]);
  });
  let totA = 0, totR = 0;
  Object.keys(perProg).forEach((p) => { totA += perProg[p].ang; totR += perProg[p].real; });
  if ($("fin-anggaran")) $("fin-anggaran").textContent = fmtRupiah(totA);
  if ($("fin-realisasi")) $("fin-realisasi").textContent = fmtRupiah(totR);
  if ($("fin-sisa")) $("fin-sisa").textContent = fmtRupiah(totA - totR);
  if ($("fin-serap")) $("fin-serap").textContent = totA > 0 ? Math.round(totR / totA * 100) + "%" : "0%";

  // dropdown program di form (yang boleh diakses)
  const sel = $("fin-program");
  if (sel && !sel.options.length) {
    const allowed = PROGRAMS.filter((p) => canAccessProgram(p.key));
    sel.innerHTML = (allowed.length ? allowed : PROGRAMS).map((p) => `<option value="${p.key}">${p.label}</option>`).join("");
  }

  const thead = document.querySelector("#fin-table thead");
  const tbody = document.querySelector("#fin-table tbody");
  if (thead) thead.innerHTML = "<tr><th>Program</th><th>Anggaran</th><th>Realisasi</th><th>Sisa</th><th>% Serapan</th></tr>";
  const keys = Object.keys(perProg);
  if (tbody) {
    if (!keys.length) { tbody.innerHTML = '<tr><td colspan="5" class="empty">Belum ada data keuangan. Klik "Input Keuangan" untuk menambah.</td></tr>'; return; }
    tbody.innerHTML = keys.map((p) => {
      const a = perProg[p].ang, rl = perProg[p].real;
      const serap = a > 0 ? Math.round(rl / a * 100) + "%" : "0%";
      return `<tr><td>${p}</td><td>${fmtRupiah(a)}</td><td>${fmtRupiah(rl)}</td><td>${fmtRupiah(a - rl)}</td><td>${serap}</td></tr>`;
    }).join("");
  }
}

async function simpanFinancial() {
  const msg = $("fin-msg"); msg.textContent = ""; msg.className = "save-msg";
  if (!SESSION) { msg.textContent = "Belum login."; msg.classList.add("err"); return; }
  const program = $("fin-program").value;
  const record = {
    Program: program, Kategori: $("fin-kategori").value.trim(), Uraian: $("fin-uraian").value.trim(),
    Anggaran: $("fin-in-anggaran").value, Realisasi: $("fin-in-realisasi").value, Keterangan: $("fin-ket").value.trim(),
  };
  if (!record.Anggaran && !record.Realisasi) { msg.textContent = "Isi Anggaran/Realisasi."; msg.classList.add("err"); return; }
  if (!API_URL) { msg.textContent = "Mode contoh — belum ke Sheets."; msg.classList.add("ok"); return; }
  msg.textContent = "Menyimpan...";
  try {
    const res = await fetch(API_URL, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "write_fin", token: SESSION.token, program: program, record: record }) });
    const out = await res.json();
    if (out.ok) {
      msg.textContent = "✅ Tersimpan ke sheet Financial."; msg.classList.add("ok");
      ["fin-kategori", "fin-uraian", "fin-ket", "fin-in-anggaran", "fin-in-realisasi"].forEach((id) => { if ($(id)) $(id).value = ""; });
      await loadFin(); renderFinancial();
    } else { msg.textContent = "❌ " + (out.error || "Gagal."); msg.classList.add("err"); }
  } catch (e) { msg.textContent = "❌ Gagal terhubung."; msg.classList.add("err"); }
}
function num(v) { const n = parseFloat(String(v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; }
function labelFromStored(p) {
  p = String(p || "");
  const byKey = PROGRAMS.find((x) => x.key === p);
  return byKey ? byKey.label : p;
}
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
  const readonly = { "Kehadiran (%)": 1 };   // otomatis, tak boleh diedit
  const kolomBerjalanan = "Keberjalanan Kegiatan";
  [...tr.querySelectorAll("td")].forEach((td) => {
    const col = td.dataset.col;
    if (!col || skip[col]) return;
    const val = td.textContent;
    if (readonly[col]) {
      td.innerHTML = `<span style="color:#6B7688;font-style:italic;">${val || "otomatis"}</span>`;
      return;
    }
    if (col === kolomBerjalanan) {
      const opts = ["", ...(typeof OPSI_KEBERJALANAN !== "undefined" ? OPSI_KEBERJALANAN : ["Sesuai Rencana", "Ada Kendala", "Tidak Sesuai Rencana", "Tidak Ada Penilaian"])];
      td.innerHTML = '<select style="width:100%;height:30px;">' +
        opts.map((o) => `<option${o === val ? " selected" : ""}>${o}</option>`).join("") + "</select>";
      return;
    }
    td.innerHTML = `<input value="${String(val).replace(/"/g, "&quot;")}" style="width:100%;height:30px;">`;
  });
  const act = tr.querySelector(".act-cell");
  act.innerHTML = '<button class="mini-btn ok">✔ OK</button> <button class="mini-btn cancel">Batal</button>';
  act.querySelector(".cancel").addEventListener("click", () => renderFlexTable(key));
  act.querySelector(".ok").addEventListener("click", () => {
    const rec = {};
    [...tr.querySelectorAll("td")].forEach((td) => {
      const col = td.dataset.col; if (!col || skip[col] || readonly[col]) return;
      const field = td.querySelector("input, select");
      if (field) rec[col] = field.value;
    });
    // hitung ulang Kehadiran (%) otomatis dari peserta terdaftar/hadir
    let tt = 0, th = 0;
    Object.keys(rec).forEach((k) => {
      if (/^Peserta .+ \(terdaftar\)$/i.test(k)) tt += num(rec[k]);
      if (/^Peserta .+ \(hadir\)$/i.test(k)) th += num(rec[k]);
    });
    if (tt > 0) rec["Kehadiran (%)"] = Math.round(th / tt * 100);
    updateRow(r["ID"], rec, key);
  });
}

// ---- Kolom Tambahan (dinamis) ----
function addExtraCol(name, val) {
  const box = $("extra-cols"); if (!box) return;
  const row = document.createElement("div");
  row.className = "extra-row";
  row.innerHTML = '<input class="xcol-name" list="col-history" placeholder="Pilih riwayat / ketik nama baru" />' +
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
  const label = labelOf(key);
  const flex = FLEX_CACHE || { rows: [] };
  const rows = flex.rows.filter((r) => { const p = String(r["Program"] || ""); return p === key || p === label; }).map(flexToStd);
  const total = rows.filter((r) => (r.kegiatan || "").trim()).length;
  const selesai = rows.filter((r) => (r.kegiatan || "").trim() && r.status === "Selesai").length;
  const fin = finForProgram(key);
  if ($("pk-progress")) $("pk-progress").textContent = total > 0 ? Math.round(selesai / total * 100) + "%" : "0%";
  if ($("pk-upcoming")) $("pk-upcoming").textContent = rows.filter((r) => r.status === "Upcoming").length;
  if ($("pk-ongoing")) $("pk-ongoing").textContent = rows.filter((r) => r.status === "On-Going").length;
  if ($("pk-selesai")) $("pk-selesai").textContent = selesai;
  if ($("pk-anggaran")) $("pk-anggaran").textContent = fmtRupiah(fin.ang);
  if ($("pk-realisasi")) $("pk-realisasi").textContent = fmtRupiah(fin.ang - fin.real);
}
function finForProgram(key) {
  const label = labelOf(key);
  const fin = FIN_CACHE || { rows: [] };
  let ang = 0, real = 0;
  fin.rows.forEach((r) => {
    const p = String(r["Program"] || "");
    if (p === key || p === label) { ang += num(r["Anggaran"]); real += num(r["Realisasi"]); }
  });
  return { ang: ang, real: real };
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

  // --- muat data (DataMasuk utama untuk dashboard) ---
  try {
    await loadFlex();          // data utama dari DataMasuk
    await loadFin();           // data keuangan dari sheet Financial
    await loadData();          // data lama (_2026) untuk cadangan/kalender bila ada
    rebuildFilters();
    render();
  } catch (e) { console.error("Gagal muat data:", e); }

  $("btn-simpan").addEventListener("click", simpan);
  $("in-program").addEventListener("change", () => renderInput($("in-program").value));
  $("btn-refresh").addEventListener("click", async () => { await loadFlex(); await loadData(); rebuildFilters(); render(); });
  if ($("cal-prev")) $("cal-prev").addEventListener("click", () => calShift(-1));
  if ($("cal-next")) $("cal-next").addEventListener("click", () => calShift(1));
  if ($("btn-add-col")) $("btn-add-col").addEventListener("click", () => addExtraCol());
  if ($("btn-refresh-flex")) $("btn-refresh-flex").addEventListener("click", async () => {
    const b = $("btn-refresh-flex"); const t = b.textContent; b.textContent = "⏳ Memuat...";
    await loadFlex(); renderFlexTable($("in-program").value); b.textContent = t;
  });
  if ($("fin-show-form")) $("fin-show-form").addEventListener("click", () => {
    const f = $("fin-form"); f.hidden = !f.hidden;
    $("fin-show-form").textContent = f.hidden ? "➕ Input Keuangan" : "✖ Tutup Form";
  });
  if ($("fin-simpan")) $("fin-simpan").addEventListener("click", simpanFinancial);
  loadFlex();
  ["flt-program", "flt-bulan", "flt-kegiatan", "flt-level"].forEach((id) =>
    $(id).addEventListener("change", () => { if (id === "flt-program") rebuildFilters(); render(); }));
}

window.addEventListener("DOMContentLoaded", init);
