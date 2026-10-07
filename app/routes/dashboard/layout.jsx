import { useEffect, useMemo, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatches } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { FeedbackHost } from "../../components/feedback.jsx";
import { Icon } from "../../components/Icon.jsx";
import { SelectField, Sheet, Spinner } from "../../components/ui.jsx";
import { PROGRAMS, SUGT_URL } from "../../config.js";
import { ACCESS } from "../../components/Access.jsx";
import { AccessOverlay, AuthGate } from "../../components/AuthGate.jsx";
import { isAllAccess, levelLabel, programByApi, progColor, roleLabel, withoutAll } from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";
import { useApi } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";
import dashboardCss from "../../styles/dashboard.css?url";

export function links() {
  return [{ rel: "stylesheet", href: dashboardCss }];
}

export function meta() {
  return [{ title: "Dashboard Monitoring Program DITSAMA 2026" }];
}

const navClass = ({ isActive }) => "nav-item" + (isActive ? " active" : "");

// tautan menu; untuk jabatan tanpa akses tetap tampil tapi nonaktif
function NavItem({ session, area, to, end, children }) {
  const rule = area && ACCESS[area];
  if (rule && !rule.can(session)) {
    const why = `Hanya untuk ${rule.who}`;
    return (
      <span className="nav-item disabled" role="link" aria-disabled="true" title={why}>
        {children}<Icon name="lock" size={14} className="nav-lock" /><span className="sr-only">({why})</span>
      </span>
    );
  }
  return <NavLink className={navClass} to={to} end={end}>{children}</NavLink>;
}

export default function DashboardLayout() {
  const session = useAuthStore((s) => s.session);
  if (!session) return <><AuthGate /><FeedbackHost /></>;
  if (!session.token) return <><AccessOverlay /><FeedbackHost /></>;
  return <Shell session={session} />;
}

function Shell({ session }) {
  const ui = useUiStore(useShallow((s) => ({
    railOpen: s.railOpen, railHidden: s.railHidden, controlOpen: s.controlOpen, controlHidden: s.controlHidden, set: s.set,
  })));
  const [profileOpen, setProfileOpen] = useState(false);
  const location = useLocation();
  const matches = useMatches();
  const withControl = matches.some((m) => m.handle?.control);

  // tutup laci menu (ponsel) setiap pindah halaman
  useEffect(() => { ui.set({ railOpen: false, controlOpen: false }); }, [location.pathname]);

  // badge jumlah Berlangsung (merah) & Akan Datang (kuning) per program dari kalender dashboard utama
  const canActivities = ACCESS.activities.can(session);
  const { data } = useApi("/dashboard", {}, { enabled: canActivities });
  const badges = useMemo(() => {
    const out = {};
    (data?.data?.calendar || []).forEach((e) => {
      const b = (out[e.program] = out[e.program] || { on: 0, up: 0 });
      if (e.status === "ongoing") b.on++;
      if (e.status === "upcoming") b.up++;
    });
    return out;
  }, [data]);

  return (
    <div className={"app" + (ui.railHidden ? " rail-hidden" : "")}>
      <a className="skip" href="#main">Langsung ke konten</a>
      <aside className={"rail" + (ui.railOpen ? " open" : "")} aria-label="Menu utama">
        <div className="rail-top">
          <Link to="/" className="rail-brand">
            <img className="badge-itb" src={import.meta.env.BASE_URL + "assets/itb-logo.png"} alt="Logo ITB" width="36" height="36" />
            <span><b>Pra Universitas</b><small>Dashboard DITSAMA 2026</small></span>
          </Link>
          <button className="icon-btn on-dark rail-close" type="button" onClick={() => ui.set({ railOpen: false })} aria-label="Tutup menu"><Icon name="x" size={18} /></button>
        </div>
        <nav className="rail-nav">
          <NavItem session={session} area="activities" to="/dashboard" end><Icon name="grid" />Portofolio Program</NavItem>
          <NavItem session={session} area="finance" to="/dashboard/financial"><Icon name="wallet" />Keuangan</NavItem>
          <NavItem session={session} area="activities" to="/dashboard/peserta"><Icon name="users" />Peserta</NavItem>
          <NavItem session={session} area="activities" to="/dashboard/dosen"><Icon name="grad" />Portofolio Dosen</NavItem>
          <NavItem session={session} area="activities" to="/dashboard/input"><Icon name="clipboard" />Data Kegiatan</NavItem>
          <div className="nav-label">Dashboard program</div>
          {PROGRAMS.map((p) => {
            const b = badges[p.api];
            return (
              <NavItem key={p.key} session={session} area="activities" to={`/dashboard/program/${p.key}`}>
                <span className="nav-dot" style={{ background: progColor(p.api) }} aria-hidden="true" />
                <span className="nav-txt">{p.label}</span>
                {b?.on > 0 && <span className="nav-badge red" title={`${b.on} kegiatan berlangsung`}>{b.on}</span>}
                {b?.up > 0 && <span className="nav-badge yellow" title={`${b.up} kegiatan akan datang`}>{b.up}</span>}
              </NavItem>
            );
          })}
          <a className="nav-item" href={SUGT_URL} target="_blank" rel="noopener"><Icon name="external" />Program SUGT</a>
        </nav>
        <button className="rail-foot" type="button" onClick={() => setProfileOpen(true)}>
          <span className="ava">{(session.name || "?").slice(0, 1).toUpperCase()}</span>
          <span className="rail-who"><b>{session.name}</b><small>{roleLabel(session.role)}</small></span>
          <Icon name="right" size={16} />
        </button>
      </aside>
      <div className="scrim" hidden={!ui.railOpen && !ui.controlOpen} onClick={() => ui.set({ railOpen: false, controlOpen: false })} />

      {withControl && canActivities && <ControlPanel open={ui.controlOpen} hidden={ui.controlHidden} />}

      <main className="stage" id="main">
        <div className="topbar">
          <button className="icon-btn" type="button" onClick={() => ui.set({ railOpen: true })} aria-label="Buka menu"><Icon name="menu" size={20} /></button>
          <button className="icon-btn desk" type="button" onClick={() => ui.set({ railHidden: !ui.railHidden })}
            aria-label={ui.railHidden ? "Tampilkan menu" : "Sembunyikan menu"} title={ui.railHidden ? "Tampilkan menu" : "Sembunyikan menu"}>
            <Icon name="menu" size={20} />
          </button>
          {withControl && canActivities && (
            <button className="btn btn-sm topbar-filter" type="button"
              onClick={() => (window.matchMedia("(max-width: 1100px)").matches ? ui.set({ controlOpen: true }) : ui.set({ controlHidden: !ui.controlHidden }))}>
              <Icon name="filter" size={16} />Filter
            </button>
          )}
        </div>
        <Outlet />
      </main>

      <ProfileSheet open={profileOpen} onClose={() => setProfileOpen(false)} />
      <FeedbackHost />
    </div>
  );
}

