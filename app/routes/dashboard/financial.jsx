import { useMemo } from "react";
import { ChartCanvas } from "../../components/ChartCanvas.jsx";
import { FinanceTable } from "../../components/Finance.jsx";
import { RequireAccess } from "../../components/Access.jsx";
import { Icon } from "../../components/Icon.jsx";
import { Bar, ErrorNote, Kpi, PageHead, SelectField, SkeletonCard, Spinner } from "../../components/ui.jsx";
import { FIN_PROGRAMS } from "../../config.js";
import { finProgramLabel, fmtRupiah, fmtRupiahShort, MONTHS, progColor } from "../../lib/format.js";
import { useApi } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";

const monthName = (ym) => { const [y, m] = ym.split("-"); return MONTHS[Number(m) - 1].slice(0, 3) + " " + y; };
const jt = (v) => Math.round((Number(v) || 0) / 1e5) / 10;   // juta, 1 desimal

export default function Financial() {
  return <RequireAccess area="finance" page="Keuangan"><FinancialPage /></RequireAccess>;
}

function FinancialPage() {
  const ui = useUiStore((s) => s.fin);
  const patch = useUiStore((s) => s.patch);
  const update = (v) => patch("fin", v);

  const filters = {
    programs: [ui.program || "all"],
    ...(ui.year ? { year: Number(ui.year) } : {}),
    ...(ui.month ? { month: Number(ui.month) } : {}),
    ...(ui.submissionType ? { submissionType: ui.submissionType } : {}),
  };
  const { data, error, loading, reload } = useApi("/dashboard/financial", filters);
  const d = data?.data;
  const fo = d?.filterOptions;
  const months = (fo?.months || []).filter((m) => !ui.year || String(m.year) === ui.year);
  const setFilter = (v) => update({ ...v, page: 1 });
  const active = !!(ui.program !== "all" || ui.year || ui.month || ui.submissionType);

  return (
    <div className="page">
      <PageHead title="Keuangan" sub="PKS, pengajuan dana, dan saldo per program">
        {loading && d && <span className="tb-loading"><Spinner size={14} />Memperbarui…</span>}
      </PageHead>

      <section className="card filter-bar">
        <SelectField label="Program" value={ui.program} onChange={(v) => setFilter({ program: v })}
          options={[["all", "Semua program"], ...FIN_PROGRAMS.map((p) => [p.api, p.label])]} />
        <SelectField label="Tahun" value={ui.year} onChange={(v) => setFilter({ year: v, month: "" })}
          options={[["", "Semua tahun"], ...(fo?.years || []).map((y) => [String(y), String(y)])]} />
        <SelectField label="Bulan" value={ui.month} onChange={(v) => setFilter({ month: v })}
          options={[["", "Semua bulan"], ...[...new Set(months.map((m) => m.month))].sort((a, b) => a - b).map((m) => [String(m), MONTHS[m - 1]])]} />
        <SelectField label="Jenis pengajuan" value={ui.submissionType} onChange={(v) => setFilter({ submissionType: v })}
          options={[["", "Semua jenis"], ...(fo?.submissionTypes || []).map((t) => [t, t])]} />
        {active && <button type="button" className="btn btn-sm filter-reset" onClick={() => setFilter({ program: "all", year: "", month: "", submissionType: "" })}>Reset filter</button>}
      </section>

      <ErrorNote error={error} onRetry={() => reload()} />

      {!d ? <div className="grid g-2"><SkeletonCard /><SkeletonCard /></div> : (
        <>
          <div className="kpi-row five">
            <Kpi label="Total nilai PKS" value={fmtRupiahShort(d.kpi.totalPks)} hint={fmtRupiah(d.kpi.totalPks)} icon="wallet" />
            <Kpi label="Total DPKS" value={fmtRupiahShort(d.kpi.totalDpks)} hint={fmtRupiah(d.kpi.totalDpks)} />
            <Kpi label="Total pengajuan" value={fmtRupiahShort(d.kpi.totalSubmission)} hint={fmtRupiah(d.kpi.totalSubmission)} />
            <Kpi label="Saldo saat ini" value={fmtRupiahShort(d.kpi.currentBalance)} hint={fmtRupiah(d.kpi.currentBalance)} tone={d.kpi.currentBalance < 0 ? "t-neg" : ""} />
            <div className="kpi">
              <div className="kpi-lab">Serapan anggaran</div>
              <div className="kpi-val">{d.kpi.absorptionPercentage}%</div>
              <Bar value={d.kpi.absorptionPercentage} tone={d.kpi.absorptionPercentage > 95 ? "crit" : ""} />
            </div>
          </div>
          <FinCharts d={d} />
          <Summary rows={d.summary} />
        </>
      )}

      <FinanceTable filters={filters} ui={ui} update={update} />
    </div>
  );
}

