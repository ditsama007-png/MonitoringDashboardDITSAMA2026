// Tabel Data Kegiatan (server: pencarian, urutan, halaman, hapus massal, impor/ekspor) + panel rincian.
import { useEffect, useMemo, useState } from "react";
import { PROGRAMS } from "../config.js";
import { api } from "../lib/api.js";
import {
  activityStatus, attendance, canEditActivity, editablePrograms, fmtDate, fmtDateLong, fmtDateTime, fmtRelative,
  levelLabel, phaseLabel, programLabel, progressLabel, skName, topIssueLevel,
} from "../lib/format.js";
import { useAuthStore } from "../stores/auth.js";
import { invalidate, useApi } from "../stores/data.js";
import { useUiStore } from "../stores/ui.js";
import { ActivityForm } from "./ActivityForm.jsx";
import { confirmAction, toast } from "./feedback.jsx";
import { Icon } from "./Icon.jsx";
import { ExportButton, ImportButton } from "./ImportExport.jsx";
import {
  Bar, EmptyState, ErrorNote, LevelBadge, Pagination, SearchInput, Sheet, Skeleton, Spinner, StatusBadge,
} from "./ui.jsx";

const SORTS = [
  ["createdAt:desc", "Terbaru diinput"], ["createdAt:asc", "Terlama diinput"],
  ["date:desc", "Tanggal kegiatan (terbaru)"], ["date:asc", "Tanggal kegiatan (terlama)"],
  ["achievementValue:desc", "Nilai capaian tertinggi"], ["feedback:desc", "Umpan balik tertinggi"],
];

export const refreshActivities = () => invalidate("/activities", "/dashboard");

// tindakan per kegiatan (dipakai tabel, kartu, panel rincian, dan dashboard program)
export function useActivityActions() {
  const [busyId, setBusyId] = useState(null);
  const run = async (id, fn, okText) => {
    setBusyId(id);
    try { await fn(); toast(okText); refreshActivities(); return true; }
    catch (e) { toast(e.message, "err"); return false; }
    finally { setBusyId(null); }
  };
  return {
    busyId,
    toggleDone: (a) => run(a.id, () => api("/activity/" + a.id, { method: "PATCH", body: { isDone: !a.isDone } }),
      a.isDone ? "Status selesai dibatalkan." : `"${a.name}" ditandai selesai.`),
    remove: async (a) => {
      const ok = await confirmAction({
        title: "Hapus kegiatan ini?", danger: true, confirmText: "Hapus",
        body: `"${a.name}" beserta data peserta, SDM, dan isunya akan dihapus permanen.`,
      });
      return ok && run(a.id, () => api("/activity/" + a.id, { method: "DELETE" }), "Kegiatan dihapus.");
    },
  };
}

function SortTh({ col, sort, onSort, className, children }) {
  const [by, dir] = sort.split(":");
  const on = by === col;
  return (
    <th className={className} aria-sort={on ? (dir === "asc" ? "ascending" : "descending") : "none"}>
      <button type="button" className={"th-sort" + (on ? " on" : "")} onClick={() => onSort(col + ":" + (on && dir === "desc" ? "asc" : "desc"))}>
        {children}<Icon name={on ? (dir === "asc" ? "arrowUp" : "arrowDown") : "sort"} size={13} />
      </button>
    </th>
  );
}

function Attendance({ participants, compact }) {
  const a = attendance(participants);
  if (!a.reg) return compact ? null : <span className="muted">–</span>;
  return (
    <span className={"att" + (compact ? " compact" : "")} title={`${a.pres} hadir dari ${a.reg} terdaftar`}>
      <Bar value={a.pct} tone={a.pct < 60 ? "warn" : ""} />
      <span className="num">{a.pres.toLocaleString("id-ID")}<span className="muted">/{a.reg.toLocaleString("id-ID")}</span></span>
    </span>
  );
}

function IssueCell({ issues }) {
  if (!issues?.length) return <span className="muted">–</span>;
  const lv = topIssueLevel(issues);
  return <span className={"iss-count lv-" + lv} title={`${issues.length} isu · terberat: ${levelLabel(lv)}`}><Icon name="alert" size={13} />{issues.length}</span>;
}

function ProgramTag({ api }) {
  return <span className="ptag">{programLabel(api)}</span>;
}

/**
 * fixedProgram: kode backend program (mis. "siap_itb") -> tabel hanya untuk program itu (dashboard program).
 */
