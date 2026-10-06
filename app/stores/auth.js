// Sesi login. Sengaja TIDAK disimpan ke localStorage:
// pengguna wajib login setiap kali membuka website (sama seperti versi lama).
import { create } from "zustand";
import { useDataStore } from "./data.js";

export const useAuthStore = create((set) => ({
  session: null,          // { nama, jabatan, email, programs, token }
  accessUnlocked: false,  // sudah memasukkan Password Akses?

  login: (session) => {
    set({ session, accessUnlocked: false });
    const data = useDataStore.getState();
    data.resetPrivate();
    data.loadCapaian();   // mulai langsung, paralel dgn data lain
  },
  unlock: () => set({ accessUnlocked: true }),
  logout: () => {
    set({ session: null, accessUnlocked: false });
    useDataStore.getState().resetPrivate();
  },
}));
