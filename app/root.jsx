import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

export function Layout({ children }) {
  return (
    <html lang="id">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return <Outlet />;
}

export function HydrateFallback() {
  return <p style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>Memuat…</p>;
}

export function ErrorBoundary({ error }) {
  let title = "Terjadi kesalahan";
  let detail = "Silakan muat ulang halaman.";
  if (isRouteErrorResponse(error)) {
    title = error.status === 404 ? "Halaman tidak ditemukan" : `${error.status} ${error.statusText}`;
    detail = typeof error.data === "string" ? error.data : detail;
  } else if (error instanceof Error) {
    detail = error.message;
  }
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <title>{title}</title>
      <h1>{title}</h1>
      <p>{detail}</p>
      <a href={import.meta.env.BASE_URL}>← Kembali ke beranda</a>
    </main>
  );
}
