// Sesi login. Sengaja TIDAK disimpan ke localStorage:
// pengguna wajib login setiap kali membuka website (sama seperti versi lama).
import { create } from "zustand";
import { useDataStore } from "./data.js";

export const useAuthStore = create((set) => ({
  // { name, email, role, programs, loginToken, token }
  // token = token setelah Password Akses (dipakai untuk semua data); null -> belum diverifikasi
  session: null,
  notice: "",   // pesan untuk gerbang login (mis. sesi berakhir)

  login: (user, loginToken) => {
    useDataStore.getState().reset();
    set({
      session: { name: user.name, email: user.email, role: user.role, programs: user.programs || [], loginToken, token: null },
      notice: "",
    });
  },
  unlock: (token) => set((s) => ({ session: s.session && { ...s.session, token } })),
  lockAccess: () => set((s) => ({ session: s.session && { ...s.session, token: null } })),
  logout: (notice = "") => {
    set({ session: null, notice });
    useDataStore.getState().reset();
  },
}));
