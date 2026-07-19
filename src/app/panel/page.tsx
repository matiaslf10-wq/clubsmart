export const dynamic = "force-dynamic";

export default function PanelPage() {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
        Panel administrativo
      </p>

      <h1 className="mt-3 text-3xl font-bold text-slate-900">
        ClubSmart Demo
      </h1>

      <p className="mt-4 text-slate-600">
        El panel se cargó correctamente.
      </p>
    </div>
  );
}