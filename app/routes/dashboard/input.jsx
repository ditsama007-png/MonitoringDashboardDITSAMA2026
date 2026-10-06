import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, useFetcher, useSearchParams } from "react-router";
import { EmptyRow, SaveMsg, StatusBadge } from "../../components/ui.jsx";
import { OPSI_FASE, OPSI_KEBERJALANAN, OPSI_LEVEL_ISU, PROGRAMS } from "../../config.js";
import { apiPost, HAS_API } from "../../lib/api.js";
import {
  canAccessProgram, fileToBase64, fmtTanggal, idLabel, isAllAccess, isFinanceOnly, keyFromStored, labelOf, makeFlexId,
  milestoneActive, milestoneNeedsDate, rowIsProgram, splitPeople, statusOf, toDateInput,
} from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";
import { useDataStore } from "../../stores/data.js";

const ALL = "__ALL__", LAINNYA = "__LAINNYA__";
const PERAN = ["Dosen", "Asisten", "Staff", "Mitra"];

// ------------------------------------------------------------- action ---
// intent: "save" (tulis/update baris), "delete" (hapus baris), "update" (ubah sebagian kolom)
export async function clientAction({ request }) {
  const body = await request.json();
  const session = useAuthStore.getState().session;
  if (!session) return { intent: body.intent, ok: false, message: "Anda belum login." };
  if (!HAS_API) {
    return body.intent === "save"
      ? { intent: "save", ok: true, message: "Tersimpan (mode contoh — belum ke Sheets)." }
      : { intent: body.intent, ok: false, message: "Mode contoh — edit/hapus hanya aktif setelah tersambung ke Sheets." };
  }
  const token = session.token;
  const req = {
    save: body.editId
      // sedang mengisi milestone / edit baris -> update baris itu
      ? { action: "update_flex", token, id: body.editId, record: body.record }
      : { action: "write_flex", token, program: body.program, record: body.record },
    delete: { action: "delete_flex", token, id: body.id },
    update: { action: "update_flex", token, id: body.id, record: body.record },
  }[body.intent];
  try {
    const out = await apiPost(req);
    if (!out.ok) {
      const prefix = { save: "❌ ", delete: "Gagal hapus: ", update: "Gagal simpan: " }[body.intent];
      return { intent: body.intent, ok: false, message: prefix + (out.error || "Gagal menyimpan.") };
    }
    await useDataStore.getState().loadFlex();
    const message = body.intent !== "save" ? "" : body.editId
      ? "✅ Agenda terisi & tersimpan."
      : "✅ Tersimpan. Isi lagi atau klik 'Tambahkan data lainnya'.";
    return { intent: body.intent, ok: true, message };
  } catch {
    return { intent: body.intent, ok: false, message: "❌ Gagal terhubung ke server." };
  }
}

// --------------------------------------------------------- form state ---
let uidCounter = 0;
const uid = () => ++uidCounter;
const newPeserta = (kat = "", ter = "", had = "") => ({ id: uid(), kat, ter: String(ter ?? ""), had: String(had ?? "") });
const newSdm = (peran = "", names = "") => ({
  id: uid(),
  peranSel: !peran || PERAN.includes(peran) ? (peran || "Dosen") : LAINNYA,
  peranCustom: peran && !PERAN.includes(peran) ? peran : "",
  names, skStatus: "", skLink: "",
});
const newIssue = (nama = "", level = "", pihak = "", solve = "") => ({ id: uid(), nama, level: level || OPSI_LEVEL_ISU[0], pihak, solve });
const newExtra = () => ({ id: uid(), name: "", val: "" });
const peranOf = (s) => s.peranSel === LAINNYA ? s.peranCustom.trim() : s.peranSel;

function emptyForm(session) {
  return {
    editId: null, mode: "ongoing",
    pic: session ? session.nama : "",   // otomatis dari akun, tetap bisa diedit
    tanggal: "", kegiatan: "", fase: "", lokasi: "",
    peserta: [newPeserta("SMA"), newPeserta("Universitas")],
    sdm: [newSdm("Dosen")],
    issues: [],
    nilai: "", feedback: "", keberjalanan: "",
    extras: [],
  };
}

