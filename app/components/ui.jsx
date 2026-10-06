// Komponen kecil yang dipakai berulang.
import { useLayoutEffect, useRef, useState } from "react";
import { idLabel, statusClass } from "../lib/format.js";

export function Kpi({ value, label, id }) {
  return (
    <div className="kpi" id={id}>
      <div className="kpi-val">{value}</div>
      <div className="kpi-lab">{label}</div>
    </div>
  );
}

// <label>Teks<select/></label> — opts: string[] atau [value, text][]
export function SelectField({ label, value, options, onChange, style }) {
  return (
    <label style={style}>
      {label}
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {options.map((o) => {
          const [v, t] = Array.isArray(o) ? o : [o, o];
          return <option key={v} value={v}>{t}</option>;
        })}
      </select>
    </label>
  );
}

export function StatusBadge({ status }) {
  return <span className={"status-badge " + statusClass(status)}>{idLabel(status)}</span>;
}

export function SaveMsg({ msg }) {
  if (!msg) return <span className="save-msg" />;
  return <span className={"save-msg " + (msg.ok ? "ok" : msg.ok === false ? "err" : "")}>{msg.text}</span>;
}

// tampilkan `limit` item pertama + tombol "Lihat semua (n)"
export function SeeMore({ items, limit = 3, render }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {(open ? items : items.slice(0, limit)).map(render)}
      {items.length > limit && (
        <button type="button" className="see-more" onClick={() => setOpen(!open)}>
          {open ? "Tampilkan lebih sedikit" : `Lihat semua (${items.length})`}
        </button>
      )}
    </>
  );
}

export function EmptyRow({ cols, children, className = "empty" }) {
  return <tr><td colSpan={cols} className={className}>{children}</td></tr>;
}

// kartu "Tentang program" — dipotong 3 baris, tombol Selengkapnya bila lebih panjang
export function ProgramAbout({ program }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [long, setLong] = useState(false);
  useLayoutEffect(() => {
    setOpen(false);
    const el = ref.current;
    if (el) setLong(el.scrollHeight > el.clientHeight + 2);
  }, [program?.key]);
  if (!program?.desc) return null;
  return (
    <div className="card prog-about">
      <div className="prog-about-head">ℹ️ Tentang program</div>
      <p ref={ref} className={open ? "" : "clamp"}>{program.desc}</p>
      {long && (
        <button className="prog-more" type="button" onClick={() => setOpen(!open)}>
          {open ? "Ringkas" : "Selengkapnya"}
        </button>
      )}
    </div>
  );
}
