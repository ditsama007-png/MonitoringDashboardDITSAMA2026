import { useMemo, useState } from "react";
import { Navigate } from "react-router";
import { Calendar } from "../../components/Calendar.jsx";
import { ChartCanvas } from "../../components/ChartCanvas.jsx";
import { Gantt } from "../../components/Gantt.jsx";
import { Icon } from "../../components/Icon.jsx";
import {
  Bar, EmptyState, ErrorNote, Kpi, LevelBadge, PageHead, ProgramAbout, SeeMore, Sheet, SkeletonCard,
} from "../../components/ui.jsx";
import { PROGRAMS } from "../../config.js";
import { canSeeActivities, fmtDate, fmtNum, phaseLabel, progColor, withoutAll } from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";
import { useApi } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";

// layout menampilkan panel Filter untuk route ini
export const handle = { control: true };

const STATUS = { "On Track": ["Sesuai target", "ok"], Attention: ["Perlu perhatian", "warn"], Critical: ["Kritis", "crit"] };

export default function Portfolio() {
  // halaman awal dashboard; Finance langsung diarahkan ke Keuangan
  const session = useAuthStore((s) => s.session);
  return canSeeActivities(session) ? <PortfolioPage /> : <Navigate to="/dashboard/financial" replace />;
}

function PortfolioPage() {
  const dash = useUiStore((s) => s.dash);
  const { data, error, loading, reload } = useApi("/dashboard", withoutAll(dash));
  const d = data?.data;
  const program = PROGRAMS.find((p) => p.label === dash.program);
  const filters = Object.entries(dash).filter(([, v]) => v !== "Semua").map(([, v]) => v);

  return (
    <div className="page">
      <PageHead title={program ? program.fullName : "Portofolio Program"}
        sub={filters.length ? "Filter: " + filters.join(" · ") : "Semua program DITSAMA 2026"}>
        {loading && d && <span className="tb-loading"><Icon name="spinner" size={14} className="spin" />Memperbarui…</span>}
      </PageHead>
      <ErrorNote error={error} onRetry={() => reload()} />
      {program && <ProgramAbout program={program} />}
      {!d ? <PortfolioSkeleton /> : (
        <>
          <div className="kpi-row">
            <Kpi label="Kemajuan keseluruhan" value={d.kpi.progress + "%"} hint={`${fmtNum(d.kpi.totalDone)} dari ${fmtNum(d.kpi.totalActivities)} kegiatan selesai`} icon="trend" />
            <Kpi label="Berlangsung" value={fmtNum(d.kpi.totalOngoing)} hint="H-2 sampai H+7 dari tanggal kegiatan" tone="t-ongoing" icon="calendar" />
            <Kpi label="Akan datang" value={fmtNum(d.kpi.totalUpcoming)} hint="Terjadwal lebih dari 2 hari lagi" tone="t-upcoming" icon="calendar" />
            <Kpi label="Selesai" value={fmtNum(d.kpi.totalDone)} hint="Lewat H+7 atau ditandai selesai" tone="t-done" icon="checkCircle" />
          </div>

          <div className="grid g-5-7">
            <Performance strip={d.performanceStrip} />
            <PortfolioList items={d.portfolio} />
          </div>

          <div className="grid g-2">
            <Issues items={d.issues} />
            <Milestones items={d.milestones} />
          </div>

          <ParticipantAnalysis a={d.participantAnalysis} />
          <Capaian cap={d.capaian} />

          <div className="grid g-2">
            <Sdm sdm={d.sdmMitra.sdm} total={d.sdmMitra.totalSdm} />
            <Mitra items={d.sdmMitra.mitra} />
          </div>

          <section className="card">
            <div className="card-head"><div><h2 className="card-title">Linimasa fase kegiatan</h2>
              <div className="card-sub">Rentang tanggal tiap fase per program (ikut filter program &amp; bulan)</div></div></div>
            <Gantt
              rows={d.timeline.flatMap((t) => t.phases.map((ph) => ({
                key: t.program + ph.phase, label: `${t.programLabel} · ${phaseLabel(ph.phase)}`, color: progColor(t.program),
                start: ph.startDate, end: ph.endDate, count: ph.count,
              })))}
              legend={d.timeline.map((t) => ({ label: t.programLabel, color: progColor(t.program) }))} />
          </section>

          <Calendar events={d.calendar} />
        </>
      )}
    </div>
  );
}

