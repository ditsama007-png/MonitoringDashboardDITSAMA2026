// Pembatasan halaman per jabatan (mengikuti hak akses backend).
import { Link } from "react-router";
import { canEditFinance, canSeeActivities, roleLabel } from "../lib/format.js";
import { useAuthStore } from "../stores/auth.js";
import { Icon } from "./Icon.jsx";
import { EmptyState } from "./ui.jsx";

export const ACCESS = {
  activities: { can: canSeeActivities, who: "Admin, Kasubdit, dan PIC" },
  finance: { can: canEditFinance, who: "Admin, Kasubdit, dan Finance" },
};

// halaman awal yang pasti bisa dibuka jabatan ini
export const homeOf = (s) => (canSeeActivities(s) ? ["/dashboard", "Portofolio Program"] : ["/dashboard/financial", "Keuangan"]);

/** Tampilkan `children` bila jabatan boleh membuka halaman `area`; kalau tidak, tampilkan penjelasan. */
export function RequireAccess({ area, page, children }) {
  const session = useAuthStore((s) => s.session);
  const rule = ACCESS[area];
  if (rule.can(session)) return children;
  const [to, label] = homeOf(session);
  return (
    <div className="page">
      <section className="card">
        <EmptyState icon="lock" title={`${page} tidak tersedia untuk jabatan Anda`}
          action={<Link className="btn btn-primary btn-sm" to={to}><Icon name="left" size={15} />Buka {label}</Link>}>
          Halaman ini hanya bisa dibuka oleh {rule.who}. Anda masuk sebagai {roleLabel(session?.role)}.
        </EmptyState>
      </section>
    </div>
  );
}
