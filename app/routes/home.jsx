import { useState } from "react";
import { Link } from "react-router";
import homeCss from "../styles/home.css?url";

export function links() {
  return [{ rel: "stylesheet", href: homeCss }];
}

export function meta() {
  return [{ title: "DITSAMA — Direktorat Persiapan Bersama ITB" }];
}

const scrollTo = (id) => document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });

export default function Home() {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <>
      {/* ================= HERO / HOME ================= */}
      <section className="hero" id="top">
        <header className="hero-title">DITSAMA</header>

        <div className="logo-area">
          {/* Logo resmi di public/assets/dpb-logo.png. Kalau gagal dimuat, tampil teks. */}
          {logoFailed ? (
            <div className="logo-text">
              <span className="lt-1">Direktorat Persiapan Bersama</span>
              <span className="lt-2">Institut Teknologi Bandung</span>
            </div>
          ) : (
            <img src={import.meta.env.BASE_URL + "assets/dpb-logo.png"} alt="DPB ITB" className="logo-img"
              onError={() => setLogoFailed(true)} />
          )}
        </div>

        <nav className="menu-bar">
          <button className="menu-item" type="button" onClick={() => scrollTo("layanan")}>
            <span className="bubble">
              <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="#fff" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="7" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" />
                <rect x="14" y="4" width="7" height="5" rx="1" /><path d="M17.5 9v3" />
              </svg>
            </span>
            <span className="lbl">Layanan</span>
          </button>

          <button className="menu-item" type="button" onClick={() => scrollTo("about")}>
            <span className="bubble">
              <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="#fff" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round">
                <circle cx="8" cy="8" r="3" /><circle cx="16" cy="8" r="3" />
                <path d="M2 20c0-3 2.5-5 6-5s6 2 6 5" /><path d="M14 15c3 0 6 2 6 5" />
              </svg>
            </span>
            <span className="lbl">About</span>
          </button>

          <Link className="menu-item" to="/dashboard">
            <span className="bubble">
              <svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="#fff" strokeWidth="1.7"
                strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 5h7v14H4z" /><path d="M13 5h7v14h-7z" /><path d="M15 9h3M15 12h3" />
                <circle cx="9" cy="9" r="1.4" />
              </svg>
            </span>
            <span className="lbl">Program</span>
          </Link>
        </nav>

        <div className="batik" />
      </section>

      {/* ================= ABOUT ================= */}
      <section className="section" id="about">
        <h2>About DITSAMA</h2>
        <p>
          Direktorat Persiapan Bersama (DPB) Institut Teknologi Bandung menaungi program
          persiapan pra-universitas DITSAMA. Dashboard ini digunakan untuk memantau
          performa portofolio setiap program: SIAP, INSPIRASI EduQuest, dan INSPIRASI
          Sang Cendekia.
        </p>
        <p className="muted">
          (Silakan ganti teks ini dengan deskripsi resmi DITSAMA — visi, misi, dan
          cakupan program.)
        </p>
        <a className="btn-back" href="#top" onClick={(e) => { e.preventDefault(); scrollTo("top"); }}>↑ Kembali ke atas</a>
      </section>

      {/* ================= LAYANAN (placeholder) ================= */}
      <section className="section alt" id="layanan">
        <h2>Layanan</h2>
        <p className="muted">Bagian ini akan diisi kemudian.</p>
      </section>

      <footer className="foot">© DITSAMA · Institut Teknologi Bandung</footer>
    </>
  );
}
