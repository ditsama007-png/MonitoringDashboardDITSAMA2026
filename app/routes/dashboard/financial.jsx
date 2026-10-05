import { useEffect, useMemo, useState } from "react";
import { useFetcher } from "react-router";
import { ChartCanvas } from "../../components/ChartCanvas.jsx";
import { EmptyRow, Kpi, SaveMsg, SelectField } from "../../components/ui.jsx";
import { FIN_PROGRAMS } from "../../config.js";
import { apiPost, HAS_API } from "../../lib/api.js";
import {
  fmtRupiah, fmtTanggal, keepOption, keyFromStored, labelOf, monthLabel, monthOptions, num, parseTgl, PROG_COLORS, yearOf,
} from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";
import { useDataStore } from "../../stores/data.js";
import { useUiStore } from "../../stores/ui.js";

const ALL = "Semua", LAINNYA = "__LAINNYA__";
const persenDPKS = (jenis) => jenis === "Pd" ? 20 : (jenis === "DP" ? 0 : 10);

// Simpan PKS / Pengajuan ke sheet Financial, lalu muat ulang.
export async function clientAction({ request }) {
  const { form, program, record } = await request.json();
  const session = useAuthStore.getState().session;
  if (!session) return { form, ok: false, message: "Belum login." };
  if (!HAS_API) return { form, ok: true, message: "Mode contoh — belum ke Sheets." };
  try {
    const out = await apiPost({ action: "write_fin", token: session.token, program, record });
    if (!out.ok) return { form, ok: false, message: "❌ " + (out.error || "Gagal.") };
    await useDataStore.getState().loadFin();
    return { form, ok: true, message: (form === "pks" ? "✅ Tersimpan. Saldo: " : "✅ Terkirim. Saldo: ") + fmtRupiah(out.saldo || 0) };
  } catch {
    return { form, ok: false, message: "❌ Gagal terhubung." };
  }
}

// tentukan tipe otomatis kalau kosong (data manual)
function tipeOf(r) {
  const t = String(r["Tipe"] || "").trim();
  if (t) return t;
  if (num(r["Nilai Pengajuan"]) > 0 || r["No Invoice"]) return "Pengajuan";
  if (num(r["Nilai PKS"]) > 0) return "PKS Awal";
  return "";
}
const isPks = (r) => { const t = tipeOf(r); return t === "PKS Awal" || t === "Penambahan PKS"; };
const progLabel = (r) => labelOf(keyFromStored(r["Program"]));

