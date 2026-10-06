// ============================================================
//  KONFIGURASI
// ============================================================

// Base URL backend monitoring-dashboard-ditsama-be (termasuk prefix /api), diatur lewat .env
export const API_URL = String(import.meta.env.VITE_API_URL || "").replace(/\/+$/, "");

// Daftar program monitoring. `key` dipakai di URL dashboard, `api` = nilai enum di backend.
// fullName & desc tampil sebagai judul + kartu "Tentang program" di dashboard.
export const PROGRAMS = [
  { key: "SIAP",          api: "siap_itb",           label: "SIAP ITB",
    fullName: "Sekolah Intensif Akademik Pra-ITB",
    desc: "Sekolah Intensif Akademik Pra-ITB (SIAP ITB) 2026 merupakan program pembelajaran intensif yang diselenggarakan oleh Direktorat Persiapan Bersama Institut Teknologi Bandung (ITB) sebagai bagian dari upaya mempersiapkan siswa dan juga mahasiswa baru mengenal proses pembelajaran pada Tahap Persiapan Bersama (TPB). Program ini dirancang untuk membantu siswa di tingkat sekolah menengah atas dan juga mahasiswa untuk dapat memahami konsep-konsep dasar sains, sekaligus mendukung proses adaptasi dari jenjang pendidikan menengah ke pendidikan tinggi." },
  { key: "INSPIRASI_EDQ", api: "inspirasi_eduquest", label: "INSPIRASI EduQuest",
    fullName: "Kelas Eksplorasi Cendekia",
    desc: "EduQuest ITB 2026: Kelas Eksplorasi Cendekia merupakan salah satu program reguler DITSAMA ITB di bawah naungan Subdirektorat Persiapan Bersama ITB. Program ini diselenggarakan sebagai salah satu upaya Institut Teknologi Bandung dalam mewujudkan visi dan misinya melalui pemberian eksposur dunia perkuliahan kepada siswa Sekolah Menengah Atas (SMA). Melalui program ini, peserta diperkenalkan dengan kehidupan akademik, berbagai bidang keilmuan, serta prospek karier sehingga memiliki bekal dalam menentukan pilihan program studi." },
  { key: "INSPIRASI_SCD", api: "inspirasi_scd",      label: "INSPIRASI SCD",
    fullName: "Petualangan Sang Cendekia",
    desc: "Program Inspirasi - Petualangan Sang Cendekia 2026 merupakan program pengenalan dan pembekalan pra-universitas yang diselenggarakan oleh Direktorat Persiapan Bersama (DITSAMA) Institut Teknologi Bandung (ITB). Program ini dirancang untuk memberikan gambaran menyeluruh mengenai suasana perkuliahan, ragam bidang keilmuan, serta budaya akademik di ITB kepada peserta didik jenjang pendidikan menengah yang berminat melanjutkan studi ke perguruan tinggi." },
  { key: "OSN",           api: "osn",                label: "OSN",
    fullName: "Olimpiade Sains Nasional",
    desc: "Program Pembinaan Pra-OSN SMA Taruna Nusantara Kampus Magelang diselenggarakan sebagai upaya mendukung penguatan kapasitas akademik siswa sekolah menengah atas dalam bidang sains melalui pendampingan terstruktur oleh Tim Pra-Universitas Direktorat Persiapan Bersama Institut Teknologi Bandung. Program ini menjadi bentuk kontribusi nyata perguruan tinggi dalam pembinaan talenta muda Indonesia agar memiliki kesiapan yang lebih baik dalam menghadapi kompetisi sains tingkat nasional, khususnya Olimpiade Sains Nasional. Secara khusus, kegiatan ini bertujuan memberikan pembinaan intensif kepada siswa dalam bidang OSN prioritas, yaitu Matematika, Fisika, Kimia, Biologi, Astronomi, Kebumian, Informatika, Geografi, dan Ekonomi; memperkenalkan pendekatan ilmiah serta atmosfer akademik kampus; membangun jejaring pembinaan antara ITB dan SMA mitra; serta menumbuhkan minat siswa terhadap pengembangan karier di bidang sains dan teknologi." },
  { key: "OPSI",          api: "opsi",               label: "OPSI",
    fullName: "Olimpiade Penelitian Siswa Indonesia",
    desc: "Program Pembinaan OPSI difokuskan pada pendampingan riset yang intensif, dengan tujuan mengembangkan ide yang telah agar dapat disusun menjadi proposal penelitian yang matang, sistematis, dan layak ditindaklanjuti. Pelaksanaan tahap ini dikolaborasikan dengan pendampingan pamong secara luring pada mata pelajaran yang relevan dengan topik riset siswa. Dalam prosesnya, pamong juga mendapatkan materi, arahan, dan pendampingan dari dosen ITB secara daring, sehingga memiliki bekal yang memadai untuk mendampingi siswa secara langsung di sekolah." },
  { key: "RISET",         api: "riset",              label: "Riset",
    fullName: "Riset Kolaboratif",
    desc: "Program Pra-Universitas Riset Kolaboratif merupakan kegiatan pembinaan riset yang dirancang secara bertahap untuk menumbuhkan minat, kemampuan berpikir ilmiah, dan keterampilan menyusun karya ilmiah bagi siswa SMA Taruna Nusantara. Program ini terdiri atas tiga tahapan utama, yaitu Research Exposure (Stage 1) untuk memperkenalkan daya tarik riset dan inovasi, Student Research Ideation (Stage 2) untuk mengembangkan ide riset melalui diskusi bersama pamong dan dosen ITB serta penyusunan proposal, dan Advanced Student Research Project (Stage 3) untuk mendampingi siswa dalam pelaksanaan penelitian, pengumpulan dan analisis data, hingga penyusunan hasil riset dalam bentuk artikel ilmiah. Dalam pelaksanaannya, kegiatan juga dikaitkan dengan pendampingan OPSI 2026 sebagai upaya memperkuat ekosistem riset sekolah, meningkatkan kualitas proposal penelitian siswa, serta membangun budaya ilmiah yang lebih sistematis melalui dukungan pamong, mentor, dan dosen ITB." },
  { key: "BTI",           api: "bti",                label: "BTI",
    fullName: "Bina Talenta Indonesia",
    desc: "" },
  { key: "WIT",           api: "wit",                label: "WIT",
    fullName: "Wardah Inspiring Teacher",
    desc: "Program kerjasama Direktorat Persiapan Bersama (DITSAMA) dan Wardah pelatihan bidang AI dan STEM untuk guru-guru SD, SMP dan SMA." },
  { key: "MAUNG",         api: "maung",              label: "MAUNG",
    fullName: "Sekolah Manusia Unggul",
    desc: "Sekolah Maung (Sekolah Manusia Unggul) 2026 merupakan program Dinas Pendidikan Provinsi Jawa Barat melalui Bidang Guru dan Tenaga Kependidikan, yang diselenggarakan sebagai langkah awal penyiapan SMA dan SMK Manusia Unggul di Jawa Barat. Program ini merupakan salah satu upaya Pemerintah Provinsi Jawa Barat dalam memastikan kesiapan pendidik untuk mewujudkan generasi yang unggul, berkarakter, dan berdaya saing global. Melalui program ini, 2.946 guru pada 41 SMA/SMK Manusia Unggul diases dan dipetakan kompetensinya, meliputi pedagogi, penguasaan substansi, kepemimpinan, serta karakter berlandaskan filosofi Pancawaluya. Hasil asesmen menjadi dasar penyusunan rencana pengembangan kompetensi bagi setiap guru." },
];

