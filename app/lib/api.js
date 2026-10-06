// Komunikasi dengan Google Apps Script (Web App).
import { API_URL } from "../config.js";

export const HAS_API = Boolean(API_URL);

// POST JSON (Content-Type text/plain agar tidak memicu CORS preflight Apps Script)
export async function apiPost(body, { signal } = {}) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify(body),
    signal,
  });
  return res.json();
}

// Sama seperti apiPost, tapi balasan non-JSON (halaman error HTML Apps Script)
// diringkas jadi pesan yang bisa dibaca. Mengembalikan { out } atau { error }.
export async function apiPostVerbose(body) {
  let res, txt = "";
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body),
    });
    txt = await res.text();
  } catch (e) {
    return { error: "Tidak bisa menghubungi server (" + (e && e.message ? e.message : e) + "). Cek koneksi internet / API_URL di config.js." };
  }
  try {
    return { out: JSON.parse(txt) };
  } catch {
    const plain = txt.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    console.error(body.action + ": balasan bukan JSON", res && res.status, txt.slice(0, 1000));
    return { error: "Server membalas error (HTTP " + (res ? res.status : "?") + "): " + (plain.slice(0, 300) || "(kosong)") };
  }
}
