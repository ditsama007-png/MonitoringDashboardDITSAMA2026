// State tampilan yang perlu bertahan saat pindah halaman (filter, tabel, panel tersembunyi).
import { create } from "zustand";

const ALL = "Semua";

export const useUiStore = create((set) => ({
  railOpen: false,        // menu utama di layar kecil (laci)
  railHidden: false,      // menu utama disembunyikan di layar lebar
  controlOpen: false,     // panel Filter di layar kecil (laci)
  controlHidden: false,   // panel Filter disembunyikan di layar lebar
  set: (patch) => set(patch),

  // filter panel Filter di Portofolio Program (nilai = label dari backend)
  dash: { program: ALL, year: ALL, month: ALL, phase: ALL, activity: ALL, issueLevel: ALL },
  calMonth: null,   // Date (tgl 1) bulan yang tampil di kalender; null = bulan data terbaru
  capSearch: "",

  // tabel Data Kegiatan
  act: { program: "", search: "", sort: "createdAt:desc", page: 1, perPage: 10 },

  // Keuangan
  fin: { program: "all", year: "", month: "", submissionType: "", search: "", sort: "date:desc", page: 1, perPage: 10 },

  // Peserta
  pst: {
    program: ALL, periode: ALL, aktivitas: ALL, provinsi: ALL, fakultas: ALL, skema: ALL, tipe: ALL, kelompok: ALL,
    ujian: "__LAST__", rankingSortBy: "ujian", rankAll: false, sekAll: false, schoolSearch: "", search: "", page: 1, perPage: 25,
  },

  // Portofolio Dosen
  dsn: { program: ALL, mapel: ALL, metode: ALL, kelas: ALL, bahasa: ALL, minResp: "1", sel: "", search: "" },

  // patch sebagian objek state: patch("dash", { program: "SIAP ITB" })
  patch: (section, values) => set((s) => ({ [section]: { ...s[section], ...values } })),
}));
