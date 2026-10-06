import { useEffect, useMemo, useState } from "react";
import { Calendar } from "../../components/Calendar.jsx";
import { ChartCanvas } from "../../components/ChartCanvas.jsx";
import { Gantt } from "../../components/Gantt.jsx";
import { EmptyRow, Kpi, ProgramAbout, SeeMore } from "../../components/ui.jsx";
import { PROGRAMS } from "../../config.js";
import { capParse } from "../../lib/capaian.js";
import { filterRawByProgramMonth, filterStdRows, useDashFilters } from "../../lib/dashboard.js";
import {
  driveThumb, KEBER_SKOR, keyFromStored, labelFromStored, labelOf, normNamaOrang, num, parseTgl, programProgress,
  progressStatus, splitPeople,
} from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";
import { useDataStore } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";

// layout menampilkan panel "Control" + judul untuk route ini
export const handle = { control: true };

export default function Portfolio() {
  const { all, values, programKey } = useDashFilters();
  const flex = useDataStore((s) => s.flex);
  const rows = useMemo(() => filterStdRows(all, values), [all, values]);
  // baris mentah yang hanya ikut filter Program & Bulan (Analisis Peserta, SDM, Mitra, Timeline)
  const rawPB = useMemo(() => filterRawByProgramMonth(flex.rows, programKey, values.bulan), [flex.rows, programKey, values.bulan]);

  const totKeg = rows.filter((r) => (r.kegiatan || "").trim()).length;
  const totSelesai = rows.filter((r) => (r.kegiatan || "").trim() && r.status === "Selesai").length;

  // strip komponen performa (rata-rata, dalam %)
  const avgOf = (getter) => {
    const vals = rows.map(getter).filter((v) => v !== null && v !== undefined && !isNaN(v));
    return (vals.length ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : 0) + "%";
  };
  const kbScore = (r) => { const s = KEBER_SKOR[(r.keberjalanan || "").toLowerCase()]; return s === undefined ? null : s * 100; };

  return (
    <section id="view-dash">
      <ProgramAbout program={PROGRAMS.find((p) => p.key === programKey)} />
      <div className="perf-strip">
        <PerfItem ic="🎯" val={avgOf((r) => r.nilai > 0 ? r.nilai * 100 : null)} nm="Nilai Capaian Peserta" />
        <PerfItem ic="🙋" val={avgOf((r) => r.hadir > 0 ? r.hadir * 100 : null)} nm="Performa Kehadiran Peserta" />
        <PerfItem ic="📈" val={avgOf(kbScore)} nm="Performa Keberjalanan Aktivitas" />
        <PerfItem ic="💬" val={avgOf((r) => r.feedback > 0 ? r.feedback * 100 : null)} nm="Feedback Peserta" />
        <PerfItem ic="⚠️" val={avgOf((r) => r.issueAlert !== undefined ? r.issueAlert * 100 : null)} nm="Nilai Issue & Alert" />
      </div>
      <div className="kpi-row">
        <Kpi value={totKeg > 0 ? Math.round(totSelesai / totKeg * 100) + "%" : "0%"} label="Progress Keseluruhan" />
        <Kpi value={rows.filter((r) => r.status === "Upcoming").length} label="Total Upcoming" />
        <Kpi value={rows.filter((r) => r.status === "On-Going").length} label="Total On-Going" />
        <Kpi value={totSelesai} label="Total Aktivitas Selesai" />
      </div>

      <PortfolioList rows={rows} />

      <div className="card">
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <h3 style={{ margin: 0 }}>Analisis Peserta</h3>
          <span className="sub">(dari Data Masuk · ikut filter Program &amp; Bulan)</span>
        </div>
        <PesertaAnalysis header={flex.header} rows={rawPB} />
        <Capaian programKey={programKey} tahun={values.tahun} />
      </div>

      <div className="card">
        <h3>Analisis SDM &amp; Mitra</h3>
        <div className="sub">Jumlah SDM per peran &amp; mitra yang terlibat (ikut filter Program &amp; Bulan)</div>
        <div className="grid-2 gap" style={{ marginTop: ".6rem" }}>
          <div>
            <div className="sub" style={{ margin: "6px 0 4px" }}>SDM terlibat (jumlah per peran)</div>
            <SdmTable rows={rawPB} />
          </div>
          <Mitra rows={rawPB} />
        </div>
      </div>

      <div className="grid-2 gap">
        <div className="card"><h3>Top Issues &amp; Alerts</h3><Issues rows={rows} /></div>
        <div className="card"><h3>Upcoming Milestones</h3><Milestones rows={rows} /></div>
      </div>

      <div className="card">
        <h3>Timeline Fase Kegiatan</h3>
        <div className="sub">Rentang tiap fase berdasarkan tanggal kegiatan (ikut filter Program &amp; Bulan)</div>
        <Gantt perProgram items={rawPB
          .map((r) => ({ prog: keyFromStored(r["Program"]), d: parseTgl(r["Tanggal Kegiatan"]), fase: String(r["Fase Kegiatan"] || "").trim() }))
          .filter((x) => x.fase && x.d)} />
      </div>

      <Calendar rows={rows} />
    </section>
  );
}

