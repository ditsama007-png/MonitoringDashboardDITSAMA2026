// ============================================================
//  KONFIGURASI  (ubah bagian ini setelah setup Apps Script)
// ============================================================

// URL Web App dari Google Apps Script (lihat README langkah setup).
// Selama masih kosong (""), website jalan dengan DATA CONTOH.
export const API_URL = "https://script.google.com/macros/s/AKfycbylTdZBgYuWL9roaIEF-9A-KIdQUf8ha2fVStexxonoucojaR-Lgu_2GTRAPrbn8v3Rqg/exec";

// Daftar program -> nama sheet di Google Sheets (harus sama persis)
// fullName & desc tampil sebagai judul + kartu "Tentang program" di dashboard.
export const PROGRAMS = [
  { key: "SIAP",          label: "SIAP ITB",           sheet: "SIAP_2026",
    fullName: "Sekolah Intensif Akademik Pra-ITB",
    desc: "Sekolah Intensif Akademik Pra-ITB (SIAP ITB) 2026 merupakan program pembelajaran intensif yang diselenggarakan oleh Direktorat Persiapan Bersama Institut Teknologi Bandung (ITB) sebagai bagian dari upaya mempersiapkan siswa dan juga mahasiswa baru mengenal proses pembelajaran pada Tahap Persiapan Bersama (TPB). Program ini dirancang untuk membantu siswa di tingkat sekolah menengah atas dan juga mahasiswa untuk dapat memahami konsep-konsep dasar sains, sekaligus mendukung proses adaptasi dari jenjang pendidikan menengah ke pendidikan tinggi." },
  { key: "INSPIRASI_EDQ", label: "INSPIRASI EduQuest", sheet: "INSPIRASI_Edq2026",
    fullName: "Kelas Eksplorasi Cendekia",
    desc: "EduQuest ITB 2026: Kelas Eksplorasi Cendekia merupakan salah satu program reguler DITSAMA ITB di bawah naungan Subdirektorat Persiapan Bersama ITB. Program ini diselenggarakan sebagai salah satu upaya Institut Teknologi Bandung dalam mewujudkan visi dan misinya melalui pemberian eksposur dunia perkuliahan kepada siswa Sekolah Menengah Atas (SMA). Melalui program ini, peserta diperkenalkan dengan kehidupan akademik, berbagai bidang keilmuan, serta prospek karier sehingga memiliki bekal dalam menentukan pilihan program studi." },
  { key: "INSPIRASI_SCD", label: "INSPIRASI SCD",      sheet: "INSPIRASI_Scd2026",
    fullName: "Petualangan Sang Cendekia",
    desc: "Program Inspirasi - Petualangan Sang Cendekia 2026 merupakan program pengenalan dan pembekalan pra-universitas yang diselenggarakan oleh Direktorat Persiapan Bersama (DITSAMA) Institut Teknologi Bandung (ITB). Program ini dirancang untuk memberikan gambaran menyeluruh mengenai suasana perkuliahan, ragam bidang keilmuan, serta budaya akademik di ITB kepada peserta didik jenjang pendidikan menengah yang berminat melanjutkan studi ke perguruan tinggi." },
  { key: "OSN",           label: "OSN",                sheet: "OSN_2026",
    fullName: "Olimpiade Sains Nasional",
    desc: "Program Pembinaan Pra-OSN SMA Taruna Nusantara Kampus Magelang diselenggarakan sebagai upaya mendukung penguatan kapasitas akademik siswa sekolah menengah atas dalam bidang sains melalui pendampingan terstruktur oleh Tim Pra-Universitas Direktorat Persiapan Bersama Institut Teknologi Bandung. Program ini menjadi bentuk kontribusi nyata perguruan tinggi dalam pembinaan talenta muda Indonesia agar memiliki kesiapan yang lebih baik dalam menghadapi kompetisi sains tingkat nasional, khususnya Olimpiade Sains Nasional. Secara khusus, kegiatan ini bertujuan memberikan pembinaan intensif kepada siswa dalam bidang OSN prioritas, yaitu Matematika, Fisika, Kimia, Biologi, Astronomi, Kebumian, Informatika, Geografi, dan Ekonomi; memperkenalkan pendekatan ilmiah serta atmosfer akademik kampus; membangun jejaring pembinaan antara ITB dan SMA mitra; serta menumbuhkan minat siswa terhadap pengembangan karier di bidang sains dan teknologi." },
  { key: "OPSI",          label: "OPSI",               sheet: "OPSI_2026",
    fullName: "Olimpiade Penelitian Siswa Indonesia",
    desc: "Program Pembinaan OPSI difokuskan pada pendampingan riset yang intensif, dengan tujuan mengembangkan ide yang telah agar dapat disusun menjadi proposal penelitian yang matang, sistematis, dan layak ditindaklanjuti. Pelaksanaan tahap ini dikolaborasikan dengan pendampingan pamong secara luring pada mata pelajaran yang relevan dengan topik riset siswa. Dalam prosesnya, pamong juga mendapatkan materi, arahan, dan pendampingan dari dosen ITB secara daring, sehingga memiliki bekal yang memadai untuk mendampingi siswa secara langsung di sekolah." },
  { key: "RISET",         label: "Riset",              sheet: "Riset_2026",
    fullName: "Riset Kolaboratif",
    desc: "Program Pra-Universitas Riset Kolaboratif merupakan kegiatan pembinaan riset yang dirancang secara bertahap untuk menumbuhkan minat, kemampuan berpikir ilmiah, dan keterampilan menyusun karya ilmiah bagi siswa SMA Taruna Nusantara. Program ini terdiri atas tiga tahapan utama, yaitu Research Exposure (Stage 1) untuk memperkenalkan daya tarik riset dan inovasi, Student Research Ideation (Stage 2) untuk mengembangkan ide riset melalui diskusi bersama pamong dan dosen ITB serta penyusunan proposal, dan Advanced Student Research Project (Stage 3) untuk mendampingi siswa dalam pelaksanaan penelitian, pengumpulan dan analisis data, hingga penyusunan hasil riset dalam bentuk artikel ilmiah. Dalam pelaksanaannya, kegiatan juga dikaitkan dengan pendampingan OPSI 2026 sebagai upaya memperkuat ekosistem riset sekolah, meningkatkan kualitas proposal penelitian siswa, serta membangun budaya ilmiah yang lebih sistematis melalui dukungan pamong, mentor, dan dosen ITB." },
  { key: "BTI",           label: "BTI",                sheet: "BTI_2026",
    fullName: "Bina Talenta Indonesia",
    desc: "" },
  { key: "WIT",           label: "WIT",                sheet: "WIT_2026",
    fullName: "Wardah Inspiring Teacher",
    desc: "Program kerjasama Direktorat Persiapan Bersama (DITSAMA) dan Wardah pelatihan bidang AI dan STEM untuk guru-guru SD, SMP dan SMA." },
  { key: "MAUNG",         label: "MAUNG",              sheet: "MAUNG_2026",
    fullName: "Sekolah Manusia Unggul",
    desc: "Sekolah Maung (Sekolah Manusia Unggul) 2026 merupakan program Dinas Pendidikan Provinsi Jawa Barat melalui Bidang Guru dan Tenaga Kependidikan, yang diselenggarakan sebagai langkah awal penyiapan SMA dan SMK Manusia Unggul di Jawa Barat. Program ini merupakan salah satu upaya Pemerintah Provinsi Jawa Barat dalam memastikan kesiapan pendidik untuk mewujudkan generasi yang unggul, berkarakter, dan berdaya saing global. Melalui program ini, 2.946 guru pada 41 SMA/SMK Manusia Unggul diases dan dipetakan kompetensinya, meliputi pedagogi, penguasaan substansi, kepemimpinan, serta karakter berlandaskan filosofi Pancawaluya. Hasil asesmen menjadi dasar penyusunan rencana pengembangan kompetensi bagi setiap guru." },
];

