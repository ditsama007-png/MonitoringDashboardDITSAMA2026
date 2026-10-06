// Helper murni (tanpa DOM): label, format angka/tanggal, dan hak akses.
import { FIN_PROGRAMS, ISSUE_LEVELS, PHASES, PROGRAMS, PROGRESS, ROLES } from "../config.js";

// ---------------------------------------------------------------- angka ---
export const fmtNum = (n) => (n === null || n === undefined || n === "" ? "–" : Number(n).toLocaleString("id-ID"));
export const fmtRupiah = (n) => "Rp " + Math.round(Number(n) || 0).toLocaleString("id-ID");
// ringkas untuk KPI & grafik: Rp 1,07 M · Rp 365,2 jt
export function fmtRupiahShort(n) {
  const v = Number(n) || 0, a = Math.abs(v);
  const f = (x, d) => x.toLocaleString("id-ID", { maximumFractionDigits: d });
  if (a >= 1e12) return "Rp " + f(v / 1e12, 2) + " T";
  if (a >= 1e9) return "Rp " + f(v / 1e9, 2) + " M";
  if (a >= 1e6) return "Rp " + f(v / 1e6, 1) + " jt";
  return fmtRupiah(v);
}
// buang filter bernilai "Semua" (= default backend) agar kunci cache sama dengan permintaan tanpa filter
export const withoutAll = (o) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== "Semua"));
export const pct = (part, whole) => (whole > 0 ? Math.round((part / whole) * 100) : 0);

// -------------------------------------------------------------- tanggal ---
const toDate = (v) => { if (!v) return null; const d = new Date(v); return isNaN(d) ? null : d; };
export function fmtDate(v, opts) {
  const d = toDate(v);
  return d ? d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric", ...opts }) : "–";
}
export const fmtDateLong = (v) => fmtDate(v, { weekday: "long", month: "long" });
// "28 Sep 2026, 22.55" (waktu lokal pengguna)
export function fmtDateTime(v) {
  const d = toDate(v);
  if (!d) return "–";
  return d.toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" }) + ", " +
    d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });
}
// "baru saja", "3 jam lalu", "kemarin", "5 hari lalu"; lebih dari 2 minggu -> tanggal
export function fmtRelative(v) {
  const d = toDate(v);
  if (!d) return "–";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 0) return fmtDate(d);
  if (diff < 60) return "baru saja";
  if (diff < 3600) return Math.floor(diff / 60) + " menit lalu";
  if (diff < 86400) return Math.floor(diff / 3600) + " jam lalu";
  const days = Math.floor(diff / 86400);
  if (days === 1) return "kemarin";
  if (days < 14) return days + " hari lalu";
  return fmtDate(d);
}
// ISO -> nilai <input type="date"> (tanggal lokal)
export function toDateInput(v) {
  const d = toDate(v);
  if (!d) return "";
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
}
// nilai <input type="date"> -> ISO (tengah malam UTC, sama seperti data hasil impor)
export const fromDateInput = (s) => (s ? s + "T00:00:00.000Z" : null);
export const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// ---------------------------------------------------------------- label ---
const lookup = (pairs) => { const m = Object.fromEntries(pairs); return (v) => m[v] ?? v ?? "–"; };
export const phaseLabel = lookup(PHASES);
export const progressLabel = lookup(PROGRESS);
export const levelLabel = lookup(ISSUE_LEVELS);
export const roleLabel = lookup(ROLES);
export const statusLabel = lookup([["upcoming", "Akan Datang"], ["ongoing", "Berlangsung"], ["done", "Selesai"]]);
export const finTypeLabel = lookup([["initial_pks", "PKS Awal"], ["addition_pks", "Penambahan PKS"], ["submission", "Pengajuan"]]);
export const isPks = (r) => r.type === "initial_pks" || r.type === "addition_pks";

export const programByApi = (api) => PROGRAMS.find((p) => p.api === api);
export const programByKey = (key) => PROGRAMS.find((p) => p.key === key);
export const programLabel = (api) => programByApi(api)?.label ?? api;
export const finProgramLabel = (api) => FIN_PROGRAMS.find((p) => p.api === api)?.label ?? api;

// palet warna per program (indeks stabil sesuai urutan PROGRAMS / FIN_PROGRAMS)
export const PROG_COLORS = ["#3a6db0", "#16A34A", "#E08A2E", "#8B5CF6", "#DC2626", "#0EA5E9", "#DB2777", "#65A30D", "#9333EA"];
export function progColor(api) {
  let i = PROGRAMS.findIndex((p) => p.api === api);
  if (i < 0) i = FIN_PROGRAMS.findIndex((p) => p.api === api);
  return PROG_COLORS[(i < 0 ? 0 : i) % PROG_COLORS.length];
}

// status otomatis dari tanggal (sama dengan backend): Akan Datang < H-2 · Berlangsung H-2..H+7 · Selesai > H+7
export function activityStatus(a) {
  if (a.status) return a.status;
  if (a.isDone) return "done";
  if (!a.date) return a.mode === "upcoming" ? "upcoming" : "ongoing";
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = new Date(a.date); d.setHours(0, 0, 0, 0);
  const from = new Date(d); from.setDate(from.getDate() - 2);
  const to = new Date(d); to.setDate(to.getDate() + 7);
  return now < from ? "upcoming" : now > to ? "done" : "ongoing";
}

// isu terberat sebuah kegiatan: "high" | "medium" | "low" | ""
export function topIssueLevel(issues) {
  const rank = { high: 3, medium: 2, low: 1 };
  return (issues || []).reduce((best, i) => (rank[i.level] > (rank[best] || 0) ? i.level : best), "");
}
export function attendance(participants) {
  const reg = (participants || []).reduce((s, p) => s + (p.registered || 0), 0);
  const pres = (participants || []).reduce((s, p) => s + (p.present || 0), 0);
  return { reg, pres, pct: reg > 0 ? Math.round((pres / reg) * 100) : null };
}
// nama file SK dari storage: "1791259620257-SK_Dosen.pdf" -> "SK_Dosen.pdf"
export const skName = (name) => String(name || "").replace(/^\d{10,}-/, "");

// ---------------------------------------------------------------- akses ---
export const isAllAccess = (s) => !!s && ["admin", "kasubdit", "finance"].includes(s.role);
export const isFinanceOnly = (s) => s?.role === "finance";
export const canEditFinance = (s) => !!s && ["admin", "kasubdit", "finance"].includes(s.role);
// program kegiatan yang boleh diisi/diubah (Finance tidak boleh mengisi data kegiatan)
export function editablePrograms(s) {
  if (!s || s.role === "finance") return [];
  if (s.role === "pic") return PROGRAMS.filter((p) => (s.programs || []).includes(p.api));
  return PROGRAMS;
}
export const canEditActivity = (s, programApi) => editablePrograms(s).some((p) => p.api === programApi);

// ------------------------------------------------------------ nama orang ---
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
export const initials = (name) => String(name || "").replace(/^(prof|dr|drs|dra|ir)\.?\s+/gi, "").split(/[\s,]+/)
  .filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
