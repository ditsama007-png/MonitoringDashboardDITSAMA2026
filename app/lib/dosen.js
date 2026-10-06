// ============================================================
//  PORTOFOLIO DOSEN — parser data
//  Sumber: tab berawalan "Dosen" (mis. Dosen_SIAP) = hasil Google Form evaluasi apa adanya.
//  Kolom dosen dikenali dari header: "Evaluasi Dosen Matematika [Nama, gelar]"
//  atau "Mathematics Lecturer Evaluation [Nama, gelar]". Nilai 1–5; teks lain diabaikan.
// ============================================================
import { keyFromStored, labelOf } from "./format.js";

const DSN_MAPEL = { matematika: "Matematika", mathematics: "Matematika", fisika: "Fisika", physics: "Fisika",
  kimia: "Kimia", chemistry: "Kimia", biologi: "Biologi", biology: "Biologi" };

// [kunci state ui.dsn, field penilaian, label]
export const DSN_FILTERS = [
  ["program", "prog", "Program"], ["mapel", "mapel", "Mata Kuliah"], ["metode", "metode", "Metode"],
  ["kelas", "kelas", "Kelas"], ["bahasa", "bahasa", "Bahasa Form"],
];

// "Dr. Abdul Muizz Tri Pradipto, S.Si., M.Si." -> kunci "abdul muizz tri pradipto"
export function dsnKey(nama) {
  return String(nama || "").split(",")[0].replace(/\b(prof|dr|drs|dra|ir|hj|h)\.?\s+/gi, "")
    .toLowerCase().replace(/[^a-z\s]/g, " ").replace(/\s+/g, " ").trim();
}
export const dsnNice = (nama) => dsnKey(nama).replace(/\b\w/g, (c) => c.toUpperCase());
export function dsnInitials(nama) {
  const w = dsnKey(nama).split(" ").filter(Boolean);
  return ((w[0] || "?")[0] + (w.length > 1 ? w[w.length - 1][0] : "")).toUpperCase();
}
export function dsnPredikat(v) {
  if (v === null) return ["–", ""];
  if (v >= 4.5) return ["Sangat Baik", "a"];
  if (v >= 4) return ["Baik", "b"];
  if (v >= 3) return ["Cukup", "c"];
  return ["Perlu Perhatian", "d"];
}

// bentuk lebar (form) -> daftar penilaian {prog, key, nama, mapel, metode, kelas, bahasa, nilai, peserta}
export function dsnParse(tabs) {
  const evals = [], comments = [];
  let nResp = 0;
  (tabs || []).forEach((t) => {
    const header = t.header || [];
    const prog = labelOf(keyFromStored(String(t.tab || "").replace(/^dosen[\s_-]*/i, "").trim() || "Lainnya"));
    const find = (re) => header.findIndex((h) => re.test(String(h)));
    const iNama = find(/nama\s+lengkap|full\s+name/i);
    const iKelas = find(/^\s*kelas|\bclass\b/i);
    const commentCols = header.map((h, i) => (/berkesan|positive impression/i.test(String(h)) ? i : -1)).filter((i) => i >= 0);
    const cols = [];
    header.forEach((h, i) => {
      h = String(h || "");
      if (!/(evaluasi\s+dosen|lecturer\s+evaluation)/i.test(h)) return;
      const m = /\[(.+)\]/.exec(h); if (!m) return;
      const w = h.toLowerCase().match(/matematika|mathematics|fisika|physics|kimia|chemistry|biologi|biology/);
      cols.push({ i, nama: m[1].replace(/\s+/g, " ").trim(), mapel: w ? DSN_MAPEL[w[0]] : "Lainnya",
        bahasa: /lecturer/i.test(h) ? "English" : "Indonesia" });
    });
    (t.rows || []).forEach((r) => {
      const kelasRaw = iKelas >= 0 ? String(r[iKelas] || "").trim() : "";
      const kl = kelasRaw.toLowerCase();
      const metode = /hybrid|hibrida/.test(kl) ? "Hibrida" : /daring|online/.test(kl) ? "Daring" : /luring|on-site|onsite|offline/.test(kl) ? "Luring" : "–";
      const kelas = kelasRaw.split("||")[0].trim() || "–";
      const peserta = iNama >= 0 ? String(r[iNama] || "").trim() : "";
      let any = false;
      cols.forEach((c) => {
        const v = r[c.i];
        const n = parseFloat(String(v === null || v === undefined ? "" : v).replace(",", "."));
        if (isNaN(n) || n < 1 || n > 5) return;
        any = true;
        evals.push({ prog, key: dsnKey(c.nama), nama: c.nama, mapel: c.mapel, metode, kelas, bahasa: c.bahasa, nilai: n, peserta });
      });
      if (any) nResp++;
      commentCols.forEach((ci) => {
        const txt = String(r[ci] || "").trim();
        if (txt.length > 3 && !/^(-|tidak ada|none|no)$/i.test(txt)) comments.push({ prog, metode, kelas, txt, peserta });
      });
    });
  });
  return { evals, comments, nResp };
}

const avg = (a) => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;

// agregasi per dosen + ranking (nilai sama -> ranking sama)
export function dsnAggregate(rows, minResp) {
  const g = {};
  rows.forEach((e) => {
    const o = g[e.key] = g[e.key] || { key: e.key, names: {}, mapel: {}, metode: {}, prog: {}, bahasa: {}, vals: [], dist: [0, 0, 0, 0, 0], peserta: {} };
    o.names[e.nama] = 1; o.mapel[e.mapel] = 1; o.metode[e.metode] = (o.metode[e.metode] || []).concat(e.nilai);
    o.prog[e.prog] = 1; o.bahasa[e.bahasa] = 1; o.vals.push(e.nilai); o.dist[Math.round(e.nilai) - 1]++;
    if (e.peserta) o.peserta[e.peserta] = 1;
  });
  const dosen = Object.values(g).map((o) => ({
    ...o, nama: Object.keys(o.names).sort((a, b) => b.length - a.length)[0], avg: avg(o.vals), n: o.vals.length,
  })).filter((d) => d.n >= minResp)
    .sort((a, b) => b.avg - a.avg || b.n - a.n || a.nama.localeCompare(b.nama));
  let pv = null, pr = 0;
  dosen.forEach((d, i) => { const k = d.avg.toFixed(2); d.rank = pv === k ? pr : i + 1; pv = k; pr = d.rank; });
  return dosen;
}
export { avg as dsnAvg };
