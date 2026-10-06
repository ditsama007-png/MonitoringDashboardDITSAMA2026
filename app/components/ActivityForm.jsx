// Form tambah / ubah kegiatan (panel samping). Mengirim ke POST /activity atau PATCH /activity/:id.
import { useEffect, useMemo, useState } from "react";
import { ISSUE_LEVELS, PHASES, PROGRESS, SDM_POSITIONS } from "../config.js";
import { api, upload } from "../lib/api.js";
import { attendance, editablePrograms, fromDateInput, skName, splitPeople, toDateInput } from "../lib/format.js";
import { useAuthStore } from "../stores/auth.js";
import { invalidate } from "../stores/data.js";
import { toast } from "./feedback.jsx";
import { Icon } from "./Icon.jsx";
import { Segmented, Sheet, Spinner } from "./ui.jsx";

const LAINNYA = "__LAINNYA__";
let uidCounter = 0;
const uid = () => ++uidCounter;

const newPeserta = (p = {}) => ({ uid: uid(), id: p.id, category: p.category || "", registered: p.registered ?? "", present: p.present ?? "" });
const newSdm = (h = {}) => ({
  uid: uid(), id: h.id,
  posSel: !h.position || SDM_POSITIONS.includes(h.position) ? (h.position || "Dosen") : LAINNYA,
  posCustom: h.position && !SDM_POSITIONS.includes(h.position) ? h.position : "",
  names: (h.names || []).join("\n"),
  skId: h.skId || null, skName: h.sk ? skName(h.sk.name) : "", skUrl: h.sk?.url || "", skBusy: false,
});
const newIssue = (i = {}) => ({ uid: uid(), id: i.id, level: i.level || "medium", name: i.name || "", to: i.to || "", problemSolving: i.problemSolving || "" });
const posOf = (s) => (s.posSel === LAINNYA ? s.posCustom.trim() : s.posSel);
const numOrNull = (v) => (v === "" || v === null || v === undefined ? null : Number(v));

function formFrom(a, session, program) {
  if (!a) {
    return {
      mode: "ongoing", program, pic: session?.name || "", name: "", date: "", phase: "", location: "",
      participants: [newPeserta({ category: "SMA" }), newPeserta({ category: "Universitas" })],
      hr: [newSdm()], issues: [], achievementValue: "", feedback: "", progress: "",
    };
  }
  return {
    mode: a.mode, program: a.program, pic: a.pic || "", name: a.name || "", date: toDateInput(a.date), phase: a.phase || "",
    location: a.location || "",
    participants: a.participants?.length ? a.participants.map(newPeserta) : [newPeserta()],
    hr: a.humanResources?.length ? a.humanResources.map(newSdm) : [newSdm()],
    issues: (a.issues || []).map(newIssue),
    achievementValue: a.achievementValue ?? "", feedback: a.feedback ?? "", progress: a.progress || "",
  };
}

function lists(f) {
  return {
    participants: f.participants.filter((p) => p.category.trim()).map((p) => ({
      ...(p.id ? { id: p.id } : {}), category: p.category.trim(), registered: Number(p.registered) || 0, present: Number(p.present) || 0,
    })),
    humanResources: f.hr.map((s) => ({ s, position: posOf(s), names: splitPeople(s.names) }))
      .filter((x) => x.position && x.names.length)
      .map(({ s, position, names }) => ({ ...(s.id ? { id: s.id } : {}), position, names, ...(s.skId ? { skId: s.skId } : {}) })),
    issues: f.issues.filter((i) => i.name.trim()).map((i) => ({
      ...(i.id ? { id: i.id } : {}), level: i.level, name: i.name.trim(),
      ...(i.to.trim() ? { to: i.to.trim() } : {}), ...(i.problemSolving.trim() ? { problemSolving: i.problemSolving.trim() } : {}),
    })),
  };
}

function validate(f) {
  if (!f.program) return "Pilih program.";
  if (!f.name.trim()) return "Nama kegiatan wajib diisi.";
  for (const [k, label] of [["achievementValue", "Nilai capaian"], ["feedback", "Umpan balik"]]) {
    if (f[k] === "") continue;
    const n = Number(f[k]);
    if (!Number.isInteger(n) || n < 0 || n > 100) return `${label} harus bilangan bulat 0–100.`;
  }
  for (const p of f.participants) {
    if (!p.category.trim()) continue;
    if ([p.registered, p.present].some((v) => v !== "" && (!Number.isInteger(Number(v)) || Number(v) < 0))) return `Jumlah peserta "${p.category}" harus bilangan bulat ≥ 0.`;
  }
  if (f.hr.some((s) => s.posSel === LAINNYA && !s.posCustom.trim() && splitPeople(s.names).length)) return "Ketik nama peran SDM lainnya.";
  return "";
}

