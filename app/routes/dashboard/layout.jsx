import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useMatches } from "react-router";
import { useShallow } from "zustand/react/shallow";
import { AccessOverlay, AuthGate } from "../../components/AuthGate.jsx";
import { SelectField } from "../../components/ui.jsx";
import { PROGRAMS, SUGT_URL } from "../../config.js";
import { useDashFilters } from "../../lib/dashboard.js";
import { idLabel, isAllAccess, isFinanceOnly, labelOf, ongoingItems, upcomingMilestones } from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";
import { useDataStore } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";
import dashboardCss from "../../styles/dashboard.css?url";

export function links() {
  return [{ rel: "stylesheet", href: dashboardCss }];
}

export function meta() {
  return [{ title: "Dashboard Monitoring Program DITSAMA 2026" }];
}

// Mulai memuat DataMasuk + Financial tanpa menunggu: gerbang login tampil langsung,
// data menyusul di latar belakang (semua halaman membacanya dari store zustand).
export function clientLoader() {
  useDataStore.getState().ensureCore();
  return null;
}

const PROGRAM_NAV = [
  ["SIAP", "Program SIAP"], ["INSPIRASI_EDQ", "Program EduQuest"], ["INSPIRASI_SCD", "Program PSCD"],
  ["OSN", "Program OSN"], ["OPSI", "Program OPSI"], ["RISET", "Program Riset"], ["BTI", "Program BTI"],
  ["WIT", "Program WIT"], ["MAUNG", "Program MAUNG"],
];
const navClass = ({ isActive }) => "nav-item" + (isActive ? " active" : "");

