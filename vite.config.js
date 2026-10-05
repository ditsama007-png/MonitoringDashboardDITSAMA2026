import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";

export default defineConfig({
  // harus sama dengan `basename` di react-router.config.js
  base: "/MonitoringDashboardDITSAMA2026/",
  plugins: [reactRouter()],
});
