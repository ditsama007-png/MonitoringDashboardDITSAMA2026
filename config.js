// ============================================================
//  KONFIGURASI  (ubah bagian ini setelah setup Apps Script)
// ============================================================

// URL Web App dari Google Apps Script (lihat README langkah setup).
// Selama masih kosong (""), website jalan dengan DATA CONTOH.
const API_URL = "https://script.google.com/macros/s/AKfycby7uCAReUXNXbWcQPax7RgF5KSPs8LXBsScBL6PBQplhsTPJM9_yuDg0KWvpvPncFXIYw/exec";

// Daftar program -> nama sheet di Google Sheets (harus sama persis)
const PROGRAMS = [
  { key: "SIAP",          label: "SIAP ITB",           sheet: "SIAP_2026" },
  { key: "INSPIRASI_EDQ", label: "INSPIRASI EduQuest", sheet: "INSPIRASI_Edq2026" },
  { key: "INSPIRASI_SCD", label: "INSPIRASI SCD",      sheet: "INSPIRASI_Scd2026" },
  { key: "OSN",           label: "OSN",                sheet: "OSN_2026" },
  { key: "OPSI",          label: "OPSI",               sheet: "OPSI_2026" },
  { key: "RISET",         label: "Riset",              sheet: "Riset_2026" },
  { key: "BTI",           label: "BTI",                sheet: "BTI_2026" },
  { key: "WIT",           label: "WIT",                sheet: "WIT_2026" },
  { key: "MAUNG",         label: "MAUNG",              sheet: "MAUNG_2026" },
];

// Pilihan dropdown pada form
const OPSI_KEBERJALANAN = [
  "Sesuai Rencana", "Ada Kendala", "Tidak Sesuai Rencana", "Tidak Ada Penilaian",
];
const OPSI_LEVEL_ISU = ["Tidak Ada", "High", "Medium", "Low"];

// Pilihan Fase Kegiatan (dropdown di form input)
const OPSI_FASE = [
  "Persiapan", "Proses",
  "Fase 1", "Fase 2", "Fase 3", "Fase 4", "Fase 5",
  "Fase 6", "Fase 7", "Fase 8", "Fase 9", "Fase 10",
  "Pelaporan",
];

// Jabatan (role). Program yang dipegang dipilih terpisah saat sign up.
const JABATAN = ["Admin", "Head Program", "Finance", "PIC"];

// Jabatan yang otomatis bisa MELIHAT semua program.
// (Finance juga lihat semua, tapi hanya boleh isi menu Financial — diatur di app.js)
const ALL_ACCESS_ROLES = ["Admin", "Head Program", "Finance"];

// Jabatan yang HANYA boleh mengisi menu Financial (tak boleh Input Data program).
const FINANCE_ONLY_ROLES = ["Finance"];
