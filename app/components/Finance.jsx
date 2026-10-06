// Tabel transaksi Keuangan (PKS & pengajuan) + form tambah/ubah.
import { useEffect, useState } from "react";
import { FIN_PROGRAMS, PKS_TYPES } from "../config.js";
import { api } from "../lib/api.js";
import {
  canEditFinance, finProgramLabel, finTypeLabel, fmtDate, fmtDateTime, fmtRelative, fmtRupiah, fromDateInput, isPks, toDateInput,
} from "../lib/format.js";
import { useAuthStore } from "../stores/auth.js";
import { invalidate, useApi } from "../stores/data.js";
import { confirmAction, toast } from "./feedback.jsx";
import { Icon } from "./Icon.jsx";
import { ExportButton, ImportButton } from "./ImportExport.jsx";
import { EmptyState, ErrorNote, Pagination, SearchInput, Segmented, Sheet, Skeleton, Spinner } from "./ui.jsx";

const SORTS = [
  ["date:desc", "Tanggal (terbaru)"], ["date:asc", "Tanggal (terlama)"],
  ["createdAt:desc", "Terbaru diinput"], ["createdAt:asc", "Terlama diinput"],
  ["balance:desc", "Saldo tertinggi"], ["balance:asc", "Saldo terendah"],
];

export const refreshFinance = () => invalidate("/financial", "/dashboard/financial");

function TypeChip({ r }) {
  return <span className={"ftype " + (isPks(r) ? "pks" : "sub")}>{finTypeLabel(r.type)}</span>;
}
const amountOf = (r) => (isPks(r) ? r.pksValue : r.submissionValue) || 0;
const detailOf = (r) => (isPks(r) ? r.information : r.description) || "";
const subOf = (r) => (isPks(r)
  ? [r.pksType && `Jenis ${r.pksType}`].filter(Boolean)
  : [r.submissionType, r.invoiceNumber && `Invoice ${r.invoiceNumber}`].filter(Boolean)).join(" · ");