export default function Financial() {
  const fin = useDataStore((s) => s.fin);
  const loadFin = useDataStore((s) => s.loadFin);
  const ui = useUiStore((s) => s.fin);
  const patch = useUiStore((s) => s.patch);
  const [showInput, setShowInput] = useState(false);

  // FILTER khusus financial — memengaruhi SEMUA (KPI/grafik/ringkasan/tabel)
  const opts = useMemo(() => ({
    program: [ALL, ...FIN_PROGRAMS.map((p) => p.label)],
    tahun: [ALL, ...[...new Set(fin.rows.map((r) => yearOf(r["Tanggal"])).filter(Boolean))].sort()],
    bulan: [ALL, ...monthOptions(fin.rows.map((r) => r["Tanggal"]))],
    jenis: [ALL, ...[...new Set(fin.rows.map((r) => String(r["Jenis Pengajuan"] || "")).filter(Boolean))].sort()],
  }), [fin.rows]);
  const f = {
    program: keepOption(opts.program, ui.program), tahun: keepOption(opts.tahun, ui.tahun),
    bulan: keepOption(opts.bulan, ui.bulan), jenis: keepOption(opts.jenis, ui.jenis),
  };

  const { rows, perProg } = useMemo(() => {
    const rows = fin.rows.filter((r) => {
      if (f.program !== ALL && progLabel(r) !== f.program) return false;
      if (isPks(r)) return true;   // PKS selalu masuk (dana dasar)
      if (f.tahun !== ALL && yearOf(r["Tanggal"]) !== f.tahun) return false;
      if (f.bulan !== ALL && monthLabel(r["Tanggal"]) !== f.bulan) return false;
      if (f.jenis !== ALL && String(r["Jenis Pengajuan"] || "") !== f.jenis) return false;
      return true;
    });
    // ringkasan per program (dari data TERFILTER)
    const perProg = {};
    rows.forEach((r) => {
      const key = keyFromStored(r["Program"]), prog = labelOf(key);
      const o = perProg[prog] = perProg[prog] || { key, pks: 0, dpks: 0, ajuan: 0, saldo: 0 };
      if (isPks(r)) { o.pks += num(r["Nilai PKS"]); o.dpks += num(r["DPKS"]); }
      else if (tipeOf(r) === "Pengajuan") o.ajuan += num(r["Nilai Pengajuan"]);
    });
    const noFilter = Object.values(f).every((v) => v === ALL);
    const saldoMap = fin.saldo || {};
    Object.values(perProg).forEach((o) => {
      o.saldo = (noFilter && saldoMap[o.key] !== undefined) ? num(saldoMap[o.key]) : (o.pks - o.dpks - o.ajuan);
    });
    return { rows, perProg };
  }, [fin, f.program, f.tahun, f.bulan, f.jenis]);

  const tot = Object.values(perProg).reduce((t, o) => ({
    pks: t.pks + o.pks, dpks: t.dpks + o.dpks, ajuan: t.ajuan + o.ajuan, saldo: t.saldo + o.saldo,
  }), { pks: 0, dpks: 0, ajuan: 0, saldo: 0 });
  const dasar = tot.pks - tot.dpks;

  const sel = (key, label, minWidth) => (
    <SelectField label={"Filter " + label} style={{ minWidth }} value={f[key]} options={opts[key]} onChange={(v) => patch("fin", { [key]: v })} />
  );

  return (
    <section id="view-financial">
      <h1 className="title">Financial</h1>

      <div className="card">
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end" }}>
          {sel("program", "Program", 150)}
          {sel("tahun", "Tahun", 110)}
          {sel("bulan", "Bulan", 130)}
          {sel("jenis", "Jenis Pengajuan", 150)}
          <button className="btn-ghost" type="button" onClick={() => loadFin()}>🔄 Refresh</button>
        </div>
      </div>

      <div className="kpi-row">
        <Kpi value={fmtRupiah(tot.pks)} label="Total Nilai PKS" />
        <Kpi value={fmtRupiah(tot.dpks)} label="Total DPKS" />
        <Kpi value={fmtRupiah(tot.ajuan)} label="Total Pengajuan" />
        <Kpi value={fmtRupiah(tot.saldo)} label="Saldo Saat Ini" />
        <Kpi value={dasar > 0 ? Math.round(tot.ajuan / dasar * 100) + "%" : "0%"} label="% Serapan" />
      </div>

      <FinCharts rows={rows} perProg={perProg} />

      <div className="card">
        <h3>Ringkasan Keuangan per Program</h3>
        <div className="table-wrap"><table>
          <thead><tr><th>Program</th><th>Total PKS</th><th>DPKS</th><th>Pengajuan</th><th>Saldo</th><th>% Serapan</th></tr></thead>
          <tbody>
            {!Object.keys(perProg).length && <EmptyRow cols={6}>Belum ada data.</EmptyRow>}
            {Object.entries(perProg).map(([p, o]) => {
              const base = o.pks - o.dpks;
              return (
                <tr key={p}><td>{p}</td><td>{fmtRupiah(o.pks)}</td><td>{fmtRupiah(o.dpks)}</td><td>{fmtRupiah(o.ajuan)}</td>
                  <td>{fmtRupiah(o.saldo)}</td><td>{base > 0 ? Math.round(o.ajuan / base * 100) + "%" : "0%"}</td></tr>
              );
            })}
          </tbody>
        </table></div>
      </div>

      <div className="card">
        <div className="input-bar">
          <span className="input-label">Input Keuangan &amp; Tabel Data</span>
          <button className="btn-primary" type="button" onClick={() => setShowInput(!showInput)}>{showInput ? "✖ Tutup" : "➕ Input Data"}</button>
        </div>
      </div>

      {showInput && (
        <div>
          <div className="card">
            <div className="grid-2 gap">
              <PksForm />
              <PengajuanForm />
            </div>
          </div>
          <FinTable rows={rows} programs={Object.keys(perProg)} />
        </div>
      )}
    </section>
  );
}

