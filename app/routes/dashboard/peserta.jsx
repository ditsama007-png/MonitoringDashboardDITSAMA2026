import { useMemo, useState } from "react";
import { ChartCanvas } from "../../components/ChartCanvas.jsx";
import { Icon } from "../../components/Icon.jsx";
import {
  Bar, EmptyState, ErrorNote, Kpi, PageHead, Pagination, SearchInput, Segmented, SelectField, Sheet, SkeletonCard, Spinner,
} from "../../components/ui.jsx";
import { fmtNum, withoutAll } from "../../lib/format.js";
import { useApi } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";

const ALL = "Semua";
const NAVY = "#204074", BLUE = "#3a6db0", ORANGE = "#E08A2E";
const FILTERS = [
  ["program", "programs", "Program"], ["periode", "periodes", "Periode"], ["aktivitas", "aktivitas", "Aktivitas"],
  ["provinsi", "provinsis", "Provinsi"], ["fakultas", "fakultas", "Fakultas / jurusan"], ["skema", "skemas", "Skema"],
  ["tipe", "tipes", "Tipe"], ["kelompok", "kelompoks", "Kelompok"],
];
const SORTS = [["ujian", "Nilai ujian terpilih"], ["rata", "Rata-rata semua ujian"], ["naik", "Kenaikan tertinggi"]];
const LOW = { C: 1, D: 1, E: 1 };

function IdxChip({ ix }) {
  return ix ? <span className={"idx-chip" + (LOW[ix] ? " low" : "")}>{ix}</span> : null;
}

export default function Peserta() {
  const ui = useUiStore((s) => s.pst);
  const patch = useUiStore((s) => s.patch);
  const base = withoutAll(Object.fromEntries(FILTERS.map(([k]) => [k, ui[k]])));
  const query = { ...base, ...(ui.ujian !== "__LAST__" ? { ujian: ui.ujian } : {}) };
  const dash = useApi("/dashboard/peserta", { ...query, ...(ui.rankingSortBy !== "ujian" ? { rankingSortBy: ui.rankingSortBy } : {}) });
  const d = dash.data?.data;
  const fo = d?.filterOptions;
  const setFilter = (k, v) => patch("pst", { [k]: v, page: 1 });
  const active = FILTERS.some(([k]) => ui[k] !== ALL) || ui.ujian !== "__LAST__";
  const [busy, setBusy] = useState(false);
  const refresh = async () => { setBusy(true); await dash.reload({ refresh: true }); setBusy(false); };

  return (
    <div className="page">
      <PageHead title="Peserta" sub="Data peserta, nilai ujian, dan sebaran sekolah dari Google Sheets">
        <button type="button" className="btn" onClick={refresh} disabled={busy || dash.loading}>
          {busy ? <Spinner /> : <Icon name="refresh" size={16} />}<span className="btn-txt">Muat ulang dari Sheets</span>
        </button>
      </PageHead>

      <section className="card filter-bar">
        {FILTERS.map(([k, optKey, label]) => {
          const list = fo?.[optKey] || [];
          return <SelectField key={k} label={label} value={list.includes(ui[k]) ? ui[k] : ALL} options={[ALL, ...list]} onChange={(v) => setFilter(k, v)} />;
        })}
        <SelectField label="Ujian" value={ui.ujian} onChange={(v) => setFilter("ujian", v)}
          options={[["__LAST__", "Terbaru yang sudah dinilai"], ...[...(fo?.ujians || [])].reverse().map((u) => [u.key, u.label])]} />
        {active && <button type="button" className="btn btn-sm filter-reset"
          onClick={() => patch("pst", { ...Object.fromEntries(FILTERS.map(([k]) => [k, ALL])), ujian: "__LAST__", page: 1 })}>Reset filter</button>}
      </section>

      <ErrorNote error={dash.error} onRetry={() => dash.reload()} />

      {!d ? (
        <>
          {dash.loading && <div className="note"><Spinner />Mengambil data peserta dari Google Sheets… pemuatan pertama bisa memakan waktu beberapa detik.</div>}
          <div className="grid g-2"><SkeletonCard lines={0} /><SkeletonCard lines={0} /></div>
        </>
      ) : (
        <>
          <div className="kpi-row six">
            <Kpi label="Total peserta" value={fmtNum(d.kpi.totalParticipants)} icon="users" />
            <Kpi label="Provinsi" value={fmtNum(d.kpi.totalProvinces)} icon="pin" />
            <Kpi label="Sekolah / instansi" value={fmtNum(d.kpi.totalSchools)} icon="building" />
            <Kpi label="Ujian bernilai" value={d.kpi.totalExamsWithData + (d.kpi.totalExams > d.kpi.totalExamsWithData ? " / " + d.kpi.totalExams : "")} icon="clipboard" />
            <Kpi label={"Rata-rata · " + (d.kpi.selectedExamLabel || "–")} value={d.kpi.averageScore == null ? "–" : Number(d.kpi.averageScore).toLocaleString("id-ID", { maximumFractionDigits: 1 })} icon="target" />
            <Kpi label="Sudah dinilai" value={fmtNum(d.kpi.gradedCount)} hint={`dari ${fmtNum(d.kpi.totalParticipants)} peserta`} icon="checkCircle" />
          </div>
          <Charts d={d} />
          <Ranking d={d} sort={ui.rankingSortBy} onSort={(v) => patch("pst", { rankingSortBy: v })} showAll={ui.rankAll} onToggle={() => patch("pst", { rankAll: !ui.rankAll })} />
          <Schools d={d} />
        </>
      )}
      <Participants query={query} exams={fo?.ujians || []} />
    </div>
  );
}

