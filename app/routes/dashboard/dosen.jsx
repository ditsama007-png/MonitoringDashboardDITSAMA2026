import { useMemo, useState } from "react";
import { ChartCanvas } from "../../components/ChartCanvas.jsx";
import { Icon } from "../../components/Icon.jsx";
import {
  Bar, EmptyState, ErrorNote, Kpi, PageHead, SearchInput, SelectField, Sheet, SkeletonCard, Spinner,
} from "../../components/ui.jsx";
import { fmtNum, withoutAll } from "../../lib/format.js";
import { useApi } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";

const ALL = "Semua";
const METODE_COL = { Luring: "#204074", Hibrida: "#9EC1E6", Daring: "#E08A2E" };
const FILTERS = [["program", "programs", "Program"], ["mapel", "mapels", "Mata kuliah"], ["metode", "metodes", "Metode"],
  ["kelas", "kelas", "Kelas"], ["bahasa", "bahasas", "Bahasa"]];
const score = (v) => (v == null ? "–" : Number(v).toLocaleString("id-ID", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
// "Dr. Budi Santoso, S.Si., M.Si." -> "Budi Santoso"
const nice = (n) => String(n || "").split(",")[0].replace(/^((prof|dr|drs|dra|ir)\.?\s+)+/i, "").trim();

export default function Dosen() {
  const ui = useUiStore((s) => s.dsn);
  const patch = useUiStore((s) => s.patch);
  const filters = { ...withoutAll(Object.fromEntries(FILTERS.map(([k]) => [k, ui[k]]))), ...(ui.minResp !== "1" ? { minResp: ui.minResp } : {}) };
  const { data, error, loading, reload } = useApi("/dashboard/dosen", filters);
  const d = data?.data;
  const fo = d?.filterOptions;
  const [busy, setBusy] = useState(false);
  const refresh = async () => { setBusy(true); await reload({ refresh: true }); setBusy(false); };
  const select = (key) => patch("dsn", { sel: key });
  const active = FILTERS.some(([k]) => ui[k] !== ALL) || ui.minResp !== "1";
  const q = ui.search.trim().toLowerCase();
  const lecturers = (d?.lecturers || []).filter((l) => !q || l.name.toLowerCase().includes(q));

  return (
    <div className="page">
      <PageHead title="Portofolio Dosen" sub="Hasil evaluasi dosen oleh peserta (Google Form → Sheets)">
        <button type="button" className="btn" onClick={refresh} disabled={busy || loading}>
          {busy ? <Spinner /> : <Icon name="refresh" size={16} />}<span className="btn-txt">Muat ulang dari Sheets</span>
        </button>
      </PageHead>

      <section className="card filter-bar">
        {FILTERS.map(([k, optKey, label]) => {
          const list = fo?.[optKey] || [];
          return <SelectField key={k} label={label} value={list.includes(ui[k]) ? ui[k] : ALL} options={[ALL, ...list]} onChange={(v) => patch("dsn", { [k]: v })} />;
        })}
        <SelectField label="Minimal penilaian" value={ui.minResp} options={[["1", "Semua"], ["5", "≥ 5"], ["10", "≥ 10"], ["30", "≥ 30"]]} onChange={(v) => patch("dsn", { minResp: v })} />
        {active && <button type="button" className="btn btn-sm filter-reset" onClick={() => patch("dsn", { ...Object.fromEntries(FILTERS.map(([k]) => [k, ALL])), minResp: "1" })}>Reset filter</button>}
      </section>

      <ErrorNote error={error} onRetry={() => reload()} />

      {!d ? (
        <>
          {loading && <div className="note"><Spinner />Mengambil data evaluasi dari Google Sheets… pemuatan pertama bisa memakan waktu beberapa detik.</div>}
          <div className="grid g-2"><SkeletonCard lines={0} /><SkeletonCard lines={0} /></div>
        </>
      ) : (
        <>
          <div className="kpi-row six">
            <Kpi label="Dosen dinilai" value={fmtNum(d.kpi.totalLecturers)} icon="grad" />
            <Kpi label="Mata kuliah" value={fmtNum(d.kpi.totalSubjects)} icon="book" />
            <Kpi label="Peserta mengisi" value={fmtNum(d.kpi.totalRespondents)} icon="users" />
            <Kpi label="Total penilaian" value={fmtNum(d.kpi.totalRatings)} icon="clipboard" />
            <Kpi label="Rata-rata (1–5)" value={score(d.kpi.averageScore)} icon="star" />
            <Kpi label="Tertinggi" value={score(d.kpi.highestScore)} hint={nice(d.kpi.highestScoreLecturer)} icon="trophy" />
          </div>
          <Charts d={d} onSelect={select} />
          <section className="card">
            <div className="card-head"><div><h2 className="card-title">Mata kuliah</h2><div className="card-sub">Klik kartu untuk memfilter per mata kuliah</div></div></div>
            {!d.subjects.length ? <div className="empty-inline">Belum ada data.</div> : (
              <div className="subj-cards">
                {d.subjects.map((s) => (
                  <button key={s.subject} type="button" className={"subj" + (ui.mapel === s.subject ? " on" : "")}
                    onClick={() => patch("dsn", { mapel: ui.mapel === s.subject ? ALL : s.subject })} aria-pressed={ui.mapel === s.subject}>
                    <span className="subj-top"><b>{s.subject}</b><span className="muted">{s.lecturerCount} dosen</span></span>
                    <span className="subj-stats">
                      <span><b>{score(s.highestScore)}</b>tertinggi</span><span><b>{score(s.averageScore)}</b>rata-rata</span><span><b>{fmtNum(s.totalRatings)}</b>penilaian</span>
                    </span>
                    <ol>{s.topLecturers.map((l) => <li key={l.name}><span>{nice(l.name)}</span><b>{score(l.averageScore)}</b></li>)}</ol>
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="card tbl-card">
            <div className="tbl-head"><div><h2 className="card-title">Peringkat dosen</h2>
              <div className="card-sub">{d.lecturers.length} dosen{ui.minResp !== "1" && ` dengan minimal ${ui.minResp} penilaian`} · klik baris untuk melihat portofolio</div></div></div>
            <div className="tbl-toolbar"><SearchInput value={ui.search} onChange={(v) => patch("dsn", { search: v })} placeholder="Cari nama dosen" delay={150} /></div>
            {!lecturers.length ? <EmptyState icon="search" title="Tidak ada dosen yang cocok" /> : (
              <div className="tbl-scroll"><table className="tbl dsn-tbl">
                <thead><tr><th className="c-rank">#</th><th>Dosen</th><th className="c-meth">Metode</th><th className="num">Penilaian</th><th className="c-dist">Sebaran 1–5</th><th className="num">Rata-rata</th><th>Predikat</th></tr></thead>
                <tbody>{lecturers.map((l) => {
                  const mx = Math.max(...l.distribution, 1);
                  return (
                    <tr key={l.key} className={(ui.sel === l.key ? "sel " : "") + (l.rank <= 3 ? "top" : "")} onClick={() => select(l.key)}>
                      <td className="c-rank"><span className={"rank-no" + (l.rank <= 3 ? " top" : "")}>{l.rank}</span></td>
                      <td><button type="button" className="row-link" onClick={(e) => { e.stopPropagation(); select(l.key); }}>{l.name}</button>
                        <div className="row-meta"><span>{l.subjects.join(", ")}</span><span>{l.programs.join(", ")}</span></div></td>
                      <td className="c-meth">{l.methods.join(", ")}</td>
                      <td className="num">{fmtNum(l.totalRatings)}</td>
                      <td className="c-dist" title={l.distribution.map((c, i) => `${i + 1}: ${c}`).join(" · ")}>
                        <span className="dist">{l.distribution.map((c, i) => <i key={i} style={{ height: Math.round((c / mx) * 20) + 2 }} />)}</span></td>
                      <td className="num cell-strong">{score(l.averageScore)}</td>
                      <td><span className={"pred " + l.predicate.grade}>{l.predicate.text}</span></td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
            )}
          </section>
        </>
      )}
      <LecturerDetail lecturerKey={ui.sel} filters={filters} onClose={() => select("")} />
    </div>
  );
}

function Charts({ d, onSelect }) {
  const top = d.charts.rankings;
  const rank = useMemo(() => ({
    type: "bar",
    data: {
      labels: top.length ? top.map((l) => nice(l.name)) : ["(belum ada data)"],
      datasets: [{ label: "Rata-rata", data: top.map((l) => l.averageScore), backgroundColor: top.map((_, i) => (i < 3 ? "#204074" : "#3a6db0")), borderRadius: 4, maxBarThickness: 20 }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Rata-rata ${c.parsed.x} · ${top[c.dataIndex].totalRatings} penilaian · ${top[c.dataIndex].subjects.join(", ")}` } } },
      scales: { x: { min: 1, max: 5, ticks: { stepSize: 1 } }, y: { grid: { display: false } } },
      onClick: (_e, el) => { if (el.length) onSelect(top[el[0].index].key); },
      onHover: (e, el) => { e.native.target.style.cursor = el.length ? "pointer" : "default"; },
    },
  }), [d]);
  const methods = [...new Set(d.charts.methodBySubject.flatMap((s) => s.methods.map((m) => m.method)))];
  const metode = useMemo(() => ({
    type: "bar",
    data: {
      labels: d.charts.methodBySubject.length ? d.charts.methodBySubject.map((s) => s.subject) : ["(belum ada data)"],
      datasets: methods.map((m) => ({ label: m, backgroundColor: METODE_COL[m] || "#3a6db0", borderRadius: 4, maxBarThickness: 36,
        data: d.charts.methodBySubject.map((s) => s.methods.find((x) => x.method === m)?.averageScore ?? null) })),
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", align: "end" } },
      scales: { x: { grid: { display: false } }, y: { min: 1, max: 5, ticks: { stepSize: 1 } } } },
  }), [d]);
  return (
    <div className="grid g-2">
      <section className="card"><div className="card-head"><div><h2 className="card-title">15 dosen dengan nilai tertinggi</h2><div className="card-sub">Rata-rata 1–5 · klik batang untuk membuka portofolio</div></div></div>
        <ChartCanvas config={rank} height={Math.max(240, top.length * 24 + 40)} /></section>
      <section className="card"><div className="card-head"><div><h2 className="card-title">Rata-rata per metode</h2><div className="card-sub">Luring / Hibrida / Daring per mata kuliah</div></div></div>
        <ChartCanvas config={metode} height={300} /></section>
    </div>
  );
}

function LecturerDetail({ lecturerKey, filters, onClose }) {
  const { data, error, loading } = useApi("/dashboard/dosen/" + encodeURIComponent(lecturerKey || "-"), filters, { enabled: !!lecturerKey });
  const d = lecturerKey && data?.data?.key === lecturerKey ? data.data : null;
  return (
    <Sheet open={!!lecturerKey} onClose={onClose} wide title={d ? d.name : "Portofolio dosen"}
      sub={d && <span className="detail-sub">{d.tags.map((t) => <span key={t} className="ptag">{t}</span>)}<span className={"pred " + d.predicate.grade}>{d.predicate.text}</span></span>}>
      {error && <ErrorNote error={error} />}
      {!d ? (loading && <div className="note"><Spinner />Memuat portofolio…</div>) : (
        <div className="detail">
          <div className="metric-row">
            <div className="metric"><span>Rata-rata</span><b>{score(d.kpi.averageScore)}</b><small>skala 1–5</small></div>
            <div className="metric"><span>Peringkat</span><b>#{d.kpi.rank}</b><small>dari {d.kpi.totalRankedLecturers} dosen</small></div>
            <div className="metric"><span>Penilaian</span><b>{fmtNum(d.kpi.totalRatings)}</b></div>
            <div className="metric"><span>Memberi nilai 5</span><b>{d.kpi.fiveStarPercentage}%</b></div>
          </div>
          <div className="grid g-2 inner">
            <div>
              <h3 className="detail-h">Sebaran nilai</h3>
              <ul className="dist-list">{d.scoreDistribution.map((s) => (
                <li key={s.score}><b>{s.score}</b><Bar value={s.percentage} /><span className="num">{s.count}</span></li>
              ))}</ul>
              <h3 className="detail-h">Per metode</h3>
              <table className="mini-tbl"><thead><tr><th>Metode</th><th className="num">Penilaian</th><th className="num">Rata-rata</th></tr></thead>
                <tbody>{d.methods.map((m) => <tr key={m.method}><td>{m.method}</td><td className="num">{m.ratingsCount}</td><td className="num cell-strong">{score(m.averageScore)}</td></tr>)}</tbody></table>
            </div>
            <div>
              <h3 className="detail-h">Komentar peserta</h3>
              {!d.comments.length ? <p className="muted small">Belum ada komentar yang menyebut dosen ini.</p>
                : d.comments.slice(0, 12).map((c, i) => (
                  <figure className="quote" key={i}><blockquote>{c.text}</blockquote><figcaption>{[c.program, c.class, c.method].filter(Boolean).join(" · ")}</figcaption></figure>
                ))}
              {d.comments.length > 12 && <p className="muted small">+{d.comments.length - 12} komentar lain</p>}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}

