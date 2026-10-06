// Helper murni (tanpa DOM) — dipindahkan dari app.js lama.
import { ALL_ACCESS_ROLES, FINANCE_ONLY_ROLES, FIN_PROGRAMS, OPSI_FASE, PROGRAMS } from "../config.js";

export const fmtRupiah = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
export const KEBER_SKOR = { "sesuai rencana": 1, "ada kendala": 0.7, "tidak sesuai rencana": 0.4 };

export function num(v) { const n = parseFloat(String(v).replace(/[^0-9.-]/g, "")); return isNaN(n) ? 0 : n; }

// --------------------------------------------------------------- program ---
const allPrograms = () => PROGRAMS.concat(FIN_PROGRAMS);
export function programByKey(key) { return allPrograms().find((p) => p.key === key); }
export function labelOf(key) { const p = programByKey(key); return p ? p.label : key; }
export function keyFromStored(p) {
  p = String(p || "");
  const f = allPrograms().find((x) => x.key === p || x.label === p);
  return f ? f.key : p;
}
export function labelFromStored(p) {
  p = String(p || "");
  const byKey = allPrograms().find((x) => x.key === p);
  return byKey ? byKey.label : p;
}
// ID baris DataMasuk: <4 digit acak>-<dd>-<mm>-<yyyy kegiatan>/<program>/<fase>, mis. 4821-06-10-2026/SIAP/Fase1
// (fase tanpa spasi; "-" bila kosong). `taken` = ID yang sudah ada, supaya tidak dobel.
export function makeFlexId(programKey, fase, date = new Date(), taken = new Set()) {
  const pad = (n) => String(n).padStart(2, "0");
  const tgl = pad(date.getDate()) + "-" + pad(date.getMonth() + 1) + "-" + date.getFullYear();
  const jenis = String(fase || "").replace(/\s+/g, "") || "-";
  let id;
  do id = (1000 + Math.floor(Math.random() * 9000)) + "-" + tgl + "/" + programKey + "/" + jenis;
  while (taken.has(id));
  return id;
}
// baris DataMasuk milik program `key` (kolom Program berisi kode ATAU label)
export function rowIsProgram(r, key) {
  const p = String(r["Program"] || "");
  return p === key || p === labelOf(key);
}
// mapping label program di filter -> key
export function filterProgramToKey(label) {
  if (label === "Semua") return "Semua";
  const p = PROGRAMS.find((x) => x.label === label);
  return p ? p.key : "Semua";
}

// palet warna per program (indeks stabil sesuai urutan PROGRAMS)
export const PROG_COLORS = ["#2F6FB0", "#16A34A", "#F59E0B", "#8B5CF6", "#DC2626", "#0EA5E9", "#DB2777", "#65A30D", "#9333EA"];
export function progColor(key) {
  const i = PROGRAMS.findIndex((p) => p.key === key);
  return PROG_COLORS[(i < 0 ? 0 : i) % PROG_COLORS.length];
}

// ---------------------------------------------------------------- akses ---
export const isAllAccess = (jab) => ALL_ACCESS_ROLES.includes(jab);
export const isFinanceOnly = (jab) => FINANCE_ONLY_ROLES.includes(jab);
export function canAccessProgram(session, key) {
  if (!session) return false;
  if (isFinanceOnly(session.jabatan)) return false;   // Finance tak boleh input data program
  if (isAllAccess(session.jabatan)) return true;
  return (session.programs || []).includes(key);
}