export default function DashboardLayout() {
  const session = useAuthStore((s) => s.session);
  const unlocked = useAuthStore((s) => s.accessUnlocked);
  const flexRows = useDataStore((s) => s.flex.rows);
  const { railHidden, controlHidden, toggleRail, toggleControl } = useUiStore(useShallow((s) => ({
    railHidden: s.railHidden, controlHidden: s.controlHidden, toggleRail: s.toggleRail, toggleControl: s.toggleControl,
  })));
  const [profileOpen, setProfileOpen] = useState(false);

  // `handle` dari route anak: { control: true } -> tampilkan panel Control + judul
  const withControl = useMatches().some((m) => m.handle?.control);
  // program terpilih di filter Control -> judul memakai nama lengkapnya
  const dashProgram = useUiStore((s) => PROGRAMS.find((p) => p.label === s.dash.program));

  // badge notif jumlah On-Going (merah) & Upcoming (kuning) di tiap menu program
  const badges = useMemo(() => Object.fromEntries(PROGRAM_NAV.map(([key]) =>
    [key, { on: ongoingItems(flexRows, key).length, up: upcomingMilestones(flexRows, key).length }])), [flexRows]);

  const openSugt = (e) => {
    e.preventDefault();
    const url = String(SUGT_URL || "").trim();
    if (!url) { alert("Link dashboard SUGT belum diatur (SUGT_URL di config.js)."); return; }
    window.open(url, "_blank", "noopener");
  };

  return (
    <div className={"app" + (session && !unlocked ? " blurred" : "")} id="app">
      {/* ============== RAIL: MENU UTAMA (navy) ============== */}
      <aside className={"rail" + (railHidden ? " hide" : "")} id="rail">
        <div className="rail-top">
          <div className="rail-brand">
            <span className="badge">ITB</span>
            <div><b>Pra Universitas</b><small>Dashboard DITSAMA</small></div>
          </div>
          <button className="hamb" type="button" title="Sembunyikan menu" onClick={toggleRail}>&#9776;</button>
        </div>
        <nav className="rail-nav">
          <Link className="nav-home" to="/">&#127968; Beranda</Link>
          <NavLink className={navClass} to="/dashboard" end>Portofolio Program</NavLink>
          <NavLink className={navClass} to="/dashboard/financial">💰 Keuangan</NavLink>
          <NavLink className={navClass} to="/dashboard/peserta">🎓 Peserta</NavLink>
          <NavLink className={navClass} to="/dashboard/dosen">👨‍🏫 Portofolio Dosen</NavLink>
          {/* Finance hanya boleh mengisi menu Keuangan */}
          {!(session && isFinanceOnly(session.jabatan)) && (
            <NavLink className={navClass} to="/dashboard/input">📝 Input Data</NavLink>
          )}
          <div className="nav-label">Lihat Dashboard Program</div>
          {PROGRAM_NAV.map(([key, text]) => (
            <NavLink key={key} className={navClass} to={`/dashboard/program/${key}`}>
              {text}
              {badges[key].on > 0 && <span className="nav-badge red" title="Berlangsung">{badges[key].on}</span>}
              {badges[key].up > 0 && <span className="nav-badge yellow" title="Akan Datang">{badges[key].up}</span>}
            </NavLink>
          ))}
          <a className="nav-item nav-ext" href={SUGT_URL || "#"} target="_blank" rel="noopener" onClick={openSugt}>
            Program SUGT <span className="ext-ic">↗</span>
          </a>
        </nav>
        <button className="rail-foot" type="button" onClick={() => setProfileOpen(true)}>
          <span className="ava">&#128100;</span> <span>{session ? session.nama + " · " + session.jabatan : "Profil"}</span>
        </button>
      </aside>

      {!session && <AuthGate />}
      {session && !unlocked && <AccessOverlay />}
      {session && profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}

      {withControl && <ControlPanel hidden={controlHidden} onToggle={toggleControl} />}

      {/* ============== STAGE ============== */}
      <main className="stage">
        <div className="stage-top">
          <button className="mini" type="button" title="Menu utama" onClick={toggleRail}>&#9776;</button>
          {withControl && <button className="mini" type="button" title="Filter" onClick={toggleControl}>&#8942; Filter</button>}
          <h1 className="title" style={{ visibility: withControl ? "visible" : "hidden" }}>
            {dashProgram ? <>{dashProgram.fullName}<span className="title-abbr">{dashProgram.label}</span></> : "Dashboard Program DITSAMA 2026"}
          </h1>
        </div>
        <Outlet />
      </main>
    </div>
  );
}

function ProfileModal({ onClose }) {
  const session = useAuthStore((s) => s.session);
  const logout = useAuthStore((s) => s.logout);
  const progText = isAllAccess(session.jabatan)
    ? "Semua program"
    : ((session.programs || []).map(labelOf).join(", ") || "-");
  return (
    <div className="modal" id="profile-modal">
      <div className="modal-box">
        <h3>Profil</h3>
        <div className="sub">
          <b>{session.nama}</b><br />Jabatan: {session.jabatan}
          <br />Email: {session.email || "-"}
          <br />Akses program: {progText}
        </div>
        <div className="form-actions">
          <button className="btn-ghost" type="button" onClick={() => { onClose(); logout(); }}>Logout</button>
          <button className="btn-ghost" type="button" onClick={onClose}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

// ============== CONTROL: FILTER (biru terang) ==============
function ControlPanel({ hidden, onToggle }) {
  const { opts, values } = useDashFilters();
  const patch = useUiStore((s) => s.patch);
  const loadFlex = useDataStore((s) => s.loadFlex);
  const loadCapaian = useDataStore((s) => s.loadCapaian);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    useDataStore.setState((s) => ({ capaian: { ...s.capaian, raw: null } }));
    await Promise.all([loadFlex(), loadCapaian()]);
    setBusy(false);
  };
  const sel = (key, label) => (
    <SelectField label={label} value={values[key]} options={opts[key].map((o) => [o, idLabel(o)])} onChange={(v) => patch("dash", { [key]: v })} />
  );

  return (
    <aside className={"control" + (hidden ? " hide" : "")} id="control">
      <div className="control-head">Filter
        <button className="chev" type="button" title="Sembunyikan filter" onClick={onToggle}>&#8249;</button>
      </div>
      <div className="control-body">
        {sel("program", "Program")}
        {sel("tahun", "Tahun")}
        {sel("bulan", "Bulan")}
        {sel("fase", "Jenis Fase")}
        {sel("kegiatan", "Kegiatan")}
        {sel("level", "Level Isu")}
        <button className="btn-ghost" type="button" disabled={busy} onClick={refresh}>
          {busy ? "⏳ Memuat…" : <>&#128260; Muat Ulang Data</>}
        </button>
      </div>
    </aside>
  );
}