// isi form dari baris milestone (jadi On-Going)
function formFromMilestone(row, session) {
  return {
    ...emptyForm(session), editId: row["ID"] || null,
    kegiatan: row["Nama Kegiatan"] || "", tanggal: toDateInput(row["Tanggal Kegiatan"]),
    fase: row["Fase Kegiatan"] || "", lokasi: row["Lokasi / Alamat"] || "",
  };
}

// Edit sebuah baris DataMasuk lewat FORM pengisian
function formFromRow(r, session) {
  const f = {
    ...emptyForm(session), editId: r["ID"] || null,
    pic: r["PIC"] || (session ? session.nama : ""),
    tanggal: toDateInput(r["Tanggal Kegiatan"]), kegiatan: r["Nama Kegiatan"] || "",
    fase: r["Fase Kegiatan"] || "", lokasi: r["Lokasi / Alamat"] || "",
    mode: String(r["Mode"] || "") === "Upcoming Milestone" ? "milestone" : "ongoing",
  };
  if (f.mode === "milestone") return f;

  // peserta: dari kolom "Peserta X (terdaftar)/(hadir)"
  const kat = {};
  Object.keys(r).forEach((k) => {
    let m = /^Peserta (.+) \(terdaftar\)$/.exec(k);
    if (m) (kat[m[1]] = kat[m[1]] || {}).ter = r[k];
    m = /^Peserta (.+) \(hadir\)$/.exec(k);
    if (m) (kat[m[1]] = kat[m[1]] || {}).had = r[k];
  });
  f.peserta = Object.keys(kat)
    .filter((nm) => String(kat[nm].ter ?? "") !== "" || String(kat[nm].had ?? "") !== "")
    .map((nm) => newPeserta(nm, kat[nm].ter, kat[nm].had));
  if (!f.peserta.length) f.peserta = [newPeserta()];

  // SDM: dari "SDM {peran} (daftar nama)", cadangan "SDM {peran} - Nama N"
  f.sdm = [];
  const done = {};
  Object.keys(r).forEach((k) => {
    const m = /^SDM (.+) \(daftar nama\)$/.exec(k);
    if (m && String(r[k] || "").trim()) { done[m[1]] = 1; f.sdm.push(newSdm(m[1], splitPeople(r[k]).join("\n"))); }
  });
  Object.keys(r).forEach((k) => {
    const m = /^SDM (.+) - Nama \d+$/.exec(k);
    if (!m || done[m[1]] || !String(r[k] || "").trim()) return;
    done[m[1]] = 1;
    const re = new RegExp("^SDM " + m[1].replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + " - Nama \\d+$");
    f.sdm.push(newSdm(m[1], Object.keys(r).filter((x) => re.test(x)).map((x) => r[x]).filter(Boolean).join("\n")));
  });

  // issue: dari "Issue N Level/Nama/Pihak/Problem Solving"
  f.issues = [];
  for (let n = 1; r["Issue " + n + " Level"] !== undefined || r["Issue " + n + " Nama"] !== undefined; n++) {
    const lv = r["Issue " + n + " Level"], nm = r["Issue " + n + " Nama"];
    if ((lv && String(lv).trim()) || (nm && String(nm).trim())) {
      f.issues.push(newIssue(nm || "", lv || "", r["Issue " + n + " Pihak (penyelenggara)"] || r["Issue " + n + " Pihak"] || "",
        r["Issue " + n + " Problem Solving"] || ""));
    }
  }

  // portfolio
  f.nilai = String(r["Nilai Capaian (%)"] || "").replace(/[^0-9.]/g, "");
  f.feedback = String(r["Feedback (%)"] || "").replace(/[^0-9.]/g, "");
  f.keberjalanan = r["Keberjalanan Kegiatan"] || "";
  return f;
}

