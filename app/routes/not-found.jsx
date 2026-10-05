import { data } from "react-router";

export function clientLoader() {
  throw data("Halaman yang Anda cari tidak ada.", { status: 404 });
}

export default function NotFound() {
  return null;
}
