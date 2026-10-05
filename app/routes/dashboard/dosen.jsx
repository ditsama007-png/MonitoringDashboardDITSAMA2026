import { useEffect, useMemo, useRef, useState } from "react";
import { ChartCanvas } from "../../components/ChartCanvas.jsx";
import { Kpi, SelectField } from "../../components/ui.jsx";
import {
  DSN_FILTERS, dsnAggregate, dsnAvg, dsnInitials, dsnNice, dsnParse, dsnPredikat,
} from "../../lib/dosen.js";
import { keepOption, uniqSorted } from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";
import { useDataStore } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";

const ALL = "Semua";
const METODE_COL = { Luring: "#204074", Hibrida: "#9EC1E6", Daring: "#E08A2E", "–": "#B7C3D6" };

export default function Dosen() {
  const { raw, err } = useDataStore((s) => s.dosen);
  const loadDosen = useDataStore((s) => s.loadDosen);
  const session = useAuthStore((s) => s.session);
  const ui = useUiStore((s) => s.dsn);
  const patch = useUiStore((s) => s.patch);
  const [loading, setLoading] = useState(false);
  const detailRef = useRef(null);

  const reload = async () => { setLoading(true); await loadDosen(); setLoading(false); };
  useEffect(() => { if (raw === null && session) reload(); }, [raw, session]);

  const { evals, comments, nResp } = useMemo(() => dsnParse(raw), [raw]);

  // filter bertingkat
  const { opts, values, rows } = useMemo(() => {
    const opts = {}, values = {};
    DSN_FILTERS.forEach(([key, field]) => {
      const others = evals.filter((e) => DSN_FILTERS.every(([k2, f2]) => k2 === key || ui[k2] === ALL || e[f2] === ui[k2]));
      opts[key] = [ALL, ...uniqSorted(others.map((e) => e[field]))];
      values[key] = keepOption(opts[key], ui[key]);
    });
    return { opts, values, rows: evals.filter((e) => DSN_FILTERS.every(([k, f]) => values[k] === ALL || e[f] === values[k])) };
  }, [evals, ui]);

  const minResp = parseInt(ui.minResp, 10) || 1;
  const dosen = useMemo(() => dsnAggregate(rows, minResp), [rows, minResp]);

  // klik dosen: buka portofolio (baris tabel: klik lagi untuk menutup).
  // Baca state terbaru lewat getState() karena dipanggil juga dari onClick Chart.js.
  const select = (key, toggle = true) => {
    const cur = useUiStore.getState().dsn.sel;
    const next = toggle && cur === key ? "" : key;
    patch("dsn", { sel: next });
    if (next) requestAnimationFrame(() => detailRef.current?.scrollIntoView({ behavior: "smooth" }));
  };

  let msg, msgErr = false;
  if (loading && !raw) msg = "⏳ Memuat data dosen…";
  else if (err) { msg = "⚠️ " + err; msgErr = true; }
  else if (!raw || !raw.length) msg = <>Belum ada data. Buat tab berawalan <b>Dosen</b> (mis. <b>Dosen_SIAP</b>) di spreadsheet utama berisi hasil Google Form evaluasi dosen.</>;
  else msg = `${raw.length} tab (${raw.map((t) => t.tab).join(", ")}) · ${nResp} peserta mengisi · ${evals.length} penilaian dosen terbaca`;

  const allVals = dosen.flatMap((d) => d.vals);

  return (
    <section id="view-dosen">
      <h1 className="title" style={{ visibility: "visible" }}>Portofolio Dosen</h1>

      <div className="card">
        <div className="pst-filters">
          {DSN_FILTERS.map(([key, , label]) => (
            <SelectField key={key} label={label} value={values[key]} options={opts[key]} onChange={(v) => patch("dsn", { [key]: v })} />
          ))}
          <SelectField label="Minimal Responden" value={ui.minResp} options={["1", "5", "10", "30"]} onChange={(v) => patch("dsn", { minResp: v })} />
          <button className="btn-ghost" type="button" onClick={reload}>{loading ? "⏳ Memuat..." : "🔄 Refresh"}</button>
        </div>
        <div className="sub" style={{ margin: ".4rem 0 0", color: msgErr ? "var(--red)" : undefined }}>{msg}</div>
      </div>

      <div className="kpi-row">
        <Kpi value={dosen.length} label="Dosen Dinilai" />
        <Kpi value={uniqSorted(dosen.flatMap((d) => Object.keys(d.mapel))).length} label="Mata Kuliah" />
        <Kpi value={uniqSorted(rows.map((e) => e.peserta)).length.toLocaleString("id-ID")} label="Peserta Mengisi" />
        <Kpi value={allVals.length.toLocaleString("id-ID")} label="Total Penilaian" />
        <Kpi value={allVals.length ? dsnAvg(allVals).toFixed(2) : "–"} label="Rata-rata Nilai (1–5)" />
        <Kpi value={dosen.length ? dosen[0].avg.toFixed(2) : "–"} label={dosen.length ? "Tertinggi · " + dsnNice(dosen[0].nama) : "Nilai Tertinggi"} />
      </div>

      <DosenCharts dosen={dosen} rows={rows} onSelect={select} />

      <div className="card">
        <h3>Mata Kuliah yang Diajarkan</h3>
        <div className="sub">Klik kartu untuk memfilter</div>
        <MapelCards dosen={dosen} current={values.mapel} onPick={(m) => patch("dsn", { mapel: values.mapel === m ? ALL : m })} />
      </div>

      <DosenTable dosen={dosen} minResp={minResp} selected={ui.sel} onSelect={select} />

      <div ref={detailRef}>
        <DosenDetail dosen={dosen} evals={evals} comments={comments} selected={ui.sel} onClose={() => patch("dsn", { sel: "" })} />
      </div>
    </section>
  );
}