// ===== Grafik Financial =====
function FinCharts({ rows, perProg }) {
  const charts = useMemo(() => {
    const progList = Object.keys(perProg);
    const colorOf = (p) => PROG_COLORS[progList.indexOf(p) % PROG_COLORS.length];
    // kunci urutan bulan dari tanggal asli (biar "Agu/Mei/Okt" tetap urut benar)
    const monthMeta = {};
    rows.forEach((r) => { const d = parseTgl(r["Tanggal"]); if (d) monthMeta[monthLabel(r["Tanggal"])] = d.getFullYear() * 12 + d.getMonth(); });
    const monthSort = (a, b) => (monthMeta[a] ?? 0) - (monthMeta[b] ?? 0);

    // 1) Realisasi bulanan, ditumpuk per program
    const bulanSet = {}, realBP = {};
    rows.forEach((r) => {
      if (tipeOf(r) !== "Pengajuan") return;
      const m = monthLabel(r["Tanggal"]); if (!m) return;
      const prog = progLabel(r);
      bulanSet[m] = 1;
      (realBP[prog] = realBP[prog] || {})[m] = (realBP[prog][m] || 0) + num(r["Nilai Pengajuan"]);
    });
    const bulan = Object.keys(bulanSet).sort(monthSort);
    // Susun PER BULAN: tiap bulan diurutkan sendiri (nilai kecil di bawah). Pakai "layer"
    // (dataset per posisi tumpukan); warna & tooltip mengikuti program di posisi itu.
    const perMonth = Object.fromEntries(bulan.map((m) => [m, progList.map((p) => ({ prog: p, val: (realBP[p] || {})[m] || 0 }))
      .filter((x) => x.val > 0).sort((a, b) => a.val - b.val)]));
    const maxLayers = Math.max(1, ...bulan.map((m) => perMonth[m].length));
    const layers = Array.from({ length: maxLayers }, (_, L) => ({
      label: "layer" + L, stack: "s",
      data: bulan.map((m) => { const it = perMonth[m][L]; return it ? Math.round(it.val / 1e6) : 0; }),
      backgroundColor: bulan.map((m) => { const it = perMonth[m][L]; return it ? colorOf(it.prog) : "rgba(0,0,0,0)"; }),
      _progs: bulan.map((m) => { const it = perMonth[m][L]; return it ? it.prog : ""; }),
    }));
    const bulanan = {
      type: "bar",
      data: { labels: bulan.length ? bulan : ["(kosong)"], datasets: layers },
      options: {
        responsive: true, maintainAspectRatio: false,
        plugins: {
          legend: { position: "top", labels: { generateLabels: () => progList.map((p) => ({ text: p, fillStyle: colorOf(p), strokeStyle: colorOf(p) })) } },
          tooltip: { callbacks: { label: (ctx) => { const p = ctx.dataset._progs[ctx.dataIndex]; return p ? p + ": " + ctx.parsed.y + " jt" : ""; } } },
        },
        scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true, title: { display: true, text: "juta Rp" } } },
      },
    };

    // 2) Saldo per program per bulan: kolom "Saldo" pada baris TERAKHIR di bulan itu;
    //    bulan tanpa transaksi -> pakai saldo bulan sebelumnya (carry-forward).
    const months = [...new Set(rows.map((r) => monthLabel(r["Tanggal"])).filter(Boolean))].sort(monthSort);
    const saldo = {
      type: "line",
      data: {
        labels: months.length ? months : ["(kosong)"],
        datasets: progList.map((p, i) => {
          let last = null;
          const data = months.map((m) => {
            const inMonth = rows.filter((r) => progLabel(r) === p && monthLabel(r["Tanggal"]) === m && String(r["Saldo"] || "") !== "");
            if (inMonth.length) last = num(inMonth[inMonth.length - 1]["Saldo"]);
            return last === null ? null : Math.round(last / 1e6);
          });
          const c = PROG_COLORS[i % PROG_COLORS.length];
          return { label: p, data, borderColor: c, backgroundColor: c, fill: false, tension: 0.3, spanGaps: true };
        }),
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { title: { display: true, text: "juta Rp" } } } },
    };

    // 3) Nilai PKS vs Realisasi per program
    const prog = {
      type: "bar",
      data: {
        labels: progList.length ? progList : ["(kosong)"],
        datasets: [
          { label: "Nilai PKS", data: progList.map((p) => Math.round(perProg[p].pks / 1e6)), backgroundColor: "#9EC1E6" },
          { label: "Realisasi", data: progList.map((p) => Math.round(perProg[p].ajuan / 1e6)), backgroundColor: "#2F6FB0" },
        ],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "top" } }, scales: { y: { beginAtZero: true, title: { display: true, text: "juta Rp" } } } },
    };
    return { bulanan, saldo, prog };
  }, [rows, perProg]);

  return (
    <>
      <div className="grid-2 gap">
        <div className="card"><h3>Realisasi Bulanan Semua Program</h3><div className="sub">Pengajuan per bulan, ditumpuk per program (juta Rp)</div><ChartCanvas config={charts.bulanan} /></div>
        <div className="card"><h3>Saldo per Program per Bulan</h3><div className="sub">Tren saldo tiap program</div><ChartCanvas config={charts.saldo} /></div>
      </div>
      <div className="card"><h3>Anggaran per Program vs PKS</h3><div className="sub">Nilai PKS vs Realisasi (Pengajuan) per program</div><ChartCanvas config={charts.prog} /></div>
    </>
  );
}