function buildRecord(f) {
  const record = {
    "Mode": f.mode === "milestone" ? "Upcoming Milestone" : "On-Going",
    "PIC": f.pic.trim(),
    "Tanggal Kegiatan": f.tanggal,
    "Nama Kegiatan": f.kegiatan.trim(),
    "Fase Kegiatan": f.fase.trim(),
    "Lokasi / Alamat": f.lokasi.trim(),
  };
  if (f.mode === "ongoing") {
    let totTer = 0, totHad = 0;
    f.peserta.filter((p) => p.kat.trim()).forEach((p) => {
      record["Peserta " + p.kat.trim() + " (terdaftar)"] = p.ter;
      record["Peserta " + p.kat.trim() + " (hadir)"] = p.had;
      totTer += +p.ter || 0; totHad += +p.had || 0;
    });
    f.sdm.forEach((s) => {
      const peran = peranOf(s); if (!peran) return;
      const names = splitPeople(s.names);
      record["SDM " + peran + " (jumlah)"] = names.length;
      record["SDM " + peran + " (daftar nama)"] = names.join("\n");
      if (s.skLink) record["SK " + peran] = s.skLink;
    });
    // Issue paket (hanya yang benar-benar ada issue); kalau tak ada issue -> tak ada kolom issue
    f.issues.filter((it) => it.level && it.level !== "Tidak Ada").forEach((it, i) => {
      const n = i + 1;
      record["Issue " + n + " Level"] = it.level;
      record["Issue " + n + " Nama"] = it.nama.trim();
      record["Issue " + n + " Pihak (penyelenggara)"] = it.pihak.trim();
      record["Issue " + n + " Problem Solving"] = it.solve.trim();
    });
    record["Nilai Capaian (%)"] = f.nilai;
    record["Feedback (%)"] = f.feedback;
    record["Keberjalanan Kegiatan"] = f.keberjalanan;
    // Kehadiran otomatis = total hadir / total terdaftar * 100
    if (totTer > 0) record["Kehadiran (%)"] = Math.round((totHad / totTer) * 100);
  }
  f.extras.forEach((x) => { if (x.name.trim()) record[x.name.trim()] = x.val.trim(); });
  return record;
}

// opsi select + nilai sekarang bila tidak ada di daftar
const withCurrent = (opts, v) => (v && !opts.includes(v) ? [...opts, v] : opts);

