import { useEffect, useMemo, useState } from "react";
import { ChartCanvas } from "../../components/ChartCanvas.jsx";
import { Kpi, SelectField } from "../../components/ui.jsx";
import { keepOption, uniqSorted } from "../../lib/format.js";
import {
  PST_FILTERS, PST_IDX_LOW, PST_IDX_ORDER, pstExamLabel, pstFmt, pstParse, pstStats,
} from "../../lib/peserta.js";
import { useAuthStore } from "../../stores/auth.js";
import { useDataStore } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";

const ALL = "Semua";
const NAVY = "#204074", BLUE = "#3a6db0", ORANGE = "#E08A2E";

function IdxChip({ ix }) {
  return ix ? <span className={"idx-chip" + (PST_IDX_LOW[ix] ? " low" : "")}>{ix}</span> : <span className="nil-muted">–</span>;
}

export default function Peserta() {
  const { raw, err } = useDataStore((s) => s.peserta);
  const loadPeserta = useDataStore((s) => s.loadPeserta);
  const session = useAuthStore((s) => s.session);
  const ui = useUiStore((s) => s.pst);
  const patch = useUiStore((s) => s.patch);
  const [loading, setLoading] = useState(false);

  const reload = async () => { setLoading(true); await loadPeserta(); setLoading(false); };
  // muat sekali setelah login (data peserta butuh token)
  useEffect(() => { if (raw === null && session) reload(); }, [raw, session]);

  const { people, examKeys } = useMemo(() => pstParse(raw), [raw]);

  // filter bertingkat: opsi tiap filter dihitung dari data yang lolos filter lain (kecuali dirinya)
  const { opts, values, rows } = useMemo(() => {
    const opts = {}, values = {};
    PST_FILTERS.forEach(([key, field]) => {
      const others = people.filter((p) => PST_FILTERS.every(([k2, f2]) => k2 === key || ui[k2] === ALL || p[f2] === ui[k2]));
      opts[key] = [ALL, ...uniqSorted(others.map((p) => p[field]))];
      values[key] = keepOption(opts[key], ui[key]);
    });
    const rows = people.filter((p) => PST_FILTERS.every(([k, f]) => values[k] === ALL || p[f] === values[k]));
    return { opts, values, rows };
  }, [people, ui]);

  // ujian yang dipakai (terbaru yg ada nilainya di data terfilter, atau pilihan user)
  const ujianOpts = [["__LAST__", "Terbaru (yang sudah ada nilai)"], ...examKeys.slice().reverse().map((k) => [k, pstExamLabel(k)])];
  const ujianSel = ujianOpts.some(([v]) => v === ui.ujian) ? ui.ujian : "__LAST__";
  const withData = examKeys.filter((k) => rows.some((p) => p.n[k] && p.n[k].v !== null));
  const uj = ujianSel !== "__LAST__" ? ujianSel : (withData.length ? withData[withData.length - 1] : (examKeys[examKeys.length - 1] || ""));
  const ujLabel = uj ? pstExamLabel(uj) : "–";

  const setFilter = (key, v) => patch("pst", { [key]: v, listN: 50 });

  let msg = null, msgErr = false;
  if (loading && !raw) msg = "⏳ Memuat data peserta…";
  else if (err) { msg = "⚠️ " + err; msgErr = true; }
  else if (!raw || !raw.length) {
    msg = <>Belum ada data. Buat tab di Google Sheets dengan nama diawali <b>Peserta</b> (mis. <b>Peserta_SIAP</b>),
      header baris 1: PIC, Program, Periode, Aktivitas, Nama Peserta, Provinsi, Nama Sekolah, Fakultas/Jurusan, Skema, Tipe, Kelompok Peserta,
      lalu kolom ujian <b>Nilai Akhir_dd_mm_yyyy</b> dan <b>Indeks_dd_mm_yyyy</b>.</>;
  } else {
    msg = `${people.length} peserta dari ${raw.length} tab · ${examKeys.length} tanggal ujian terbaca: ` +
      (examKeys.map(pstExamLabel).join(", ") || "belum ada kolom ujian");
  }

  const nilaiUj = rows.map((p) => (p.n[uj] && p.n[uj].v !== null) ? p.n[uj].v : null).filter((v) => v !== null);
  const avgUj = nilaiUj.length ? nilaiUj.reduce((a, b) => a + b, 0) / nilaiUj.length : null;

  return (
    <section id="view-peserta">
      <h1 className="title" style={{ visibility: "visible" }}>Dashboard Peserta</h1>

      <div className="card">
        <div className="pst-filters">
          {PST_FILTERS.map(([key, , label]) => (
            <SelectField key={key} label={label} value={values[key]} options={opts[key]} onChange={(v) => setFilter(key, v)} />
          ))}
          <SelectField label="Ujian" value={ujianSel} options={ujianOpts} onChange={(v) => setFilter("ujian", v)} />
          <button className="btn-ghost" type="button" onClick={reload}>{loading ? "⏳ Memuat..." : "🔄 Refresh"}</button>
        </div>
        <div className="sub" style={{ margin: ".4rem 0 0", color: msgErr ? "var(--red)" : undefined }}>{msg}</div>
      </div>

      <div className="kpi-row">
        <Kpi value={rows.length.toLocaleString("id-ID")} label="Total Peserta" />
        <Kpi value={uniqSorted(rows.map((p) => p.prov)).length} label="Provinsi" />
        <Kpi value={uniqSorted(rows.map((p) => p.sek)).length} label="Sekolah / Instansi" />
        <Kpi value={withData.length + (examKeys.length > withData.length ? " / " + examKeys.length : "")} label="Jumlah Ujian" />
        <Kpi value={avgUj === null ? "–" : avgUj.toFixed(1)} label={"Rata-rata Nilai · " + ujLabel} />
        <Kpi value={rows.length ? nilaiUj.length + " / " + rows.length : "–"} label="Sudah Dinilai" />
      </div>

      <PesertaCharts rows={rows} examKeys={examKeys} uj={uj} ujLabel={ujLabel} />
      <Sekolah rows={rows} uj={uj} ujLabel={ujLabel} />
      <Ranking rows={rows} examKeys={examKeys} uj={uj} ujLabel={ujLabel} />
      <Daftar rows={rows} examKeys={examKeys} />
    </section>
  );
}