// dropdown program form (FIN_PROGRAMS + Lainnya…)
function ProgramPicker({ value, custom, onChange, onCustom }) {
  return (
    <label>Program
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {FIN_PROGRAMS.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
        <option value={LAINNYA}>Lainnya… (ketik sendiri)</option>
      </select>
      {value === LAINNYA && <input placeholder="ketik nama program baru" style={{ marginTop: 4 }} autoFocus value={custom} onChange={(e) => onCustom(e.target.value)} />}
    </label>
  );
}

// pesan simpan: validasi lokal, status kirim, atau hasil clientAction
function useFormMsg(fetcher, form, busyText) {
  const [local, setLocal] = useState(null);
  const msg = local || (fetcher.state !== "idle" ? { text: busyText }
    : fetcher.data?.form === form ? { ok: fetcher.data.ok, text: fetcher.data.message } : null);
  return [msg, setLocal];
}

function PksForm() {
  const fetcher = useFetcher();
  const [prog, setProg] = useState(FIN_PROGRAMS[0].key);
  const [custom, setCustom] = useState("");
  const [v, setV] = useState({ tipe: "PKS Awal", jenis: "Pm", nilai: "", tanggal: "", ket: "" });
  const [msg, setLocal] = useFormMsg(fetcher, "pks", "Menyimpan...");
  const field = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) });
  const nilai = num(v.nilai), persen = persenDPKS(v.jenis);

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.form === "pks" && fetcher.data.ok) setV((x) => ({ ...x, nilai: "", tanggal: "", ket: "" }));
  }, [fetcher.state, fetcher.data]);

  const submit = () => {
    setLocal(null);
    if (!useAuthStore.getState().session) return setLocal({ ok: false, text: "Belum login." });
    if (!nilai) return setLocal({ ok: false, text: "Isi Nilai PKS." });
    const record = { Tipe: v.tipe, "Jenis PKS": v.jenis, "Persen DPKS": persen, "Nilai PKS": v.nilai, "Tanggal": v.tanggal, "Keterangan": v.ket.trim() };
    fetcher.submit({ form: "pks", program: prog === LAINNYA ? custom.trim() : prog, record }, { method: "post", encType: "application/json" });
  };

  return (
    <div>
      <h3>Input PKS</h3>
      <div className="sub">DPKS = persen × Nilai PKS. PKS Awal hanya sekali (lalu terkunci); tambahan pakai "Penambahan PKS".</div>
      <div className="grid-2" style={{ marginTop: ".6rem" }}>
        <ProgramPicker value={prog} custom={custom} onChange={setProg} onCustom={setCustom} />
        <label>Jenis<select {...field("tipe")}><option value="PKS Awal">PKS Awal</option><option value="Penambahan PKS">Penambahan PKS</option></select></label>
      </div>
      <div className="grid-2">
        <label>Jenis PKS<select {...field("jenis")}><option value="Pm">Pm (10%)</option><option value="Pd">Pd (20%)</option><option value="DP">DP (0% · dana pemerintah)</option></select></label>
        <label>Nilai PKS (Rp)<input type="number" min="0" placeholder="100000000" {...field("nilai")} /></label>
      </div>
      <div className="grid-2">
        <label>DPKS (otomatis)<input type="text" readOnly placeholder="—" value={nilai > 0 ? fmtRupiah(Math.round(nilai * persen / 100)) : ""} /></label>
        <label>Tanggal<input type="date" {...field("tanggal")} /></label>
      </div>
      <label>Keterangan<input type="text" placeholder="opsional" {...field("ket")} /></label>
      <div className="form-actions">
        <button className="btn-primary" type="button" disabled={fetcher.state !== "idle"} onClick={submit}>💾 Simpan PKS</button>
        <SaveMsg msg={msg} />
      </div>
    </div>
  );
}

