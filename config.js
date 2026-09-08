// ============================================================
//  KONFIGURASI  (ubah bagian ini setelah setup Apps Script)
// ============================================================

// URL Web App dari Google Apps Script (lihat README langkah setup).
// Selama masih kosong (""), website jalan dengan DATA CONTOH.
const API_URL = "";

// Daftar program -> nama sheet di Google Sheets (harus sama persis)
const PROGRAMS = [
  { key: "SIAP",          label: "SIAP ITB",            sheet: "SIAP_2026" },
  { key: "INSPIRASI_EDQ", label: "INSPIRASI EduQuest",  sheet: "INSPIRASI_Edq2026" },
  { key: "INSPIRASI_SCD", label: "INSPIRASI SCD",       sheet: "INSPIRASI_Scd2026" },
];

// Pilihan dropdown pada form
const OPSI_KEBERJALANAN = [
  "Sesuai Rencana", "Ada Kendala", "Tidak Sesuai Rencana", "Tidak Ada Penilaian",
];
const OPSI_LEVEL_ISU = ["Tidak Ada", "High", "Medium", "Low"];