function PesertaCharts({ rows, examKeys, uj, ujLabel }) {
  const c = useMemo(() => {
    // 1) tren rata-rata per ujian
    const tren = examKeys.map((k) => {
      const v = rows.map((p) => (p.n[k] && p.n[k].v !== null) ? p.n[k].v : null).filter((x) => x !== null);
      return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null;
    });
    const cnt = examKeys.map((k) => rows.filter((p) => p.n[k] && p.n[k].v !== null).length);
    const trenCfg = {
      type: "bar",
      data: {
        labels: examKeys.length ? examKeys.map(pstExamLabel) : ["(belum ada ujian)"],
        datasets: [{ label: "Rata-rata nilai", data: tren, backgroundColor: examKeys.map((k) => k === uj ? NAVY : BLUE), borderRadius: 6, maxBarThickness: 70 }],
      },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: (x) => `Rata-rata ${x.parsed.y} · ${cnt[x.dataIndex]} peserta dinilai` } } },
        scales: { y: { beginAtZero: true, suggestedMax: 100, title: { display: true, text: "Nilai" } } },
      },
    };
    // 2) distribusi indeks ujian terpilih
    const idxCount = {};
    rows.forEach((p) => { const ix = p.n[uj] && p.n[uj].idx; if (ix) idxCount[ix] = (idxCount[ix] || 0) + 1; });
    const idxLabels = PST_IDX_ORDER.filter((x) => idxCount[x] || ["A", "AB", "B", "BC", "C", "D", "E"].includes(x))
      .concat(Object.keys(idxCount).filter((x) => !PST_IDX_ORDER.includes(x)).sort());
    const idxCfg = {
      type: "bar",
      data: { labels: idxLabels, datasets: [{ label: "Peserta", data: idxLabels.map((x) => idxCount[x] || 0),
        backgroundColor: idxLabels.map((x) => PST_IDX_LOW[x] ? ORANGE : NAVY), borderRadius: 6, maxBarThickness: 70 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } },
    };
    // 3 & 4) sebaran provinsi / fakultas (horizontal, top 10)
    const topBar = (field) => {
      const m = {};
      rows.forEach((p) => { const v = p[field] || "(kosong)"; m[v] = (m[v] || 0) + 1; });
      const top = Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 10);
      return {
        type: "bar",
        data: { labels: top.length ? top.map((x) => x[0]) : ["(kosong)"], datasets: [{ label: "Peserta", data: top.map((x) => x[1]), backgroundColor: BLUE, borderRadius: 5, maxBarThickness: 34 }] },
        options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { beginAtZero: true, ticks: { precision: 0 } } } },
      };
    };
    return { trenCfg, idxCfg, provCfg: topBar("prov"), fakCfg: topBar("fak") };
  }, [rows, examKeys, uj]);

  return (
    <>
      <div className="grid-2 gap">
        <div className="card"><h3>Perkembangan Nilai Akhir</h3><div className="sub">Rata-rata nilai per tanggal ujian</div><ChartCanvas config={c.trenCfg} /></div>
        <div className="card"><h3>Distribusi Indeks</h3><div className="sub">Jumlah peserta per indeks · ujian {ujLabel}</div><ChartCanvas config={c.idxCfg} /></div>
      </div>
      <div className="grid-2 gap">
        <div className="card"><h3>Sebaran Provinsi</h3><div className="sub">10 provinsi terbanyak</div><ChartCanvas config={c.provCfg} /></div>
        <div className="card"><h3>Fakultas / Jurusan</h3><div className="sub">10 terbanyak</div><ChartCanvas config={c.fakCfg} /></div>
      </div>
    </>
  );
}

