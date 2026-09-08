/* =========================================================================
   Code.gs — Backend Google Apps Script untuk Dashboard DITSAMA
   Fungsi: (1) baca data 3 sheet -> JSON  (2) simpan data form + cek password.

   CARA SETUP singkat (detail di README):
   1. Buka Google Sheets kamu -> menu Extensions -> Apps Script.
   2. Hapus isi default, tempel SELURUH file ini.
   3. Sesuaikan SPREADSHEET_ID, SHEETS, dan PIC_ACCESS di bawah.
   4. Deploy -> New deployment -> Web app -> Execute as: Me,
      Who has access: Anyone -> Deploy. Salin URL-nya ke config.js (API_URL).
   ========================================================================= */

// ---- KONFIGURASI ----
var SPREADSHEET_ID = "1sg_lZ6m07g9hISqDwDG2MVAoG55oNJgk";  // ID Google Sheets kamu

// program key -> nama sheet
var SHEETS = {
  "SIAP":          "SIAP_2026",
  "INSPIRASI_EDQ": "INSPIRASI_Edq2026",
  "INSPIRASI_SCD": "INSPIRASI_Scd2026",
};

// Password per PIC per program. Format:
//   "PROGRAM_KEY": { "nama_pic": "password" }
// PIC hanya bisa menyimpan ke program yang terdaftar di sini.
var PIC_ACCESS = {
  "SIAP":          { "budi": "siap123" },
  "INSPIRASI_EDQ": { "sari": "edq123" },
  "INSPIRASI_SCD": { "anto": "scd123" },
};

// Baris awal data pada template _2026 (header di baris 7-8, data mulai baris 9)
var DATA_START_ROW = 9;

// Pemetaan field form -> kolom (1-indexed) pada template _2026
var COLMAP = {
  tanggal: 1, kegiatan: 2, anggaran: 3, realisasi: 4, target: 5, actual: 6,
  // H..K = High/Medium/Low/TidakAda (8..11), diisi dari 'level'
  ketisu: 12, nilai: 14, hadir: 15, keberjalanan: 16, feedback: 17,
  jenis: 21,
};

// ---------------------------------------------------------------- READ ------
function doGet(e) {
  var out = { data: {} };
  try {
    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    Object.keys(SHEETS).forEach(function (key) {
      out.data[key] = readSheet_(ss, SHEETS[key]);
    });
  } catch (err) {
    out.error = String(err);
  }
  return json_(out);
}

function readSheet_(ss, sheetName) {
  var sh = ss.getSheetByName(sheetName);
  if (!sh) return [];
  var last = sh.getLastRow();
  if (last < DATA_START_ROW) return [];
  var rng = sh.getRange(DATA_START_ROW, 1, last - DATA_START_ROW + 1, 21).getValues();
  var rows = [];
  rng.forEach(function (r) {
    var kegiatan = String(r[1] || "").trim();
    var jenis = String(r[20] || "").trim();
    if (!kegiatan && !jenis) return;   // lewati baris kosong/hantu/total
    var level = "Tidak Ada";
    if (r[7]) level = "High"; else if (r[8]) level = "Medium";
    else if (r[9]) level = "Low"; else if (r[10]) level = "Tidak Ada";
    rows.push({
      tanggal: fmtDate_(r[0]), kegiatan: kegiatan,
      anggaran: num_(r[2]), realisasi: num_(r[3]),
      target: num_(r[4]), actual: num_(r[5]),
      level: level, ketisu: String(r[11] || ""),
      nilai: num_(r[13]), hadir: num_(r[14]),
      keberjalanan: String(r[15] || ""), feedback: num_(r[16]),
      jenis: jenis,
    });
  });
  return rows;
}

// ---------------------------------------------------------------- WRITE -----
function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    if (body.action !== "write") return json_({ ok: false, error: "aksi tidak dikenal" });

    var prog = body.program, pic = String(body.pic || "").toLowerCase(), pass = String(body.password || "");
    // cek password PIC
    var acc = PIC_ACCESS[prog];
    if (!acc || acc[pic] === undefined) return json_({ ok: false, error: "PIC tidak terdaftar untuk program ini" });
    if (acc[pic] !== pass) return json_({ ok: false, error: "Password salah" });

    var ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    var sh = ss.getSheetByName(SHEETS[prog]);
    if (!sh) return json_({ ok: false, error: "Sheet tidak ditemukan" });

    // cari baris kosong pertama (berdasarkan kolom B / Nama Kegiatan)
    var last = sh.getLastRow();
    var target = Math.max(last + 1, DATA_START_ROW);
    var r = body.row || {};

    setCell_(sh, target, COLMAP.tanggal, r.tanggal ? new Date(r.tanggal) : "");
    setCell_(sh, target, COLMAP.kegiatan, r.kegiatan || "");
    setCell_(sh, target, COLMAP.anggaran, numOrBlank_(r.anggaran));
    setCell_(sh, target, COLMAP.realisasi, numOrBlank_(r.realisasi));
    setCell_(sh, target, COLMAP.target, numOrBlank_(r.target));
    setCell_(sh, target, COLMAP.actual, numOrBlank_(r.actual));
    setCell_(sh, target, COLMAP.ketisu, r.ketisu || "");
    setCell_(sh, target, COLMAP.nilai, numOrBlank_(r.nilai));
    setCell_(sh, target, COLMAP.hadir, numOrBlank_(r.hadir));
    setCell_(sh, target, COLMAP.keberjalanan, r.keberjalanan || "");
    setCell_(sh, target, COLMAP.feedback, numOrBlank_(r.feedback));
    setCell_(sh, target, COLMAP.jenis, r.jenis || "");

    // level isu -> centang kolom H/I/J/K (8..11)
    var lv = (r.level || "Tidak Ada");
    setCell_(sh, target, 8, lv === "High");
    setCell_(sh, target, 9, lv === "Medium");
    setCell_(sh, target, 10, lv === "Low");
    setCell_(sh, target, 11, lv === "Tidak Ada");

    updatePivot_(ss);          // perbarui sheet "Pivot"
    return json_({ ok: true, row: target });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