// Daftar program KHUSUS menu Financial (boleh beda dari program monitoring)
export const FIN_PROGRAMS = [
  { key: "SIAP",          label: "SIAP ITB" },
  { key: "INSPIRASI_EDQ", label: "INSPIRASI EduQuest" },
  { key: "TORAJA",        label: "Toraja" },
  { key: "YPK",           label: "YPK" },
  { key: "TN",            label: "TN (Taruna Nusantara)" },
  { key: "BTI",           label: "BTI" },
  { key: "WIT",           label: "WIT" },
  { key: "MAUNG",         label: "MAUNG" },
];

// Pilihan dropdown pada form
export const OPSI_KEBERJALANAN = [
  "Sesuai Rencana", "Ada Kendala", "Tidak Sesuai Rencana", "Tidak Ada Penilaian",
];
export const OPSI_LEVEL_ISU = ["Tidak Ada", "High", "Medium", "Low"];

// Pilihan Fase Kegiatan (dropdown di form input)
export const OPSI_FASE = [
  "Persiapan", "Proses",
  "Fase 1", "Fase 2", "Fase 3", "Fase 4", "Fase 5",
  "Fase 6", "Fase 7", "Fase 8", "Fase 9", "Fase 10",
  "Pelaporan",
];

// Jabatan (role). Program yang dipegang dipilih terpisah saat sign up.
export const JABATAN = ["Admin", "Head Program", "Finance", "PIC"];

// Jabatan yang otomatis bisa MELIHAT semua program.
// (Finance juga lihat semua, tapi hanya boleh isi menu Financial — diatur di app/lib/access.js)
export const ALL_ACCESS_ROLES = ["Admin", "Head Program", "Finance"];

// Jabatan yang HANYA boleh mengisi menu Financial (tak boleh Input Data program).
export const FINANCE_ONLY_ROLES = ["Finance"];

// Link dashboard/website SUGT (dibuka di tab baru dari menu "Program SUGT")
export const SUGT_URL = "https://internal.sugtitb.com";