function PengajuanForm() {
  const fetcher = useFetcher();
  const [prog, setProg] = useState(FIN_PROGRAMS[0].key);
  const [custom, setCustom] = useState("");
  const empty = { invoice: "", tanggal: "", jenis: "", uraian: "", nilai: "" };
  const [v, setV] = useState(empty);
  const [msg, setLocal] = useFormMsg(fetcher, "pengajuan", "Mengirim...");
  const field = (k) => ({ value: v[k], onChange: (e) => setV({ ...v, [k]: e.target.value }) });

  useEffect(() => {
    if (fetcher.state === "idle" && fetcher.data?.form === "pengajuan" && fetcher.data.ok) setV(empty);
  }, [fetcher.state, fetcher.data]);

  const submit = () => {
    setLocal(null);
    if (!useAuthStore.getState().session) return setLocal({ ok: false, text: "Belum login." });
    if (!num(v.nilai)) return setLocal({ ok: false, text: "Isi Nilai Pengajuan." });
    const record = {
      Tipe: "Pengajuan", "No Invoice": v.invoice.trim(), "Tanggal": v.tanggal,
      "Jenis Pengajuan": v.jenis.trim(), "Uraian": v.uraian.trim(), "Nilai Pengajuan": v.nilai,
    };
    fetcher.submit({ form: "pengajuan", program: prog === LAINNYA ? custom.trim() : prog, record }, { method: "post", encType: "application/json" });
  };

  return (
    <div>
      <h3>Input Pengajuan</h3>
      <div className="sub">Tiap pengajuan mengurangi Saldo Berjalan program.</div>
      <div className="grid-2" style={{ marginTop: ".6rem" }}>
        <ProgramPicker value={prog} custom={custom} onChange={setProg} onCustom={setCustom} />
        <label>No Invoice<input type="text" placeholder="INV-001" {...field("invoice")} /></label>
      </div>
      <div className="grid-2">
        <label>Tgl Pengajuan<input type="date" {...field("tanggal")} /></label>
        <label>Jenis Pengajuan<input type="text" placeholder="mis. Konsumsi" {...field("jenis")} /></label>
      </div>
      <label>Uraian<input type="text" placeholder="mis. Snack peserta hari 1" {...field("uraian")} /></label>
      <label>Nilai Pengajuan (Rp)<input type="number" min="0" placeholder="2000000" {...field("nilai")} /></label>
      <div className="form-actions">
        <button className="btn-primary" type="button" disabled={fetcher.state !== "idle"} onClick={submit}>📨 Kirim Pengajuan</button>
        <SaveMsg msg={msg} />
      </div>
    </div>
  );
}

// tabel data keuangan (ikut filter) — satu program per tab
function FinTable({ rows, programs }) {
  const tab = useUiStore((s) => s.fin.tab);
  const patch = useUiStore((s) => s.patch);
  const active = programs.includes(tab) ? tab : (programs[0] || "");
  const tableRows = active ? rows.filter((r) => progLabel(r) === active) : rows;
  const cols = ["Tipe", "Nilai PKS", "DPKS", "No Invoice", "Tanggal", "Jenis Pengajuan", "Uraian", "Nilai Pengajuan", "Saldo"];
  const cell = (r, c) => {
    if (c === "Tipe") return tipeOf(r);
    const v = r[c] ?? "";
    if (c === "Tanggal") return v ? fmtTanggal(v) : "";
    if (["Nilai PKS", "DPKS", "Nilai Pengajuan", "Saldo"].includes(c) && v !== "") return fmtRupiah(num(v));
    return String(v);
  };

  return (
    <div className="card">
      <h3 style={{ margin: "0 0 8px" }}>Tabel Data Keuangan</h3>
      <div className="prog-tabs">
        {!programs.length && <span className="sub">Belum ada data.</span>}
        {programs.map((p) => (
          <button key={p} type="button" className={"prog-tab" + (p === active ? " active" : "")} onClick={() => patch("fin", { tab: p })}>{p}</button>
        ))}
      </div>
      <div className="table-wrap"><table>
        <thead><tr>{cols.map((c) => <th key={c}>{c}</th>)}</tr></thead>
        <tbody>
          {!tableRows.length && <EmptyRow cols={cols.length}>Belum ada data untuk {active || "program ini"}.</EmptyRow>}
          {tableRows.map((r, i) => <tr key={i}>{cols.map((c) => <td key={c}>{cell(r, c)}</td>)}</tr>)}
        </tbody>
      </table></div>
    </div>
  );
}
