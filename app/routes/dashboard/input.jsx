import { Navigate } from "react-router";
import { ActivitiesTable } from "../../components/Activities.jsx";
import { PageHead } from "../../components/ui.jsx";
import { editablePrograms, isFinanceOnly } from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";

export default function InputData() {
  const session = useAuthStore((s) => s.session);
  // Finance hanya boleh mengisi menu Keuangan
  if (isFinanceOnly(session)) return <Navigate to="/dashboard/financial" replace />;
  const mine = editablePrograms(session);
  const sub = session?.role === "pic"
    ? `Catat dan kelola kegiatan. Anda dapat mengubah data ${mine.map((p) => p.label).join(", ") || "–"}; program lain hanya bisa dilihat.`
    : "Catat, impor, dan kelola kegiatan semua program.";
  return (
    <div className="page">
      <PageHead title="Data Kegiatan" sub={sub} />
      <ActivitiesTable title="Semua kegiatan" />
    </div>
  );
}
