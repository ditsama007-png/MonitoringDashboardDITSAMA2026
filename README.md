# Dashboard DITSAMA 2026 — Versi Website (GitHub Pages)

Website statis (HTML/CSS/JS) untuk monitoring program DITSAMA. Terdiri dari 3 layer
yang bisa dimunculkan/disembunyikan: **Form Input**, **Filter**, dan **Dashboard**.
Data disimpan ke **Google Sheets** melalui **Google Apps Script**, dengan
**password per PIC** (tiap PIC hanya bisa mengisi program-nya sendiri).

## Struktur file
```
dashboard-web/
├── index.html          # struktur halaman (3 layer)
├── styles.css          # tampilan (biru ITB)
├── app.js              # logika: toggle, dashboard, form, filter
├── config.js           # URL Apps Script + daftar program  <-- diisi
└── apps_script/
    └── Code.gs         # backend: baca/tulis Sheets + cek password
```

## Cara pakai cepat (mode contoh)
Buka `index.html` di browser. Tanpa setup apa pun, website tampil dengan **data contoh**
supaya kamu bisa lihat tampilannya.

## Setup agar tersambung ke Google Sheets (data asli)

### 1. Pasang backend Apps Script
1. Buka Google Sheets kamu → menu **Extensions → Apps Script**.
2. Hapus kode default, tempel seluruh isi `apps_script/Code.gs`.
3. Sesuaikan di bagian atas:
   - `SPREADSHEET_ID` (sudah diisi ID sheet kamu).
   - `PIC_ACCESS` → daftar PIC + password per program.
4. Klik **Deploy → New deployment → (gear) Web app**.
   - Execute as: **Me**
   - Who has access: **Anyone**
5. **Deploy**, izinkan akses, lalu **salin Web app URL**.

### 2. Sambungkan website
Buka `config.js`, isi `API_URL` dengan URL Web App tadi:
```js
const API_URL = "https://script.google.com/macros/s/XXXX/exec";
```

### 3. Publikaslikan di GitHub Pages
1. Push folder ini ke repository GitHub.
2. Repo → **Settings → Pages** → Source: **Deploy from a branch** → pilih `main` / root.
3. Tunggu beberapa menit, website tersedia di `https://<user>.github.io/<repo>/`.

## Password per PIC
Diatur di `Code.gs` bagian `PIC_ACCESS`. Contoh:
```js
var PIC_ACCESS = {
  "SIAP": { "budi": "siap123" },
  "INSPIRASI_EDQ": { "sari": "edq123" }
};
```
PIC memasukkan nama + password saat mengisi form. Validasi dilakukan di server
(Apps Script), jadi password tidak terlihat di kode website.

## Catatan keamanan
- Cocok untuk tool internal. Password disimpan di Apps Script (server Google), bukan
  di website, jadi jauh lebih aman daripada cek password di sisi browser.
- Untuk keamanan lebih tinggi (mis. akun Google SSO), perlu pengembangan lanjutan.