/** filters: { programs, year, month, submissionType } dari halaman Keuangan. */
export function FinanceTable({ filters, ui, update }) {
  const session = useAuthStore((s) => s.session);
  const canEdit = canEditFinance(session);
  const [sortBy, sortOrder] = ui.sort.split(":");
  const query = { ...filters, page: ui.page, perPage: ui.perPage, search: ui.search, sortBy, sortOrder };
  const { data, error, loading, reload } = useApi("/financial", query);
  const rows = data?.data?.records || [];
  const pagination = data?.data?.pagination;
  const [selected, setSelected] = useState(() => new Set());
  const [form, setForm] = useState(null);   // { kind, record }

  useEffect(() => { setSelected(new Set()); }, [ui.page, ui.perPage, ui.search, ui.sort, JSON.stringify(filters)]);
  useEffect(() => {
    if (pagination && pagination.totalPages > 0 && ui.page > pagination.totalPages) update({ page: pagination.totalPages });
  }, [pagination?.totalPages]);

  const allOn = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const showProgram = !(filters.programs.length === 1 && filters.programs[0] !== "all");

  async function remove(r) {
    const ok = await confirmAction({
      title: "Hapus transaksi ini?", danger: true, confirmText: "Hapus",
      body: `${finTypeLabel(r.type)} ${fmtRupiah(amountOf(r))} (${fmtDate(r.date)}) akan dihapus. Saldo program dihitung ulang otomatis.`,
    });
    if (!ok) return;
    try { await api("/financial/" + r.id, { method: "DELETE" }); toast("Transaksi dihapus."); refreshFinance(); }
    catch (e) { toast(e.message, "err"); }
  }
  async function bulkDelete() {
    const ids = [...selected];
    const ok = await confirmAction({
      title: `Hapus ${ids.length} transaksi?`, danger: true, confirmText: `Hapus ${ids.length} transaksi`,
      body: "Transaksi terpilih dihapus permanen dan saldo program dihitung ulang.",
    });
    if (!ok) return;
    try {
      await api("/financial", { method: "DELETE", body: { financialIds: ids } });
      toast(`${ids.length} transaksi dihapus.`); setSelected(new Set()); refreshFinance();
    } catch (e) { toast(e.message, "err"); }
  }

  const singleProgram = filters.programs.length === 1 && filters.programs[0] !== "all" ? filters.programs[0] : "";
  const exportPath = "/financial/export" + (singleProgram ? "/" + singleProgram : "");

  return (
    <section className="card tbl-card">
      <div className="tbl-head">
        <div>
          <h2 className="card-title">Transaksi</h2>
          <div className="card-sub">{pagination ? `${pagination.totalRecords.toLocaleString("id-ID")} transaksi PKS & pengajuan` : "Memuat…"}</div>
        </div>
        <div className="tbl-actions">
          {canEdit && (
            <ImportButton path={"/financial/import" + (singleProgram ? "/" + singleProgram : "")}
              hint="Unggah .xlsx/.csv dengan format yang sama seperti file Ekspor"
              describe={(d) => `${d.importedCount ?? 0} transaksi diimpor.`} onDone={refreshFinance} />
          )}
          <ExportButton path={exportPath} filename="keuangan.xlsx"
            query={{ ...filters, search: ui.search, sortBy, sortOrder }} />
          {canEdit && (
            <>
              <button type="button" className="btn keep-txt" onClick={() => setForm({ kind: "pks", record: null })}><Icon name="plus" size={16} /><span className="btn-txt">PKS</span></button>
              <button type="button" className="btn btn-primary" onClick={() => setForm({ kind: "submission", record: null })}><Icon name="plus" size={16} /><span className="btn-txt">Pengajuan</span></button>
            </>
          )}
        </div>
      </div>

      <div className="tbl-toolbar">
        <SearchInput value={ui.search} onChange={(v) => update({ search: v, page: 1 })} placeholder="Cari uraian, keterangan, invoice, atau PIC" />
        <select className="tb-select" value={ui.sort} onChange={(e) => update({ sort: e.target.value, page: 1 })} aria-label="Urutkan">
          {SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
      </div>

      {selected.size > 0 && (
        <div className="bulkbar" role="region" aria-label="Tindakan untuk data terpilih">
          <span><b>{selected.size}</b> transaksi dipilih</span>
          <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())}>Batal pilih</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={bulkDelete}><Icon name="trash" size={15} />Hapus</button>
        </div>
      )}

      <ErrorNote error={error} onRetry={() => reload()} />

      {!data && loading ? (
        <div className="tbl-skel">{Array.from({ length: 5 }, (_, i) => <div key={i} className="tbl-skel-row"><Skeleton h={14} w={90} /><Skeleton h={22} w={110} r={11} /><Skeleton h={14} w="40%" /><Skeleton h={14} w={120} /></div>)}</div>
      ) : rows.length === 0 && !error ? (
        ui.search
          ? <EmptyState icon="search" title={`Tidak ada transaksi yang cocok dengan "${ui.search}"`}
              action={<button type="button" className="btn btn-sm" onClick={() => update({ search: "", page: 1 })}>Hapus pencarian</button>} />
          : <EmptyState title="Belum ada transaksi untuk filter ini">
              {canEdit ? "Tambahkan PKS lebih dulu, lalu catat setiap pengajuan dana." : "Transaksi yang dicatat tim Keuangan akan tampil di sini."}
            </EmptyState>
      ) : (
        <div className={"tbl-body" + (loading ? " is-loading" : "")} aria-busy={loading}>
          <div className="tbl-scroll">
            <table className="tbl fin-tbl">
              <thead>
                <tr>
                  {canEdit && <th className="c-check"><input type="checkbox" checked={allOn} onChange={() => setSelected(allOn ? new Set() : new Set(rows.map((r) => r.id)))} aria-label="Pilih semua di halaman ini" /></th>}
                  <th className="c-date">Tanggal</th>
                  <th className="c-type">Jenis</th>
                  <th className="c-name">Keterangan</th>
                  <th className="num c-amt">Nilai</th>
                  <th className="num c-dpks">DPKS</th>
                  <th className="num c-bal">Saldo</th>
                  <th className="c-pic">PIC</th>
                  <th className="c-created">Diinput</th>
                  {canEdit && <th className="c-act"><span className="sr-only">Aksi</span></th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={selected.has(r.id) ? "sel" : ""}>
                    {canEdit && <td className="c-check"><input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Pilih transaksi" /></td>}
                    <td className="c-date">{fmtDate(r.date)}</td>
                    <td className="c-type"><TypeChip r={r} /></td>
                    <td className="c-name">
                      <div className="cell-strong">{detailOf(r) || <span className="muted">Tanpa keterangan</span>}</div>
                      <div className="row-meta">{showProgram && <span className="ptag">{finProgramLabel(r.program)}</span>}{subOf(r) && <span>{subOf(r)}</span>}</div>
                    </td>
                    <td className={"num c-amt " + (isPks(r) ? "pos" : "neg")}>{isPks(r) ? "+" : "−"}{fmtRupiah(amountOf(r))}</td>
                    <td className="num c-dpks">{isPks(r) ? <>{fmtRupiah(r.dpks)}<span className="muted"> · {r.dpksPercentage ?? 0}%</span></> : <span className="muted">–</span>}</td>
                    <td className="num c-bal">{fmtRupiah(r.balance)}</td>
                    <td className="c-pic"><span className="trunc">{r.pic}</span></td>
                    <td className="c-created" title={fmtDateTime(r.createdAt)}>{fmtRelative(r.createdAt)}</td>
                    {canEdit && (
                      <td className="c-act">
                        <div className="row-actions">
                          <button type="button" className="icon-btn" title="Ubah" aria-label="Ubah transaksi" onClick={() => setForm({ kind: isPks(r) ? "pks" : "submission", record: r })}><Icon name="pencil" size={16} /></button>
                          <button type="button" className="icon-btn danger" title="Hapus" aria-label="Hapus transaksi" onClick={() => remove(r)}><Icon name="trash" size={16} /></button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <ul className="rec-list">
            {rows.map((r) => (
              <li key={r.id} className={"rec" + (selected.has(r.id) ? " sel" : "")}>
                {canEdit && <input type="checkbox" className="rec-check" checked={selected.has(r.id)} onChange={() => toggle(r.id)} aria-label="Pilih transaksi" />}
                <button type="button" className="rec-main" disabled={!canEdit} onClick={() => setForm({ kind: isPks(r) ? "pks" : "submission", record: r })}>
                  <span className="rec-top"><span className="rec-name">{detailOf(r) || finTypeLabel(r.type)}</span>
                    <span className={"rec-amt " + (isPks(r) ? "pos" : "neg")}>{isPks(r) ? "+" : "−"}{fmtRupiah(amountOf(r))}</span></span>
                  <span className="rec-meta"><TypeChip r={r} /><span>{fmtDate(r.date)}</span>{showProgram && <span>{finProgramLabel(r.program)}</span>}</span>
                  <span className="rec-meta"><span>Saldo {fmtRupiah(r.balance)}</span>{subOf(r) && <span>{subOf(r)}</span>}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Pagination pagination={pagination} perPage={ui.perPage} noun="transaksi"
        onPage={(p) => update({ page: p })} onPerPage={(n) => update({ perPage: n, page: 1 })} />

      <FinanceForm open={!!form} kind={form?.kind} record={form?.record} defaultProgram={singleProgram}
        onClose={() => setForm(null)} onDelete={form?.record ? () => { const r = form.record; setForm(null); remove(r); } : null} />
    </section>
  );
}

// --------------------------------------------------------------- form ---
function MoneyInput({ value, onChange, placeholder, label }) {
  const shown = value === "" ? "" : Number(value).toLocaleString("id-ID");
  return (
    <div className="money">
      <span>Rp</span>
      <input type="text" inputMode="numeric" aria-label={label} placeholder={placeholder} value={shown}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").replace(/^0+(?=\d)/, ""))} />
    </div>
  );
}

const today = () => toDateInput(new Date());

function formFrom(kind, r, program, session) {
  if (!r) {
    return kind === "pks"
      ? { program, type: "initial_pks", pksType: "Pm", value: "", date: today(), text: "", pic: session?.name || "" }
      : { program, date: today(), invoiceNumber: "", submissionType: "", text: "", value: "", pic: session?.name || "" };
  }
  return isPks(r)
    ? { program: r.program, type: r.type, pksType: r.pksType || "Pm", value: String(r.pksValue ?? ""), date: toDateInput(r.date), text: r.information || "", pic: r.pic || "" }
    : { program: r.program, date: toDateInput(r.date), invoiceNumber: r.invoiceNumber || "", submissionType: r.submissionType || "", text: r.description || "", value: String(r.submissionValue ?? ""), pic: r.pic || "" };
}

function FinanceForm({ open, kind, record, defaultProgram, onClose, onDelete }) {
  const session = useAuthStore((s) => s.session);
  const types = useApi("/dashboard/financial", {}, { enabled: open && kind === "submission" }).data?.data?.filterOptions?.submissionTypes || [];
  const program0 = defaultProgram || FIN_PROGRAMS[0].api;
  const [f, setF] = useState(() => formFrom(kind, record, program0, session));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  useEffect(() => { if (open) { setF(formFrom(kind, record, program0, session)); setErr(""); } }, [open, kind, record]);

  const isEdit = !!record, isPksForm = kind === "pks";
  const field = (k) => ({ value: f[k] ?? "", onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const persen = PKS_TYPES.find(([v]) => v === f.pksType)?.[2] ?? 0;
  const value = Number(f.value) || 0;

  async function save() {
    if (!value) return setErr(isPksForm ? "Isi nilai PKS." : "Isi nilai pengajuan.");
    if (!f.date) return setErr("Isi tanggal.");
    setErr(""); setBusy(true);
    const date = fromDateInput(f.date);
    try {
      if (!isEdit) {
        const body = isPksForm
          ? { program: f.program, type: f.type, pksType: f.pksType, pksValue: value, date, ...(f.text.trim() ? { information: f.text.trim() } : {}) }
          : { program: f.program, date, submissionValue: value,
              ...(f.invoiceNumber.trim() ? { invoiceNumber: f.invoiceNumber.trim() } : {}),
              ...(f.submissionType.trim() ? { submissionType: f.submissionType.trim() } : {}),
              ...(f.text.trim() ? { description: f.text.trim() } : {}) };
        if (f.pic.trim()) body.pic = f.pic.trim();
        const out = await api(isPksForm ? "/financial/pks" : "/financial/submission", { method: "POST", body });
        toast(`${isPksForm ? "PKS" : "Pengajuan"} tersimpan. Saldo ${finProgramLabel(f.program)} kini ${fmtRupiah(out.data?.balance)}.`);
      } else {
        const r = record, body = {};
        const set = (k, v, old) => { if ((v ?? "") !== (old ?? "")) body[k] = v; };
        set("program", f.program, r.program);
        set("pic", f.pic.trim(), r.pic);
        if (f.date !== toDateInput(r.date)) body.date = date;
        if (isPksForm) {
          set("pksType", f.pksType, r.pksType);
          if (value !== r.pksValue) body.pksValue = value;
          set("information", f.text.trim(), r.information);
        } else {
          if (value !== r.submissionValue) body.submissionValue = value;
          set("invoiceNumber", f.invoiceNumber.trim(), r.invoiceNumber);
          set("submissionType", f.submissionType.trim(), r.submissionType);
          set("description", f.text.trim(), r.description);
        }
        // backend tidak menerima string kosong -> lewati kolom teks yang dikosongkan
        Object.keys(body).forEach((k) => { if (body[k] === "") delete body[k]; });
        if (Object.keys(body).length) await api("/financial/" + r.id, { method: "PATCH", body });
        toast("Perubahan transaksi disimpan.");
      }
      refreshFinance();
      onClose();
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  const title = (isEdit ? "Ubah " : "Tambah ") + (isPksForm ? (isEdit ? finTypeLabel(record.type) : "PKS") : "pengajuan");
  return (
    <Sheet open={open} onClose={onClose} title={title}
      sub={isPksForm ? "Nilai PKS menambah dana program; DPKS dipotong otomatis sesuai jenis PKS." : "Setiap pengajuan mengurangi saldo program."}
      footer={(
        <>
          {err && <div className="foot-err" role="alert"><Icon name="alert" size={16} />{err}</div>}
          {isEdit && onDelete && <button type="button" className="btn btn-danger-ghost" onClick={onDelete} disabled={busy}><Icon name="trash" size={16} />Hapus</button>}
          <span className="grow" />
          <button type="button" className="btn" onClick={onClose} disabled={busy}>Batal</button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={busy}>{busy && <Spinner />}Simpan</button>
        </>
      )}>
      {open && (
        <form className="form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          {isPksForm && !isEdit && (
            <div className="form-sec">
              <span className="field-lab">Jenis</span>
              <Segmented label="Jenis PKS" value={f.type} onChange={(v) => setF({ ...f, type: v })}
                options={[["initial_pks", "PKS Awal"], ["addition_pks", "Penambahan PKS"]]} />
              <p className="hint">PKS Awal hanya sekali per program. Tambahan dana berikutnya dicatat sebagai Penambahan PKS.</p>
            </div>
          )}
          <div className="form-grid">
            <label className="field"><span className="field-lab">Program</span>
              <select {...field("program")}>{FIN_PROGRAMS.map((p) => <option key={p.api} value={p.api}>{p.label}</option>)}</select>
            </label>
            <label className="field"><span className="field-lab">{isPksForm ? "Tanggal PKS" : "Tanggal pengajuan"}</span>
              <input type="date" required {...field("date")} />
            </label>
            {isPksForm ? (
              <>
                <label className="field"><span className="field-lab">Jenis PKS</span>
                  <select {...field("pksType")}>{PKS_TYPES.map(([v, t, p]) => <option key={v} value={v}>{t} (DPKS {p}%)</option>)}</select>
                </label>
                <label className="field"><span className="field-lab">Nilai PKS</span>
                  <MoneyInput label="Nilai PKS" value={f.value} onChange={(v) => setF({ ...f, value: v })} placeholder="100.000.000" />
                </label>
                <div className="calc span-2">
                  <span>DPKS {persen}%</span><b>{fmtRupiah(Math.round(value * persen / 100))}</b>
                  <span>Dana bersih</span><b>{fmtRupiah(value - Math.round(value * persen / 100))}</b>
                </div>
                <label className="field span-2"><span className="field-lab">Keterangan</span>
                  <input type="text" placeholder="opsional, mis. PKS Awal SIAP ITB" {...field("text")} />
                </label>
              </>
            ) : (
              <>
                <label className="field"><span className="field-lab">Nilai pengajuan</span>
                  <MoneyInput label="Nilai pengajuan" value={f.value} onChange={(v) => setF({ ...f, value: v })} placeholder="2.000.000" />
                </label>
                <label className="field"><span className="field-lab">No. invoice</span>
                  <input type="text" placeholder="opsional, mis. INV-001" {...field("invoiceNumber")} />
                </label>
                <label className="field"><span className="field-lab">Jenis pengajuan</span>
                  <input type="text" list="fin-types" placeholder="mis. Konsumsi (kosong = Lainnya)" {...field("submissionType")} />
                  <datalist id="fin-types">{types.map((t) => <option key={t} value={t} />)}</datalist>
                </label>
                <label className="field span-2"><span className="field-lab">Uraian</span>
                  <input type="text" placeholder="mis. Snack peserta hari 1" {...field("text")} />
                </label>
              </>
            )}
            <label className="field span-2"><span className="field-lab">PIC</span>
              <input type="text" placeholder="kosongkan untuk memakai email akun Anda" {...field("pic")} />
            </label>
          </div>
          {isEdit && <p className="hint">Diinput {fmtDateTime(record.createdAt)}. Saldo dihitung ulang otomatis setelah disimpan.</p>}
          <button type="submit" hidden />
        </form>
      )}
    </Sheet>
  );
}