function buildCreate(f) {
  const body = { program: f.program, mode: f.mode, name: f.name.trim() };
  if (f.pic.trim()) body.pic = f.pic.trim();
  if (f.date) body.date = fromDateInput(f.date);
  if (f.phase) body.phase = f.phase;
  if (f.location.trim()) body.location = f.location.trim();
  if (f.mode === "ongoing") {
    Object.assign(body, lists(f));
    if (f.achievementValue !== "") body.achievementValue = Number(f.achievementValue);
    if (f.feedback !== "") body.feedback = Number(f.feedback);
    if (f.progress) body.progress = f.progress;
  }
  return body;
}

// hanya kolom yang berubah; string kosong -> null (hapus nilai)
function buildPatch(f, a) {
  const body = {};
  const set = (k, v, old) => { if ((v ?? null) !== (old ?? null)) body[k] = v; };
  set("program", f.program, a.program);
  set("mode", f.mode, a.mode);
  set("name", f.name.trim(), a.name);
  set("pic", f.pic.trim() || null, a.pic);
  if (f.date !== toDateInput(a.date)) body.date = fromDateInput(f.date);
  set("phase", f.phase || null, a.phase);
  set("location", f.location.trim() || null, a.location);
  if (f.mode === "ongoing") {
    Object.assign(body, lists(f));
    set("achievementValue", numOrNull(f.achievementValue), a.achievementValue);
    set("feedback", numOrNull(f.feedback), a.feedback);
    set("progress", f.progress || null, a.progress);
  }
  return body;
}

