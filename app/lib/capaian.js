// ============================================================
//  CAPAIAN PESERTA (pemenang / medali) — tab berawalan "Capaian" (mis. Capaian_Peserta)
//  Kolom: PIC | Program | Periode | Tahun | Nama | Jenis (Perorangan/Kelompok) | Kategori | Peringkat
// ============================================================
import { PROGRAMS } from "../config.js";
import { keyFromStored, labelOf, programByKey } from "./format.js";

// "EduQuest" -> INSPIRASI_EDQ, "SIAP" -> SIAP, dst.
function capProgKey(p) {
  const s = String(p || "").trim(); if (!s) return "";
  const k = keyFromStored(s); if (programByKey(k)) return k;
  const low = s.toLowerCase();
  const hit = PROGRAMS.find((x) => x.label.toLowerCase().includes(low) || low.includes(x.key.toLowerCase()) || low.includes(x.label.toLowerCase()));
  return hit ? hit.key : s;
}
// urutan & gaya peringkat
function capRank(peringkat) {
  const s = String(peringkat || "").trim(), l = s.toLowerCase();
  if (!s) return { ord: 5, label: "Pemenang", cls: "lain" };
  if (/emas|gold/.test(l)) return { ord: 1, label: "Medali Emas", cls: "emas" };
  if (/perak|silver/.test(l)) return { ord: 2, label: "Medali Perak", cls: "perak" };
  if (/perunggu|bronze/.test(l)) return { ord: 3, label: "Medali Perunggu", cls: "perunggu" };
  if (/honou?rable|^hm$/.test(l)) return { ord: 4, label: "Honorable Mention", cls: "hm" };
  const m = /^(juara\s*)?(\d+)$/.exec(l);
  if (m) return { ord: +m[2], label: "Juara " + m[2], cls: +m[2] <= 3 ? "juara" : "lain" };
  return { ord: 5, label: s, cls: "lain" };
}

export function capParse(tabs) {
  const out = [];
  (tabs || []).forEach((t) => {
    const H = (t.header || []).map((h) => String(h || "").trim());
    const f = (re) => H.findIndex((h) => re.test(h));
    const c = { prog: f(/^program$/i), per: f(/^periode$/i), th: f(/^tahun$/i), nama: f(/^nama/i), jenis: f(/^jenis/i), kat: f(/^kategori/i), rk: f(/^peringkat|^capaian|^juara$/i) };
    const g = (r, i) => (i >= 0 && r[i] !== null && r[i] !== undefined) ? String(r[i]).trim() : "";
    (t.rows || []).forEach((r) => {
      const nama = g(r, c.nama); if (!nama) return;
      const names = nama.split(/\s*;\s*|\n+/).map((x) => x.trim()).filter(Boolean);
      const jRaw = g(r, c.jenis).toLowerCase();
      const jenis = /kelompok|tim|team|group/.test(jRaw) ? "Kelompok" : (/individu|perorangan|personal/.test(jRaw) ? "Individu" : (names.length > 1 ? "Kelompok" : "Individu"));
      const key = capProgKey(g(r, c.prog));
      out.push({ prog: key, progLabel: labelOf(key), periode: g(r, c.per), tahun: g(r, c.th).replace(/\.0+$/, ""),
        names, jenis, kat: g(r, c.kat), rank: capRank(g(r, c.rk)) });
    });
  });
  return out;
}
