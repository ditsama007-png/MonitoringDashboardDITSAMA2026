import { faseRank, labelOf, progColor, tglWajar } from "../lib/format.js";

const DAY = 86400000;
const fmt = (d) => String(d.getDate()).padStart(2, "0") + "/" + String(d.getMonth() + 1).padStart(2, "0");
const WARNA_FASE = { persiapan: "#2F6FB0", pelaksanaan: "#16A34A", pelaporan: "#F59E0B", proses: "#8B5CF6", evaluasi: "#DC2626" };

// skala waktu global — hanya dari tanggal wajar (buang typo tahun spt 2006)
function scaleOf(items) {
  const wajar = items.filter((x) => tglWajar(x.d));
  const sd = wajar.length ? wajar : items;
  let gMin = sd[0].d, gMax = sd[0].d;
  sd.forEach((x) => { if (x.d < gMin) gMin = x.d; if (x.d > gMax) gMax = x.d; });
  const rawSpan = Math.max((gMax - gMin) / DAY, 1);
  const pad = Math.max(rawSpan * 0.08, 1);   // padding kiri-kanan
  return { gMin, gMax, base: gMin.getTime() - pad * DAY, total: rawSpan + pad * 2 };
}
function rangesByFase(items) {
  const byFase = {};
  items.forEach((x) => {
    const o = byFase[x.fase] = byFase[x.fase] || { min: x.d, max: x.d, count: 0 };
    if (x.d < o.min) o.min = x.d;
    if (x.d > o.max) o.max = x.d;
    o.count++;
  });
  return Object.keys(byFase).sort((a, b) => faseRank(a) - faseRank(b)).map((f) => ({ fase: f, ...byFase[f] }));
}
function barPos(o, sc) {
  let left = (o.min.getTime() - sc.base) / DAY / sc.total * 100;
  let width = ((o.max - o.min) / DAY + 1) / sc.total * 100;
  left = Math.max(0, Math.min(96, left));
  width = Math.max(width, 4); if (left + width > 100) width = 100 - left;
  return { left: left + "%", width: width + "%" };
}

/** items: [{ d: Date, fase, prog? }]. `perProgram` -> satu baris per (program, fase) dengan warna program + legenda. */
export function Gantt({ items, perProgram = false }) {
  if (!items.length) return <div className="empty">Belum ada data fase.</div>;
  const sc = scaleOf(items);
  const progs = perProgram ? [...new Set(items.map((x) => x.prog))] : [null];
  return (
    <>
      <div className="gantt">
        {progs.flatMap((pk) =>
          rangesByFase(perProgram ? items.filter((x) => x.prog === pk) : items).map((o) => {
            const name = perProgram ? labelOf(pk) + " · " + o.fase : o.fase;
            const bg = perProgram ? progColor(pk) : (WARNA_FASE[o.fase.toLowerCase()] || "#64748B");
            const range = fmt(o.min) + "–" + fmt(o.max);
            return (
              <div className="gantt-row" key={pk + "|" + o.fase}>
                <div className="gantt-lab">{name}</div>
                <div className="gantt-track">
                  <div className="gantt-bar" style={{ ...barPos(o, sc), background: bg }}
                    title={(perProgram ? labelOf(pk) + " - " + o.fase : o.fase) + ": " + range}>
                    <span>{range}{perProgram ? "" : ` · ${o.count} hari`}</span>
                  </div>
                </div>
              </div>
            );
          }))}
        <div className="gantt-axis"><span>{fmt(sc.gMin)}</span><span>{fmt(sc.gMax)}</span></div>
      </div>
      {perProgram && (
        <div className="gantt-legend">
          {progs.map((pk) => <span key={pk}><i style={{ background: progColor(pk) }} />{labelOf(pk)}</span>)}
        </div>
      )}
    </>
  );
}
