import { fmtDate } from "../lib/format.js";

const DAY = 86400000;
const short = (d) => d.toLocaleDateString("id-ID", { day: "numeric", month: "short" });

/** rows: [{ key, label, color, start, end, count }] (start/end = tanggal ISO). legend: [{ label, color }] opsional. */
export function Gantt({ rows, legend }) {
  const items = rows.map((r) => ({ ...r, s: new Date(r.start), e: new Date(r.end) })).filter((r) => !isNaN(r.s) && !isNaN(r.e));
  if (!items.length) return <div className="empty-inline">Belum ada kegiatan bertanggal dengan fase.</div>;
  const min = Math.min(...items.map((r) => r.s.getTime())), max = Math.max(...items.map((r) => r.e.getTime()));
  const span = Math.max((max - min) / DAY, 1), pad = Math.max(span * 0.04, 1);
  const base = min - pad * DAY, total = span + pad * 2;
  const pos = (r) => {
    const left = Math.max(0, ((r.s.getTime() - base) / DAY / total) * 100);
    const width = Math.max(((r.e - r.s) / DAY + 1) / total * 100, 2.5);
    return { left: left + "%", width: Math.min(width, 100 - left) + "%" };
  };
  // garis bantu awal tiap bulan
  const ticks = [];
  for (let d = new Date(new Date(base).getFullYear(), new Date(base).getMonth() + 1, 1); d.getTime() < base + total * DAY; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) {
    ticks.push({ left: ((d.getTime() - base) / DAY / total) * 100, label: d.toLocaleDateString("id-ID", { month: "short" }) });
  }
  return (
    <div className="gantt">
      <div className="gantt-scale" aria-hidden="true">
        <span />
        <div className="gantt-ticks">{ticks.map((t) => <span key={t.left} style={{ left: t.left + "%" }}>{t.label}</span>)}</div>
      </div>
      {items.map((r) => (
        <div className="gantt-row" key={r.key}>
          <div className="gantt-lab" title={r.label}>{r.label}</div>
          <div className="gantt-track">
            {ticks.map((t) => <i key={t.left} className="gantt-grid" style={{ left: t.left + "%" }} />)}
            <div className="gantt-bar" style={{ ...pos(r), background: r.color }}
              title={`${r.label}: ${fmtDate(r.start)} – ${fmtDate(r.end)} · ${r.count} kegiatan`}>
              <span>{short(r.s)}{r.s.toDateString() !== r.e.toDateString() && "–" + short(r.e)}</span>
            </div>
          </div>
        </div>
      ))}
      {legend && legend.length > 1 && (
        <div className="legend">{legend.map((l) => <span key={l.label}><i style={{ background: l.color }} />{l.label}</span>)}</div>
      )}
    </div>
  );
}
