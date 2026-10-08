// Komponen kecil yang dipakai berulang.
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { levelLabel, statusLabel } from "../lib/format.js";
import { Icon } from "./Icon.jsx";

export function Kpi({ value, label, hint, tone, icon }) {
  return (
    <div className={"kpi" + (tone ? " " + tone : "")}>
      <div className="kpi-lab">{icon && <Icon name={icon} size={15} />}{label}</div>
      <div className="kpi-val">{value}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}

// <label>Teks<select/></label> — opts: string[] atau [value, text][]
export function SelectField({ label, value, options, onChange, className }) {
  return (
    <label className={"field" + (className ? " " + className : "")}>
      <span className="field-lab">{label}</span>
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
  return <span className={"status st-" + status}><i />{statusLabel(status)}</span>;
}
export function LevelBadge({ level }) {
  return level ? <span className={"level lv-" + level}>{levelLabel(level)}</span> : null;
}

export function Spinner({ size = 16 }) {
  return <Icon name="spinner" size={size} className="spin" />;
}

export function EmptyState({ icon = "inbox", title, children, action }) {
  return (
    <div className="empty-state">
      <div className="empty-ic"><Icon name={icon} size={22} /></div>
      <div className="empty-title">{title}</div>
      {children && <div className="empty-body">{children}</div>}
      {action}
    </div>
  );
}

export function ErrorNote({ error, onRetry }) {
  if (!error) return null;
  return (
    <div className="note err" role="alert">
      <Icon name="alert" size={16} /><span>{error}</span>
      {onRetry && <button type="button" className="btn btn-sm" onClick={onRetry}>Coba lagi</button>}
    </div>
  );
}

export function Skeleton({ h = 14, w = "100%", r = 6, style }) {
  return <span className="skel" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}
export function SkeletonCard({ lines = 4, h = 160 }) {
  return (
    <div className="card">
      <Skeleton h={16} w="40%" />
      <div style={{ height: 12 }} />
      {lines ? Array.from({ length: lines }, (_, i) => <Skeleton key={i} h={12} w={90 - i * 12 + "%"} style={{ marginTop: 10 }} />)
        : <Skeleton h={h} />}
    </div>
  );
}

/** Kotak pencarian dengan jeda ketik (tidak memanggil server di setiap huruf). */
export function SearchInput({ value, onChange, placeholder, delay = 350 }) {
  const [v, setV] = useState(value);
  const first = useRef(true);
  useEffect(() => { setV(value); }, [value]);
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (v === value) return;
    const t = setTimeout(() => onChange(v), delay);
    return () => clearTimeout(t);
  }, [v]);
  return (
    <div className="search">
      <Icon name="search" size={16} />
      <input type="search" value={v} placeholder={placeholder} aria-label={placeholder} onChange={(e) => setV(e.target.value)} />
      {v && <button type="button" className="search-x" aria-label="Hapus pencarian" onClick={() => { setV(""); onChange(""); }}><Icon name="x" size={14} /></button>}
    </div>
  );
}

const PAGE_SIZES = [10, 25, 50, 100];
/** Navigasi halaman dari objek `pagination` backend. */
export function Pagination({ pagination, perPage, onPage, onPerPage, noun = "data" }) {
  if (!pagination || !pagination.totalRecords) return null;
  const { totalRecords, currentPage, totalPages } = pagination;
  const from = totalRecords ? (currentPage - 1) * perPage + 1 : 0;
  const to = Math.min(currentPage * perPage, totalRecords);
  // nomor halaman ringkas: 1 … 4 5 6 … 20
  const pages = [];
  for (let p = 1; p <= totalPages; p++) {
    if (p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1) pages.push(p);
    else if (pages[pages.length - 1] !== "…") pages.push("…");
  }
  return (
    <div className="pager">
      <div className="pager-info">
        <b>{from.toLocaleString("id-ID")}–{to.toLocaleString("id-ID")}</b> dari {totalRecords.toLocaleString("id-ID")} {noun}
      </div>
      <div className="pager-nav">
        <button type="button" className="pg" disabled={currentPage <= 1} onClick={() => onPage(currentPage - 1)} aria-label="Halaman sebelumnya"><Icon name="left" size={16} /></button>
        {pages.map((p, i) => p === "…"
          ? <span key={"g" + i} className="pg-gap">…</span>
          : <button key={p} type="button" className={"pg" + (p === currentPage ? " on" : "")} aria-current={p === currentPage ? "page" : undefined} onClick={() => onPage(p)}>{p}</button>)}
        <button type="button" className="pg" disabled={currentPage >= totalPages} onClick={() => onPage(currentPage + 1)} aria-label="Halaman berikutnya"><Icon name="right" size={16} /></button>
      </div>
      {onPerPage && (
        <label className="pager-size">
          <select value={perPage} onChange={(e) => onPerPage(Number(e.target.value))} aria-label="Baris per halaman">
            {PAGE_SIZES.map((n) => <option key={n} value={n}>{n} / halaman</option>)}
          </select>
        </label>
      )}
    </div>
  );
}

/** Panel samping (desktop) / layar penuh (ponsel) berbasis <dialog>. */
export function Sheet({ open, onClose, title, sub, children, footer, wide }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog ref={ref} className={"sheet" + (wide ? " wide" : "")} aria-label={typeof title === "string" ? title : undefined}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      {open && (
        <div className="sheet-box">
          <header className="sheet-head">
            <div className="sheet-title">{title}{sub && <div className="sheet-sub">{sub}</div>}</div>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Tutup"><Icon name="x" size={18} /></button>
          </header>
          <div className="sheet-body">{children}</div>
          {footer && <footer className="sheet-foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}

/** Tombol pilihan berdampingan. options: [value, label][] */
export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="seg" role="radiogroup" aria-label={label}>
      {options.map(([v, t]) => (
        <button key={v} type="button" role="radio" aria-checked={value === v} className={value === v ? "on" : ""} onClick={() => onChange(v)}>{t}</button>
      ))}
    </div>
  );
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
          <Icon name={open ? "up" : "down"} size={15} />
        </button>
      )}
    </>
  );
}

export function Bar({ value, tone }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return <span className={"meter" + (tone ? " " + tone : "")}><span style={{ width: v + "%" }} /></span>;
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
      <div className="prog-about-head"><Icon name="info" size={16} />Tentang program</div>
      <p ref={ref} className={open ? "" : "clamp"}>{program.desc}</p>
      {long && (
        <button className="link-btn" type="button" onClick={() => setOpen(!open)}>
          {open ? "Ringkas" : "Selengkapnya"}
        </button>
      )}
    </div>
  );
}

export function PageHead({ title, sub, children }) {
  return (
    <div className="page-head">
      <div>
        <h1 className="page-title">{title}</h1>
        {sub && <div className="page-sub">{sub}</div>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  );
}
