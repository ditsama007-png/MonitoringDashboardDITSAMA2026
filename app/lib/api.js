// Komunikasi dengan backend monitoring-dashboard-ditsama-be (REST + JWT).
import { API_URL } from "../config.js";
import { useAuthStore } from "../stores/auth.js";

export class ApiError extends Error {
  constructor(message, status, raw) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

// pesan backend (Inggris) -> Bahasa Indonesia
const MESSAGES = {
  "Invalid email or password.": "Email atau password salah.",
  "User is not yet verified.": "Email belum diverifikasi. Masukkan kode yang dikirim ke email Anda.",
  "User not verified.": "Email belum diverifikasi.",
  "User with the provided email already exists.": "Email ini sudah terdaftar. Silakan masuk.",
  "User not found.": "Email tidak terdaftar.",
  "User already verified.": "Email sudah terverifikasi. Silakan masuk.",
  "OTP not found. Please request again.": "Kode tidak ditemukan. Minta kode baru.",
  "Code has expired. Please request again.": "Kode sudah kedaluwarsa. Minta kode baru.",
  "Invalid code passed. Check your inbox.": "Kode salah. Periksa lagi email Anda.",
  "New password cannot be the same with the old password.": "Password baru tidak boleh sama dengan password lama.",
  "Invalid access password.": "Password Akses salah.",
  "Access password verification required.": "Masukkan Password Akses untuk melanjutkan.",
  "Forbidden.": "Anda tidak punya akses untuk tindakan ini.",
  "Activity not found.": "Kegiatan tidak ditemukan (mungkin sudah dihapus).",
  "Financial not found.": "Data keuangan tidak ditemukan (mungkin sudah dihapus).",
  "Initial PKS for this program already exists.": "PKS Awal untuk program ini sudah ada. Gunakan Penambahan PKS.",
  "Submission fields cannot be applied to a PKS record.": "Kolom pengajuan tidak bisa dipakai untuk data PKS.",
  "PKS fields cannot be applied to a submission record.": "Kolom PKS tidak bisa dipakai untuk data pengajuan.",
  "Failed to upload SK.": "Gagal mengunggah SK. Coba lagi.",
  "Invalid Excel file format.": "Format file tidak dikenali. Gunakan .xlsx atau .csv.",
  "Excel workbook contains no sheets.": "File tidak berisi sheet apa pun.",
  "Uploaded sheet contains no data.": "Sheet pertama di file kosong.",
  "A file field containing the spreadsheet is required.": "Pilih file spreadsheet dulu.",
  "Lecturer not found.": "Dosen tidak ditemukan untuk filter ini.",
  "Something went wrong": "Terjadi kesalahan di server. Coba lagi sebentar lagi.",
};

const FIELD_LABELS = {
  email: "Email", password: "Password", name: "Nama", role: "Jabatan", programs: "Program", code: "Kode",
  newPassword: "Password baru", program: "Program", date: "Tanggal", pksValue: "Nilai PKS",
  submissionValue: "Nilai pengajuan", achievementValue: "Nilai capaian", feedback: "Umpan balik",
  participants: "Peserta", humanResources: "SDM", issues: "Isu", sk: "File SK", pic: "PIC", location: "Lokasi",
};

function readableMessage(body, status, retryAfter) {
  if (status === 429) {
    const min = Math.ceil((Number(retryAfter) || 900) / 60);
    return `Terlalu banyak percobaan. Coba lagi dalam ${min} menit.`;
  }
  const msg = body?.message;
  if (msg && typeof msg === "object" && Array.isArray(msg.errors)) {
    const first = msg.errors[0] || {};
    const field = FIELD_LABELS[first.path?.[0]] || first.path?.[0];
    const custom = { "Programs are required for PIC role.": "Pilih minimal satu program untuk PIC." }[first.message];
    if (custom) return custom;
    if (first.path?.[0] === "email") return "Format email tidak valid.";
    return field ? `${field} tidak valid. Periksa kembali isiannya.` : "Isian tidak valid. Periksa kembali formulir.";
  }
  if (typeof msg === "string") return MESSAGES[msg] || msg;
  return `Server membalas error (HTTP ${status}).`;
}

function buildUrl(path, query) {
  const url = new URL(API_URL + path, window.location.origin);
  Object.entries(query || {}).forEach(([k, v]) => {
    if (v === undefined || v === null || v === "") return;
    url.searchParams.set(k, Array.isArray(v) ? v.join(",") : String(v));
  });
  return url;
}

async function send(path, { method = "GET", query, body, form, token, signal } = {}) {
  if (!API_URL) throw new ApiError("Alamat server belum diatur (VITE_API_URL di .env).", 0);
  const auth = token === undefined ? useAuthStore.getState().session?.token : token;
  const headers = {};
  if (auth) headers.Authorization = "Bearer " + auth;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
  try {
    return await fetch(buildUrl(path, query), { method, headers, body: payload, signal });
  } catch (e) {
    if (e?.name === "AbortError") throw e;
    throw new ApiError("Tidak bisa menghubungi server. Periksa koneksi internet Anda.", 0);
  }
}

async function failure(res) {
  let body = null;
  try { body = await res.json(); } catch { /* bukan JSON */ }
  const err = new ApiError(readableMessage(body, res.status, res.headers.get("Retry-After")), res.status, body);
  const auth = useAuthStore.getState();
  // token kedaluwarsa / tidak sah -> keluar; Password Akses belum diverifikasi -> minta lagi
  if (res.status === 401 && auth.session) auth.logout("Sesi Anda berakhir. Silakan masuk lagi.");
  if (res.status === 403 && body?.message === "Access password verification required.") auth.lockAccess();
  return err;
}

/** Panggil endpoint JSON. Mengembalikan isi body (`{ status, data, ... }`) atau melempar ApiError. */
export async function api(path, opts) {
  const res = await send(path, opts);
  if (!res.ok) throw await failure(res);
  return res.json();
}

/** Unduh file (ekspor Excel) dengan filter yang sama seperti tabel. */
export async function download(path, query, fallbackName) {
  const res = await send(path, { query });
  if (!res.ok) throw await failure(res);
  const blob = await res.blob();
  const cd = res.headers.get("Content-Disposition") || "";
  const name = /filename="?([^";]+)"?/.exec(cd)?.[1] || fallbackName;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

/** Unggah file (multipart). `field` = nama kolom file yang diminta backend. */
export function upload(path, file, field = "file") {
  const form = new FormData();
  form.append(field, file);
  return api(path, { method: "POST", form });
}
