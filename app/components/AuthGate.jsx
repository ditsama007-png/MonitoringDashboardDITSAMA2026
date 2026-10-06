import { useState } from "react";
import { JABATAN, PROGRAMS } from "../config.js";
import { apiPost, HAS_API } from "../lib/api.js";
import { useAuthStore } from "../stores/auth.js";
import { SaveMsg } from "./ui.jsx";

const SUBTITLE = {
  login: "Masuk cukup dengan nama/username & password.",
  signup: "Daftar: isi data, klik 'Kirim kode', masukkan kode dari email, lalu Daftar.",
  forgot: "Lupa password: masukkan email, klik 'Kirim kode', lalu isi kode + password baru.",
};
const BUTTON = { login: "Masuk", signup: "Daftar", forgot: "Reset Password" };

// ---- mode contoh (tanpa API_URL): akun disimpan di localStorage ----
const readDemoUsers = () => { try { return JSON.parse(localStorage.getItem("ditsama_users") || "[]"); } catch { return []; } };
const writeDemoUsers = (u) => { try { localStorage.setItem("ditsama_users", JSON.stringify(u)); } catch { /* abaikan */ } };

/** Gerbang Login / Sign up / Lupa password (tampil sampai user login). */
export function AuthGate() {
  const login = useAuthStore((s) => s.login);
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ nama: "", jabatan: JABATAN[0], email: "", code: "", pass: "", programs: [] });
  const [msg, setMsg] = useState(null);
  const [demoCode, setDemoCode] = useState(null);
  const [busy, setBusy] = useState(false);

  const isLogin = mode === "login", isSignup = mode === "signup", isForgot = mode === "forgot";
  const field = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const switchMode = (m) => { setMode(m); setMsg(null); };
  const done = (text) => { switchMode("login"); setMsg({ ok: true, text }); };
  const toggleProgram = (key) => setF({
    ...f, programs: f.programs.includes(key) ? f.programs.filter((k) => k !== key) : [...f.programs, key],
  });

  async function sendCode() {
    if (!f.email.trim()) return setMsg({ ok: false, text: "Isi email dulu." });
    if (!HAS_API) {   // demo: tampilkan kode via alert
      const code = String(Math.floor(100000 + Math.random() * 900000));
      setDemoCode(code);
      alert("MODE DEMO — kode verifikasi kamu: " + code + "\n(Di versi asli, ini dikirim ke email.)");
      return setMsg({ ok: true, text: "Kode dikirim (demo). Cek popup." });
    }
    setMsg({ text: "Mengirim kode..." });
    try {
      const out = await apiPost({ action: "send_code", email: f.email.trim(), purpose: isForgot ? "reset" : "signup" });
      setMsg(out.ok ? { ok: true, text: "✅ Kode terkirim ke email. Cek inbox/spam." } : { ok: false, text: "❌ " + (out.error || "Gagal kirim kode.") });
    } catch { setMsg({ ok: false, text: "❌ Gagal terhubung ke server." }); }
  }

  function demoAuth(nama, email, pass, code) {
    const store = readDemoUsers();
    if (isSignup || isForgot) {
      if (!demoCode || code !== demoCode) return setMsg({ ok: false, text: "Kode salah (klik Kirim kode dulu)." });
    }
    if (isSignup) {
      if (store.some((u) => u.nama.toLowerCase() === nama.toLowerCase())) return setMsg({ ok: false, text: "Nama sudah terdaftar." });
      writeDemoUsers([...store, { nama, jabatan: f.jabatan, email, password: pass, programs: f.programs }]);
      setDemoCode(null);
      return done("✅ Terdaftar (demo). Silakan login.");
    }
    if (isForgot) {
      const idx = store.findIndex((u) => (u.email || "").toLowerCase() === email.toLowerCase());
      if (idx < 0) return setMsg({ ok: false, text: "Email tidak terdaftar." });
      store[idx].password = pass; writeDemoUsers(store);
      setDemoCode(null);
      return done("✅ Password diubah (demo). Silakan login.");
    }
    const u = store.find((x) => x.nama.toLowerCase() === nama.toLowerCase() && x.password === pass);
    if (!u) return setMsg({ ok: false, text: "Nama/password salah, atau belum sign up." });
    login({ nama: u.nama, jabatan: u.jabatan, email: u.email, programs: u.programs || [], token: "demo" });
  }

  async function doAuth(e) {
    e.preventDefault();
    const nama = f.nama.trim(), email = f.email.trim(), code = f.code.trim(), pass = f.pass;
    if (isLogin && (!nama || !pass)) return setMsg({ ok: false, text: "Isi nama & password." });
    if (isSignup) {
      if (!nama || !f.jabatan || !email || !pass || !code) return setMsg({ ok: false, text: "Lengkapi semua kolom + kode." });
      if (f.jabatan === "PIC" && !f.programs.length) return setMsg({ ok: false, text: "Pilih minimal satu program." });
    }
    if (isForgot && (!email || !code || !pass)) return setMsg({ ok: false, text: "Isi email, kode, & password baru." });
    if (!HAS_API) return demoAuth(nama, email, pass, code);

    setMsg({ text: "Memproses..." });
    setBusy(true);
    try {
      const out = await apiPost({
        action: isForgot ? "reset" : mode, nama, jabatan: f.jabatan, email, password: pass, code, programs: f.programs,
      });
      if (!out.ok) return setMsg({ ok: false, text: "❌ " + (out.error || "Gagal.") });
      if (isSignup) return done("✅ Terdaftar. Silakan login.");
      if (isForgot) return done("✅ Password diubah. Silakan login.");
      login({ nama: out.user.nama, jabatan: out.user.jabatan, email: out.user.email, programs: out.user.programs || [], token: out.token });
    } catch {
      setMsg({ ok: false, text: "❌ Gagal terhubung ke server." });
    } finally { setBusy(false); }
  }

  // Pilihan program hanya muncul saat SIGN UP dan jabatan = PIC
  // (Admin & Head Program otomatis akses semua program).
  const showPrograms = isSignup && f.jabatan === "PIC";

  return (
    <div className="gate" id="auth-gate">
      <form className="gate-box" onSubmit={doAuth}>
        <div className="gate-brand"><span className="badge">ITB</span> Dashboard DITSAMA 2026</div>
        <div className="tabs">
          <button type="button" className={"tab" + (isLogin ? " active" : "")} onClick={() => switchMode("login")}>Login</button>
          <button type="button" className={"tab" + (isSignup ? " active" : "")} onClick={() => switchMode("signup")}>Sign up</button>
        </div>
        <div className="sub">{SUBTITLE[mode]}</div>

        {!isForgot && <label>Nama / Username<input type="text" placeholder="mis. Budi" value={f.nama} onChange={field("nama")} /></label>}
        {isSignup && (
          <label>Jabatan
            <select value={f.jabatan} onChange={field("jabatan")}>{JABATAN.map((j) => <option key={j}>{j}</option>)}</select>
          </label>
        )}
        {showPrograms && (
          <div>
            <div className="prog-title">Program yang dipegang</div>
            <details className="prog-dd">
              <summary>{f.programs.length ? f.programs.length + " program dipilih" : "Pilih program (klik untuk buka)…"}</summary>
              <div className="prog-check">
                {PROGRAMS.map((p) => (
                  <label className="prog-item" key={p.key}>
                    <input type="checkbox" checked={f.programs.includes(p.key)} onChange={() => toggleProgram(p.key)} /> {p.label}
                  </label>
                ))}
              </div>
            </details>
          </div>
        )}
        {!isLogin && (
          <>
            <label>Email<input type="email" placeholder="nama@itb.ac.id" value={f.email} onChange={field("email")} /></label>
            <button type="button" className="btn-ghost wide" onClick={sendCode}>✉️ Kirim kode ke email</button>
            <label>Kode Verifikasi (dari email)<input type="text" placeholder="6 digit" value={f.code} onChange={field("code")} /></label>
          </>
        )}
        <label>Password
          <input type="password" placeholder={isForgot ? "password BARU" : "password"} value={f.pass} onChange={field("pass")} />
        </label>
        <button type="submit" className="btn-primary wide" disabled={busy}>{BUTTON[mode]}</button>
        <div><SaveMsg msg={msg} /></div>
        <div className="gate-links">
          {isLogin
            ? <a href="#" onClick={(e) => { e.preventDefault(); switchMode("forgot"); }}>Lupa password?</a>
            : <a href="#" onClick={(e) => { e.preventDefault(); switchMode("login"); }}>← Kembali ke login</a>}
        </div>
      </form>
    </div>
  );
}

/** Overlay blur + Password Akses (muncul setelah login). */
export function AccessOverlay() {
  const unlock = useAuthStore((s) => s.unlock);
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState(null);

  async function check(e) {
    e.preventDefault();
    if (!HAS_API) return unlock();   // mode demo (tanpa server): langsung buka
    setMsg({ text: "Memeriksa..." });
    try {
      const out = await apiPost({ action: "check_access", password: pass });
      if (out.ok) unlock(); else setMsg({ ok: false, text: "Password Akses salah." });
    } catch { setMsg({ ok: false, text: "Gagal terhubung ke server." }); }
  }

  return (
    <div className="access-overlay" id="access-overlay">
      <form className="access-box" onSubmit={check}>
        <div className="gate-brand"><span className="badge">ITB</span> Verifikasi Akses</div>
        <div className="sub">Masukkan Password Akses untuk membuka dashboard.</div>
        <label>Password Akses
          <input type="password" placeholder="password akses" value={pass} autoFocus onChange={(e) => setPass(e.target.value)} />
        </label>
        <button type="submit" className="btn-primary wide">Buka Dashboard</button>
        <SaveMsg msg={msg} />
      </form>
    </div>
  );
}