function PerfItem({ ic, val, nm }) {
  return (
    <div className="perf-item"><div className="perf-ic">{ic}</div>
      <div><div className="perf-val">{val}</div><div className="perf-nm">{nm}</div></div>
    </div>
  );
}

function PortfolioList({ rows }) {
  const progs = [...new Set(rows.map((r) => r._prog))];
  return (
    <div className="card">
      <h3>Program Portfolio Performance</h3>
      <div className="sub">Nilai Performance = rata-rata Nilai Capaian, Kehadiran, Feedback &amp; Keberjalanan (dari Data Masuk)</div>
      <div>
        {!progs.length && <div className="empty">Belum ada data.</div>}
        {progs.map((k) => {
          const pr = rows.filter((r) => r._prog === k);
          const total = pr.filter((r) => (r.kegiatan || "").trim()).length;
          const selesai = pr.filter((r) => (r.kegiatan || "").trim() && r.status === "Selesai").length;
          const pics = [...new Set(pr.map((r) => (r.pic || "").trim()).filter(Boolean))];
          const prog = programProgress(pr);
          const [stat, cls] = progressStatus(prog);
          const p = Math.round(prog * 100);
          return (
            <div className="port" key={k}>
              <div className="nm">{labelOf(k)}<small>{pics.length ? "PIC: " + pics.join(", ") : "Kegiatan selesai / total"}</small></div>
              <div className="cnt">{selesai} / {total}</div>
              <div>
                <div className="bar"><span style={{ width: Math.min(p, 100) + "%" }} /></div>
                <div className="pct">{p}% <small style={{ fontWeight: 400, color: "#6B7688" }}>Nilai Performance</small></div>
              </div>
              <div className={"badge " + cls}>{stat}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ===== Analisis Peserta dari DataMasuk (ikut filter Program & Bulan) =====
function PesertaAnalysis({ header, rows }) {
  const a = useMemo(() => {
    // kolom peserta: "Peserta X (terdaftar)" / "(hadir)"
    const catSet = {};
    (header || []).forEach((h) => {
      const m = /^Peserta (.+) \((terdaftar|hadir)\)$/.exec(h); if (m) catSet[m[1]] = 1;
    });
    const cats = Object.keys(catSet);
    let totDaftar = 0, totHadir = 0, jmlKeg = 0;
    const perKat = Object.fromEntries(cats.map((c) => [c, { ter: 0, had: 0 }]));
    const kegLabels = [], kegTer = [], kegHad = [];
    rows.forEach((r) => {
      let rowTer = 0, rowHad = 0, ada = false;
      cats.forEach((c) => {
        const ter = num(r["Peserta " + c + " (terdaftar)"]), had = num(r["Peserta " + c + " (hadir)"]);
        if (ter || had) ada = true;
        perKat[c].ter += ter; perKat[c].had += had;
        rowTer += ter; rowHad += had;
      });
      if (!ada) return;
      jmlKeg++; totDaftar += rowTer; totHadir += rowHad;
      if (rowTer > 0) {   // grafik: aktivitas tanpa pendaftar tidak ditampilkan
        kegLabels.push((r["Nama Kegiatan"] || "-").slice(0, 18));
        kegTer.push(rowTer); kegHad.push(rowHad);
      }
    });
    return { totDaftar, totHadir, jmlKeg, perKat, catsIsi: cats.filter((c) => perKat[c].ter > 0), kegLabels, kegTer, kegHad };
  }, [header, rows]);

  const chart = useMemo(() => ({
    type: "bar",
    data: {
      labels: a.kegLabels.length ? a.kegLabels : ["(belum ada data)"],
      datasets: [
        { label: "Terdaftar", data: a.kegTer, backgroundColor: "#9EC1E6" },
        { label: "Hadir", data: a.kegHad, backgroundColor: "#2F6FB0" },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        zoom: {
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, drag: { enabled: false }, mode: "x" },
          pan: { enabled: true, mode: "x" },
          limits: { x: { min: "original", max: "original" } },
        },
      },
      // batas Y tetap, tidak mengecil saat zoom X
      scales: { y: { beginAtZero: true, min: 0, suggestedMax: Math.max(1, ...a.kegTer, ...a.kegHad) } },
    },
  }), [a]);

  return (
    <>
      <div className="kpi-row" style={{ marginTop: ".6rem" }}>
        <Kpi value={a.jmlKeg} label="Jumlah Aktivitas" />
        <Kpi value={a.totDaftar.toLocaleString("id-ID")} label="Total Pendaftaran" />
        <Kpi value={a.totHadir.toLocaleString("id-ID")} label="Total Kehadiran" />
        <Kpi value={a.totDaftar > 0 ? Math.round(a.totHadir / a.totDaftar * 100) + "%" : "0%"} label="% Kehadiran (tertimbang)" />
      </div>
      <div className="grid-2 gap" style={{ marginTop: ".8rem" }}>
        <div>
          <div className="sub" style={{ marginBottom: 4 }}>Kehadiran per kegiatan (terdaftar vs hadir)</div>
          <ChartCanvas config={chart} zoom />
          <div className="sub" style={{ marginTop: 4 }}>💡 Scroll/cubit untuk zoom, seret untuk geser.</div>
        </div>
        <div>
          <div className="sub" style={{ marginBottom: 4 }}>Komposisi &amp; kehadiran per jenis peserta</div>
          <div className="table-wrap"><table>
            <thead><tr><th>Jenis</th><th>Terdaftar</th><th>Hadir</th><th>% Hadir</th></tr></thead>
            <tbody>
              {!a.catsIsi.length && <EmptyRow cols={4}>Belum ada data peserta.</EmptyRow>}
              {a.catsIsi.map((c) => {
                const { ter, had } = a.perKat[c];
                return <tr key={c}><td>{c}</td><td>{ter}</td><td>{had}</td><td>{ter > 0 ? Math.round(had / ter * 100) + "%" : "0%"}</td></tr>;
              })}
            </tbody>
          </table></div>
        </div>
      </div>
    </>
  );
}

// ---- SDM terlibat per peran: HITUNG NAMA UNIK ----
// Utama: kolom "SDM {peran} (daftar nama)" (dipisah koma/baris).
// Cadangan (data lama): "SDM {peran} - Nama N" dan "SDM {peran} (nama)".
function SdmTable({ rows }) {
  const [open, setOpen] = useState({});
  const perPeran = useMemo(() => {
    const out = {};   // peran -> { normNama: namaTampilan }
    const add = (peranRaw, val) => {
      const pr = String(peranRaw || "").trim();
      const peran = pr ? pr.charAt(0).toUpperCase() + pr.slice(1).toLowerCase() : "Lainnya";
      splitPeople(val).forEach((s) => {
        const nm = normNamaOrang(s);
        if (!nm) return;
        const mp = (out[peran] = out[peran] || {});
        if (!mp[nm]) mp[nm] = String(s).trim().replace(/^\d+\s*[.)-]\s*/, "").replace(/\s+/g, " ");   // nama tampilan (pertama ditemukan)
      });
    };
    rows.forEach((r) => Object.keys(r).forEach((k) => {
      const m = /^SDM (.+) \(daftar nama\)$/.exec(k) || /^SDM (.+) - Nama \d+$/.exec(k) || /^SDM (.+) \(nama\)$/.exec(k);
      if (m) add(m[1], r[k]);
    }));
    return Object.entries(out).map(([peran, names]) => ({
      peran, names: Object.values(names).sort((a, b) => a.localeCompare(b, "id")),
    })).filter((x) => x.names.length > 0);
  }, [rows]);

  // unik per (peran + nama): orang & peran sama di aktivitas lain = 1; beda peran = dihitung terpisah
  const total = perPeran.reduce((s, x) => s + x.names.length, 0);
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>Peran SDM</th><th>Jumlah (orang berbeda)</th><th></th></tr></thead>
      <tbody>
        {!perPeran.length && <EmptyRow cols={3}>Belum ada data SDM.</EmptyRow>}
        {perPeran.flatMap(({ peran, names }) => [
          <tr key={peran}>
            <td>{peran}</td><td>{names.length}</td>
            <td style={{ textAlign: "right" }}>
              <button type="button" className="mini-btn sdm-detail" onClick={() => setOpen({ ...open, [peran]: !open[peran] })}>
                {open[peran] ? "Tutup" : "Detail"}
              </button>
            </td>
          </tr>,
          open[peran] && (
            <tr className="sdm-names-row" key={peran + "-names"}>
              <td colSpan={3}><ol className="sdm-name-list">{names.map((n) => <li key={n}>{n}</li>)}</ol></td>
            </tr>
          ),
        ])}
        {perPeran.length > 0 && <tr><td><b>Total SDM</b></td><td><b>{total}</b></td><td /></tr>}
      </tbody>
    </table></div>
  );
}

// kumpulkan mitra (nama+logo) dari DataMasuk
function collectMitra(rows) {
  const mitra = [];
  const addMitra = (nama, prog, logo) => {
    const nm = String(nama || "").trim();
    if (nm && !mitra.some((x) => x.nama.toLowerCase() === nm.toLowerCase())) mitra.push({ nama: nm, logo: logo || "", prog });
  };
  rows.forEach((r) => {
    const prog = labelFromStored(r["Program"]);
    const logoRole = driveThumb(r["SK Mitra"] || "");   // SK per peran (baru)
    Object.keys(r).forEach((k) => {
      if (k === "SDM Mitra (daftar nama)") {
        splitPeople(r[k]).forEach((nm) => addMitra(nm, prog, logoRole));
      } else if (/^SDM Mitra - Nama \d+$/.test(k) && String(r[k] || "").trim()) {
        const nama = String(r[k]).trim();
        addMitra(nama, prog, driveThumb(r["SK Mitra (" + nama + ")"] || "") || logoRole);
      }
    });
  });
  return mitra;
}

function MitraSlide({ mt }) {
  const [imgFailed, setImgFailed] = useState(false);
  const initials = mt.nama.split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const showImg = mt.logo && !imgFailed;
  return (
    <div className="mitra-slide">
      {showImg && <img src={mt.logo} alt="" onError={() => setImgFailed(true)} />}
      {!showImg && <div className="mitra-ph">{initials}</div>}
      <div className="mitra-nm">{mt.nama}<small>{mt.prog}</small></div>
    </div>
  );
}

function Mitra({ rows }) {
  const mitra = useMemo(() => collectMitra(rows), [rows]);
  const [idx, setIdx] = useState(0);
  const [page, setPage] = useState(0);
  const [listOpen, setListOpen] = useState(false);
  const n = mitra.length;

  useEffect(() => { setIdx(0); setPage(0); }, [mitra]);
  useEffect(() => {
    if (n <= 1) return;
    const t = setInterval(() => setIdx((i) => (i + 1) % n), 3000);
    return () => clearInterval(t);
  }, [n, mitra]);

  const per = 5, pages = Math.ceil(n / per);
  const pg = Math.min(page, Math.max(pages - 1, 0));
  const cur = mitra[Math.min(idx, n - 1)];

  return (
    <div>
      <div className="sub" style={{ margin: "6px 0 4px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>Mitra (klik untuk lihat daftar)</span>
        <button className="mini-btn" type="button" onClick={() => setListOpen(!listOpen)}>📋 Daftar Mitra</button>
      </div>
      <div className="mitra-slideshow">
        {!n ? <div className="empty">Belum ada data mitra.</div> : (
          <>
            <div className="mitra-show">
              <button className="mitra-arrow" type="button" onClick={() => setIdx((i) => (i - 1 + n) % n)}>‹</button>
              <div className="mitra-stage"><MitraSlide key={cur.nama} mt={cur} /></div>
              <button className="mitra-arrow" type="button" onClick={() => setIdx((i) => (i + 1) % n)}>›</button>
            </div>
            <div className="mitra-count" style={{ textAlign: "center", fontSize: ".7rem", color: "#6B7688", marginTop: 4 }}>
              {Math.min(idx, n - 1) + 1} / {n}
            </div>
          </>
        )}
      </div>
      {listOpen && (
        <div className="table-wrap">
          <table>
            <thead><tr><th>No</th><th>Nama Mitra</th><th>Program</th><th>Logo</th></tr></thead>
            <tbody>
              {!n && <EmptyRow cols={4}>Belum ada mitra.</EmptyRow>}
              {mitra.slice(pg * per, pg * per + per).map((mt, i) => (
                <tr key={mt.nama}><td>{pg * per + i + 1}</td><td>{mt.nama}</td><td>{mt.prog}</td><td>{mt.logo ? "✓" : "-"}</td></tr>
              ))}
            </tbody>
          </table>
          {pages > 1 && (
            <div className="tbl-nav">
              <button className="mini-btn" type="button" onClick={() => setPage(Math.max(pg - 1, 0))}>‹</button>
              <span style={{ margin: "0 10px", fontWeight: 600 }}>{pg + 1} / {pages}</span>
              <button className="mini-btn" type="button" onClick={() => setPage(Math.min(pg + 1, pages - 1))}>›</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function IssueItem({ r }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <div className={"issue " + r.level.toLowerCase()}>
        <div className="t">{r.ketisu || r.kegiatan || "-"}<small>{labelOf(r._prog)}</small></div>
        <button className="mini-btn issue-detail" type="button" onClick={() => setOpen(!open)}>Detail</button>
        <div className="lv">{r.level}</div>
      </div>
      {open && (
        <div className="issue-info">
          <div><b>PIC:</b> {r.pic || "-"}</div>
          <div><b>Keterangan Issue:</b> {r.ketisu || "-"}</div>
          <div><b>Issue dengan pihak (penyelenggara):</b> {r.issuePihak || "-"}</div>
          <div><b>Problem Solving:</b> {r.issueSolve || "-"}</div>
        </div>
      )}
    </div>
  );
}

function Issues({ rows }) {
  const order = { High: 0, Medium: 1, Low: 2 };
  const items = rows.filter((r) => r.level in order).sort((a, b) => order[a.level] - order[b.level]);
  if (!items.length) return <div className="empty">Tidak ada issue. 🎉</div>;
  return <div><SeeMore items={items} render={(r, i) => <IssueItem key={r.id || i} r={r} />} /></div>;
}

function Milestones({ rows }) {
  const items = rows.filter((r) => (r.jenis || "").trim() && r.tanggal)
    .sort((a, b) => parseTgl(a.tanggal) - parseTgl(b.tanggal));
  if (!items.length) return <div className="empty">Belum ada milestone.</div>;
  return (
    <div>
      <SeeMore items={items} render={(r, i) => {
        const d = parseTgl(r.tanggal);
        return (
          <div className="ms" key={r.id || i}>
            <div className="d">{d ? d.getDate() : "--"}<br /><small>{d ? d.toLocaleDateString("id-ID", { month: "short" }) : ""}</small></div>
            <div className="ti">{r.jenis}<small>{labelOf(r._prog)}</small></div>
          </div>
        );
      }} />
    </div>
  );
}

// ===== Capaian Peserta (ikut filter Program & Tahun) =====
function Capaian({ programKey, tahun }) {
  const cap = useDataStore((s) => s.capaian);
  const session = useAuthStore((s) => s.session);
  const loadCapaian = useDataStore((s) => s.loadCapaian);
  const q = useUiStore((s) => s.capSearch);

  useEffect(() => {
    if (cap.raw === null && !cap.loading && session?.token) loadCapaian();
  }, [cap.raw, cap.loading, session, loadCapaian]);

  const rows = useMemo(() => {
    const ql = q.trim().toLowerCase();
    const list = capParse(cap.raw).filter((x) =>
      (programKey === "Semua" || x.prog === programKey) && (tahun === "Semua" || !x.tahun || x.tahun === tahun) &&
      (!ql || x.names.join(" ").toLowerCase().includes(ql) || x.kat.toLowerCase().includes(ql)));
    // peringkat terbaik per (program, kategori) -> kategori juara utama tampil lebih dulu
    const best = {};
    list.forEach((x) => { const k = x.prog + "|" + x.kat; best[k] = Math.min(best[k] || 99, x.rank.ord); });
    return list.sort((a, b) => a.progLabel.localeCompare(b.progLabel) || best[a.prog + "|" + a.kat] - best[b.prog + "|" + b.kat] ||
      a.kat.localeCompare(b.kat) || a.rank.ord - b.rank.ord);
  }, [cap.raw, programKey, tahun, q]);

  let sub = "(dari sheet Capaian_Peserta · ikut filter Program & Tahun di Control)", subErr = false;
  if (cap.err) { sub = "⚠️ " + cap.err; subErr = true; }
  else if (cap.raw === null) sub = "⏳ Memuat capaian dari Google Sheets…";
  else if (!cap.raw.length) sub = <>Belum ada data. Buat tab <b>Capaian_Peserta</b> di spreadsheet utama.</>;
  else sub += ` · ${rows.length} capaian · ${rows.reduce((a, x) => a + x.names.length, 0)} peserta`;

  const cnt = (cls) => rows.filter((x) => x.rank.cls === cls).length;
  const chips = [["Medali Emas", "emas"], ["Medali Perak", "perak"], ["Medali Perunggu", "perunggu"],
    ["Honorable Mention", "hm"], ["Juara 1–3", "juara"], ["Penghargaan lain", "lain"]]
    .map(([l, cls]) => [l, cnt(cls), cls]).filter((c) => c[1] > 0);

  return (
    <div id="cap-card" style={{ marginTop: "1.1rem", borderTop: "1px solid var(--line)", paddingTop: ".9rem" }}>
      <div className="pst-head">
        <div>
          <div style={{ fontWeight: 800, color: "var(--navy)" }}>🏆 Capaian Peserta</div>
          <div className="sub" style={subErr ? { color: "var(--red)" } : undefined}>{sub}</div>
        </div>
        <input type="search" placeholder="Cari nama / kategori…" style={{ minWidth: 200 }} value={q}
          onChange={(e) => useUiStore.setState({ capSearch: e.target.value })} />
      </div>
      <div className="cap-chips">
        {chips.map(([l, n, cls]) => <div className="cap-chip" key={cls}><span className={"medal " + cls}>{l}</span><b>{n}</b></div>)}
      </div>
      <div className="table-wrap"><table id="cap-table">
        <thead><tr><th>No</th><th>Program</th><th>Kategori</th><th>Peringkat</th><th>Nama</th><th>Jenis</th></tr></thead>
        <tbody>
          {!rows.length && (
            <EmptyRow cols={6} className="nil-muted">
              {cap.raw === null ? "⏳ Sedang memuat…" : (cap.raw.length ? "Tidak ada capaian untuk filter ini." : "Belum ada data capaian.")}
            </EmptyRow>
          )}
          {rows.map((x, i) => (
            <tr key={i}>
              <td>{i + 1}</td><td>{x.progLabel}</td><td><b>{x.kat || "–"}</b></td>
              <td><span className={"medal " + x.rank.cls}>{x.rank.label}</span></td>
              <td>{x.names.length > 1 ? <ol className="cap-names">{x.names.map((nm, j) => <li key={j}>{nm}</li>)}</ol> : x.names[0]}</td>
              <td>{x.jenis}{x.names.length > 1 && <> <span className="nil-muted">({x.names.length} orang)</span></>}</td>
            </tr>
          ))}
        </tbody>
      </table></div>
    </div>
  );
}
