// Tombol Impor (unggah .xlsx/.csv) dan Ekspor (unduh .xlsx) untuk tabel data.
import { useRef, useState } from "react";
import { download, upload } from "../lib/api.js";
import { toast } from "./feedback.jsx";
import { Icon } from "./Icon.jsx";
import { Spinner } from "./ui.jsx";

const ACCEPT = ".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv";

export function ExportButton({ path, query, filename, label = "Ekspor" }) {
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try { await download(path, query, filename); toast("File Excel diunduh."); }
    catch (e) { toast(e.message, "err"); }
    finally { setBusy(false); }
  };
  return (
    <button type="button" className="btn" onClick={run} disabled={busy} title="Unduh data sesuai filter & pencarian saat ini">
      {busy ? <Spinner /> : <Icon name="download" size={16} />}<span className="btn-txt">{label}</span>
    </button>
  );
}

/** onDone(data) dipanggil setelah impor berhasil; describe(data) -> teks toast. */
export function ImportButton({ path, onDone, describe, hint }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (file) => {
    if (!file) return;
    setBusy(true);
    try {
      const out = await upload(path, file);
      toast(describe ? describe(out.data || {}) : "Impor selesai.");
      onDone?.(out.data);
    } catch (e) { toast(e.message, "err"); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  };
  return (
    <>
      <button type="button" className="btn" onClick={() => ref.current?.click()} disabled={busy} title={hint}>
        {busy ? <Spinner /> : <Icon name="upload" size={16} />}<span className="btn-txt">{busy ? "Mengimpor…" : "Impor"}</span>
      </button>
      <input ref={ref} type="file" accept={ACCEPT} hidden onChange={(e) => pick(e.target.files[0])} />
    </>
  );
}
