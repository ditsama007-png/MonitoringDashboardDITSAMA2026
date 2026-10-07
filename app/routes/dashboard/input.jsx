import { RequireAccess } from "../../components/Access.jsx";
import { ActivitiesTable } from "../../components/Activities.jsx";
import { PageHead } from "../../components/ui.jsx";
import { editablePrograms } from "../../lib/format.js";
import { useAuthStore } from "../../stores/auth.js";

export default function InputData() {
  return <RequireAccess area="activities" page="Data Kegiatan"><InputPage /></RequireAccess>;
}

function InputPage() {
  const session = useAuthStore((s) => s.session);
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
