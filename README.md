# Dashboard DITSAMA 2026 — React Router (framework mode) test

Website monitoring program DITSAMA, dibangun dengan **React Router v8 (framework mode, SPA)**
dan **Zustand** untuk state bersama. Data disimpan ke **Google Sheets** melalui
**Google Apps Script**, dengan login per pengguna (password dicek di server).

## Struktur file
```
app/
├── root.jsx                 # dokumen HTML + ErrorBoundary global
├── routes.js                # daftar route
├── config.js                # URL Apps Script + daftar program  <-- diisi
├── routes/
│   ├── home.jsx             # beranda (/)
│   └── dashboard/
│       ├── layout.jsx       # menu, gerbang login, Password Akses, panel Control
│       ├── portfolio.jsx    # /dashboard           — Program Portfolio
│       ├── financial.jsx    # /dashboard/financial
│       ├── peserta.jsx      # /dashboard/peserta
│       ├── dosen.jsx        # /dashboard/dosen
│       ├── input.jsx        # /dashboard/input?program=SIAP&edit=<ID>
│       └── program.jsx      # /dashboard/program/:programKey
├── stores/                  # zustand: auth (sesi), data (Sheets), ui (filter/tab)
├── lib/                     # helper murni: format, parser peserta/dosen/capaian, API
├── components/              # Chart.js, Gantt, Kalender, gerbang login, dll.
└── styles/                  # dashboard.css, home.css
public/assets/dpb-logo.png
```

## Menjalankan di komputer
Butuh Node.js 22.22+.
```bash
npm install
npm run dev
```
Buka `http://localhost:5173/MonitoringDashboardDITSAMA2026/`.

## Setup Google Sheets (backend)
1. Buka Google Sheets → **Extensions → Apps Script**, tempel `Code.gs`.
2. Atur `SPREADSHEET_ID` dan daftar akses PIC di bagian atas `Code.gs`.
3. **Deploy → New deployment → Web app** (Execute as: Me, Who has access: Anyone).
4. Salin Web app URL ke `API_URL` di `app/config.js`.
   Selama `API_URL` kosong (`""`), website jalan dalam **mode contoh** (akun disimpan di browser).

## Publikasi di GitHub Pages
Workflow `.github/workflows/deploy.yml` otomatis build & deploy setiap push ke `main`.
1. Repo → **Settings → Pages** → Source: **GitHub Actions**.
2. Push ke `main`; website tersedia di `https://<user>.github.io/MonitoringDashboardDITSAMA2026/`.

Jika nama repo berubah, sesuaikan `basename` di `react-router.config.js` **dan** `base`
di `vite.config.js`.

`npm run build` menghasilkan `build/client/` (termasuk `404.html` agar URL seperti
`/dashboard/financial` tetap bisa dibuka langsung di GitHub Pages).

## Catatan keamanan
- Cocok untuk tool internal. Password diperiksa di Apps Script (server Google), bukan di website.
- Sesi login tidak disimpan: pengguna wajib login setiap membuka website.
