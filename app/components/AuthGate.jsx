import { useState } from "react";
import { PROGRAMS, ROLES } from "../config.js";
import { api } from "../lib/api.js";
import { useAuthStore } from "../stores/auth.js";
import { Icon } from "./Icon.jsx";
import { Spinner } from "./ui.jsx";

const COPY = {
  login: ["Masuk", "Gunakan email dan password akun Anda."],
  signup: ["Buat akun", "Setelah mendaftar, kami kirim kode verifikasi ke email Anda."],
  verify: ["Verifikasi email", "Masukkan 6 digit kode yang kami kirim ke email Anda."],
  forgot: ["Lupa password", "Masukkan email akun Anda. Kami kirim kode untuk membuat password baru."],
  reset: ["Buat password baru", "Masukkan kode dari email dan password baru Anda."],
};

function Brand() {
  const [failed, setFailed] = useState(false);
  return failed
    ? <div className="gate-logo-text"><b>Direktorat Persiapan Bersama</b><span>Institut Teknologi Bandung</span></div>
    : <img className="gate-logo" src={import.meta.env.BASE_URL + "assets/dpb-logo.png"} alt="Direktorat Persiapan Bersama ITB" onError={() => setFailed(true)} />;
}

function Shell({ children }) {
  return (
    <div className="gate">
      <aside className="gate-side">
        <img className="gate-badge" src={import.meta.env.BASE_URL + "assets/itb-logo.png"} alt="Logo ITB" width="52" height="52" />
        <div>
          <h1>Dashboard Monitoring Program DITSAMA 2026</h1>
          <p>Direktorat Persiapan Bersama · Institut Teknologi Bandung</p>
        </div>
      </aside>
      <main className="gate-main">{children}</main>
    </div>
  );
}

function PasswordInput({ value, onChange, autoComplete, placeholder }) {
  const [show, setShow] = useState(false);
  return (
    <div className="pw">
      <input type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} placeholder={placeholder} required />
      <button type="button" className="pw-eye" onClick={() => setShow(!show)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}>
        <Icon name={show ? "eyeOff" : "eye"} size={17} />
      </button>
    </div>
  );
}

function Msg({ msg }) {
  if (!msg) return null;
  return <div className={"note " + (msg.ok ? "ok" : "err")} role={msg.ok ? "status" : "alert"}><Icon name={msg.ok ? "checkCircle" : "alert"} size={16} /><span>{msg.text}</span></div>;
}