function FinCharts({ d }) {
  const charts = useMemo(() => {
    const months = d.monthlyRealization.map((m) => m.month);
    const progs = [...new Set(d.monthlyRealization.flatMap((m) => m.programs.filter((p) => p.realization).map((p) => p.program)))];
    const yJt = { beginAtZero: true, ticks: { callback: (v) => v + " jt" } };
    const tipRp = { callbacks: { label: (c) => `${c.dataset.label}: ${fmtRupiah((c.parsed.y ?? c.parsed.x) * 1e6)}` } };
    const realisasi = {
      type: "bar",
      data: {
        labels: months.length ? months.map(monthName) : ["(belum ada pengajuan)"],
        datasets: progs.map((p) => ({
          label: finProgramLabel(p), backgroundColor: progColor(p), borderRadius: 3, maxBarThickness: 34, stack: "s",
          data: d.monthlyRealization.map((m) => jt(m.programs.find((x) => x.program === p)?.realization)),
        })),
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", align: "end" }, tooltip: tipRp },
        scales: { x: { stacked: true, grid: { display: false } }, y: { ...yJt, stacked: true } } },
    };
    const bProgs = [...new Set(d.monthlyBalance.flatMap((m) => m.programs.filter((p) => p.balance).map((p) => p.program)))];
    const saldo = {
      type: "line",
      data: {
        labels: d.monthlyBalance.length ? d.monthlyBalance.map((m) => monthName(m.month)) : ["(belum ada data)"],
        datasets: bProgs.map((p) => ({
          label: finProgramLabel(p), borderColor: progColor(p), backgroundColor: progColor(p), tension: 0.3, spanGaps: true, pointRadius: 3,
          data: d.monthlyBalance.map((m) => { const v = m.programs.find((x) => x.program === p); return v ? jt(v.balance) : null; }),
        })),
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", align: "end" }, tooltip: tipRp },
        scales: { x: { grid: { display: false } }, y: { ticks: { callback: (v) => v + " jt" } } } },
    };
    const cmp = d.programComparison.filter((p) => p.pksValue || p.realization);
    const banding = {
      type: "bar",
      data: {
        labels: cmp.length ? cmp.map((p) => finProgramLabel(p.program)) : ["(belum ada data)"],
        datasets: [
          { label: "Nilai PKS", data: cmp.map((p) => jt(p.pksValue)), backgroundColor: "#BCD3EE", borderRadius: 4, maxBarThickness: 40 },
          { label: "Realisasi", data: cmp.map((p) => jt(p.realization)), backgroundColor: "#3a6db0", borderRadius: 4, maxBarThickness: 40 },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top", align: "end" }, tooltip: tipRp },
        scales: { x: { grid: { display: false } }, y: yJt } },
    };
    return { realisasi, saldo, banding };
  }, [d]);

  return (
    <>
      <div className="grid g-2">
        <section className="card"><div className="card-head"><div><h2 className="card-title">Realisasi bulanan</h2><div className="card-sub">Pengajuan per bulan, ditumpuk per program (juta Rp)</div></div></div>
          <ChartCanvas config={charts.realisasi} height={260} /></section>
        <section className="card"><div className="card-head"><div><h2 className="card-title">Saldo per bulan</h2><div className="card-sub">Saldo akhir bulan tiap program (juta Rp)</div></div></div>
          <ChartCanvas config={charts.saldo} height={260} /></section>
      </div>
      <section className="card"><div className="card-head"><div><h2 className="card-title">Nilai PKS vs realisasi</h2><div className="card-sub">Per program (juta Rp)</div></div></div>
        <ChartCanvas config={charts.banding} height={240} /></section>
    </>
  );
}

function Summary({ rows }) {
  const used = rows.filter((r) => r.totalPks || r.totalSubmission);
  const idle = rows.length - used.length;
  return (
    <section className="card">
      <div className="card-head"><div><h2 className="card-title">Ringkasan per program</h2>
        <div className="card-sub">{idle > 0 ? `${idle} program belum punya transaksi dan tidak ditampilkan` : "Semua program"}</div></div></div>
      {!used.length ? <div className="empty-inline">Belum ada transaksi untuk filter ini.</div> : (
        <div className="tbl-scroll"><table className="tbl compact">
          <thead><tr><th>Program</th><th className="num">Nilai PKS</th><th className="num">DPKS</th><th className="num">Pengajuan</th><th className="num">Saldo</th><th className="c-abs">Serapan</th></tr></thead>
          <tbody>{used.map((r) => (
            <tr key={r.program}>
              <td className="cell-strong"><span className="port-dot" style={{ background: progColor(r.program) }} />{finProgramLabel(r.program)}</td>
              <td className="num">{fmtRupiah(r.totalPks)}</td><td className="num">{fmtRupiah(r.totalDpks)}</td>
              <td className="num">{fmtRupiah(r.totalSubmission)}</td><td className={"num cell-strong" + (r.balance < 0 ? " neg" : "")}>{fmtRupiah(r.balance)}</td>
              <td className="c-abs"><span className="att-cell"><Bar value={r.absorptionPercentage} />{r.absorptionPercentage}%</span></td>
            </tr>
          ))}</tbody>
        </table></div>
      )}
      <p className="hint"><Icon name="info" size={14} />Serapan = pengajuan ÷ (nilai PKS − DPKS).</p>
    </section>
  );
}