function PortfolioSkeleton() {
  return (
    <>
      <div className="kpi-row">{Array.from({ length: 4 }, (_, i) => <div className="kpi" key={i}><span className="skel" style={{ height: 12, width: "60%" }} /><span className="skel" style={{ height: 26, width: "40%", marginTop: 10 }} /></div>)}</div>
      <div className="grid g-5-7"><SkeletonCard lines={5} /><SkeletonCard lines={5} /></div>
      <div className="grid g-2"><SkeletonCard /><SkeletonCard /></div>
    </>
  );
}

const PERF = [
  ["achievementValue", "Nilai capaian peserta", "target"],
  ["attendancePercentage", "Kehadiran peserta", "userCheck"],
  ["activityProgress", "Keberjalanan kegiatan", "trend"],
  ["feedback", "Umpan balik peserta", "message"],
  ["issueAlert", "Skor isu & peringatan", "alert"],
];
function Performance({ strip }) {
  return (
    <section className="card">
      <div className="card-head"><div><h2 className="card-title">Skor kinerja</h2><div className="card-sub">Rata-rata dari kegiatan yang punya nilai</div></div></div>
      <ul className="perf">
        {PERF.map(([k, label, icon]) => {
          const v = strip[k];
          return (
            <li key={k}>
              <span className="perf-ic"><Icon name={icon} size={16} /></span>
              <span className="perf-lab">{label}</span>
              <Bar value={v} tone={!v ? "" : v < 60 ? "crit" : v < 80 ? "warn" : "ok"} />
              <b className="perf-val">{v ? v + "%" : <span className="muted" title="Belum ada data">–</span>}</b>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function PortfolioList({ items }) {
  return (
    <section className="card">
      <div className="card-head"><div><h2 className="card-title">Kinerja portofolio program</h2>
        <div className="card-sub">Nilai kinerja = rata-rata capaian, kehadiran, umpan balik, keberjalanan &amp; isu</div></div></div>
      {!items.length ? <EmptyState title="Belum ada data program" /> : (
        <ul className="port">
          {items.map((p) => {
            const [label, tone] = STATUS[p.status] || [p.status, ""];
            return (
              <li key={p.program}>
                <span className="port-dot" style={{ background: progColor(p.program) }} />
                <div className="port-nm"><b>{p.label}</b><small>{p.pics.length ? "PIC: " + p.pics.join(", ") : "Belum ada PIC"}</small></div>
                <div className="port-cnt" title="Kegiatan selesai / total">{p.completedActivities}<span className="muted">/{p.totalActivities}</span></div>
                <div className="port-score"><Bar value={p.performanceScore} tone={tone} /><b>{p.performanceScore}%</b></div>
                <span className={"pill " + tone}>{label}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Issues({ items }) {
  const [open, setOpen] = useState(null);
  const counts = items.reduce((c, i) => ({ ...c, [i.level]: (c[i.level] || 0) + 1 }), {});
  return (
    <section className="card">
      <div className="card-head">
        <div><h2 className="card-title">Isu &amp; peringatan</h2><div className="card-sub">{items.length ? `${items.length} isu tercatat, terberat di atas` : "Tidak ada isu tercatat"}</div></div>
        <div className="lv-counts">{["high", "medium", "low"].map((l) => counts[l] ? <span key={l} className={"level lv-" + l}>{counts[l]}</span> : null)}</div>
      </div>
      {!items.length ? <EmptyState icon="checkCircle" title="Semua kegiatan berjalan tanpa isu" /> : (
        <SeeMore items={items} limit={4} render={(i) => (
          <button type="button" key={i.id} className={"issue-row lv-" + i.level} onClick={() => setOpen(i)}>
            <span className="issue-txt"><b>{i.name}</b><small>{i.programLabel} · {i.activityName}</small></span>
            <LevelBadge level={i.level} />
          </button>
        )} />
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open?.name} sub={open && <span className="detail-sub"><span className="ptag">{open.programLabel}</span><LevelBadge level={open.level} /></span>}>
        {open && (
          <dl className="facts">
            <div><dt>Kegiatan</dt><dd>{open.activityName}</dd></div>
            <div><dt>PIC</dt><dd>{open.pic || "–"}</dd></div>
            <div><dt>Dengan pihak</dt><dd>{open.to || "–"}</dd></div>
            <div><dt>Penanganan</dt><dd>{open.problemSolving || "–"}</dd></div>
          </dl>
        )}
      </Sheet>
    </section>
  );
}

function Milestones({ items }) {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const next = items.filter((m) => m.date && new Date(m.date) >= today);
  const past = items.length - next.length;
  return (
    <section className="card">
      <div className="card-head"><div><h2 className="card-title">Agenda mendatang</h2>
        <div className="card-sub">{next.length ? `${next.length} agenda terjadwal` : "Tidak ada agenda terjadwal"}{past > 0 && ` · ${past} agenda sudah lewat`}</div></div></div>
      {!next.length ? <EmptyState icon="calendar" title="Belum ada agenda ke depan">Agenda dibuat dari Data Kegiatan dengan jenis “Agenda mendatang”.</EmptyState> : (
        <SeeMore items={next} limit={4} render={(m) => {
          const dt = new Date(m.date);
          return (
            <div className="ms" key={m.id}>
              <div className="ms-date"><b>{dt.getDate()}</b><small>{dt.toLocaleDateString("id-ID", { month: "short" })}</small></div>
              <div className="ms-txt"><b>{m.name}</b><small>{m.programLabel} · {fmtDate(m.date, { weekday: "long", year: undefined })}</small></div>
            </div>
          );
        }} />
      )}
    </section>
  );
}

function ParticipantAnalysis({ a }) {
  const per = a.attendancePerActivity.filter((x) => x.registered > 0);
  const chart = useMemo(() => ({
    type: "bar",
    data: {
      labels: per.length ? per.map((x) => (x.activityName.length > 22 ? x.activityName.slice(0, 21) + "…" : x.activityName)) : ["(belum ada data)"],
      datasets: [
        { label: "Terdaftar", data: per.map((x) => x.registered), backgroundColor: "#BCD3EE", borderRadius: 4, maxBarThickness: 26 },
        { label: "Hadir", data: per.map((x) => x.present), backgroundColor: "#3a6db0", borderRadius: 4, maxBarThickness: 26 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top", align: "end" },
        tooltip: { callbacks: { title: (items) => per[items[0].dataIndex]?.activityName } },
        zoom: { zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: "x" }, pan: { enabled: true, mode: "x" }, limits: { x: { min: "original", max: "original" } } },
      },
      scales: { x: { grid: { display: false }, ticks: { maxRotation: 50, minRotation: 0 } }, y: { beginAtZero: true } },
    },
  }), [a]);

  return (
    <section className="card">
      <div className="card-head"><div><h2 className="card-title">Analisis peserta</h2><div className="card-sub">Pendaftaran &amp; kehadiran dari Data Kegiatan (ikut filter program &amp; bulan)</div></div></div>
      <div className="stat-row">
        <div><span>Kegiatan berpeserta</span><b>{fmtNum(a.totalActivities)}</b></div>
        <div><span>Total terdaftar</span><b>{fmtNum(a.totalRegistered)}</b></div>
        <div><span>Total hadir</span><b>{fmtNum(a.totalPresent)}</b></div>
        <div><span>Kehadiran tertimbang</span><b>{a.attendancePercentage}%</b></div>
      </div>
      <div className="grid g-7-5 inner">
        <div>
          <div className="mini-head">Terdaftar vs hadir per kegiatan</div>
          <ChartCanvas config={chart} zoom height={280} />
          <div className="hint">Gulir atau cubit grafik untuk memperbesar, seret untuk menggeser.</div>
        </div>
        <div>
          <div className="mini-head">Per jenis peserta</div>
          {!a.categories.length ? <div className="empty-inline">Belum ada data peserta.</div> : (
            <table className="mini-tbl">
              <thead><tr><th>Jenis</th><th className="num">Terdaftar</th><th className="num">Hadir</th><th className="num">Kehadiran</th></tr></thead>
              <tbody>{a.categories.map((c) => (
                <tr key={c.category}><td>{c.category}</td><td className="num">{fmtNum(c.registered)}</td><td className="num">{fmtNum(c.present)}</td>
                  <td className="num"><span className="att-cell"><Bar value={c.attendancePercentage} />{c.attendancePercentage}%</span></td></tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </div>
    </section>
  );
}

function Capaian({ cap }) {
  const q = useUiStore((s) => s.capSearch);
  const ql = q.trim().toLowerCase();
  const rows = ql ? cap.items.filter((x) => x.names.join(" ").toLowerCase().includes(ql) || x.category.toLowerCase().includes(ql)) : cap.items;
  return (
    <section className="card">
      <div className="card-head">
        <div><h2 className="card-title">Capaian peserta</h2>
          <div className="card-sub">{cap.totalAchievements} capaian · {cap.totalParticipants} peserta (dari sheet Capaian_Peserta, ikut filter program &amp; tahun)</div></div>
        <div className="search compact">
          <Icon name="search" size={16} />
          <input type="search" placeholder="Cari nama / kategori" aria-label="Cari capaian" value={q} onChange={(e) => useUiStore.setState({ capSearch: e.target.value })} />
        </div>
      </div>
      {cap.summary.length > 0 && (
        <div className="medals">{cap.summary.filter((s) => s.count > 0).map((s) => <span key={s.cls} className={"medal " + s.cls}>{s.label}<b>{s.count}</b></span>)}</div>
      )}
      {!rows.length ? <div className="empty-inline">{cap.items.length ? "Tidak ada capaian yang cocok." : "Belum ada data capaian."}</div> : (
        <div className="tbl-scroll"><table className="tbl compact">
          <thead><tr><th>Program</th><th>Kategori</th><th>Peringkat</th><th>Nama</th><th>Jenis</th></tr></thead>
          <tbody>{rows.map((x, i) => (
            <tr key={i}><td>{x.programLabel}</td><td className="cell-strong">{x.category || "–"}</td>
              <td><span className={"medal " + x.rank.cls}>{x.rank.label}</span></td>
              <td className="wrap">{x.names.join(", ")}</td><td>{x.type}{x.names.length > 1 && <span className="muted"> · {x.names.length} orang</span>}</td></tr>
          ))}</tbody>
        </table></div>
      )}
    </section>
  );
}

function Sdm({ sdm, total }) {
  const [open, setOpen] = useState(null);
  return (
    <section className="card">
      <div className="card-head"><div><h2 className="card-title">SDM terlibat</h2><div className="card-sub">{total} orang berbeda per peran (ikut filter program &amp; bulan)</div></div></div>
      {!sdm.length ? <div className="empty-inline">Belum ada data SDM.</div> : (
        <ul className="sdm-list">
          {sdm.map((s) => (
            <li key={s.position}>
              <button type="button" onClick={() => setOpen(s)}>
                <span>{s.position}</span><Bar value={(s.count / Math.max(...sdm.map((x) => x.count))) * 100} /><b>{s.count}</b><Icon name="right" size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={open ? `${open.position} · ${open.count} orang` : ""}>
        {open && <ol className="name-list">{open.names.map((n) => <li key={n}>{n}</li>)}</ol>}
      </Sheet>
    </section>
  );
}

function Mitra({ items }) {
  return (
    <section className="card">
      <div className="card-head"><div><h2 className="card-title">Mitra</h2><div className="card-sub">{items.length} mitra dari data SDM peran Mitra</div></div></div>
      {!items.length ? <div className="empty-inline">Belum ada data mitra.</div> : (
        <ul className="mitra">
          {items.map((m) => (
            <li key={m.name}>
              <span className="mitra-ava">{m.name.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase()}</span>
              <span><b>{m.name}</b><small>{m.program}</small></span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