/** Gerbang Masuk / Daftar / Verifikasi / Lupa password (tampil sampai user login). */
export function AuthGate() {
  const login = useAuthStore((s) => s.login);
  const notice = useAuthStore((s) => s.notice);
  const [mode, setMode] = useState("login");
  const [f, setF] = useState({ name: "", role: "pic", email: "", password: "", code: "", programs: [] });
  const [msg, setMsg] = useState(notice ? { ok: false, text: notice } : null);
  const [busy, setBusy] = useState(false);

  const field = (k) => ({ value: f[k], onChange: (e) => setF({ ...f, [k]: e.target.value }) });
  const go = (m, message = null) => { setMode(m); setMsg(message); setF((x) => ({ ...x, code: "", password: m === "login" ? x.password : "" })); };
  const toggleProgram = (api) => setF({ ...f, programs: f.programs.includes(api) ? f.programs.filter((k) => k !== api) : [...f.programs, api] });
  const email = f.email.trim();

  const run = async (fn) => {
    setBusy(true); setMsg(null);
    try { await fn(); } catch (e) { return e; } finally { setBusy(false); }
  };
  const post = (path, body) => api(path, { method: "POST", body, token: null });

  async function submit(e) {
    e.preventDefault();
    const err = await run(async () => {
      if (mode === "login") {
        const out = await post("/auth/login", { email, password: f.password });
        login(out.data.user, out.data.accessToken);
      } else if (mode === "signup") {
        if (f.role === "pic" && !f.programs.length) throw new Error("Pilih minimal satu program yang Anda pegang.");
        await post("/auth/register", {
          name: f.name.trim(), role: f.role, email, password: f.password,
          ...(f.role === "pic" ? { programs: f.programs } : {}),
        });
        go("verify", { ok: true, text: `Kode verifikasi terkirim ke ${email}. Cek juga folder spam.` });
      } else if (mode === "verify") {
        await post("/auth/otp/email/verify", { email, code: f.code.trim() });
        go("login", { ok: true, text: "Email terverifikasi. Silakan masuk." });
      } else if (mode === "forgot") {
        await post("/auth/otp/password-reset", { email });
        go("reset", { ok: true, text: `Kode terkirim ke ${email}.` });
      } else if (mode === "reset") {
        await post("/auth/otp/password-reset/verify", { email, code: f.code.trim(), newPassword: f.password });
        go("login", { ok: true, text: "Password berhasil diganti. Silakan masuk dengan password baru." });
      }
    });
    if (!err) return;
    if (mode === "login" && err.raw?.message === "User is not yet verified.") {
      return go("verify", { ok: false, text: "Email Anda belum diverifikasi. Masukkan kode dari email, atau kirim ulang kode." });
    }
    setMsg({ ok: false, text: err.message });
  }

  async function resend() {
    if (!email) return setMsg({ ok: false, text: "Isi email dulu." });
    const err = await run(async () => {
      await post(mode === "verify" ? "/auth/otp/email" : "/auth/otp/password-reset", { email });
      setMsg({ ok: true, text: `Kode baru terkirim ke ${email}.` });
    });
    if (err) setMsg({ ok: false, text: err.message });
  }

  const [title, sub] = COPY[mode];
  const isEntry = mode === "login" || mode === "signup";
  const button = { login: "Masuk", signup: "Daftar", verify: "Verifikasi", forgot: "Kirim kode", reset: "Simpan password baru" }[mode];

  return (
    <Shell>
      <form className="gate-form" onSubmit={submit}>
        <Brand />
        {isEntry && (
          <div className="seg wide" role="tablist">
            <button type="button" role="tab" aria-selected={mode === "login"} className={mode === "login" ? "on" : ""} onClick={() => go("login")}>Masuk</button>
            <button type="button" role="tab" aria-selected={mode === "signup"} className={mode === "signup" ? "on" : ""} onClick={() => go("signup")}>Daftar</button>
          </div>
        )}
        <div>
          <h2 className="gate-title">{title}</h2>
          <p className="gate-sub">{sub}</p>
        </div>

        {mode === "signup" && (
          <>
            <label className="field"><span className="field-lab">Nama lengkap</span>
              <input type="text" autoComplete="name" placeholder="mis. Budi Santoso" required {...field("name")} />
            </label>
            <label className="field"><span className="field-lab">Jabatan</span>
              <select {...field("role")}>{ROLES.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
            </label>
            {f.role === "pic" && (
              <fieldset className="checks">
                <legend className="field-lab">Program yang Anda pegang</legend>
                <div className="check-grid">
                  {PROGRAMS.map((p) => (
                    <label key={p.api} className={"check" + (f.programs.includes(p.api) ? " on" : "")}>
                      <input type="checkbox" checked={f.programs.includes(p.api)} onChange={() => toggleProgram(p.api)} />
                      <span>{p.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
          </>
        )}

        <label className="field"><span className="field-lab">Email</span>
          <input type="email" autoComplete="email" placeholder="nama@itb.ac.id" required readOnly={mode === "verify" || mode === "reset"} {...field("email")} />
        </label>

        {(mode === "verify" || mode === "reset") && (
          <label className="field"><span className="field-lab">Kode verifikasi</span>
            <input className="otp" type="text" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" maxLength={6} required {...field("code")} />
          </label>
        )}

        {(mode === "login" || mode === "signup" || mode === "reset") && (
          <label className="field">
            <span className="field-lab">{mode === "reset" ? "Password baru" : "Password"}</span>
            <PasswordInput value={f.password} onChange={field("password").onChange}
              autoComplete={mode === "login" ? "current-password" : "new-password"} placeholder={mode === "reset" ? "password baru" : "password"} />
          </label>
        )}

        <Msg msg={msg} />

        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>
          {busy && <Spinner />}{button}
        </button>

        <div className="gate-links">
          {mode === "login" && <button type="button" className="link-btn" onClick={() => go("forgot")}>Lupa password?</button>}
          {(mode === "verify" || mode === "reset") && <button type="button" className="link-btn" disabled={busy} onClick={resend}>Kirim ulang kode</button>}
          {!isEntry && <button type="button" className="link-btn" onClick={() => go("login")}><Icon name="left" size={15} />Kembali ke Masuk</button>}
        </div>
      </form>
    </Shell>
  );
}

/** Password Akses (muncul setelah login, sebelum data dashboard dibuka). */
export function AccessOverlay() {
  const session = useAuthStore((s) => s.session);
  const unlock = useAuthStore((s) => s.unlock);
  const logout = useAuthStore((s) => s.logout);
  const [pass, setPass] = useState("");
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  async function check(e) {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      const out = await api("/auth/access", { method: "POST", body: { password: pass }, token: session.loginToken });
      unlock(out.data.accessToken);
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    } finally { setBusy(false); }
  }

  return (
    <Shell>
      <form className="gate-form" onSubmit={check}>
        <Brand />
        <div className="gate-who">
          <span className="ava">{(session.name || "?").slice(0, 1).toUpperCase()}</span>
          <div><b>{session.name}</b><small>{session.email}</small></div>
        </div>
        <div>
          <h2 className="gate-title"><Icon name="lock" size={20} />Password Akses</h2>
          <p className="gate-sub">Satu langkah lagi. Masukkan Password Akses tim untuk membuka data dashboard.</p>
        </div>
        <label className="field"><span className="field-lab">Password Akses</span>
          <PasswordInput value={pass} onChange={(e) => setPass(e.target.value)} autoComplete="off" placeholder="password akses" />
        </label>
        <Msg msg={msg} />
        <button type="submit" className="btn btn-primary btn-block" disabled={busy}>{busy && <Spinner />}Buka dashboard</button>
        <div className="gate-links">
          <button type="button" className="link-btn" onClick={() => logout()}><Icon name="logout" size={15} />Keluar, ganti akun</button>
        </div>
      </form>
    </Shell>
  );
}