// ============================================================== route ===
export default function InputData() {
  const session = useAuthStore((s) => s.session);
  const flex = useDataStore((s) => s.flex);
  const [params, setParams] = useSearchParams();
  const [form, setForm] = useState(() => emptyForm(session));
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");
  const [localMsg, setLocalMsg] = useState(null);
  const formRef = useRef(null);
  const saver = useFetcher();

  // dropdown program: hanya yang boleh diisi user (+ Semua / Lainnya untuk Admin/Head/Finance)
  const programOptions = useMemo(() => {
    const opts = PROGRAMS.filter((p) => canAccessProgram(session, p.key)).map((p) => [p.key, p.label]);
    if (session && isAllAccess(session.jabatan)) return [[ALL, "Semua Program"], ...opts, [LAINNYA, "Lainnya… (ketik sendiri)"]];
    return opts.length ? opts : [["", "(tidak ada program yang bisa Anda isi)"]];
  }, [session]);
  const paramProg = params.get("program");
  const selected = programOptions.some(([v]) => v === paramProg) ? paramProg : programOptions[0][0];
  const program = selected === LAINNYA ? custom.trim() : selected;

  // ?edit=ID / ?fill=ID (dari tombol "Edit" atau "Isi data") -> muat baris ke form
  const editId = params.get("edit"), fillId = params.get("fill");
  useEffect(() => {
    const id = editId || fillId;
    if (!id) return;
    const row = flex.rows.find((r) => String(r["ID"]) === id);
    if (!row) return;   // tunggu DataMasuk termuat
    setForm(editId ? formFromRow(row, session) : formFromMilestone(row, session));
    setOpen(true);
    setLocalMsg(null);
    const next = new URLSearchParams(params);
    next.delete("edit"); next.delete("fill");
    setParams(next, { replace: true });
    requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  }, [editId, fillId, flex.rows, params, session, setParams]);

  // setelah tersimpan: kosongkan form ke bentuk awal (untuk input baru)
  useEffect(() => {
    if (saver.state === "idle" && saver.data?.intent === "save" && saver.data.ok) setForm(emptyForm(session));
  }, [saver.state, saver.data, session]);

  if (session && isFinanceOnly(session.jabatan)) return <Navigate to="/dashboard/financial" replace />;

  const isAll = selected === ALL;
  const changeProgram = (v) => {
    setParams({ program: v }, { replace: true });
    setOpen(false);   // ganti program -> form ditutup
  };
  const toggleForm = () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setForm((f) => ({ ...f, mode: "ongoing", pic: f.pic || (session ? session.nama : "") }));
      requestAnimationFrame(() => formRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    }
  };
  const addMore = () => {
    setForm(emptyForm(session));
    setOpen(true);
    setLocalMsg(null);
    requestAnimationFrame(() => formRef.current?.querySelector("#f-kegiatan")?.focus());
  };
  const save = () => {
    setLocalMsg(null);
    if (!session) return setLocalMsg({ ok: false, text: "Anda belum login." });
    if (!canAccessProgram(session, program)) return setLocalMsg({ ok: false, text: "Anda tak berhak mengisi program ini." });
    const record = buildRecord(form);
    if (!record["PIC"]) record["PIC"] = session.nama;
    if (!record["Nama Kegiatan"]) return setLocalMsg({ ok: false, text: "Nama kegiatan wajib diisi." });
    // data baru -> ID berformat (Apps Script memakai ID ini bila dikirim); edit tetap pakai ID lama
    if (!form.editId) record["ID"] = makeFlexId(program, record["Fase Kegiatan"], new Date(), new Set(flex.rows.map((r) => String(r["ID"]))));
    saver.submit({ intent: "save", program, record, editId: form.editId }, { method: "post", encType: "application/json" });
  };

  const saveMsg = localMsg || (saver.state !== "idle" ? { text: "Menyimpan..." }
    : saver.data?.intent === "save" ? { ok: saver.data.ok, text: saver.data.message } : null);

  return (
    <section id="view-input">
      <div className="card">
        <h2 className="prog-heading">Input Data</h2>
        <div className="sub">Pilih program yang mau diisi, lalu klik "Input Data Baru".</div>
        <label style={{ maxWidth: 360, display: "block", marginTop: ".6rem" }}>Program yang diisi
          <select value={selected} onChange={(e) => changeProgram(e.target.value)}>
            {programOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
          {selected === LAINNYA && (
            <input placeholder="ketik nama program baru" style={{ marginTop: 6 }} autoFocus value={custom}
              onChange={(e) => setCustom(e.target.value)} />
          )}
        </label>

        <div className="input-bar" style={{ marginTop: "1rem" }}>
          <span className="input-label">Form Input</span>
          <button type="button" className="btn-primary" disabled={isAll} style={isAll ? { opacity: 0.5 } : undefined}
            title={isAll ? "Pilih program spesifik untuk mengisi data" : ""} onClick={toggleForm}>
            {open && !isAll ? "✖ Tutup Form" : "➕ Input Data Baru"}
          </button>
        </div>

        {open && !isAll && (
          <div ref={formRef}>
            <hr />
            <InputForm form={form} setForm={setForm} session={session} />
            <div className="form-actions">
              <button type="button" className="btn-primary" disabled={saver.state !== "idle"} onClick={save}>&#128190; Simpan ke Sheets</button>
              <button type="button" className="btn-ghost" onClick={addMore}>➕ Tambahkan data lainnya</button>
              <SaveMsg msg={saveMsg} />
            </div>
          </div>
        )}
      </div>

      <DataMasukTable programKey={selected} label={isAll ? "Semua Program" : labelOf(program)} />
      <ColumnHistory header={flex.header} rows={flex.rows} />
    </section>
  );
}

