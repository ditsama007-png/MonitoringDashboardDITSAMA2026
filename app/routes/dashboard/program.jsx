import { useMemo } from "react";
import { data, Link, useFetcher } from "react-router";
import { Gantt } from "../../components/Gantt.jsx";
import { EmptyRow, Kpi, ProgramAbout, StatusBadge } from "../../components/ui.jsx";
import { PROGRAMS } from "../../config.js";
import { apiPost, HAS_API } from "../../lib/api.js";
import {
  flexToStd, fmtTanggal, ongoingItems, parseTgl, rowIsProgram, statusOf, upcomingMilestones,
} from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";
import { useDataStore } from "../../stores/data.js";

export function clientLoader({ params }) {
  const program = PROGRAMS.find((p) => p.key === params.programKey);
  if (!program) throw data(`Program "${params.programKey}" tidak dikenal.`, { status: 404 });
  return { program };
}

// Tandai Selesai / Hapus kegiatan, lalu muat ulang DataMasuk.
export async function clientAction({ request }) {
  const { intent, id } = await request.json();
  const session = useAuthStore.getState().session;
  if (!session) return { ok: false, message: "Sesi habis, silakan login ulang." };
  if (!HAS_API) return { ok: false, message: "Mode contoh — tidak terhubung ke Sheets." };
  try {
    const out = intent === "selesai"
      ? await apiPost({ action: "update_flex", token: session.token, id, record: { "Status Manual": "Selesai" } })
      : await apiPost({ action: "delete_flex", token: session.token, id });
    if (!out.ok) {
      return {
        ok: false,
        message: intent === "selesai" ? "Gagal: " + (out.error || "")
          : "❌ Gagal hapus: " + (out.error || "tidak diketahui") + ". Kemungkinan Code.gs versi lama — pastikan sudah deploy Code.gs terbaru (ada fungsi delete_flex).",
      };
    }
    await useDataStore.getState().loadFlex();
    return { ok: true, message: intent === "selesai" ? "✅ Kegiatan ditandai selesai." : "✅ Kegiatan berhasil dihapus." };
  } catch {
    return { ok: false, message: "❌ Gagal terhubung ke server." };
  }
}

export default function ProgramDashboard({ loaderData }) {
  const { program } = loaderData;
  const key = program.key;
  const flex = useDataStore((s) => s.flex);
  const rawRows = useMemo(() => flex.rows.filter((r) => rowIsProgram(r, key)), [flex.rows, key]);
  const rows = useMemo(() => rawRows.map(flexToStd), [rawRows]);

  const total = rows.filter((r) => (r.kegiatan || "").trim()).length;
  const selesai = rows.filter((r) => (r.kegiatan || "").trim() && r.status === "Selesai").length;

  return (
    <section id="view-program">
      <h1 className="title">{program.fullName}<span className="title-abbr">{program.label}</span></h1>
      <ProgramAbout program={program} />
      <div className="kpi-row">
        <Kpi value={total > 0 ? Math.round(selesai / total * 100) + "%" : "0%"} label="Progress Program" />
        <Kpi value={rows.filter((r) => r.status === "Upcoming").length} label="Total Upcoming" />
        <Kpi value={rows.filter((r) => r.status === "On-Going").length} label="Total On-Going" />
        <Kpi value={selesai} label="Total Selesai" />
      </div>
      <ProgramMilestones programKey={key} flexRows={flex.rows} />
      <div className="card">
        <h3>Timeline Fase Kegiatan</h3>
        <div className="sub">Rentang tiap fase berdasarkan tanggal kegiatan (dari Data Masuk)</div>
        <Gantt items={rawRows
          .map((r) => ({ d: parseTgl(r["Tanggal Kegiatan"]), fase: String(r["Fase Kegiatan"] || "").trim() }))
          .filter((x) => x.fase && x.d)} />
      </div>
      <div className="card">
        <h3>Data Program</h3>
        <ProgramTable header={flex.header} rows={rawRows} label={program.label} />
      </div>
    </section>
  );
}

// kartu On-Going & Upcoming Milestone + tombol Isi / Selesai / Hapus
function ProgramMilestones({ programKey, flexRows }) {
  const fetcher = useFetcher();
  const ongoing = ongoingItems(flexRows, programKey);
  const upcoming = upcomingMilestones(flexRows, programKey);
  const busyId = fetcher.state !== "idle" ? fetcher.json?.id : null;

  const submit = (intent, id) => {
    if (intent === "delete") {
      if (!id) { alert("Baris ini tidak punya ID, tidak bisa dihapus otomatis. Hapus manual di sheet."); return; }
      if (!confirm("Hapus kegiatan ini secara permanen dari data? Tindakan ini tidak bisa dibatalkan.")) return;
    }
    if (!id) return;
    fetcher.submit({ intent, id }, { method: "post", encType: "application/json" });
  };

  const row = (r) => {
    const id = String(r["ID"] || "");
    return (
      <div className="ms-row" key={id || r["Nama Kegiatan"]} style={busyId && busyId === id ? { opacity: 0.5 } : undefined}>
        <div><b>{r["Nama Kegiatan"] || "(tanpa nama)"}</b>
          <div className="sub">📅 {r["Tanggal Kegiatan"] ? fmtTanggal(r["Tanggal Kegiatan"]) : "(belum ada tanggal)"}</div>
        </div>
        <div style={{ whiteSpace: "nowrap" }}>
          <Link className="mini-btn ok ms-fill" to={`/dashboard/input?program=${programKey}&fill=${encodeURIComponent(id)}`}>✍ Isi data</Link>{" "}
          <button type="button" className="mini-btn ms-done" style={{ background: "#16A34A", color: "#fff", borderColor: "#16A34A" }}
            onClick={() => submit("selesai", id)}>✅ Selesai</button>{" "}
          <button type="button" className="mini-btn ms-del" style={{ background: "#DC2626", color: "#fff", borderColor: "#DC2626" }}
            onClick={() => submit("delete", id)}>🗑 Hapus</button>
        </div>
      </div>
    );
  };

  const card = (title, list, color) => list.length > 0 && (
    <div className="card">
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>{title}</h3>
        <span className={"notif-badge " + color}>{list.length}</span>
      </div>
      {list.map(row)}
    </div>
  );

  return (
    <div>
      {fetcher.state === "idle" && fetcher.data && (
        <div className={"save-msg " + (fetcher.data.ok ? "ok" : "err")} style={{ display: "block", marginBottom: 8 }}>
          {fetcher.data.message}
        </div>
      )}
      {card("Sedang Berlangsung (On-Going)", ongoing, "red")}
      {card("Upcoming Milestone", upcoming, "yellow")}
    </div>
  );
}

// tabel program (read-only) dari DataMasuk
function ProgramTable({ header, rows, label }) {
  const cols = (header.length ? header : ["ID", "Waktu Input", "Program", "PIC"]).filter((h) => h !== "Mode");
  return (
    <div className="table-wrap"><table>
      <thead><tr><th>Status</th>{cols.map((h) => <th key={h}>{h}</th>)}</tr></thead>
      <tbody>
        {!rows.length && <EmptyRow cols={cols.length + 1}>Belum ada data untuk {label}.</EmptyRow>}
        {rows.map((r, i) => (
          <tr key={r["ID"] || i}>
            <td><StatusBadge status={statusOf(r)} /></td>
            {cols.map((h) => {
              const v = r[h] ?? "";
              return <td key={h}>{h === "Tanggal Kegiatan" ? fmtTanggal(v) : String(v)}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table></div>
  );
}
