// Cache data dari backend, dipakai bersama oleh semua halaman dashboard.
// Kunci = path + query. Setelah simpan/hapus, panggil invalidate("/activities", ...) agar halaman memuat ulang.
import { useEffect, useRef } from "react";
import { create } from "zustand";
import { api } from "../lib/api.js";
import { useAuthStore } from "./auth.js";

let seq = 0;

export const useDataStore = create((set, get) => ({
  entries: {},   // key -> { data, error, loading, stale, req }

  load: async (key, path, query) => {
    const req = ++seq;
    set((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], loading: true, stale: false, req } } }));
    let patch;
    try {
      patch = { data: await api(path, { query }), error: null };
    } catch (e) {
      patch = { error: e.message || "Gagal memuat data." };
    }
    if (get().entries[key]?.req !== req) return;   // sudah ada permintaan yang lebih baru
    set((s) => ({ entries: { ...s.entries, [key]: { ...s.entries[key], ...patch, loading: false } } }));
  },

  // tandai data dengan awalan path tertentu sebagai usang -> dimuat ulang saat dipakai
  invalidate: (...prefixes) => set((s) => ({
    entries: Object.fromEntries(Object.entries(s.entries).map(([k, e]) =>
      [k, prefixes.some((p) => k.startsWith(p)) ? { ...e, stale: true } : e])),
  })),

  reset: () => set({ entries: {} }),
}));

export const invalidate = (...prefixes) => useDataStore.getState().invalidate(...prefixes);

const keyOf = (path, query) => path + "?" + JSON.stringify(Object.entries(query || {})
  .filter(([, v]) => v !== undefined && v !== null && v !== "")
  .sort(([a], [b]) => a.localeCompare(b)));

/**
 * Ambil data endpoint GET. Data lama tetap tampil saat filter/halaman berganti (tidak berkedip).
 * `reload(extra)` memuat ulang paksa, mis. reload({ refresh: true }) untuk menyegarkan cache Google Sheets.
 */
export function useApi(path, query, { enabled = true } = {}) {
  const key = keyOf(path, query);
  const entry = useDataStore((s) => s.entries[key]);
  const token = useAuthStore((s) => s.session?.token);
  const last = useRef(null);
  const queryRef = useRef(query);
  queryRef.current = query;

  useEffect(() => {
    if (!enabled || !token) return;
    const e = useDataStore.getState().entries[key];
    if (e && (e.loading || (!e.stale && (e.data || e.error)))) return;
    useDataStore.getState().load(key, path, queryRef.current);
  }, [key, path, enabled, token, entry?.stale]);

  if (entry?.data) last.current = entry.data;
  return {
    data: entry?.data ?? last.current,
    error: entry?.error || null,
    loading: !entry || !!entry.loading,
    fresh: !!entry?.data,
    reload: (extra) => useDataStore.getState().load(key, path, { ...queryRef.current, ...extra }),
  };
}
