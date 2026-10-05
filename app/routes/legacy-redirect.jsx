import { redirect } from "react-router";

// Bookmark lama (index.html / dashboard.html) diarahkan ke route baru.
export function clientLoader({ request }) {
  const { pathname } = new URL(request.url);
  throw redirect(pathname.endsWith("dashboard.html") ? "/dashboard" : "/");
}

export default function LegacyRedirect() {
  return null;
}