// -------------------------------------------------------------- tanggal ---
// Parser tanggal universal: menerima Date, ISO (yyyy-mm-dd) & dd/mm/yyyy
export function parseTgl(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s);           // ISO
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = /^(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})/.exec(s);       // dd/mm/yyyy (Indonesia)
  if (m) { let yy = +m[3]; if (yy < 100) yy += 2000; return new Date(yy, +m[2] - 1, +m[1]); }
  const d = new Date(s); return isNaN(d) ? null : d;
}
// tanggal wajar? (buang typo tahun spt 2006/2035 dari perhitungan skala timeline)
export function tglWajar(d) { if (!d) return false; const y = d.getFullYear(); return y >= 2020 && y <= 2035; }
export function monthLabel(d) {
  const dt = parseTgl(d);
  return dt ? dt.toLocaleDateString("id-ID", { month: "short", year: "numeric" }) : "";
}
export function yearOf(v) { const d = parseTgl(v); return d ? String(d.getFullYear()) : ""; }
// format tanggal -> dd/mm/yyyy
export function fmtTanggal(v) {
  if (!v) return "";
  const d = new Date(v);
  if (isNaN(d)) return v;
  return String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0") + "/" + d.getFullYear();
}
export function toDateInput(v) {
  const d = parseTgl(v); if (!d) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
// daftar label bulan unik, urut kronologis
export function monthOptions(values) {
  const mm = {};
  values.forEach((v) => { const d = parseTgl(v); if (d) mm[monthLabel(v)] = d.getFullYear() * 12 + d.getMonth(); });
  return Object.keys(mm).sort((a, b) => mm[a] - mm[b]);
}

// urutan fase tetap: Persiapan -> Proses -> Fase 1..10 -> Pelaporan (dari OPSI_FASE)
export function faseRank(f) {
  const i = OPSI_FASE.findIndex((x) => x.toLowerCase() === String(f || "").trim().toLowerCase());
  return i < 0 ? 999 : i;
}

// unik + urut (bahasa Indonesia, angka natural)
export function uniqSorted(arr) {
  return [...new Set(arr.filter((x) => x !== "" && x !== undefined && x !== null))]
    .sort((a, b) => String(a).localeCompare(String(b), "id", { numeric: true }));
}
// nilai select yang masih valid untuk daftar opsi (meniru fillSelect lama)
export function keepOption(opts, value) { return opts.includes(value) ? value : opts[0]; }

// ----------------------------------------------------- status kegiatan ---
// status otomatis dari TANGGAL (konsisten di tabel, KPI, portfolio):
//  Upcoming : hari ini < H-2 · On-Going : H-2..H+7 · Selesai : hari ini > H+7
function inWindow(d) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const from = new Date(d); from.setDate(from.getDate() - 2);
  const to = new Date(d); to.setDate(to.getDate() + 7);
  return now < from ? "before" : now > to ? "after" : "in";
}
export function statusOf(r) {
  if (String(r["Status Manual"] || "").toLowerCase() === "selesai") return "Selesai";   // tombol "Selesai"
  const t = r["Tanggal Kegiatan"];
  if (!t) return String(r["Mode"] || "") === "Upcoming Milestone" ? "Upcoming" : "On-Going";
  const d = parseTgl(t); if (!d) return "On-Going";
  const w = inWindow(d);
  return w === "before" ? "Upcoming" : w === "after" ? "Selesai" : "On-Going";
}
// label tampilan Bahasa Indonesia untuk nilai status/level (nilai aslinya di Sheets tidak diubah)
const ID_LABEL = { "Upcoming": "Akan Datang", "On-Going": "Berlangsung", "High": "Tinggi", "Medium": "Sedang", "Low": "Rendah" };
export const idLabel = (v) => ID_LABEL[v] ?? v;
export const statusClass = (st) => "st-" + st.toLowerCase().replace(/[^a-z]/g, "");
export function milestoneNeedsDate(r) { return String(r["Mode"] || "") === "Upcoming Milestone"; }
export function milestoneActive(r) {
  const t = r["Tanggal Kegiatan"];
  if (!t) return true;                       // belum ada tanggal -> boleh diisi
  const d = new Date(t); if (isNaN(d)) return true;
  return inWindow(d) === "in";               // aktif H-2 sampai H+7
}

// milestone upcoming per program (belum lewat): dipakai untuk badge & daftar
export function upcomingMilestones(flexRows, key) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  return flexRows.filter((r) => {
    if (!rowIsProgram(r, key)) return false;
    if (String(r["Status Manual"] || "").toLowerCase() === "selesai") return false;
    if (String(r["Mode"] || "") !== "Upcoming Milestone") return false;
    if (statusOf(r) === "On-Going") return false;   // sudah masuk window On-Going (biar tak dobel)
    const d = parseTgl(r["Tanggal Kegiatan"]);
    return !d || d >= now;
  });
}
// kegiatan berstatus On-Going (H-2..H+7) untuk program tertentu
export function ongoingItems(flexRows, key) {
  return flexRows.filter((r) => rowIsProgram(r, key) && statusOf(r) === "On-Going");
}

// ---------------------------------------------- DataMasuk -> bentuk standar ---
function sumColsMatch(r, re) {
  let s = 0; Object.keys(r).forEach((k) => { if (re.test(k)) s += num(r[k]); }); return s;
}
function primaryIssue(r) {
  const rank = { High: 3, Medium: 2, Low: 1 };
  let best = "", name = "", pihak = "", solve = "";
  Object.keys(r).forEach((k) => {
    if (!/^Issue \d+ Level$/.test(k) && k !== "Level Isu") return;
    const lv = String(r[k] || "");
    if (!rank[lv] || (best && rank[lv] <= rank[best])) return;
    best = lv;
    if (k === "Level Isu") {
      name = r["Keterangan Isu"] || ""; pihak = r["Issue dengan pihak"] || ""; solve = r["Penanganan"] || "";
    } else {
      const base = k.replace(" Level", "");
      name = r[base + " Nama"] || ""; pihak = r[base + " Pihak (penyelenggara)"] || ""; solve = r[base + " Problem Solving"] || "";
    }
  });
  return { level: best, name, pihak, solve };
}
const ISSUE_SKOR = { High: 0.4, Medium: 0.6, Low: 0.8 };
export function flexToStd(r) {
  const iss = primaryIssue(r);
  return {
    id: r["ID"] || "",
    _prog: keyFromStored(r["Program"]),
    kegiatan: r["Nama Kegiatan"] || "",
    tanggal: r["Tanggal Kegiatan"] || "",
    fase: String(r["Fase Kegiatan"] || "").trim(),
    lokasi: r["Lokasi / Alamat"] || "",
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
    issueAlert: ISSUE_SKOR[iss.level] ?? 1,
    pic: r["PIC"] || "",
    jenis: String(r["Mode"] || "") === "Upcoming Milestone" ? (r["Nama Kegiatan"] || "Milestone") : "",
    status: statusOf(r),
  };
}