// ---------------------------------------------------------- form body ---
function InputForm({ form: f, setForm, session }) {
  const set = (patch) => setForm((cur) => ({ ...cur, ...patch }));
  const field = (k) => ({ value: f[k], onChange: (e) => set({ [k]: e.target.value }) });
  // ubah satu baris dalam daftar dinamis (peserta / sdm / issues / extras)
  const updRow = (list, id, patch) => setForm((cur) => ({ ...cur, [list]: cur[list].map((x) => x.id === id ? { ...x, ...patch } : x) }));
  const delRow = (list, id) => setForm((cur) => ({ ...cur, [list]: cur[list].filter((x) => x.id !== id) }));
  const addRow = (list, row) => setForm((cur) => ({ ...cur, [list]: [...cur[list], row] }));

  async function uploadSK(s, file) {
    if (!file) return;
    const peran = peranOf(s) || "SDM";
    const fname = peran.replace(/\s+/g, "") + "_SK." + (file.name.split(".").pop() || "pdf");
    if (!HAS_API) return updRow("sdm", s.id, { skStatus: "(demo) " + fname });
    updRow("sdm", s.id, { skStatus: "Mengunggah...", skLink: "" });
    try {
      const out = await apiPost({ action: "upload_sk", token: session?.token, name: fname, mime: file.type, data: await fileToBase64(file) });
      updRow("sdm", s.id, out.ok ? { skStatus: out.name, skLink: out.url } : { skStatus: "❌ " + (out.error || "gagal") });
    } catch { updRow("sdm", s.id, { skStatus: "❌ gagal unggah" }); }
  }

  return (
    <>
      <div style={{ marginBottom: ".6rem" }}>
        <span style={{ fontSize: ".8rem", fontWeight: 700, color: "#1B3A6B", marginRight: 8 }}>Jenis pengisian:</span>
        <button type="button" className={"mode-btn" + (f.mode === "ongoing" ? " active" : "")} onClick={() => set({ mode: "ongoing" })}>Data Berlangsung</button>
        <button type="button" className={"mode-btn" + (f.mode === "milestone" ? " active" : "")} onClick={() => set({ mode: "milestone" })}>Agenda Mendatang</button>
      </div>

      <div className="grid-2">
        <label>Nama PIC<input type="text" placeholder="nama PIC" {...field("pic")} /></label>
        <div />
      </div>
      <div className="grid-2">
        <label>Tanggal Kegiatan<input type="date" {...field("tanggal")} /></label>
        <label>Nama Kegiatan<input id="f-kegiatan" type="text" placeholder="mis. Kelas SIAP 6-10 Juli" {...field("kegiatan")} /></label>
      </div>
      <div className="grid-2">
        <label>Fase Kegiatan
          <select {...field("fase")}>{withCurrent(["", ...OPSI_FASE], f.fase).map((o) => <option key={o}>{o}</option>)}</select>
        </label>
        <label>Lokasi / Alamat<input type="text" placeholder="mis. Aula ITB" {...field("lokasi")} /></label>
      </div>

      {f.mode === "ongoing" && (
        <div>
          <div className="dyn-box">
            <div className="dyn-head"><span>Participant (peserta)</span>
              <button type="button" className="btn-ghost" onClick={() => addRow("peserta", newPeserta())}>➕ Tambah baris</button></div>
            <div className="dyn-cols"><span>Kategori</span><span>Terdaftar</span><span>Hadir</span><span /></div>
            {f.peserta.map((p) => (
              <div className="dyn-row" key={p.id}>
                <input placeholder="mis. SMA" value={p.kat} onChange={(e) => updRow("peserta", p.id, { kat: e.target.value })} />
                <input type="number" placeholder="0" value={p.ter} onChange={(e) => updRow("peserta", p.id, { ter: e.target.value })} />
                <input type="number" placeholder="0" value={p.had} onChange={(e) => updRow("peserta", p.id, { had: e.target.value })} />
                <button type="button" className="dyn-del" onClick={() => delRow("peserta", p.id)}>✕</button>
              </div>
            ))}
          </div>

          <div className="dyn-box">
            <div className="dyn-head"><span>SDM terlibat</span>
              <button type="button" className="btn-ghost" onClick={() => addRow("sdm", newSdm())}>➕ Tambah peran</button></div>
            {f.sdm.map((s) => (
              <div className="sdm-block" key={s.id}>
                <div className="grid-2">
                  <label>Peran
                    <select value={s.peranSel} onChange={(e) => updRow("sdm", s.id, { peranSel: e.target.value })}>
                      {PERAN.map((p) => <option key={p}>{p}</option>)}
                      <option value={LAINNYA}>Lainnya…</option>
                    </select>
                    {s.peranSel === LAINNYA && (
                      <input placeholder="ketik peran lain" style={{ marginTop: 4 }} autoFocus value={s.peranCustom}
                        onChange={(e) => updRow("sdm", s.id, { peranCustom: e.target.value })} />
                    )}
                  </label>
                  <label>Jumlah (otomatis)<input type="number" placeholder="0" readOnly value={splitPeople(s.names).length} /></label>
                </div>
                <label>Daftar Nama (boleh paste banyak — pisah dengan Enter atau koma)
                  <textarea rows={4} placeholder={"Budi Santoso\nSari Dewi\nAndi Pratama"} value={s.names}
                    onChange={(e) => updRow("sdm", s.id, { names: e.target.value })} />
                </label>
                <div className="sdm-sk-row">
                  <label className="btn-ghost" style={{ display: "inline-block", cursor: "pointer" }}>
                    📎 Unggah SK (opsional, 1 file)
                    <input type="file" accept="application/pdf,image/*" hidden onChange={(e) => uploadSK(s, e.target.files[0])} />
                  </label>{" "}
                  <span className="s-status">
                    {s.skLink ? <a href={s.skLink} target="_blank" rel="noreferrer">✓ {s.skStatus}</a> : s.skStatus}
                  </span>
                </div>
                <button type="button" className="btn-ghost" style={{ color: "#DC2626", marginTop: 4 }} onClick={() => delRow("sdm", s.id)}>✕ Hapus peran</button>
              </div>
            ))}
          </div>

          <div className="dyn-box">
            <div className="dyn-head"><span>Isu / Peringatan (isi hanya jika ADA masalah)</span>
              <button type="button" className="btn-ghost" onClick={() => addRow("issues", newIssue())}>➕ Tambah isu</button></div>
            <div className="sub" style={{ marginBottom: 6 }}>Kosongkan kalau tidak ada isu. Tiap isu = Nama, Level, Keterangan, Penyelesaian Masalah.</div>
            {f.issues.map((it) => (
              <div className="issue-row" key={it.id}>
                <div className="grid-2">
                  <label>Tentukan Level Isu dulu
                    <select value={it.level} onChange={(e) => updRow("issues", it.id, { level: e.target.value })}>
                      {withCurrent(OPSI_LEVEL_ISU, it.level).map((o) => <option key={o} value={o}>{idLabel(o)}</option>)}
                    </select>
                  </label>
                  <div />
                </div>
                {it.level && it.level !== "Tidak Ada" && (
                  <div>
                    <div className="grid-2">
                      <label>Nama Isu<input placeholder="mis. Jadwal bentrok" value={it.nama} onChange={(e) => updRow("issues", it.id, { nama: e.target.value })} /></label>
                      <label>Isu dengan pihak siapa (penyelenggara)?<input placeholder="mis. sekolah / mitra" value={it.pihak} onChange={(e) => updRow("issues", it.id, { pihak: e.target.value })} /></label>
                    </div>
                    <div className="grid-2">
                      <label>Penyelesaian Masalah<input placeholder="penanganan yang dilakukan" value={it.solve} onChange={(e) => updRow("issues", it.id, { solve: e.target.value })} /></label>
                      <div />
                    </div>
                  </div>
                )}
                <button type="button" className="btn-ghost" style={{ marginBottom: 8 }} onClick={() => delRow("issues", it.id)}>✕ Hapus issue</button>
              </div>
            ))}
          </div>

          <div className="grid-3">
            <label>Nilai Capaian (%)<input type="number" min="0" max="100" placeholder="80" {...field("nilai")} /></label>
            <label>Umpan Balik (%)<input type="number" min="0" max="100" placeholder="85" {...field("feedback")} /></label>
            <label>Keberjalanan Kegiatan
              <select {...field("keberjalanan")}>{withCurrent(["", ...OPSI_KEBERJALANAN], f.keberjalanan).map((o) => <option key={o}>{o}</option>)}</select>
            </label>
          </div>
          <div className="sub" style={{ marginTop: 4 }}><i>Kehadiran dihitung otomatis (total hadir ÷ total terdaftar) — tidak perlu diisi, muncul di dashboard.</i></div>
        </div>
      )}

      <div className="extra-box">
        <div style={{ fontWeight: 700, fontSize: ".85rem", color: "#1B3A6B", marginBottom: ".4rem" }}>Kolom Tambahan (opsional)</div>
        <div className="sub">Ketik nama kolom &amp; isinya. Kolom baru otomatis dibuat di Sheets.</div>
        <div>
          {f.extras.map((x) => (
            <div className="extra-row" key={x.id}>
              <input list="col-history" placeholder="Pilih riwayat / ketik nama baru" value={x.name} onChange={(e) => updRow("extras", x.id, { name: e.target.value })} />
              <input placeholder="Isi" value={x.val} onChange={(e) => updRow("extras", x.id, { val: e.target.value })} />
              <button type="button" className="xcol-del" title="Hapus" onClick={() => delRow("extras", x.id)}>✕</button>
            </div>
          ))}
        </div>
        <button type="button" className="btn-ghost" onClick={() => addRow("extras", newExtra())}>➕ Tambah kolom</button>
      </div>
    </>
  );
}

