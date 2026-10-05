// GitHub Pages tidak punya rewrite ke index.html. Salin index.html -> 404.html
// supaya membuka langsung URL seperti /dashboard/financial tetap memuat SPA.
import { copyFileSync } from "node:fs";

copyFileSync("build/client/index.html", "build/client/404.html");
console.log("SPA fallback: build/client/404.html dibuat.");
