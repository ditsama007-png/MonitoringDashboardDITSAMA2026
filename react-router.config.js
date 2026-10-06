/** @type {import("@react-router/dev/config").Config} */
export default {
  // Website statis (GitHub Pages / Vercel) -> Single Page App, tanpa server rendering.
  ssr: false,
  // Vercel melayani dari root domain (env VERCEL=1 saat build di Vercel).
  // GitHub Pages: path repo -> https://<user>.github.io/MonitoringDashboardDITSAMA2026/
  // Bisa ditimpa manual dengan env BASE_PATH.
  basename: process.env.BASE_PATH || (process.env.VERCEL ? "/" : "/MonitoringDashboardDITSAMA2026/"),
};