// ------------------------------------------------- tabel Data Masuk ---
function DataMasukTable({ programKey, label }) {
  const flex = useDataStore((s) => s.flex);
  const loadFlex = useDataStore((s) => s.loadFlex);
  const fetcher = useFetcher();
  const [, setParams] = useSearchParams();
  const [refreshing, setRefreshing] = useState(false);

  const header = (flex.header.length ? flex.header : ["ID", "Waktu Input", "Program", "PIC"]).filter((h) => h !== "Mode");
  // tampilkan semua data untuk program terpilih (cocokkan kode ATAU label)
  const rows = programKey === ALL ? flex.rows : flex.rows.filter((r) => rowIsProgram(r, programKey));

  const del = (id) => {
    if (!id || !confirm("Hapus baris ini? Tidak bisa dikembalikan.")) return;
    fetcher.submit({ intent: "delete", id }, { method: "post", encType: "application/json" });
  };
  const fillDate = (r) => {
    if (!milestoneActive(r)) { alert("Tombol isi tanggal aktif H-2 sampai H+7 dari tanggal milestone."); return; }
    const d = prompt("Isi tanggal pelaksanaan (YYYY-MM-DD):", r["Tanggal Kegiatan"] || "");
    if (d) fetcher.submit({ intent: "update", id: r["ID"], record: { "Tanggal Kegiatan": d } }, { method: "post", encType: "application/json" });
  };
  const edit = (r) => setParams({ program: keyFromStored(r["Program"]) || programKey, edit: String(r["ID"] || "") });
  const refresh = async () => { setRefreshing(true); await loadFlex(); setRefreshing(false); };

  return (
    <div className="card">
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
        <div>
          <h3>Data Masuk (semua kolom fleksibel · program terpilih)</h3>
          <div className="sub">Tersimpan di sheet "DataMasuk". Kolom menyesuaikan otomatis.</div>
        </div>
        <button className="btn-ghost" type="button" onClick={refresh}>{refreshing ? "⏳ Memuat..." : "🔄 Muat ulang data"}</button>
      </div>
      {fetcher.state === "idle" && fetcher.data && !fetcher.data.ok && (
        <div className="save-msg err" style={{ display: "block", margin: "6px 0" }}>{fetcher.data.message}</div>
      )}
      <div className="table-wrap" style={fetcher.state !== "idle" ? { opacity: 0.6 } : undefined}>
        <table id="flex-table">
          <thead><tr><th>Status</th>{header.map((h) => <th key={h}>{h}</th>)}<th>Aksi</th></tr></thead>
          <tbody>
            {!rows.length && <EmptyRow cols={header.length + 2}>Belum ada data untuk {label}.</EmptyRow>}
            {rows.map((r, i) => (
              <tr key={r["ID"] || i}>
                <td><StatusBadge status={statusOf(r)} /></td>
                {header.map((h) => {
                  const v = r[h] ?? "";
                  return <td key={h}>{h === "Tanggal Kegiatan" ? fmtTanggal(v) : String(v)}</td>;
                })}
                <td className="act-cell" style={{ whiteSpace: "nowrap" }}>
                  <button type="button" className="mini-btn edit" onClick={() => edit(r)}>✎ Ubah</button>{" "}
                  <button type="button" className="mini-btn del" onClick={() => del(r["ID"])}>🗑 Hapus</button>
                  {milestoneNeedsDate(r) && (
                    <> <button type="button" className={"mini-btn fill" + (milestoneActive(r) ? "" : " off")} onClick={() => fillDate(r)}>📅 Isi tanggal</button></>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// riwayat semua nama kolom yang pernah ada (dari semua program) -> datalist
function ColumnHistory({ header, rows }) {
  const sys = { "ID": 1, "Waktu Input": 1, "Program": 1, "PIC": 1, "Mode": 1 };
  const cols = [...new Set(header.filter((h) => h && !sys[h]))];
  const names = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => Object.keys(r).forEach((k) => {
      if (/^SDM .+ - Nama \d+$/.test(k) && String(r[k] || "").trim()) s.add(String(r[k]).trim());
    }));
    return [...s];
  }, [rows]);
  return (
    <>
      <datalist id="col-history">{cols.map((c) => <option key={c} value={c} />)}</datalist>
      <datalist id="sdm-name-list">{names.map((n) => <option key={n} value={n} />)}</datalist>
    </>
  );
}