export function programProgress(rows) {
  const scores = [];
  rows.forEach((r) => {
    const comps = [];
    ["nilai", "hadir", "feedback"].forEach((k) => { if (r[k] > 0) comps.push(Math.min(r[k], 1)); });
    const kb = KEBER_SKOR[(r.keberjalanan || "").toLowerCase()];
    if (kb !== undefined) comps.push(kb);
    if (r.issueAlert !== undefined) comps.push(r.issueAlert);   // komponen Issue & Alert
    if (comps.length) scores.push(comps.reduce((a, b) => a + b, 0) / comps.length);
  });
  return scores.length ? Math.min(scores.reduce((a, b) => a + b, 0) / scores.length, 1) : 0;
}
export function progressStatus(p) {
  if (p >= 0.8) return ["On Track", "ok"];
  if (p >= 0.6) return ["Attention", "warn"];
  return ["Critical", "crit"];
}

// ------------------------------------------------------------ nama orang ---
// Normalisasi nama orang agar penulisan berbeda dianggap orang yang sama:
// "1. Dr. Budi  Santoso, S.Si" == "budi santoso" == "Budi Santoso, M.T"
export function normNamaOrang(s) {
  let t = String(s || "").toLowerCase().trim();
  t = t.replace(/^\d+\s*[.)-]\s*/, "");               // nomor urut "1." "2)"
  t = t.split(",")[0];                                 // buang gelar belakang (setelah koma)
  let prev;
  do { prev = t; t = t.replace(/^(prof|dr|drs|dra|ir|hj|h)\.\s*/, ""); } while (t !== prev);   // gelar depan
  t = t.replace(/[^a-zÀ-ɏ\s]/g, " ");                  // buang tanda baca/angka
  return t.replace(/\s+/g, " ").trim();
}
// Gelar akademik (dengan atau tanpa titik): "S.T." "ST" "MSM" "M.Sc." "PhD" "Ph.D." "S.Kom" dst.
const GELAR_TANPA_TITIK = new Set(["st", "mt", "msm", "msc", "ms", "mm", "mba", "phd", "se", "sh", "mh", "skom", "mkom",
  "spd", "mpd", "ssi", "msi", "sag", "mag", "ssos", "msos", "sp", "spsi", "mpsi", "apt", "sked", "ak", "sip", "mip",
  "sikom", "mikom", "sds", "mds", "sars", "mars", "eng", "dea", "dipl", "bsc", "ba", "ma", "mphil", "med", "meng",
  "amd", "cfa", "cpa", "ca", "stp", "mtp", "ssn", "msn", "shum", "mhum", "sfarm", "mfarm", "drs", "dra", "ir", "dr", "prof"]);
function isGelarAkademik(t) {
  const s = String(t || "").trim();
  if (!s || /\s/.test(s) || s.length > 8) return false;           // gelar = satu kata pendek
  if (GELAR_TANPA_TITIK.has(s.replace(/\./g, "").toLowerCase())) return true;
  return /\./.test(s);                                           // bentuk bertitik lain, mis. "S.Kel."
}
// Pisah daftar orang: utamakan baris/;, lalu koma — TAPI gabungkan gelar (S.Si, M.T, Ph.D, dst)
export function splitPeople(text) {
  const out = [];
  String(text || "").split(/[\n;]+/).forEach((line) => {
    let cur = "";
    line.split(",").forEach((part) => {
      const t = part.trim();
      if (!t) return;
      if (isGelarAkademik(t) && cur) cur += ", " + t;
      else { if (cur) out.push(cur); cur = t; }
    });
    if (cur) out.push(cur);
  });
  return out;
}

// ubah link Google Drive jadi URL gambar thumbnail
export function driveThumb(url) {
  const m = String(url || "").match(/[-\w]{25,}/);
  return m ? "https://drive.google.com/thumbnail?id=" + m[0] + "&sz=w400" : "";
}

export function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(",")[1]);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}
