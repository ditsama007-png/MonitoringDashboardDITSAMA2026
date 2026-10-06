import { useState } from "react";
import { fmtDateLong, MONTHS, statusLabel } from "../lib/format.js";
import { useUiStore } from "../stores/ui.js";
import { Icon } from "./Icon.jsx";
import { Sheet, StatusBadge } from "./ui.jsx";

const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

/** Kalender kegiatan. events = [{ id, name, date, status, programLabel, pic, location }] dari backend. */
export function Calendar({ events }) {
  const calMonth = useUiStore((s) => s.calMonth);
  const [detail, setDetail] = useState(null);   // { list, date }

  const dated = events.map((e) => ({ ...e, d: new Date(e.date) })).filter((e) => !isNaN(e.d));
  // default: buka di bulan ini bila ada kegiatan, kalau tidak di bulan data terbaru
  let month = calMonth;
  if (!month) {
    const now = new Date();
    const hasNow = dated.some((e) => e.d.getFullYear() === now.getFullYear() && e.d.getMonth() === now.getMonth());
    const latest = dated.reduce((m, e) => (!m || e.d > m ? e.d : m), null);
    const base = hasNow || !latest ? now : latest;
    month = new Date(base.getFullYear(), base.getMonth(), 1);
  }
  const y = month.getFullYear(), m = month.getMonth();
  const shift = (delta) => useUiStore.setState({ calMonth: new Date(y, m + delta, 1) });

  const byDay = {};
  dated.forEach((e) => { if (e.d.getFullYear() === y && e.d.getMonth() === m) (byDay[e.d.getDate()] = byDay[e.d.getDate()] || []).push(e); });
  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;   // Senin=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const today = new Date();
  const isToday = (d) => today.getFullYear() === y && today.getMonth() === m && today.getDate() === d;
  const count = Object.values(byDay).reduce((s, l) => s + l.length, 0);

  return (
    <section className="card">
      <div className="card-head">
        <div><h2 className="card-title">Kalender kegiatan</h2><div className="card-sub">{count} kegiatan di bulan ini · klik tanggal untuk rinciannya</div></div>
        <div className="cal-nav">
          <button className="icon-btn" type="button" onClick={() => shift(-1)} aria-label="Bulan sebelumnya"><Icon name="left" size={18} /></button>
          <span className="cal-month">{MONTHS[m]} {y}</span>
          <button className="icon-btn" type="button" onClick={() => shift(1)} aria-label="Bulan berikutnya"><Icon name="right" size={18} /></button>
        </div>
      </div>
      <div className="cal-grid cal-head">{HARI.map((h) => <div className="cal-dow" key={h}>{h}</div>)}</div>
      <div className="cal-grid">
        {Array.from({ length: firstDay }, (_, i) => <div className="cal-cell blank" key={"e" + i} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const d = i + 1, ev = byDay[d];
          const cls = "cal-cell" + (ev ? " has-ev" : "") + (isToday(d) ? " today" : "");
          if (!ev) return <div className={cls} key={d}><span className="cal-num">{d}</span></div>;
          return (
            <button type="button" className={cls} key={d} onClick={() => setDetail({ list: ev, date: new Date(y, m, d) })}
              aria-label={`${d} ${MONTHS[m]}: ${ev.length} kegiatan`}>
              <span className="cal-num">{d}</span>
              {ev.slice(0, 2).map((e) => <span className={"cal-ev ev-" + e.status} key={e.id}>{e.name}</span>)}
              {ev.length > 2 && <span className="cal-more">+{ev.length - 2} lagi</span>}
              <span className="cal-dots">{ev.slice(0, 4).map((e) => <i key={e.id} className={"ev-" + e.status} />)}</span>
            </button>
          );
        })}
      </div>
      <div className="legend">
        {["upcoming", "ongoing", "done"].map((s) => <span key={s}><i className={"ev-" + s} />{statusLabel(s)}</span>)}
      </div>

      <Sheet open={!!detail} onClose={() => setDetail(null)} title={detail ? fmtDateLong(detail.date) : ""} sub={detail && `${detail.list.length} kegiatan`}>
        {detail && detail.list.map((e) => (
          <div className="cal-item" key={e.id}>
            <div className="cal-item-top"><b>{e.name}</b><StatusBadge status={e.status} /></div>
            <div className="row-meta"><span className="ptag">{e.programLabel}</span>{e.pic && <span>PIC {e.pic}</span>}{e.location && <span>{e.location}</span>}</div>
          </div>
        ))}
      </Sheet>
    </section>
  );
}