// ---------------------------------------------------------------- PIVOT -----
var KEBER = { "sesuai rencana": 1, "ada kendala": 0.7, "tidak sesuai rencana": 0.4 };
var LABELS = { "SIAP": "SIAP ITB", "INSPIRASI_EDQ": "INSPIRASI EduQuest", "INSPIRASI_SCD": "INSPIRASI SCD" };

function updatePivot_(ss) {
  var sh = ss.getSheetByName("Pivot") || ss.insertSheet("Pivot");
  sh.clear();
  sh.getRange(1, 1).setValue("PIVOT DATA MONITORING DITSAMA 2026").setFontWeight("bold").setFontSize(12);
  sh.getRange(2, 1).setValue("Diperbarui otomatis: " + new Date()).setFontColor("#888888");

  var headers = ["Program", "Jumlah Kegiatan", "Total Anggaran", "Total Realisasi",
                 "Total Target", "Total Actual", "Progress"];
  sh.getRange(4, 1, 1, headers.length).setValues([headers])
    .setFontWeight("bold").setFontColor("#FFFFFF").setBackground("#1B3A6B");

  var row = 5;
  var tot = { keg: 0, ang: 0, real: 0, tgt: 0, act: 0 };
  Object.keys(SHEETS).forEach(function (key) {
    var rows = readSheet_(ss, SHEETS[key]);
    var keg = 0, ang = 0, real = 0, tgt = 0, act = 0, scores = [];
    rows.forEach(function (r) {
      if (String(r.kegiatan).trim()) keg++;
      ang += r.anggaran; real += r.realisasi; tgt += r.target; act += r.actual;
      var comps = [];
      ["nilai", "hadir", "feedback"].forEach(function (k) { if (r[k] > 0) comps.push(Math.min(r[k], 1)); });
      var kb = KEBER[(r.keberjalanan || "").toLowerCase()];
      if (kb !== undefined) comps.push(kb);
      if (comps.length) scores.push(comps.reduce(function (a, b) { return a + b; }, 0) / comps.length);
    });
    var prog = scores.length ? Math.min(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length, 1) : 0;
    sh.getRange(row, 1, 1, headers.length).setValues([[
      LABELS[key] || key, keg, ang, real, tgt, act, Math.round(prog * 100) + "%"]]);
    tot.keg += keg; tot.ang += ang; tot.real += real; tot.tgt += tgt; tot.act += act;
    row++;
  });
  // baris total
  sh.getRange(row, 1, 1, headers.length).setValues([[
    "TOTAL", tot.keg, tot.ang, tot.real, tot.tgt, tot.act, ""]]).setFontWeight("bold").setBackground("#EAF1FB");

  sh.getRange(5, 3, row - 4, 2).setNumberFormat('"Rp" #,##0');
  sh.autoResizeColumns(1, headers.length);
}

// menu manual di Google Sheets untuk refresh pivot
function onOpen() {
  SpreadsheetApp.getUi().createMenu("Dashboard DITSAMA")
    .addItem("Refresh Pivot", "refreshPivotMenu_").addToUi();
}
function refreshPivotMenu_() {
  updatePivot_(SpreadsheetApp.openById(SPREADSHEET_ID));
}

// ---------------------------------------------------------------- utils -----
function setCell_(sh, row, col, val) { sh.getRange(row, col).setValue(val); }
function num_(v) { var n = parseFloat(String(v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; }
function numOrBlank_(v) { if (v === "" || v === null || v === undefined) return ""; var n = Number(v); return isNaN(n) ? "" : n; }
function fmtDate_(v) {
  if (v instanceof Date && !isNaN(v)) {
    return Utilities.formatDate(v, Session.getScriptTimeZone(), "yyyy-MM-dd");
  }
  return String(v || "");
}
function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
