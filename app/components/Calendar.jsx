import { useState } from "react";
import { idLabel, labelOf, parseTgl } from "../lib/format.js";
import { useUiStore } from "../stores/ui.js";

const NAMA_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
const HARI = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
const evClass = (st) => st === "Selesai" ? "ev-done" : (st === "On-Going" ? "ev-ongoing" : "ev-upcoming");
const badgeClass = (st) => st === "Selesai" ? "st-selesai" : (st === "On-Going" ? "st-ongoing" : "st-upcoming");

/** Kalender kegiatan. rows = baris standar (flexToStd) yang sudah terfilter. */
export function Calendar({ rows }) {
  const calMonth = useUiStore((s) => s.calMonth);
  const [detail, setDetail] = useState(null);   // { list, date }

  const dated = rows.filter((r) => r.tanggal && parseTgl(r.tanggal));
  // default: buka di bulan data TERBARU, biar data baru langsung terlihat
  let month = calMonth;
  if (!month) {
    let latest = null;
    dated.forEach((r) => { const d = parseTgl(r.tanggal); if (!latest || d > latest) latest = d; });
    const base = latest || new Date();
    month = new Date(base.getFullYear(), base.getMonth(), 1);
  }
  const y = month.getFullYear(), m = month.getMonth();
  const shift = (delta) => useUiStore.setState({ calMonth: new Date(y, m + delta, 1) });

  const byDay = {};
  dated.forEach((r) => {
    const d = parseTgl(r.tanggal);
    if (d.getFullYear() === y && d.getMonth() === m) (byDay[d.getDate()] = byDay[d.getDate()] || []).push(r);
  });
  const firstDay = (new Date(y, m, 1).getDay() + 6) % 7;   // Senin=0
  const daysInMonth = new Date(y, m + 1, 0).getDate();

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div><h3>Kalender Kegiatan</h3><div className="sub">Klik tanggal berkegiatan untuk menyorot barisnya di tabel</div></div>
        <div className="cal-nav">
          <button className="btn-ghost" type="button" onClick={() => shift(-1)}>‹</button>
          <span style={{ fontWeight: 700, minWidth: 130, textAlign: "center", display: "inline-block" }}>{NAMA_BULAN[m] + " " + y}</span>
          <button className="btn-ghost" type="button" onClick={() => shift(1)}>›</button>
        </div>
      </div>
      <div>
        <div className="cal-grid cal-head">{HARI.map((h) => <div className="cal-dow" key={h}>{h}</div>)}</div>
        <div className="cal-grid">
          {Array.from({ length: firstDay }, (_, i) => <div className="cal-cell empty" key={"e" + i} />)}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const d = i + 1, ev = byDay[d];
            if (!ev) return <div className="cal-cell" key={d}><div className="cal-num">{d}</div></div>;
            return (
              <div className="cal-cell has-ev" key={d} onClick={() => setDetail({ list: ev, date: new Date(y, m, d) })}>
                <div className="cal-num">{d}</div>
                {ev.slice(0, 3).map((r, j) => <div className={"cal-ev " + evClass(r.status)} key={j}>{r.kegiatan || r.jenis || "Kegiatan"}</div>)}
                {ev.length > 3 && <div className="cal-more">+{ev.length - 3}</div>}
              </div>
            );
          })}
        </div>
        <div className="cal-legend">
          <span><i className="dot ev-upcoming" /> Akan Datang</span>
          <span><i className="dot ev-ongoing" /> Berlangsung</span>
          <span><i className="dot ev-done" /> Selesai</span>
        </div>
      </div>

      {detail && (
        <div className="cal-modal" onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="cal-modal-box">
            <button className="cal-modal-x" type="button" onClick={() => setDetail(null)}>✕</button>
            <div className="cal-modal-body">
              <h3 style={{ margin: "0 0 4px" }}>📅 {detail.date.toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
              <div className="sub" style={{ marginBottom: 10 }}>{detail.list.length} kegiatan</div>
              {detail.list.map((r, i) => (
                <div className="cal-detail-item" key={i}>
                  <div><b>{r.kegiatan || r.jenis || "Kegiatan"}</b> <span className={"badge " + badgeClass(r.status)}>{idLabel(r.status)}</span></div>
                  <div className="sub">👤 PIC: {r.pic || "-"} &nbsp;·&nbsp; 🏷️ {labelOf(r._prog) || "-"}</div>
                  {r.lokasi && <div className="sub">📍 {r.lokasi}</div>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