function Charts({ d }) {
  const c = useMemo(() => {
    const sel = d.kpi.selectedExamKey;
    const trend = {
      type: "bar",
      data: {
        labels: d.charts.scoreTrend.length ? d.charts.scoreTrend.map((x) => x.label) : ["(belum ada ujian)"],
        datasets: [{ label: "Rata-rata", data: d.charts.scoreTrend.map((x) => x.averageScore),
          backgroundColor: d.charts.scoreTrend.map((x) => (x.examKey === sel ? NAVY : "#9EC1E6")), borderRadius: 5, maxBarThickness: 60 }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false },
        tooltip: { callbacks: { label: (x) => `Rata-rata ${x.parsed.y} · ${d.charts.scoreTrend[x.dataIndex].gradedCount} peserta dinilai` } } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, suggestedMax: 100 } } },
    };
    const idx = {
      type: "bar",
      data: { labels: d.charts.indexDistribution.map((x) => x.index),
        datasets: [{ label: "Peserta", data: d.charts.indexDistribution.map((x) => x.count),
          backgroundColor: d.charts.indexDistribution.map((x) => (x.isLow ? ORANGE : BLUE)), borderRadius: 5, maxBarThickness: 60 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { grid: { display: false } }, y: { beginAtZero: true, ticks: { precision: 0 } } } },
    };
    const top = (list) => ({
      type: "bar",
      data: { labels: list.length ? list.map((x) => x.name) : ["(kosong)"], datasets: [{ label: "Peserta", data: list.map((x) => x.count), backgroundColor: BLUE, borderRadius: 4, maxBarThickness: 22 }] },
      options: { indexAxis: "y", responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { precision: 0 } }, y: { grid: { display: false } } } },
    });
    return { trend, idx, prov: top(d.charts.topProvinces), fak: top(d.charts.topFaculties) };
  }, [d]);
  const card = (title, sub, cfg, h) => (
    <section className="card"><div className="card-head"><div><h2 className="card-title">{title}</h2><div className="card-sub">{sub}</div></div></div><ChartCanvas config={cfg} height={h} /></section>
  );
  return (
    <>
      <div className="grid g-2">
        {card("Perkembangan nilai akhir", "Rata-rata nilai per tanggal ujian; batang gelap = ujian terpilih", c.trend, 240)}
        {card("Distribusi indeks", "Jumlah peserta per indeks · ujian " + (d.kpi.selectedExamLabel || "–") + " (oranye = C ke bawah)", c.idx, 240)}
      </div>
      <div className="grid g-2">
        {card("Sebaran provinsi", "10 provinsi terbanyak", c.prov, 300)}
        {card("Fakultas / jurusan", "10 terbanyak", c.fak, 300)}
      </div>
    </>
  );
}