export function ActivitiesTable({ fixedProgram, title = "Data Kegiatan", sub }) {
  const session = useAuthStore((s) => s.session);
  const stored = useUiStore((s) => s.act);
  const patch = useUiStore((s) => s.patch);
  const [local, setLocal] = useState({ program: fixedProgram, search: "", sort: "date:desc", page: 1, perPage: 10 });
  const st = fixedProgram ? local : stored;
  const update = (v) => fixedProgram ? setLocal((x) => ({ ...x, ...v })) : patch("act", v);

  const [selected, setSelected] = useState(() => new Set());
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(null);   // { activity } | { activity: null }
  const actions = useActivityActions();

  const programs = fixedProgram ? [fixedProgram]
    : st.program === "mine" ? (session?.programs?.length ? session.programs : ["all"])
    : st.program ? [st.program] : ["all"];
  const [sortBy, sortOrder] = st.sort.split(":");
  const query = { programs, page: st.page, perPage: st.perPage, search: st.search, sortBy, sortOrder };
  const { data, error, loading, fresh, reload } = useApi("/activities", query);
  const rows = data?.data || [];
  const pagination = data?.pagination;

  // halaman di luar jangkauan (mis. setelah hapus) -> mundur ke halaman terakhir
  useEffect(() => {
    if (pagination && pagination.totalPages > 0 && st.page > pagination.totalPages) update({ page: pagination.totalPages });
  }, [pagination?.totalPages]);
  useEffect(() => { setSelected(new Set()); }, [st.page, st.perPage, st.search, st.sort, st.program]);
  // rincian ikut diperbarui setelah data dimuat ulang
  useEffect(() => { if (detail) setDetail(rows.find((r) => r.id === detail.id) || detail); }, [data]);

  const editable = (a) => canEditActivity(session, a.program);
  const selectable = rows.filter(editable);
  const allOn = selectable.length > 0 && selectable.every((r) => selected.has(r.id));
  const toggle = (id) => setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => setSelected(allOn ? new Set() : new Set(selectable.map((r) => r.id)));

  async function bulkDelete() {
    const ids = [...selected];
    const ok = await confirmAction({
      title: `Hapus ${ids.length} kegiatan?`, danger: true, confirmText: `Hapus ${ids.length} kegiatan`,
      body: "Kegiatan terpilih beserta data peserta, SDM, dan isunya akan dihapus permanen.",
    });
    if (!ok) return;
    try {
      await api("/activities", { method: "DELETE", body: { activityIds: ids } });
      toast(`${ids.length} kegiatan dihapus.`);
      setSelected(new Set());
      refreshActivities();
    } catch (e) { toast(e.message, "err"); }
  }

  const canAdd = editablePrograms(session).length > 0 && (!fixedProgram || canEditActivity(session, fixedProgram));
  const programOptions = [["", "Semua program"], ...(session?.role === "pic" ? [["mine", "Program saya"]] : []),
    ...PROGRAMS.map((p) => [p.api, p.label])];
  const showProgram = !fixedProgram && programs.length !== 1;
  const searching = !!st.search;

  const openDetail = (a) => setDetail(a);
  const stop = (e) => e.stopPropagation();

  return (
    <section className="card tbl-card">
      <div className="tbl-head">
        <div>
          <h2 className="card-title">{title}</h2>
          <div className="card-sub">{sub || (pagination ? `${pagination.totalRecords.toLocaleString("id-ID")} kegiatan` : "Memuat…")}</div>
        </div>
        <div className="tbl-actions">
          <ImportButton path="/activity/import" hint="Unggah .xlsx/.csv dengan format yang sama seperti file Ekspor"
            describe={(d) => `${d.importedCount ?? 0} kegiatan diimpor` + (d.skippedCount ? `, ${d.skippedCount} dilewati (program di luar akses Anda).` : ".")}
            onDone={refreshActivities} />
          <ExportButton path="/activity/export" filename="data-kegiatan.xlsx"
            query={{ programs, search: st.search, sortBy, sortOrder }} />
          {canAdd && (
            <button type="button" className="btn btn-primary" onClick={() => setForm({ activity: null })}>
              <Icon name="plus" size={16} /><span className="btn-txt">Tambah kegiatan</span>
            </button>
          )}
        </div>
      </div>

      <div className="tbl-toolbar">
        <SearchInput value={st.search} onChange={(v) => update({ search: v, page: 1 })} placeholder="Cari nama kegiatan, PIC, atau lokasi" />
        {!fixedProgram && (
          <select className="tb-select" value={st.program} onChange={(e) => update({ program: e.target.value, page: 1 })} aria-label="Filter program">
            {programOptions.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
          </select>
        )}
        <select className="tb-select" value={st.sort} onChange={(e) => update({ sort: e.target.value, page: 1 })} aria-label="Urutkan">
          {SORTS.map(([v, t]) => <option key={v} value={v}>{t}</option>)}
        </select>
        {loading && fresh === false && rows.length > 0 && <span className="tb-loading"><Spinner size={14} />Memuat…</span>}
      </div>

      {selected.size > 0 && (
        <div className="bulkbar" role="region" aria-label="Tindakan untuk data terpilih">
          <span><b>{selected.size}</b> kegiatan dipilih</span>
          <button type="button" className="btn btn-sm" onClick={() => setSelected(new Set())}>Batal pilih</button>
          <button type="button" className="btn btn-sm btn-danger" onClick={bulkDelete}><Icon name="trash" size={15} />Hapus</button>
        </div>
      )}

      <ErrorNote error={error} onRetry={() => reload()} />

      {!data && loading ? <TableSkeleton /> : rows.length === 0 && !error ? (
        searching
          ? <EmptyState icon="search" title={`Tidak ada kegiatan yang cocok dengan "${st.search}"`}
              action={<button type="button" className="btn btn-sm" onClick={() => update({ search: "", page: 1 })}>Hapus pencarian</button>}>
              Coba kata kunci lain: nama kegiatan, nama PIC, atau lokasi.
            </EmptyState>
          : <EmptyState title="Belum ada kegiatan"
              action={canAdd && <button type="button" className="btn btn-primary btn-sm" onClick={() => setForm({ activity: null })}><Icon name="plus" size={15} />Tambah kegiatan</button>}>
              Kegiatan yang Anda catat atau impor dari Excel akan muncul di sini.
            </EmptyState>
      ) : (
        <div className={"tbl-body" + (loading ? " is-loading" : "")} aria-busy={loading}>
          <div className="tbl-scroll">
            <table className="tbl act-tbl">
              <thead>
                <tr>
                  <th className="c-check"><input type="checkbox" checked={allOn} disabled={!selectable.length} onChange={toggleAll} aria-label="Pilih semua di halaman ini" /></th>
                  <th className="c-name">Kegiatan</th>
                  <SortTh col="date" sort={st.sort} onSort={(v) => update({ sort: v, page: 1 })} className="c-date">Tanggal</SortTh>
                  <th className="c-status">Status</th>
                  <th className="c-att">Kehadiran</th>
                  <SortTh col="achievementValue" sort={st.sort} onSort={(v) => update({ sort: v, page: 1 })} className="c-cap num">Capaian</SortTh>
                  <SortTh col="feedback" sort={st.sort} onSort={(v) => update({ sort: v, page: 1 })} className="c-fb num">Umpan balik</SortTh>
                  <th className="c-iss">Isu</th>
                  <th className="c-pic">PIC</th>
                  <SortTh col="createdAt" sort={st.sort} onSort={(v) => update({ sort: v, page: 1 })} className="c-created">Diinput</SortTh>
                  <th className="c-act"><span className="sr-only">Aksi</span></th>
                </tr>
              </thead>
              <tbody>
                {rows.map((a) => {
                  const can = editable(a), status = activityStatus(a);
                  return (
                    <tr key={a.id} className={(selected.has(a.id) ? "sel " : "") + (actions.busyId === a.id ? "busy" : "")} onClick={() => openDetail(a)}>
                      <td className="c-check" onClick={stop}>
                        <input type="checkbox" checked={selected.has(a.id)} disabled={!can} onChange={() => toggle(a.id)}
                          aria-label={"Pilih " + a.name} title={can ? undefined : "Di luar program Anda"} />
                      </td>
                      <td className="c-name">
                        <button type="button" className="row-link" onClick={(e) => { stop(e); openDetail(a); }}>{a.name}</button>
                        <div className="row-meta">
                          {showProgram && <ProgramTag api={a.program} />}
                          {a.phase && <span>{phaseLabel(a.phase)}</span>}
                          {a.location && <span className="trunc">{a.location}</span>}
                          {a.mode === "upcoming" && <span className="tag-soft">Agenda</span>}
                        </div>
                      </td>
                      <td className="c-date">{a.date ? fmtDate(a.date) : <span className="muted unset">Belum dijadwalkan</span>}</td>
                      <td className="c-status"><StatusBadge status={status} /></td>
                      <td className="c-att"><Attendance participants={a.participants} /></td>
                      <td className="c-cap num">{a.achievementValue ?? <span className="muted">–</span>}</td>
                      <td className="c-fb num">{a.feedback ?? <span className="muted">–</span>}</td>
                      <td className="c-iss"><IssueCell issues={a.issues} /></td>
                      <td className="c-pic"><span className="trunc">{a.pic || <span className="muted">–</span>}</span></td>
                      <td className="c-created" title={fmtDateTime(a.createdAt)}>{fmtRelative(a.createdAt)}</td>
                      <td className="c-act" onClick={stop}>
                        {can ? (
                          <div className="row-actions">
                            <button type="button" className="icon-btn" title="Ubah" aria-label={"Ubah " + a.name} onClick={() => setForm({ activity: a })}><Icon name="pencil" size={16} /></button>
                            <button type="button" className="icon-btn" title={a.isDone ? "Batalkan selesai" : "Tandai selesai"} aria-label={(a.isDone ? "Batalkan selesai " : "Tandai selesai ") + a.name}
                              onClick={() => actions.toggleDone(a)}><Icon name={a.isDone ? "undo" : "check"} size={16} /></button>
                            <button type="button" className="icon-btn danger" title="Hapus" aria-label={"Hapus " + a.name} onClick={() => actions.remove(a)}><Icon name="trash" size={16} /></button>
                          </div>
                        ) : <span className="lock" title="Hanya bisa dilihat (di luar program Anda)"><Icon name="lock" size={14} /></span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <ul className="rec-list">
            {rows.map((a) => {
              const can = editable(a);
              return (
                <li key={a.id} className={"rec" + (selected.has(a.id) ? " sel" : "")}>
                  {can && <input type="checkbox" className="rec-check" checked={selected.has(a.id)} onChange={() => toggle(a.id)} aria-label={"Pilih " + a.name} />}
                  <button type="button" className="rec-main" onClick={() => openDetail(a)}>
                    <span className="rec-top"><span className="rec-name">{a.name}</span><StatusBadge status={activityStatus(a)} /></span>
                    <span className="rec-meta">
                      {showProgram && <ProgramTag api={a.program} />}
                      <span>{a.date ? fmtDate(a.date) : "Belum dijadwalkan"}</span>
                      {a.phase && <span>{phaseLabel(a.phase)}</span>}
                    </span>
                    <span className="rec-stats">
                      <Attendance participants={a.participants} compact />
                      {a.achievementValue != null && <span><Icon name="target" size={13} />{a.achievementValue}</span>}
                      {a.issues?.length > 0 && <IssueCell issues={a.issues} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      <Pagination pagination={pagination} perPage={st.perPage} noun="kegiatan"
        onPage={(p) => update({ page: p })} onPerPage={(n) => update({ perPage: n, page: 1 })} />

      <ActivityDetail activity={detail} onClose={() => setDetail(null)} canEdit={detail ? editable(detail) : false}
        onEdit={() => { setForm({ activity: detail }); setDetail(null); }}
        onToggleDone={() => actions.toggleDone(detail)}
        onDelete={async () => { if (await actions.remove(detail)) setDetail(null); }}
        busy={!!detail && actions.busyId === detail.id} />

      <ActivityForm open={!!form} activity={form?.activity || null} defaultProgram={fixedProgram || (st.program !== "mine" ? st.program : "")}
        onClose={() => setForm(null)} />
    </section>
  );
}

function TableSkeleton() {
  return (
    <div className="tbl-skel" aria-hidden="true">
      {Array.from({ length: 6 }, (_, i) => (
        <div key={i} className="tbl-skel-row">
          <Skeleton h={14} w={16} r={4} /><div style={{ flex: 1 }}><Skeleton h={14} w={`${70 - i * 6}%`} /><Skeleton h={10} w="35%" style={{ marginTop: 7 }} /></div>
          <Skeleton h={14} w={90} /><Skeleton h={22} w={96} r={11} /><Skeleton h={14} w={110} />
        </div>
      ))}
    </div>
  );
}

// --------------------------------------------------------- panel rincian ---
export function ActivityDetail({ activity: a, onClose, canEdit, onEdit, onToggleDone, onDelete, busy }) {
  const att = useMemo(() => attendance(a?.participants), [a]);
  const open = !!a;
  return (
    <Sheet open={open} onClose={onClose} wide
      title={a?.name}
      sub={a && <span className="detail-sub"><ProgramTag api={a.program} /><StatusBadge status={activityStatus(a)} />{a.mode === "upcoming" && <span className="tag-soft">Agenda mendatang</span>}</span>}
      footer={a && canEdit && (
        <>
          <button type="button" className="btn btn-danger-ghost" onClick={onDelete} disabled={busy}><Icon name="trash" size={16} />Hapus</button>
          <span className="grow" />
          <button type="button" className="btn" onClick={onToggleDone} disabled={busy}>
            {busy ? <Spinner /> : <Icon name={a.isDone ? "undo" : "check"} size={16} />}{a.isDone ? "Batalkan selesai" : "Tandai selesai"}
          </button>
          <button type="button" className="btn btn-primary" onClick={onEdit}><Icon name="pencil" size={16} />Ubah</button>
        </>
      )}>
      {a && (
        <div className="detail">
          <dl className="facts">
            <div><dt><Icon name="calendar" size={15} />Tanggal</dt><dd>{a.date ? fmtDateLong(a.date) : "Belum dijadwalkan"}</dd></div>
            <div><dt><Icon name="layers" size={15} />Fase</dt><dd>{a.phase ? phaseLabel(a.phase) : "–"}</dd></div>
            <div><dt><Icon name="pin" size={15} />Lokasi</dt><dd>{a.location || "–"}</dd></div>
            <div><dt><Icon name="user" size={15} />PIC</dt><dd>{a.pic || "–"}</dd></div>
            <div><dt><Icon name="clipboard" size={15} />Diinput</dt><dd>{fmtDateTime(a.createdAt)}</dd></div>
          </dl>

          {a.mode !== "upcoming" && (
            <>
              <div className="metric-row">
                <div className="metric"><span>Kehadiran</span><b>{att.pct === null ? "–" : att.pct + "%"}</b><small>{att.reg ? `${att.pres.toLocaleString("id-ID")} dari ${att.reg.toLocaleString("id-ID")}` : "belum ada data"}</small></div>
                <div className="metric"><span>Nilai capaian</span><b>{a.achievementValue ?? "–"}</b><small>skala 0–100</small></div>
                <div className="metric"><span>Umpan balik</span><b>{a.feedback ?? "–"}</b><small>skala 0–100</small></div>
                <div className="metric"><span>Keberjalanan</span><b className="metric-txt">{a.progress ? progressLabel(a.progress) : "–"}</b></div>
              </div>

              <h3 className="detail-h">Peserta</h3>
              {a.participants?.length ? (
                <table className="mini-tbl">
                  <thead><tr><th>Kategori</th><th className="num">Terdaftar</th><th className="num">Hadir</th><th className="num">%</th></tr></thead>
                  <tbody>{a.participants.map((p) => (
                    <tr key={p.id}><td>{p.category}</td><td className="num">{p.registered.toLocaleString("id-ID")}</td><td className="num">{p.present.toLocaleString("id-ID")}</td>
                      <td className="num">{p.registered ? Math.round(p.present / p.registered * 100) + "%" : "–"}</td></tr>
                  ))}</tbody>
                </table>
              ) : <p className="muted small">Belum ada data peserta.</p>}

              <h3 className="detail-h">SDM terlibat</h3>
              {a.humanResources?.length ? a.humanResources.map((h) => (
                <div className="sdm" key={h.id}>
                  <div className="sdm-head"><b>{h.position}</b><span className="muted">{h.names.length} orang</span>
                    {h.sk?.url && <a className="sk-link" href={h.sk.url} target="_blank" rel="noreferrer"><Icon name="file" size={14} />{skName(h.sk.name) || "SK"}</a>}
                  </div>
                  <div className="names">{h.names.join(" · ")}</div>
                </div>
              )) : <p className="muted small">Belum ada data SDM.</p>}

              <h3 className="detail-h">Isu &amp; peringatan</h3>
              {a.issues?.length ? a.issues.map((i) => (
                <div className={"issue lv-" + i.level} key={i.id}>
                  <div className="issue-top"><b>{i.name}</b><LevelBadge level={i.level} /></div>
                  {i.to && <div className="small"><span className="muted">Dengan pihak:</span> {i.to}</div>}
                  {i.problemSolving && <div className="small"><span className="muted">Penanganan:</span> {i.problemSolving}</div>}
                </div>
              )) : <p className="muted small">Tidak ada isu tercatat.</p>}
            </>
          )}
          {a.mode === "upcoming" && (
            <div className="note"><Icon name="info" size={16} /><span>Ini agenda mendatang. Saat kegiatan berlangsung, buka <b>Ubah</b> lalu pilih <b>Kegiatan berlangsung</b> untuk mengisi peserta, SDM, isu, dan penilaian.</span></div>
          )}
        </div>
      )}
    </Sheet>
  );
}