function Sekolah({ rows, uj, ujLabel }) {
  const { sekSearch, sekAll } = useUiStore((s) => s.pst);
  const patch = useUiStore((s) => s.patch);
  const q = sekSearch.trim().toLowerCase();

  const { list, nSek } = useMemo(() => {
    const g = {};
    rows.forEach((p) => {
      const k = p.sek || "(tidak diisi)";
      const o = g[k] = g[k] || { n: 0, prov: {}, nilai: [], per: {} };
      o.n++;
      // frekuensi: berapa periode berbeda sekolah ini ikut (per program + periode)
      const perKey = (p.prog || "-") + " · Periode " + (p.periode || "-");
      o.per[perKey] = (o.per[perKey] || 0) + 1;
      if (p.prov) o.prov[p.prov] = (o.prov[p.prov] || 0) + 1;
      const e = p.n[uj]; if (e && e.v !== null) o.nilai.push(e.v);
    });
    const list = Object.entries(g).map(([nama, o]) => ({
      nama, n: o.n,
      prov: Object.entries(o.prov).sort((a, b) => b[1] - a[1]).map((x) => x[0])[0] || "–",
      avg: o.nilai.length ? o.nilai.reduce((a, b) => a + b, 0) / o.nilai.length : null, dinilai: o.nilai.length,
      frek: Object.keys(o.per).length,
      perList: Object.entries(o.per).sort((a, b) => a[0].localeCompare(b[0], "id", { numeric: true })),
    })).sort((a, b) => b.n - a.n || a.nama.localeCompare(b.nama));
    let prev = null, prevRank = 0;
    list.forEach((x, i) => { x.rank = (prev !== null && x.n === prev) ? prevRank : i + 1; prev = x.n; prevRank = x.rank; });
    return { list, nSek: list.filter((x) => x.nama !== "(tidak diisi)").length };
  }, [rows, uj]);

  const filtered = q ? list.filter((x) => x.nama.toLowerCase().includes(q) || x.prov.toLowerCase().includes(q)) : list;
  const show = (sekAll || q) ? filtered : filtered.slice(0, 10);
  const total = rows.length || 1;

  return (
    <div className="card">
      <div className="pst-head">
        <div><h3>Sebaran Sekolah</h3>
          <div className="sub">{`${nSek} sekolah/instansi · ${rows.length} peserta` + (q ? ` · ${filtered.length} cocok dengan "${q}"` : "")}</div></div>
        <input type="search" placeholder="Cari sekolah…" style={{ minWidth: 220 }} value={sekSearch}
          onChange={(e) => patch("pst", { sekSearch: e.target.value })} />
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>No</th><th>Nama Sekolah / Instansi</th><th>Provinsi</th><th>Jumlah Peserta</th><th>% dari Total</th>
          <th title="Berapa periode berbeda sekolah ini mengirim peserta">Frekuensi Ikut</th><th>Rata-rata Nilai {ujLabel}</th></tr></thead>
        <tbody>
          {!show.length && <tr><td colSpan={7} className="nil-muted">Tidak ada data sekolah.</td></tr>}
          {show.map((x) => {
            const pc = x.n / total * 100;
            return (
              <tr key={x.nama}>
                <td>{x.rank}</td><td><b>{x.nama}</b></td><td>{x.prov}</td>
                <td className="pst-val">{x.n.toLocaleString("id-ID")}</td>
                <td><div className="pst-bar"><span style={{ width: Math.max(2, pc).toFixed(1) + "%" }} /></div>{pc.toFixed(1)}%</td>
                <td title={x.perList.map(([k, n]) => k + ": " + n + " peserta").join("\n")}>
                  <b>{x.frek}×</b>{" "}
                  <span className="nil-muted">{x.perList.map(([k]) => k.replace(" · Periode ", " P")).slice(0, 4).join(", ") + (x.perList.length > 4 ? ", …" : "")}</span>
                </td>
                <td className={x.avg === null ? "nil-muted" : ""}>
                  {x.avg === null ? "–" : <>{x.avg.toFixed(1)} <span className="nil-muted">({x.dinilai} dinilai)</span></>}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      {!q && filtered.length > 10 && (
        <button className="see-more" type="button" onClick={() => patch("pst", { sekAll: !sekAll })}>
          {sekAll ? "Tampilkan 10 teratas saja" : `Tampilkan semua (${filtered.length} sekolah)`}
        </button>
      )}
    </div>
  );
}

const SORTS = [["ujian", "Nilai ujian terpilih"], ["rata", "Rata-rata semua ujian"], ["naik", "Kenaikan tertinggi"]];

function Ranking({ rows, examKeys, uj, ujLabel }) {
  const { sort, rankAll } = useUiStore((s) => s.pst);
  const patch = useUiStore((s) => s.patch);
  const metricName = { ujian: "Nilai " + ujLabel, rata: "Rata-rata", naik: "Kenaikan" }[sort];

  const scored = useMemo(() => {
    const list = rows.map((p) => {
      const st = pstStats(p, examKeys);
      const val = sort === "ujian" ? ((p.n[uj] && p.n[uj].v !== null) ? p.n[uj].v : null) : sort === "rata" ? st.avg : st.naik;
      return { p, val };
    }).filter((x) => x.val !== null).sort((a, b) => b.val - a.val || a.p.nama.localeCompare(b.p.nama));
    // ranking kompetisi: nilai sama = ranking sama
    let prevVal = null, prevRank = 0;
    list.forEach((x, i) => { x.rank = (prevVal !== null && x.val === prevVal) ? prevRank : i + 1; prevVal = x.val; prevRank = x.rank; });
    return list;
  }, [rows, examKeys, uj, sort]);

  const show = rankAll ? scored : scored.slice(0, 10);
  return (
    <div className="card">
      <div className="pst-head">
        <div><h3>Ranking Peserta</h3>
          <div className="sub">{scored.length
            ? `Diurutkan menurut ${metricName.charAt(0).toLowerCase() + metricName.slice(1)} · ${scored.length} peserta punya nilai` + (sort === "naik" ? " (minimal 2 ujian)" : "")
            : "Belum ada peserta dengan nilai untuk urutan ini."}</div></div>
        <div className="prog-tabs" style={{ margin: 0 }}>
          {SORTS.map(([k, t]) => (
            <button key={k} type="button" className={"prog-tab" + (sort === k ? " active" : "")} onClick={() => patch("pst", { sort: k })}>{t}</button>
          ))}
        </div>
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Ranking</th><th>Nama Peserta</th><th>Program</th><th>Sekolah</th><th>Provinsi</th><th>Fakultas/Jurusan</th>
          <th>Kelompok</th><th>Indeks {ujLabel}</th>{examKeys.map((k) => <th key={k}>{pstExamLabel(k)}</th>)}<th>{metricName}</th></tr></thead>
        <tbody>
          {!show.length && <tr><td colSpan={9 + examKeys.length} className="nil-muted">Belum ada data nilai.</td></tr>}
          {show.map((x, i) => {
            const p = x.p, top = x.rank <= 3;
            const valTxt = sort === "naik" ? (x.val > 0 ? "+" : "") + pstFmt(x.val) : pstFmt(x.val, sort === "rata" ? 1 : 0);
            return (
              <tr key={i} className={top ? "rank-top" : ""}>
                <td><span className={"rank-no" + (top ? " top" : "")}>{x.rank}</span></td>
                <td><b>{p.nama}</b></td><td>{p.prog}</td><td>{p.sek || "–"}</td><td>{p.prov || "–"}</td>
                <td>{p.fak || "–"}</td><td>{p.kel || "–"}</td><td><IdxChip ix={p.n[uj] && p.n[uj].idx} /></td>
                {examKeys.map((k) => <td key={k} className={p.n[k] && p.n[k].v !== null ? "" : "nil-muted"}>{pstFmt(p.n[k] ? p.n[k].v : null)}</td>)}
                <td className="pst-val">{valTxt}</td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
      {scored.length > 10 && (
        <button className="see-more" type="button" onClick={() => patch("pst", { rankAll: !rankAll })}>
          {rankAll ? "Tampilkan 10 teratas saja" : `Tampilkan semua (${scored.length} peserta)`}
        </button>
      )}
    </div>
  );
}

function Daftar({ rows, examKeys }) {
  const { search, listN } = useUiStore((s) => s.pst);
  const patch = useUiStore((s) => s.patch);
  const q = search.trim().toLowerCase();
  const list = q ? rows.filter((p) => [p.nama, p.sek, p.kel, p.prov, p.fak, p.id].join(" ").toLowerCase().includes(q)) : rows;

  return (
    <div className="card">
      <div className="pst-head">
        <div><h3>Daftar Peserta</h3><div className="sub">{`${list.length} peserta` + (q ? ` cocok dengan "${q}"` : "")}</div></div>
        <input type="search" placeholder="Cari nama, sekolah, kelompok…" style={{ minWidth: 240 }} value={search}
          onChange={(e) => patch("pst", { search: e.target.value, listN: 50 })} />
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>No</th><th>Nama Peserta</th><th>PIC</th><th>Program</th><th>Periode</th><th>Aktivitas</th>
          <th>Provinsi</th><th>Nama Sekolah</th><th>Fakultas/Jurusan</th><th>Skema</th><th>Tipe</th><th>Kelompok</th>
          {examKeys.map((k) => <th key={k}>{pstExamLabel(k)}</th>)}</tr></thead>
        <tbody>
          {!list.length && <tr><td colSpan={12 + examKeys.length} className="nil-muted">Tidak ada peserta.</td></tr>}
          {list.slice(0, listN).map((p, i) => (
            <tr key={i}>
              <td>{i + 1}</td><td><b>{p.nama}</b></td><td>{p.pic}</td><td>{p.prog}</td><td>{p.periode}</td>
              <td>{p.akt}</td><td>{p.prov}</td><td>{p.sek}</td><td>{p.fak}</td><td>{p.skema}</td><td>{p.tipe}</td><td>{p.kel}</td>
              {examKeys.map((k) => { const e = p.n[k]; return e ? <td key={k}>{pstFmt(e.v)} <IdxChip ix={e.idx} /></td> : <td key={k} className="nil-muted">–</td>; })}
            </tr>
          ))}
        </tbody>
      </table></div>
      {list.length > listN && (
        <button className="see-more" type="button" onClick={() => patch("pst", { listN: listN + 50 })}>
          Tampilkan lebih banyak ({list.length - listN} lagi)
        </button>
      )}
    </div>
  );
}