function DosenCharts({ dosen, rows, onSelect }) {
  const top = dosen.slice(0, 15);
  const rank = useMemo(() => ({
    type: "bar",
    data: {
      labels: top.length ? top.map((d) => dsnNice(d.nama)) : ["(belum ada data)"],
      datasets: [{ label: "Rata-rata", data: top.map((d) => Math.round(d.avg * 100) / 100),
        backgroundColor: top.map((d, i) => (i < 3 ? "#204074" : "#3a6db0")), borderRadius: 5, maxBarThickness: 22 }],
    },
    options: {
      indexAxis: "y", responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c) => `Rata-rata ${c.parsed.x} · ${top[c.dataIndex].n} penilaian · ${Object.keys(top[c.dataIndex].mapel).join(", ")}` } } },
      scales: { x: { min: 1, max: 5, ticks: { stepSize: 1 } } },
      onClick: (_e, el) => { if (el.length) onSelect(top[el[0].index].key, false); },
    },
  }), [dosen]);

  // rata-rata per mapel x metode
  const metode = useMemo(() => {
    const mapels = uniqSorted(rows.map((e) => e.mapel)), metodes = uniqSorted(rows.map((e) => e.metode));
    return {
      type: "bar",
      data: {
        labels: mapels.length ? mapels : ["(belum ada data)"],
        datasets: metodes.map((m) => ({
          label: m, backgroundColor: METODE_COL[m] || "#3a6db0", borderRadius: 5, maxBarThickness: 40,
          data: mapels.map((mp) => { const v = rows.filter((e) => e.mapel === mp && e.metode === m).map((e) => e.nilai); return v.length ? Math.round(dsnAvg(v) * 100) / 100 : null; }),
        })),
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } },
        scales: { y: { min: 1, max: 5, ticks: { stepSize: 1 }, title: { display: true, text: "Rata-rata nilai" } } } },
    };
  }, [rows]);

  return (
    <div className="grid-2 gap">
      <div className="card"><h3>Peringkat Nilai Dosen</h3><div className="sub">Rata-rata nilai (1–5), dari tertinggi</div>
        <ChartCanvas config={rank} height={Math.max(220, top.length * 26 + 50)} /></div>
      <div className="card"><h3>Rata-rata per Metode &amp; Mata Kuliah</h3><div className="sub">Perbandingan Luring / Hibrida / Daring per mata kuliah</div>
        <ChartCanvas config={metode} height={320} /></div>
    </div>
  );
}