export function ActivityForm({ open, activity, defaultProgram, initialMode, onClose }) {
  const session = useAuthStore((s) => s.session);
  const programs = useMemo(() => editablePrograms(session), [session]);
  const initialProgram = programs.some((p) => p.api === defaultProgram) ? defaultProgram : programs[0]?.api || "";
  const [f, setF] = useState(() => formFrom(activity, session, initialProgram));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (open) {
      const base = formFrom(activity, session, initialProgram);
      setF(initialMode ? { ...base, mode: initialMode } : base);
      setErr("");
    }
  }, [open, activity]);

  const isEdit = !!activity;
  const set = (patch) => setF((cur) => ({ ...cur, ...patch }));
  const field = (k) => ({ value: f[k], onChange: (e) => set({ [k]: e.target.value }) });
  const updRow = (list, id, patch) => setF((cur) => ({ ...cur, [list]: cur[list].map((x) => (x.uid === id ? { ...x, ...patch } : x)) }));
  const delRow = (list, id) => setF((cur) => ({ ...cur, [list]: cur[list].filter((x) => x.uid !== id) }));
  const addRow = (list, row) => setF((cur) => ({ ...cur, [list]: [...cur[list], row] }));
  const att = attendance(f.participants.map((p) => ({ registered: Number(p.registered) || 0, present: Number(p.present) || 0 })));

  async function uploadSK(s, file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast("File SK maksimal 10 MB.", "err");
    updRow("hr", s.uid, { skBusy: true });
    try {
      const out = await upload("/sk", file, "sk");
      updRow("hr", s.uid, { skId: out.data.skId, skName: file.name, skUrl: "", skBusy: false });
    } catch (e) {
      updRow("hr", s.uid, { skBusy: false });
      toast(e.message === "File SK tidak valid. Periksa kembali isiannya." ? "File SK harus PDF, DOC, atau DOCX (maks. 10 MB)." : e.message, "err");
    }
  }

  async function save(again) {
    const problem = validate(f);
    if (problem) { setErr(problem); return; }
    setErr(""); setBusy(true);
    try {
      if (isEdit) {
        const body = buildPatch(f, activity);
        if (Object.keys(body).length) await api("/activity/" + activity.id, { method: "PATCH", body });
        toast("Perubahan kegiatan disimpan.");
      } else {
        await api("/activity", { method: "POST", body: buildCreate(f) });
        toast(`"${f.name.trim()}" ditambahkan.`);
      }
      invalidate("/activities", "/dashboard");
      if (again) setF((cur) => ({ ...formFrom(null, session, cur.program), mode: cur.mode, pic: cur.pic }));
      else onClose();
    } catch (e) {
      setErr(e.message);
    } finally { setBusy(false); }
  }

  const footer = (
    <>
      {err && <div className="foot-err" role="alert"><Icon name="alert" size={16} />{err}</div>}
      <span className="grow" />
      <button type="button" className="btn" onClick={onClose} disabled={busy}>Batal</button>
      {!isEdit && <button type="button" className="btn" onClick={() => save(true)} disabled={busy}>Simpan &amp; tambah lagi</button>}
      <button type="button" className="btn btn-primary" onClick={() => save(false)} disabled={busy}>{busy && <Spinner />}{isEdit ? "Simpan perubahan" : "Simpan"}</button>
    </>
  );

  return (
    <Sheet open={open} onClose={onClose} wide title={isEdit ? "Ubah kegiatan" : "Tambah kegiatan"}
      sub={isEdit ? activity.name : "Isi data kegiatan program. Kolom bertanda * wajib diisi."} footer={footer}>
      <form className="form" onSubmit={(e) => { e.preventDefault(); save(false); }}>
        <div className="form-sec">
          <span className="field-lab">Jenis data</span>
          <Segmented label="Jenis data" value={f.mode} onChange={(v) => set({ mode: v })}
            options={[["ongoing", "Kegiatan berlangsung"], ["upcoming", "Agenda mendatang"]]} />
          <p className="hint">{f.mode === "upcoming"
            ? "Agenda yang belum terlaksana. Cukup isi nama, tanggal, dan fase; data peserta diisi saat kegiatan berlangsung."
            : "Kegiatan yang sedang atau sudah berjalan, lengkap dengan peserta, SDM, isu, dan penilaian."}</p>
        </div>

        <div className="form-grid">
          <label className="field"><span className="field-lab">Program *</span>
            <select {...field("program")}>{programs.map((p) => <option key={p.api} value={p.api}>{p.label}</option>)}</select>
          </label>
          <label className="field"><span className="field-lab">PIC</span>
            <input type="text" placeholder="nama PIC" {...field("pic")} />
          </label>
          <label className="field span-2"><span className="field-lab">Nama kegiatan *</span>
            <input type="text" placeholder="mis. Kelas SIAP 6–10 Juli" required {...field("name")} />
          </label>
          <label className="field"><span className="field-lab">Tanggal kegiatan</span>
            <input type="date" {...field("date")} />
          </label>
          <label className="field"><span className="field-lab">Fase</span>
            <select {...field("phase")}><option value="">– Pilih fase –</option>{PHASES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </label>
          <label className="field span-2"><span className="field-lab">Lokasi / alamat</span>
            <input type="text" placeholder="mis. Aula Barat ITB atau Daring" {...field("location")} />
          </label>
        </div>

        {f.mode === "ongoing" && (
          <>
            <fieldset className="form-sec">
              <legend>Peserta</legend>
              <div className="dyn-head"><span>Kategori</span><span>Terdaftar</span><span>Hadir</span><span /></div>
              {f.participants.map((p) => (
                <div className="dyn-row" key={p.uid}>
                  <input aria-label="Kategori peserta" placeholder="mis. SMA" value={p.category} onChange={(e) => updRow("participants", p.uid, { category: e.target.value })} />
                  <input aria-label="Jumlah terdaftar" type="number" min="0" inputMode="numeric" placeholder="0" value={p.registered} onChange={(e) => updRow("participants", p.uid, { registered: e.target.value })} />
                  <input aria-label="Jumlah hadir" type="number" min="0" inputMode="numeric" placeholder="0" value={p.present} onChange={(e) => updRow("participants", p.uid, { present: e.target.value })} />
                  <button type="button" className="icon-btn danger" aria-label="Hapus baris peserta" onClick={() => delRow("participants", p.uid)}><Icon name="x" size={16} /></button>
                </div>
              ))}
              <div className="dyn-foot">
                <button type="button" className="btn btn-sm" onClick={() => addRow("participants", newPeserta())}><Icon name="plus" size={15} />Tambah kategori</button>
                <span className="hint">Kehadiran: <b>{att.pct === null ? "–" : att.pct + "%"}</b> {att.reg > 0 && `(${att.pres} dari ${att.reg})`} · dihitung otomatis</span>
              </div>
            </fieldset>

            <fieldset className="form-sec">
              <legend>SDM terlibat</legend>
              {f.hr.map((s) => (
                <div className="sdm-block" key={s.uid}>
                  <div className="sdm-grid">
                    <label className="field"><span className="field-lab">Peran</span>
                      <select value={s.posSel} onChange={(e) => updRow("hr", s.uid, { posSel: e.target.value })}>
                        {SDM_POSITIONS.map((p) => <option key={p}>{p}</option>)}
                        <option value={LAINNYA}>Lainnya…</option>
                      </select>
                    </label>
                    {s.posSel === LAINNYA && (
                      <label className="field"><span className="field-lab">Nama peran</span>
                        <input placeholder="mis. Pamong" value={s.posCustom} onChange={(e) => updRow("hr", s.uid, { posCustom: e.target.value })} />
                      </label>
                    )}
                    <button type="button" className="icon-btn danger sdm-del" aria-label="Hapus peran" onClick={() => delRow("hr", s.uid)}><Icon name="trash" size={16} /></button>
                  </div>
                  <label className="field">
                    <span className="field-lab">Daftar nama <span className="muted">({splitPeople(s.names).length} orang · pisahkan dengan Enter atau koma)</span></span>
                    <textarea rows={3} placeholder={"Budi Santoso\nSari Dewi"} value={s.names} onChange={(e) => updRow("hr", s.uid, { names: e.target.value })} />
                  </label>
                  <div className="sk-row">
                    <label className="btn btn-sm file-btn">
                      {s.skBusy ? <Spinner /> : <Icon name="upload" size={15} />}{s.skId ? "Ganti SK" : "Unggah SK"}
                      <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                        hidden disabled={s.skBusy} onChange={(e) => uploadSK(s, e.target.files[0])} />
                    </label>
                    {s.skId
                      ? (s.skUrl ? <a className="sk-link" href={s.skUrl} target="_blank" rel="noreferrer"><Icon name="file" size={14} />{s.skName || "SK"}</a>
                        : <span className="sk-link"><Icon name="checkCircle" size={14} />{s.skName}</span>)
                      : <span className="hint">Opsional · PDF/DOC/DOCX, maks. 10 MB</span>}
                    {s.skId && <button type="button" className="link-btn" onClick={() => updRow("hr", s.uid, { skId: null, skName: "", skUrl: "" })}>Lepas</button>}
                  </div>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => addRow("hr", newSdm())}><Icon name="plus" size={15} />Tambah peran</button>
            </fieldset>

            <fieldset className="form-sec">
              <legend>Isu &amp; peringatan</legend>
              <p className="hint">Isi hanya jika ada masalah. Kosongkan kalau kegiatan berjalan lancar.</p>
              {f.issues.map((i) => (
                <div className={"issue-edit lv-" + i.level} key={i.uid}>
                  <div className="form-grid">
                    <label className="field"><span className="field-lab">Level</span>
                      <select value={i.level} onChange={(e) => updRow("issues", i.uid, { level: e.target.value })}>
                        {ISSUE_LEVELS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
                      </select>
                    </label>
                    <label className="field"><span className="field-lab">Nama isu</span>
                      <input placeholder="mis. Jadwal bentrok" value={i.name} onChange={(e) => updRow("issues", i.uid, { name: e.target.value })} />
                    </label>
                    <label className="field"><span className="field-lab">Dengan pihak</span>
                      <input placeholder="mis. sekolah / mitra" value={i.to} onChange={(e) => updRow("issues", i.uid, { to: e.target.value })} />
                    </label>
                    <label className="field"><span className="field-lab">Penanganan</span>
                      <input placeholder="langkah yang diambil" value={i.problemSolving} onChange={(e) => updRow("issues", i.uid, { problemSolving: e.target.value })} />
                    </label>
                  </div>
                  <button type="button" className="link-btn danger" onClick={() => delRow("issues", i.uid)}><Icon name="trash" size={14} />Hapus isu</button>
                </div>
              ))}
              <button type="button" className="btn btn-sm" onClick={() => addRow("issues", newIssue())}><Icon name="plus" size={15} />Tambah isu</button>
            </fieldset>

            <fieldset className="form-sec">
              <legend>Penilaian</legend>
              <div className="form-grid three">
                <label className="field"><span className="field-lab">Nilai capaian (0–100)</span>
                  <input type="number" min="0" max="100" inputMode="numeric" placeholder="80" {...field("achievementValue")} />
                </label>
                <label className="field"><span className="field-lab">Umpan balik (0–100)</span>
                  <input type="number" min="0" max="100" inputMode="numeric" placeholder="85" {...field("feedback")} />
                </label>
                <label className="field"><span className="field-lab">Keberjalanan</span>
                  <select {...field("progress")}><option value="">– Pilih –</option>{PROGRESS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
                </label>
              </div>
            </fieldset>
          </>
        )}
        <button type="submit" hidden />
      </form>
    </Sheet>
  );
}
