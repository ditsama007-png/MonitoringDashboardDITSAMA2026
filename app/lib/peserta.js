// ============================================================
//  DASHBOARD PESERTA — parser data
//  Sumber: tab Google Sheets yang namanya diawali "Peserta" (mis. Peserta_SIAP).
//  Kolom ujian dibaca OTOMATIS dari header:
//    "Nilai Akhir_10_07_2026" + "Indeks_10_07_2026"  -> ujian tanggal 10 Juli 2026
//  Ujian baru cukup ditambah 2 kolom ke kanan dengan pola yang sama.
// ============================================================
import { keyFromStored, labelOf } from "./format.js";

const PST_BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const PST_IDX_ORDER = ["A", "AB", "B", "BC", "C", "D", "E", "T"];
export const PST_IDX_LOW = { D: 1, E: 1, T: 1 };

// [kunci state ui.pst, field peserta, label]
export const PST_FILTERS = [
  ["program", "prog", "Program"], ["periode", "periode", "Periode"], ["aktivitas", "akt", "Aktivitas"],
  ["provinsi", "prov", "Provinsi"], ["fakultas", "fak", "Fakultas / Jurusan"], ["skema", "skema", "Skema"],
  ["tipe", "tipe", "Tipe"], ["kelompok", "kel", "Kelompok"],
];