function MapelCards({ dosen, current, onPick }) {
  const by = {};
  dosen.forEach((d) => Object.keys(d.mapel).forEach((m) => { (by[m] = by[m] || []).push(d); }));
  const mapels = Object.keys(by).sort();
  return (
    <div className="dsn-cards">
      {!mapels.length && <div className="nil-muted">Belum ada data.</div>}
      {mapels.map((m) => {
        const list = by[m].slice().sort((a, b) => b.avg - a.avg);
        const vals = list.flatMap((d) => d.vals);
        return (
          <button key={m} type="button" className={"dsn-card" + (current === m ? " active" : "")} onClick={() => onPick(m)}>
            <h4>{m} <span className="chip">{list.length} dosen</span></h4>
            <div className="stat">
              <div><b>{list[0].avg.toFixed(2)}</b><span>Tertinggi</span></div>
              <div><b>{dsnAvg(vals).toFixed(2)}</b><span>Rata-rata</span></div>
              <div><b>{vals.length}</b><span>Penilaian</span></div>
            </div>
            <ol>{list.slice(0, 5).map((d) => <li key={d.key}>{dsnNice(d.nama)} · <b>{d.avg.toFixed(2)}</b></li>)}</ol>
            {list.length > 5 && <div className="nil-muted" style={{ fontSize: ".75rem" }}>+{list.length - 5} dosen lain</div>}
          </button>
        );
      })}
    </div>
  );
}

function DosenTable({ dosen, minResp, selected, onSelect }) {
  const search = useUiStore((s) => s.dsn.search);
  const patch = useUiStore((s) => s.patch);
  const q = search.trim().toLowerCase();
  const list = q ? dosen.filter((d) => d.nama.toLowerCase().includes(q)) : dosen;
  return (
    <div className="card">
      <div className="pst-head">
        <div><h3>Tabel Ranking Dosen</h3>
          <div className="sub">{`${dosen.length} dosen` + (minResp > 1 ? ` (minimal ${minResp} penilaian)` : "") + " · klik baris untuk melihat portofolio"}</div></div>
        <input type="search" placeholder="Cari dosen…" style={{ minWidth: 220 }} value={search} onChange={(e) => patch("dsn", { search: e.target.value })} />
      </div>
      <div className="table-wrap"><table>
        <thead><tr><th>Ranking</th><th>Nama Dosen</th><th>Mata Kuliah</th><th>Metode</th><th>Program</th>
          <th>Penilaian</th><th>Sebaran 1–5</th><th>Rata-rata</th><th>Predikat</th></tr></thead>
        <tbody>
          {!list.length && <tr><td colSpan={9} className="nil-muted">Belum ada data penilaian dosen.</td></tr>}
          {list.map((d) => {
            const [pt, pc] = dsnPredikat(d.avg);
            const mx = Math.max(...d.dist, 1), top3 = d.rank <= 3;
            return (
              <tr key={d.key} className={"dsn-row" + (selected === d.key ? " sel" : "") + (top3 ? " rank-top" : "")} onClick={() => onSelect(d.key)}>
                <td><span className={"rank-no" + (top3 ? " top" : "")}>{d.rank}</span></td><td><b>{d.nama}</b></td>
                <td>{Object.keys(d.mapel).join(", ")}</td><td>{Object.keys(d.metode).join(", ")}</td>
                <td>{Object.keys(d.prog).join(", ")}</td><td>{d.n}</td>
                <td title={d.dist.map((c, i) => `${i + 1}:${c}`).join(" · ")}>
                  <span className="dist">{d.dist.map((c, i) => <i key={i} style={{ height: Math.round(c / mx * 20) + 2 }} />)}</span>
                </td>
                <td className="pst-val">{d.avg.toFixed(2)}</td><td><span className={"pred " + pc}>{pt}</span></td>
              </tr>
            );
          })}
        </tbody>
      </table></div>
    </div>
  );
}

