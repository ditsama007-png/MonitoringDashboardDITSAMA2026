// Store data dari Google Sheets (via Apps Script). Dipakai bersama oleh semua halaman dashboard.
import { create } from "zustand";
import { apiPost, apiPostVerbose, HAS_API } from "../lib/api.js";
import { useAuthStore } from "./auth.js";
import { useUiStore } from "./ui.js";

const sessionToken = () => useAuthStore.getState().session?.token || null;

export const useDataStore = create((set, get) => ({
  // DataMasuk (data utama dashboard)
  flex: { header: [], rows: [] },
  flexLoaded: false,
  // sheet Financial
  fin: { rows: [], saldo: {} },
  finLoaded: false,
  // tab "Peserta*", "Dosen*", "Capaian*" (butuh login). raw === null -> belum dimuat
  peserta: { raw: null, err: "" },
  dosen: { raw: null, err: "" },
  capaian: { raw: null, err: "", loading: false },

  loadFlex: async () => {
    if (HAS_API) {
      try {
        const out = await apiPost({ action: "read_flex" });
        if (out.ok) set({ flex: { header: out.header || [], rows: out.rows || [] } });
      } catch (e) { console.error("read_flex gagal:", e); }
    }
    set({ flexLoaded: true });
    useUiStore.setState({ calMonth: null });   // kalender re-center ke bulan data terbaru
  },

  loadFin: async () => {
    if (HAS_API) {
      try {
        const out = await apiPost({ action: "read_fin" });
        if (out.ok) set({ fin: { rows: out.rows || [], saldo: out.saldo || {} } });
      } catch (e) { console.error("read_fin gagal:", e); }
    }
    set({ finLoaded: true });
  },

  // muat data inti sekali (dipanggil dari clientLoader layout dashboard)
  ensureCore: () => {
    const s = get();
    if (s._corePromise) return s._corePromise;
    const p = Promise.all([s.loadFlex(), s.loadFin()]);
    set({ _corePromise: p });
    return p;
  },

  loadPeserta: async () => {
    if (!HAS_API) { set((s) => ({ peserta: { raw: s.peserta.raw || [], err: "" } })); return; }
    const token = sessionToken();
    if (!token) { set((s) => ({ peserta: { ...s.peserta, err: "Silakan login dulu." } })); return; }
    const { out, error } = await apiPostVerbose({ action: "read_peserta", token });
    if (error) set((s) => ({ peserta: { ...s.peserta, err: error } }));
    else if (out.ok) set({ peserta: { raw: out.tabs || [], err: "" } });
    else set((s) => ({ peserta: { ...s.peserta, err: out.error || "Gagal memuat data peserta." } }));
  },

  loadDosen: async () => {
    if (!HAS_API) { set((s) => ({ dosen: { raw: s.dosen.raw || [], err: "" } })); return; }
    const token = sessionToken();
    if (!token) { set((s) => ({ dosen: { ...s.dosen, err: "Silakan login dulu." } })); return; }
    const { out, error } = await apiPostVerbose({ action: "read_dosen", token });
    const err = error || (!out.ok && (out.error === "aksi tidak dikenal"
      ? "Code.gs di server belum versi terbaru (belum ada read_dosen). Tempel Code.gs baru lalu Deploy → New version."
      : out.error || "Gagal memuat data dosen."));
    if (err) set((s) => ({ dosen: { ...s.dosen, err } }));
    else set({ dosen: { raw: out.tabs || [], err: "" } });
  },

  loadCapaian: async () => {
    if (!HAS_API) { set((s) => ({ capaian: { raw: s.capaian.raw || [], err: "", loading: false } })); return; }
    const token = sessionToken();
    if (!token || get().capaian.loading) return;
    set((s) => ({ capaian: { ...s.capaian, err: "", loading: true } }));
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 30000);   // maks 30 detik
    let raw = get().capaian.raw, err = "";
    try {
      const out = await apiPost({ action: "read_capaian", token }, { signal: ctl.signal });
      if (out.ok) raw = out.tabs || [];
      else err = out.error === "aksi tidak dikenal" ? "Code.gs di server belum versi terbaru (Deploy → New version)." : (out.error || "Gagal memuat capaian.");
    } catch (e) {
      err = e && e.name === "AbortError" ? "Server terlalu lama membalas (>30 detik). Klik Refresh Data untuk mencoba lagi."
        : e instanceof SyntaxError ? "Server membalas error." : "Gagal terhubung ke server.";
    } finally { clearTimeout(timer); }
    // gagal -> jangan dicoba ulang terus (dicoba lagi lewat tombol Refresh)
    set({ capaian: { raw: raw === null ? [] : raw, err, loading: false } });
  },

  // data yang butuh login dikosongkan saat login/logout
  resetPrivate: () => set({
    peserta: { raw: null, err: "" },
    dosen: { raw: null, err: "" },
    capaian: { raw: null, err: "", loading: false },
  }),
}));