// Daftar program KHUSUS menu Keuangan (boleh beda dari program monitoring)
export const FIN_PROGRAMS = [
  { api: "siap_itb",           label: "SIAP ITB" },
  { api: "inspirasi_eduquest", label: "INSPIRASI EduQuest" },
  { api: "toraja",             label: "Toraja" },
  { api: "ypk",                label: "YPK" },
  { api: "tn",                 label: "TN (Taruna Nusantara)" },
  { api: "bti",                label: "BTI" },
  { api: "wit",                label: "WIT" },
  { api: "maung",              label: "MAUNG" },
];

// Jabatan (role) -> label tampilan. Program yang dipegang dipilih terpisah saat daftar (khusus PIC).
export const ROLES = [
  ["admin", "Admin"],
  ["kasubdit", "Kasubdit"],
  ["finance", "Finance"],
  ["pic", "PIC"],
];

// Fase kegiatan, urut tetap: Persiapan -> Proses -> Fase 1..10 -> Pelaporan
export const PHASES = [
  ["preparation", "Persiapan"], ["process", "Proses"],
  ["phase_1", "Fase 1"], ["phase_2", "Fase 2"], ["phase_3", "Fase 3"], ["phase_4", "Fase 4"], ["phase_5", "Fase 5"],
  ["phase_6", "Fase 6"], ["phase_7", "Fase 7"], ["phase_8", "Fase 8"], ["phase_9", "Fase 9"], ["phase_10", "Fase 10"],
  ["reporting", "Pelaporan"],
];

// Keberjalanan kegiatan
export const PROGRESS = [
  ["as_planned", "Sesuai Rencana"],
  ["there_is_a_problem", "Ada Kendala"],
  ["not_according_to_plan", "Tidak Sesuai Rencana"],
  ["no_rating", "Tidak Ada Penilaian"],
];

export const ISSUE_LEVELS = [["high", "Tinggi"], ["medium", "Sedang"], ["low", "Rendah"]];

// Peran SDM yang umum (boleh ketik peran lain)
export const SDM_POSITIONS = ["Dosen", "Asisten", "Staff", "Mitra"];

// Jenis PKS -> persen DPKS (dihitung otomatis di backend)
export const PKS_TYPES = [["Pm", "Pm", 10], ["Pd", "Pd", 20], ["DP", "DP · dana pemerintah", 0]];

// Link dashboard/website SUGT (dibuka di tab baru dari menu "Program SUGT")
export const SUGT_URL = "https://internal.sugtitb.com";
