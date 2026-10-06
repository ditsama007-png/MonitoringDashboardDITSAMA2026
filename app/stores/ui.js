// State tampilan yang perlu bertahan saat pindah halaman (filter, tab, panel tersembunyi).
import { create } from "zustand";

const ALL = "Semua";

export const useUiStore = create((set) => ({
  railHidden: false,
  controlHidden: false,
  toggleRail: () => set((s) => ({ railHidden: !s.railHidden })),
  toggleControl: () => set((s) => ({ controlHidden: !s.controlHidden })),

  // filter "Control" di Program Portfolio
  dash: { program: ALL, tahun: ALL, bulan: ALL, fase: ALL, kegiatan: ALL, level: ALL },
  calMonth: null,   // Date (tgl 1) bulan yang tampil di kalender; null = bulan data terbaru
  capSearch: "",

  // Financial
  fin: { program: ALL, tahun: ALL, bulan: ALL, jenis: ALL, tab: "" },

  // Peserta
  pst: {
    program: ALL, periode: ALL, aktivitas: ALL, provinsi: ALL, fakultas: ALL, skema: ALL, tipe: ALL, kelompok: ALL,
    ujian: "__LAST__", sort: "ujian", rankAll: false, sekAll: false, listN: 50, search: "", sekSearch: "",
  },

  // Portofolio Dosen
  dsn: { program: ALL, mapel: ALL, metode: ALL, kelas: ALL, bahasa: ALL, minResp: "1", sel: "", search: "" },

  // patch sebagian objek state: patch("dash", { program: "SIAP ITB" })
  patch: (section, values) => set((s) => ({ [section]: { ...s[section], ...values } })),
}));
