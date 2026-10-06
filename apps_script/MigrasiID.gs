/* ============================================================
   MIGRASI ID DataMasuk -> format baru (jalankan SEKALI)
   Format: <4 digit acak>-<dd>-<mm>-<yyyy>/<program>/<fase>
   Contoh: 4821-06-10-2026/SIAP/Fase1

   Cara pakai:
   1. Buka Google Sheets -> Extensions -> Apps Script.
   2. Tambah file baru (+ -> Script), beri nama MigrasiID, tempel isi file ini.
   3. Pilih fungsi `migrasiIdDataMasuk` di toolbar, klik Run.
   4. Sebelum mengubah apa pun, script membuat salinan sheet
      "DataMasuk_backup_<tanggal jam>" sebagai cadangan.
   Tanggal diambil dari kolom "Waktu Input" (cadangan: "Tanggal Kegiatan").
   Baris yang ID-nya sudah berformat baru dilewati, jadi aman dijalankan ulang.
   ============================================================ */
var MIGRASI_SPREADSHEET_ID = "11b_kQGiPNyO-Gkej9dugfQtuoHr2s-D57vxlRv77oCE";

// label program yang mungkin tersimpan di kolom Program -> kode program
var MIGRASI_PROGRAM_KEY = {
  "SIAP ITB": "SIAP", "INSPIRASI EduQuest": "INSPIRASI_EDQ", "INSPIRASI SCD": "INSPIRASI_SCD", "Riset": "RISET",
};

function migrasiIdDataMasuk() {
  var ss = SpreadsheetApp.openById(MIGRASI_SPREADSHEET_ID);
  var sh = ss.getSheetByName("DataMasuk");
  if (!sh) throw new Error('Sheet "DataMasuk" tidak ditemukan.');
  var lastRow = sh.getLastRow(), lastCol = sh.getLastColumn();
  if (lastRow < 2) { Logger.log("Belum ada data."); return; }

  var header = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String);
  var cId = header.indexOf("ID"), cWaktu = header.indexOf("Waktu Input"), cProg = header.indexOf("Program"),
      cFase = header.indexOf("Fase Kegiatan"), cTgl = header.indexOf("Tanggal Kegiatan");
  if (cId < 0) throw new Error('Kolom "ID" tidak ditemukan.');

  // cadangan dulu
  var tz = Session.getScriptTimeZone();
  sh.copyTo(ss).setName("DataMasuk_backup_" + Utilities.formatDate(new Date(), tz, "yyyy-MM-dd HH.mm"));

  var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
  var POLA_BARU = /^\d{4}-\d{2}-\d{2}-\d{4}\//;
  var taken = {};
  data.forEach(function (r) { taken[String(r[cId])] = true; });

  var ids = [], diubah = 0;
  data.forEach(function (r) {
    var lama = String(r[cId] || "");
    if (POLA_BARU.test(lama)) { ids.push([lama]); return; }
    var d = tanggalDari_(cWaktu >= 0 ? r[cWaktu] : "") || tanggalDari_(cTgl >= 0 ? r[cTgl] : "") || new Date();
    var prog = String(cProg >= 0 ? r[cProg] : "").trim();
    prog = MIGRASI_PROGRAM_KEY[prog] || prog.replace(/\s+/g, "_") || "-";
    var fase = String(cFase >= 0 ? r[cFase] : "").replace(/\s+/g, "") || "-";
    var baru;
    do baru = (1000 + Math.floor(Math.random() * 9000)) + "-" + Utilities.formatDate(d, tz, "dd-MM-yyyy") + "/" + prog + "/" + fase;
    while (taken[baru]);
    taken[baru] = true;
    ids.push([baru]);
    diubah++;
  });

  var rng = sh.getRange(2, cId + 1, ids.length, 1);
  rng.setNumberFormat("@");   // simpan sebagai teks biasa
  rng.setValues(ids);
  Logger.log("Selesai. " + diubah + " ID diubah, " + (ids.length - diubah) + " sudah berformat baru.");
}

// Date dari sel (objek Date, "yyyy-MM-dd HH:mm", "yyyy-MM-dd", atau "dd/MM/yyyy")
function tanggalDari_(v) {
  if (v instanceof Date && !isNaN(v)) return v;
  var s = String(v || "").trim(), m;
  if ((m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) return new Date(+m[1], +m[2] - 1, +m[3]);
  if ((m = /^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/.exec(s))) return new Date(+m[3], +m[2] - 1, +m[1]);
  return null;
}
