import Link from "next/link";
import { redirect } from "next/navigation";

import { createSpace } from "@/app/panel/espacios/actions";
import { SpaceForm } from "@/app/panel/espacios/space-form";
import { getAdminContext } from "@/lib/auth/admin-context";

export const dynamic = "force-dynamic";

export default async function NewSpacePage() {
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel");
  }

  return (
    <div>
      <Link
        href="/panel/espacios"
        className="text-sm font-semibold text-blue-700 transition hover:text-blue-800"
      >
        ← Volver a espacios
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Nuevo espacio
        </h1>

        <p className="mt-3 max-w-3xl text-slate-600">
          Registrá el espacio, sus condiciones y
          los horarios en los que podrá reservarse.
        </p>
      </div>

      <div className="mt-8">
        <SpaceForm
          action={createSpace}
          submitLabel="Crear espacio"
        />
      </div>
    </div>
  );
}