function Ranking({ d, sort, onSort, showAll, onToggle }) {
  const list = d.rankings;
  const shown = showAll ? list : list.slice(0, 10);
  const metric = { ujian: "Nilai " + (d.kpi.selectedExamLabel || ""), rata: "Rata-rata", naik: "Kenaikan" }[sort];
  return (
    <section className="card">
      <div className="card-head">
        <div><h2 className="card-title">Peringkat peserta</h2><div className="card-sub">{list.length ? `${list.length} peserta punya nilai untuk urutan ini` + (sort === "naik" ? " (minimal 2 ujian)" : "") : "Belum ada peserta dengan nilai untuk urutan ini"}</div></div>
        <Segmented label="Urutkan peringkat" value={sort} onChange={onSort} options={SORTS} />
      </div>
      {!list.length ? <div className="empty-inline">Pilih ujian lain atau urutan lain.</div> : (
        <div className="tbl-scroll"><table className="tbl compact">
          <thead><tr><th className="c-rank">#</th><th>Peserta</th><th>Program</th><th>Fakultas</th><th>Indeks</th><th className="num">{metric}</th></tr></thead>
          <tbody>{shown.map((p, i) => (
            <tr key={i} className={p.rank <= 3 ? "top" : ""}>
              <td className="c-rank"><span className={"rank-no" + (p.rank <= 3 ? " top" : "")}>{p.rank}</span></td>
              <td><div className="cell-strong">{p.nama}</div><div className="row-meta"><span>{p.school}</span><span>{p.province}</span></div></td>
              <td>{p.program}</td><td>{p.faculty || "–"}</td><td><IdxChip ix={p.index} /></td>
              <td className="num cell-strong">{sort === "naik" && p.metricValue > 0 ? "+" : ""}{Number(p.metricValue).toLocaleString("id-ID", { maximumFractionDigits: 1 })}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {list.length > 10 && <button type="button" className="see-more" onClick={onToggle}>{showAll ? "Tampilkan 10 teratas" : `Lihat semua (${list.length})`}<Icon name={showAll ? "up" : "down"} size={15} /></button>}
    </section>
  );
}

function Schools({ d }) {
  const { schoolSearch: q, sekAll } = useUiStore((s) => s.pst);
  const patch = useUiStore((s) => s.patch);
  const ql = q.trim().toLowerCase();
  const list = ql ? d.schools.filter((s) => s.school.toLowerCase().includes(ql) || (s.province || "").toLowerCase().includes(ql)) : d.schools;
  const shown = sekAll || ql ? list : list.slice(0, 10);
  return (
    <section className="card">
      <div className="card-head">
        <div><h2 className="card-title">Sebaran sekolah</h2><div className="card-sub">{d.schools.length} sekolah/instansi{ql && ` · ${list.length} cocok`}</div></div>
        <div className="search compact"><Icon name="search" size={16} />
          <input type="search" placeholder="Cari sekolah atau provinsi" aria-label="Cari sekolah" value={q} onChange={(e) => patch("pst", { schoolSearch: e.target.value })} /></div>
      </div>
      {!list.length ? <div className="empty-inline">Tidak ada sekolah yang cocok.</div> : (
        <div className="tbl-scroll"><table className="tbl compact">
          <thead><tr><th className="c-rank">#</th><th>Sekolah / instansi</th><th className="num">Peserta</th><th className="c-share">Porsi</th>
            <th title="Berapa periode berbeda sekolah ini mengirim peserta">Frekuensi</th><th className="num">Rata-rata nilai</th></tr></thead>
          <tbody>{shown.map((s) => (
            <tr key={s.school}>
              <td className="c-rank muted">{s.rank}</td>
              <td><div className="cell-strong">{s.school}</div><div className="row-meta"><span>{s.province || "–"}</span></div></td>
              <td className="num cell-strong">{fmtNum(s.participantCount)}</td>
              <td className="c-share"><span className="att-cell"><Bar value={s.percentage} />{Number(s.percentage).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%</span></td>
              <td title={s.periods.map((p) => `${p.key}: ${p.count} peserta`).join("\n")}>{s.frequency}× <span className="muted small">{s.periods.slice(0, 2).map((p) => p.key).join(", ")}{s.periods.length > 2 ? ", …" : ""}</span></td>
              <td className="num">{s.averageScore == null ? <span className="muted">–</span> : Number(s.averageScore).toLocaleString("id-ID", { maximumFractionDigits: 1 })}{s.gradedCount > 0 && <span className="muted small"> · {s.gradedCount} dinilai</span>}</td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      {!ql && list.length > 10 && <button type="button" className="see-more" onClick={() => patch("pst", { sekAll: !sekAll })}>{sekAll ? "Tampilkan 10 teratas" : `Lihat semua (${list.length})`}<Icon name={sekAll ? "up" : "down"} size={15} /></button>}
    </section>
  );
}

function Participants({ query, exams }) {
  const ui = useUiStore((s) => s.pst);
  const patch = useUiStore((s) => s.patch);
  const { data, error, loading, reload } = useApi("/peserta/participants", { ...query, search: ui.search, page: ui.page, perPage: ui.perPage });
  const rows = data?.data || [];
  const [open, setOpen] = useState(null);
  const scoreChips = (p) => exams.filter((u) => p.scores?.[u.key]?.value != null).map((u) => (
    <span key={u.key} className="score" title={u.label}><small>{u.label.replace(/ \d{4}$/, "")}</small><b>{p.scores[u.key].value}</b><IdxChip ix={p.scores[u.key].index} /></span>
  ));
  return (
    <section className="card tbl-card">
      <div className="tbl-head"><div><h2 className="card-title">Daftar peserta</h2>
        <div className="card-sub">{data?.pagination ? fmtNum(data.pagination.totalRecords) + " peserta sesuai filter" : "Memuat…"}</div></div></div>
      <div className="tbl-toolbar">
        <SearchInput value={ui.search} onChange={(v) => patch("pst", { search: v, page: 1 })} placeholder="Cari nama, sekolah, atau kelompok" />
      </div>
      <ErrorNote error={error} onRetry={() => reload()} />
      {!data && loading ? <SkeletonCard lines={6} /> : !rows.length ? (
        <EmptyState icon={ui.search ? "search" : "users"} title={ui.search ? `Tidak ada peserta yang cocok dengan "${ui.search}"` : "Belum ada peserta untuk filter ini"} />
      ) : (
        <div className={"tbl-body" + (loading ? " is-loading" : "")}>
          <div className="tbl-scroll"><table className="tbl pst-tbl">
            <thead><tr><th>Peserta</th><th>Program</th><th className="c-fak">Fakultas / jurusan</th><th className="c-kel">Kelompok</th><th>Nilai ujian</th></tr></thead>
            <tbody>{rows.map((p, i) => (
              <tr key={i} onClick={() => setOpen(p)}>
                <td><button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); setOpen(p); }}>{p.nama}</button>
                  <div className="row-meta"><span>{p.sekolah || "–"}</span>{p.provinsi && <span>{p.provinsi}</span>}</div></td>
                <td><div>{p.program}{p.periode && <span className="muted"> · P{p.periode}</span>}</div><div className="row-meta"><span className="trunc">{p.aktivitas}</span></div></td>
                <td className="c-fak">{p.fakultas || <span className="muted">–</span>}</td>
                <td className="c-kel">{p.kelompok || <span className="muted">–</span>}</td>
                <td><div className="scores">{scoreChips(p).length ? scoreChips(p) : <span className="muted">Belum ada nilai</span>}</div></td>
              </tr>
            ))}</tbody>
          </table></div>
          <ul className="rec-list">{rows.map((p, i) => (
            <li key={i} className="rec"><button type="button" className="rec-main" onClick={() => setOpen(p)}>
              <span className="rec-top"><span className="rec-name">{p.nama}</span></span>
              <span className="rec-meta"><span>{p.sekolah || "–"}</span><span>{p.program}{p.periode && " · P" + p.periode}</span></span>
              <span className="scores">{scoreChips(p)}</span>
            </button></li>
          ))}</ul>
        </div>
      )}
      <Pagination pagination={data?.pagination} perPage={ui.perPage} noun="peserta"
        onPage={(n) => patch("pst", { page: n })} onPerPage={(n) => patch("pst", { perPage: n, page: 1 })} />
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.nama} sub={open && open.program + (open.periode ? " · Periode " + open.periode : "")}>
        {open && (
          <>
            <dl className="facts">
              {[["Sekolah", open.sekolah], ["Provinsi", open.provinsi], ["Aktivitas", open.aktivitas], ["Fakultas / jurusan", open.fakultas],
                ["Skema", open.skema], ["Tipe", open.tipe], ["Kelompok", open.kelompok], ["PIC", open.pic]].map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v || "–"}</dd></div>)}
            </dl>
            <h3 className="detail-h">Nilai ujian</h3>
            <table className="mini-tbl"><thead><tr><th>Ujian</th><th className="num">Nilai</th><th>Indeks</th></tr></thead>
              <tbody>{exams.map((u) => { const s = open.scores?.[u.key]; return <tr key={u.key}><td>{u.label}</td><td className="num">{s?.value ?? "–"}</td><td><IdxChip ix={s?.index} /></td></tr>; })}</tbody></table>
          </>
        )}
      </Sheet>
    </section>
  );
}
