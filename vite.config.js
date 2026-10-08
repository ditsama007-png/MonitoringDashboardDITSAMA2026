import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import routerConfig from "./react-router.config.js";

export default defineConfig({
  // harus sama dengan `basename` di react-router.config.js
  base: routerConfig.basename,
  plugins: [reactRouter()],
});
