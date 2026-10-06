# Dashboard DITSAMA 2026 — React Router (framework mode)

Website monitoring program DITSAMA, dibangun dengan **React Router v8 (framework mode, SPA)**
dan **Zustand** untuk state bersama. Data diambil dari backend
**monitoring-dashboard-ditsama-be** (Hono + PostgreSQL), dengan login email & password
lalu Password Akses tim.

## Struktur file
```
app/
├── root.jsx                 # dokumen HTML + ErrorBoundary global
├── routes.js                # daftar route
├── config.js                # daftar program, jabatan, fase (alamat backend dari .env)
├── routes/
│   ├── home.jsx             # beranda (/)
│   └── dashboard/
│       ├── layout.jsx       # menu, gerbang login, Password Akses, panel Filter
│       ├── portfolio.jsx    # /dashboard           — Portofolio Program
│       ├── financial.jsx    # /dashboard/financial — Keuangan
│       ├── peserta.jsx      # /dashboard/peserta
│       ├── dosen.jsx        # /dashboard/dosen
│       ├── input.jsx        # /dashboard/input     — Data Kegiatan
│       └── program.jsx      # /dashboard/program/:programKey
├── stores/                  # zustand: auth (sesi), data (cache data backend), ui (filter/tabel)
├── lib/                     # api.js (fetch + pesan error), format.js (label, tanggal, akses)
├── components/              # tabel kegiatan & keuangan, form, Chart.js, Gantt, Kalender, dll.
└── styles/                  # dashboard.css, home.css
public/assets/dpb-logo.png
```

## Menjalankan di komputer
Butuh Node.js 22.22+ dan backend yang sudah berjalan (lihat README backend).
1. Buat file `.env` di folder ini:
   ```
   VITE_API_URL=http://localhost:3000/api
   ```
2. Pastikan `CORS_ORIGINS` di `.env` backend berisi `http://localhost:5173`.
3. Jalankan:
   ```bash
   npm install
   npm run dev
   ```
Buka `http://localhost:5173/MonitoringDashboardDITSAMA2026/`.

## Fitur data
- **Data Kegiatan**: cari (nama, PIC, lokasi), urutkan, halaman, filter program, tambah/ubah lewat
  panel samping, tandai selesai, hapus satu atau banyak sekaligus, impor & ekspor Excel.
- **Keuangan**: filter program/tahun/bulan/jenis pengajuan, tabel transaksi PKS & pengajuan dengan
  pencarian, urutan, halaman, ubah, hapus massal, impor & ekspor Excel.
- File impor memakai format yang sama dengan file hasil **Ekspor**.
- Hak ubah mengikuti jabatan: PIC hanya program miliknya, Finance hanya Keuangan,
  Admin & Kasubdit semuanya.

## Publikasi di GitHub Pages
Workflow `.github/workflows/deploy.yml` otomatis build & deploy setiap push ke `main`.
1. Repo → **Settings → Pages** → Source: **GitHub Actions**.
2. Repo → **Settings → Secrets and variables → Actions → Variables** → buat `VITE_API_URL`
   berisi alamat backend produksi (termasuk `/api`).
3. Tambahkan alamat GitHub Pages ke `CORS_ORIGINS` di backend.
4. Push ke `main`; website tersedia di `https://<user>.github.io/MonitoringDashboardDITSAMA2026/`.

Jika nama repo berubah, sesuaikan `basename` di `react-router.config.js` **dan** `base`
di `vite.config.js`.

`npm run build` menghasilkan `build/client/` (termasuk `404.html` agar URL seperti
`/dashboard/financial` tetap bisa dibuka langsung di GitHub Pages).

## Catatan keamanan
- Password dan Password Akses diperiksa di backend; website hanya menyimpan token di memori.
- Sesi login tidak disimpan: pengguna wajib login setiap membuka website.