function DosenDetail({ dosen, evals, comments, selected, onClose }) {
  const d = dosen.find((x) => x.key === selected);
  if (!d) return null;
  const [pt] = dsnPredikat(d.avg);
  const nice = dsnNice(d.nama);
  // komentar "dosen paling berkesan" yang menyebut dosen ini (nama lengkap, atau kata khas ≥5 huruf yg hanya milik dosen ini)
  const allTok = {};
  uniqSorted(evals.map((e) => e.key)).forEach((k) => k.split(" ").forEach((w) => { allTok[w] = (allTok[w] || 0) + 1; }));
  const myTok = d.key.split(" ").filter((w) => w.length >= 5 && allTok[w] === 1);
  const mine = comments.filter((c) => { const t = c.txt.toLowerCase(); return t.includes(d.key) || myTok.some((w) => new RegExp("\\b" + w + "\\b").test(t)); });
  const mx = Math.max(...d.dist, 1);

  return (
    <div className="card" id="dsn-detail">
      <div className="dsn-prof">
        <div className="ava">{dsnInitials(d.nama)}</div>
        <div style={{ flex: 1 }}><h3>{d.nama}</h3>
          <div className="tags">{Object.keys(d.mapel).concat(Object.keys(d.metode), Object.keys(d.prog)).map((x, i) => <span key={i}>{x}</span>)}</div></div>
        <div style={{ textAlign: "right" }}><div style={{ fontSize: ".75rem", opacity: 0.8 }}>Predikat</div><div style={{ fontSize: "1.15rem", fontWeight: 800 }}>{pt}</div></div>
        <button type="button" className="btn-ghost" style={{ margin: "0 0 0 8px" }} onClick={onClose}>✕</button>
      </div>
      <div className="kpi-row">
        <Kpi value={d.avg.toFixed(2)} label="Rata-rata Nilai" />
        <Kpi value={"#" + d.rank} label={"Peringkat dari " + dosen.length} />
        <Kpi value={d.n} label="Penilaian" />
        <Kpi value={Math.round(d.dist[4] / d.n * 100) + "%"} label="Memberi nilai 5" />
      </div>
      <div className="grid-2 gap">
        <div>
          <h3 style={{ margin: "0 0 8px" }}>Sebaran Nilai</h3>
          {[5, 4, 3, 2, 1].map((s) => (
            <div key={s} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, fontSize: ".85rem" }}>
              <b style={{ width: 14 }}>{s}</b>
              <div className="pst-bar" style={{ width: "100%", flex: 1 }}><span style={{ width: (d.dist[s - 1] / mx * 100).toFixed(0) + "%" }} /></div>
              <span style={{ width: 34, textAlign: "right" }}>{d.dist[s - 1]}</span>
            </div>
          ))}
          <h3 style={{ margin: "14px 0 8px" }}>Per Metode</h3>
          <div className="table-wrap"><table>
            <thead><tr><th>Metode</th><th>Penilaian</th><th>Rata-rata</th></tr></thead>
            <tbody>{Object.entries(d.metode).map(([m, v]) => <tr key={m}><td>{m}</td><td>{v.length}</td><td className="pst-val">{dsnAvg(v).toFixed(2)}</td></tr>)}</tbody>
          </table></div>
        </div>
        <div>
          <h3 style={{ margin: "0 0 8px" }}>Komentar Peserta (menyebut {nice})</h3>
          {!mine.length && <div className="nil-muted">Belum ada komentar yang menyebut nama dosen ini.</div>}
          {mine.slice(0, 8).map((c, i) => <div className="dsn-quote" key={i}>{c.txt}<small>{c.prog} · {c.kelas}</small></div>)}
          {mine.length > 8 && <div className="nil-muted" style={{ fontSize: ".78rem" }}>+{mine.length - 8} komentar lain</div>}
        </div>
      </div>
    </div>
  );
}