function pstNum(v) {
  if (v === null || v === undefined) return null;
  const s = String(v).trim().replace(",", ".");
  if (s === "" || s === "-") return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

// ---- baca header -> index kolom + daftar ujian ----
function pstNormHead(h) { return String(h || "").toLowerCase().replace(/\s*\/\s*/g, "/").replace(/\s+/g, " ").trim(); }
function pstFindCol(headN, names) {
  for (const n of names) { const i = headN.indexOf(pstNormHead(n)); if (i >= 0) return i; }
  return -1;
}
const PST_EXAM_RE = /^(nilai(?:[\s_]*akhir)?|indeks)[\s_]+(\d{1,2})[\s_.\-/]+(\d{1,2})[\s_.\-/]+(\d{2,4})$/i;
function pstExamKey(d, m, y) {
  y = +y; if (y < 100) y += 2000;
  return y + "-" + String(+m).padStart(2, "0") + "-" + String(+d).padStart(2, "0");
}
export function pstExamLabel(key) {
  const [y, m, d] = key.split("-").map(Number);
  return d + " " + (PST_BULAN[m - 1] || m) + " " + y;
}

// ---- standarisasi nama provinsi (isian bebas -> nama baku) ----
const PST_PROV_BAKU = ["Aceh", "Sumatera Utara", "Sumatera Barat", "Riau", "Kepulauan Riau", "Jambi", "Sumatera Selatan",
  "Kepulauan Bangka Belitung", "Bengkulu", "Lampung", "DKI Jakarta", "Banten", "Jawa Barat", "Jawa Tengah", "DI Yogyakarta",
  "Jawa Timur", "Bali", "Nusa Tenggara Barat", "Nusa Tenggara Timur", "Kalimantan Barat", "Kalimantan Tengah", "Kalimantan Selatan",
  "Kalimantan Timur", "Kalimantan Utara", "Sulawesi Utara", "Gorontalo", "Sulawesi Tengah", "Sulawesi Barat", "Sulawesi Selatan",
  "Sulawesi Tenggara", "Maluku", "Maluku Utara", "Papua", "Papua Barat", "Papua Barat Daya", "Papua Tengah", "Papua Pegunungan",
  "Papua Selatan"];
function pstProvKey(s) {
  return String(s || "").toLowerCase().replace(/\d+/g, "").trim()
    .replace(/^(provinsi|prov\.?)\s*/, "").replace(/sumatra/g, "sumatera").replace(/kep\./g, "kepulauan ")
    .replace(/[^a-z]/g, "");
}
const PST_PROV_MAP = (() => {
  const m = {};
  PST_PROV_BAKU.forEach((p) => { m[pstProvKey(p)] = p; });
  Object.assign(m, {
    dki: "DKI Jakarta", jakarta: "DKI Jakarta", dkjakarta: "DKI Jakarta", daerahkhususibukotajakarta: "DKI Jakarta",
    jakartaselatan: "DKI Jakarta", jakartapusat: "DKI Jakarta", jakartabarat: "DKI Jakarta", jakartatimur: "DKI Jakarta", jakartautara: "DKI Jakarta",
    jabar: "Jawa Barat", westjava: "Jawa Barat", bogor: "Jawa Barat", depok: "Jawa Barat", bandung: "Jawa Barat", bekasi: "Jawa Barat",
    jateng: "Jawa Tengah", centraljava: "Jawa Tengah", jatim: "Jawa Timur", eastjava: "Jawa Timur", jawatimue: "Jawa Timur",
    tangerang: "Banten", tangerangselatan: "Banten", diy: "DI Yogyakarta", yogyakarta: "DI Yogyakarta", jogja: "DI Yogyakarta",
    daerahistimewayogyakarta: "DI Yogyakarta", bangkabelitung: "Kepulauan Bangka Belitung", babel: "Kepulauan Bangka Belitung",
    // luar negeri -> nama negara
    malaysia: "Malaysia", singapura: "Singapura", singapore: "Singapura", brunei: "Brunei Darussalam",
    madinah: "Arab Saudi", mekkah: "Arab Saudi", makkah: "Arab Saudi", saudiarabia: "Arab Saudi", arabsaudi: "Arab Saudi",
    jepang: "Jepang", japan: "Jepang", tiongkok: "Tiongkok", china: "Tiongkok", australia: "Australia",
  });
  return m;
})();
function pstNormProv(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";
  return PST_PROV_MAP[pstProvKey(raw)] || raw;   // tak dikenal -> biarkan apa adanya
}

export function pstParse(tabs) {
  const people = [];
  const examSet = {};
  (tabs || []).forEach((t) => {
    const header = t.header || [];
    const headN = header.map(pstNormHead);
    const col = {
      pic: pstFindCol(headN, ["PIC"]),
      prog: pstFindCol(headN, ["Program"]),
      periode: pstFindCol(headN, ["Periode"]),
      akt: pstFindCol(headN, ["Aktivitas", "Nama Kegiatan", "Kegiatan"]),
      nama: pstFindCol(headN, ["Nama Peserta", "Nama"]),
      prov: pstFindCol(headN, ["Provinsi"]),
      sek: pstFindCol(headN, ["Nama Sekolah", "Nama Sekolah / Instansi", "Asal Sekolah", "Sekolah", "Instansi"]),
      fak: pstFindCol(headN, ["Fakultas/Jurusan", "Fakultas", "Jurusan"]),
      skema: pstFindCol(headN, ["Skema"]),
      tipe: pstFindCol(headN, ["Tipe"]),
      kel: pstFindCol(headN, ["Kelompok Peserta", "Kelompok"]),
      id: pstFindCol(headN, ["ID Peserta"]),
    };
    // kolom ujian dari header
    const exams = {};   // key -> {nilai: idx, indeks: idx}
    header.forEach((h, i) => {
      const m = PST_EXAM_RE.exec(String(h || "").trim());
      if (!m) return;
      const key = pstExamKey(m[2], m[3], m[4]);
      exams[key] = exams[key] || {};
      if (/^indeks/i.test(m[1])) exams[key].indeks = i; else exams[key].nilai = i;
    });
    Object.keys(exams).forEach((k) => { examSet[k] = 1; });
    const tabProg = String(t.tab || "").replace(/^peserta[\s_-]*/i, "").trim();
    const get = (r, i) => (i >= 0 && r[i] !== undefined && r[i] !== null) ? String(r[i]).trim() : "";
    // isi-turun (fill down) PIC/Program/Periode/Aktivitas dari baris di atasnya
    const last = { pic: "", prog: "", periode: "", akt: "" };
    (t.rows || []).forEach((r) => {
      const nama = get(r, col.nama);
      ["pic", "prog", "periode", "akt"].forEach((f) => { const v = get(r, col[f]); if (v) last[f] = v; });
      if (!nama) return;
      const n = {};
      Object.keys(exams).forEach((k) => {
        const e = exams[k];
        const v = e.nilai !== undefined ? pstNum(r[e.nilai]) : null;
        const ix = e.indeks !== undefined ? get(r, e.indeks).toUpperCase() : "";
        if (v !== null || ix) n[k] = { v, idx: ix };
      });
      const progRaw = last.prog || tabProg;
      people.push({
        id: get(r, col.id), nama, pic: last.pic, periode: last.periode, akt: last.akt,
        prog: progRaw ? labelOf(keyFromStored(progRaw)) : "(tanpa program)",
        prov: pstNormProv(get(r, col.prov)), sek: get(r, col.sek), fak: get(r, col.fak),
        skema: get(r, col.skema), tipe: get(r, col.tipe), kel: get(r, col.kel), n,
      });
    });
  });
  // nama sekolah yang hanya beda huruf besar/kecil, spasi, atau tanda baca -> pakai ejaan yang paling sering muncul
  const sekKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const sekGroups = {};
  people.forEach((p) => {
    if (!p.sek) return;
    const g = (sekGroups[sekKey(p.sek)] = sekGroups[sekKey(p.sek)] || {});
    g[p.sek] = (g[p.sek] || 0) + 1;
  });
  const sekBest = {};
  Object.keys(sekGroups).forEach((k) => { sekBest[k] = Object.entries(sekGroups[k]).sort((a, b) => b[1] - a[1])[0][0]; });
  people.forEach((p) => { if (p.sek) p.sek = sekBest[sekKey(p.sek)]; });
  return { people, examKeys: Object.keys(examSet).sort() };
}

// ---- statistik per peserta ----
export function pstStats(p, examKeys) {
  const vals = examKeys.map((k) => (p.n[k] && p.n[k].v !== null) ? p.n[k].v : null).filter((v) => v !== null);
  const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  const naik = vals.length >= 2 ? vals[vals.length - 1] - vals[0] : null;
  return { avg, naik, count: vals.length };
}
export function pstFmt(v, d) {
  return v === null || v === undefined ? "–" : (d ? v.toFixed(d) : String(Math.round(v * 10) / 10));
}
