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

// ============================================================
//  DAFTAR PIC TERDAFTAR
//  Dipakai untuk: (a) login "Add Access", dan (b) gerbang akses form input.
//  Tiap PIC hanya bisa membuka form input PROGRAM miliknya sendiri.
//  (Catatan: ini gerbang sisi-browser; untuk keamanan penuh, pindahkan ke
//   Apps Script/server. Kalau repo public, jangan taruh password asli di sini.)
// ============================================================
const PICS = [
  { nama: "Budi", jabatan: "Koordinator SIAP",     email: "budi@itb.ac.id",  password: "siap123", program: "SIAP" },
  { nama: "Sari", jabatan: "Koordinator EduQuest", email: "sari@itb.ac.id",  password: "edq123",  program: "INSPIRASI_EDQ" },
  { nama: "Anto", jabatan: "Koordinator SCD",      email: "anto@itb.ac.id",  password: "scd123",  program: "INSPIRASI_SCD" },
  // Admin bisa akses semua (program: "*")
  { nama: "Admin", jabatan: "Admin", email: "admin@itb.ac.id", password: "admin123", program: "*" },
];
