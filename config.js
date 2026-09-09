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

// Jabatan (role). Program yang dipegang dipilih terpisah saat sign up.
const JABATAN = ["Admin", "Head Program", "PIC"];

// Jabatan yang otomatis bisa akses SEMUA program.
// Selain ini (PIC), aksesnya = program yang dipilih saat sign up.
const ALL_ACCESS_ROLES = ["Admin", "Head Program"];

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