function ProfileSheet({ open, onClose }) {
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const progs = isAllAccess(session) ? "Semua program" : session.role === "finance" ? "Hanya Keuangan"
    : (session.programs || []).map((p) => programByApi(p)?.label || p).join(", ") || "–";
  return (
    <Sheet open={open} onClose={onClose} title="Profil" footer={(
      <><span className="grow" /><button className="btn btn-danger-ghost" type="button" onClick={() => { onClose(); logout(); }}><Icon name="logout" size={16} />Keluar</button></>
    )}>
      <div className="profile">
        <span className="ava lg">{(session.name || "?").slice(0, 1).toUpperCase()}</span>
        <div><b>{session.name}</b><div className="muted">{session.email}</div></div>
      </div>
      <dl className="facts">
        <div><dt>Jabatan</dt><dd>{roleLabel(session.role)}</dd></div>
        <div><dt>Akses program</dt><dd>{progs}</dd></div>
        <div><dt>Hak ubah</dt><dd>{session.role === "finance" ? "Data keuangan" : session.role === "pic" ? "Data kegiatan program Anda (Keuangan tidak tersedia)" : "Semua data kegiatan & keuangan"}</dd></div>
      </dl>
    </Sheet>
  );
}

// ============== PANEL FILTER (Portofolio Program) ==============
const ALL = "Semua";
function ControlPanel({ open, hidden }) {
  const dash = useUiStore((s) => s.dash);
  const patch = useUiStore((s) => s.patch);
  const set = useUiStore((s) => s.set);
  const { data, loading, reload } = useApi("/dashboard", withoutAll(dash));
  const fo = data?.data?.filterOptions;
  const opts = (list) => [ALL, ...(list || [])];
  const keep = (list, v) => (v === ALL || (list || []).includes(v) ? v : ALL);
  const active = Object.values(dash).filter((v) => v !== ALL).length;
  const sel = (key, label, list, fmt) => (
    <SelectField label={label} value={keep(list, dash[key])} options={opts(list).map((o) => [o, fmt && o !== ALL ? fmt(o) : o])}
      onChange={(v) => patch("dash", { [key]: v, ...(key === "program" ? { activity: ALL } : {}) })} />
  );
  return (
    <aside className={"control" + (open ? " open" : "") + (hidden ? " hide" : "")} aria-label="Filter dashboard">
      <div className="control-head">
        <span><Icon name="filter" size={17} />Filter{active > 0 && <span className="count">{active}</span>}</span>
        <button className="icon-btn on-dark" type="button" onClick={() => set({ controlOpen: false, controlHidden: !open })} aria-label="Tutup filter"><Icon name="x" size={18} /></button>
      </div>
      <div className="control-body">
        {sel("program", "Program", fo?.programs)}
        {sel("year", "Tahun", fo?.years)}
        {sel("month", "Bulan", fo?.months)}
        {sel("phase", "Fase", fo?.phases)}
        {sel("activity", "Kegiatan", fo?.activities)}
        {sel("issueLevel", "Level isu", fo?.issueLevels, (v) => levelLabel(v.toLowerCase()))}
        <div className="control-actions">
          {active > 0 && <button className="btn btn-sm on-dark" type="button" onClick={() => patch("dash", { program: ALL, year: ALL, month: ALL, phase: ALL, activity: ALL, issueLevel: ALL })}>Reset</button>}
          <button className="btn btn-sm on-dark" type="button" disabled={loading} onClick={() => reload({ refresh: true })}>
            {loading ? <Spinner size={14} /> : <Icon name="refresh" size={15} />}Muat ulang
          </button>
        </div>
      </div>
    </aside>
  );
}
