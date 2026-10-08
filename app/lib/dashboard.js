// Filter "Control" untuk Program Portfolio (opsi bertingkat dari data DataMasuk).
import { useMemo } from "react";
import { PROGRAMS } from "../config.js";
import { useDataStore } from "../stores/data.js";
import { useUiStore } from "../stores/ui.js";
import { capParse } from "./capaian.js";
import {
  faseRank, filterProgramToKey, flexToStd, keepOption, keyFromStored, labelOf, monthLabel, monthOptions, yearOf,
} from "./format.js";

const ALL = "Semua";

/** opsi + nilai efektif filter dashboard, plus semua baris DataMasuk dalam bentuk standar */
export function useDashFilters() {
  const flexRows = useDataStore((s) => s.flex.rows);
  const capRaw = useDataStore((s) => s.capaian.raw);
  const dash = useUiStore((s) => s.dash);

  const base = useMemo(() => {
    const all = flexRows.map(flexToStd);
    const capYears = capParse(capRaw).map((x) => x.tahun);
    return {
      all,
      program: [ALL, ...PROGRAMS.map((p) => p.label)],
      tahun: [ALL, ...[...new Set(all.map((r) => yearOf(r.tanggal)).concat(capYears).filter(Boolean))].sort()],
      bulan: [ALL, ...monthOptions(all.map((r) => r.tanggal))],
      fase: [ALL, ...[...new Set(all.map((r) => r.fase).filter(Boolean))].sort((a, b) => faseRank(a) - faseRank(b))],
      level: [ALL, "High", "Medium", "Low"],
    };
  }, [flexRows, capRaw]);

  return useMemo(() => {
    const program = keepOption(base.program, dash.program);
    // Kegiatan menyesuaikan program terpilih
    const kegiatanOpts = [ALL, ...[...new Set(base.all
      .filter((r) => program === ALL || labelOf(r._prog) === program)
      .map((r) => r.kegiatan).filter(Boolean))].sort()];
    const opts = { ...base, kegiatan: kegiatanOpts };
    const values = {
      program,
      tahun: keepOption(opts.tahun, dash.tahun),
      bulan: keepOption(opts.bulan, dash.bulan),
      fase: keepOption(opts.fase, dash.fase),
      kegiatan: keepOption(opts.kegiatan, dash.kegiatan),
      level: keepOption(opts.level, dash.level),
    };
    return { all: base.all, opts, values, programKey: filterProgramToKey(program) };
  }, [base, dash]);
}

// baris standar yang lolos SEMUA filter Control
export function filterStdRows(all, values) {
  const fp = filterProgramToKey(values.program);
  return all.filter((r) =>
    (fp === ALL || r._prog === fp) &&
    (values.tahun === ALL || yearOf(r.tanggal) === values.tahun) &&
    (values.bulan === ALL || monthLabel(r.tanggal) === values.bulan) &&
    (values.fase === ALL || r.fase === values.fase) &&
    (values.kegiatan === ALL || r.kegiatan === values.kegiatan) &&
    (values.level === ALL || (r.level || "") === values.level));
}

// baris mentah DataMasuk yang lolos filter Program & Bulan saja
export function filterRawByProgramMonth(rows, programKey, bulan) {
  return rows.filter((r) =>
    (programKey === ALL || keyFromStored(r["Program"]) === programKey) &&
    (bulan === ALL || monthLabel(r["Tanggal Kegiatan"]) === bulan));
}
