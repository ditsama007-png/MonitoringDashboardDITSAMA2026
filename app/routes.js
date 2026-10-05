import { index, layout, prefix, route } from "@react-router/dev/routes";

export default [
  index("./routes/home.jsx"),

  ...prefix("dashboard", [
    layout("./routes/dashboard/layout.jsx", [
      index("./routes/dashboard/portfolio.jsx"),
      route("financial", "./routes/dashboard/financial.jsx"),
      route("peserta", "./routes/dashboard/peserta.jsx"),
      route("dosen", "./routes/dashboard/dosen.jsx"),
      route("input", "./routes/dashboard/input.jsx"),
      route("program/:programKey", "./routes/dashboard/program.jsx"),
    ]),
  ]),

  // URL lama situs statis -> URL baru
  route("index.html", "./routes/legacy-redirect.jsx", { id: "legacy-index" }),
  route("dashboard.html", "./routes/legacy-redirect.jsx", { id: "legacy-dashboard" }),

  route("*", "./routes/not-found.jsx"),
];
