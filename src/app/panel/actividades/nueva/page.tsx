import Link from "next/link";
import { redirect } from "next/navigation";

import { createActivity } from "@/app/panel/actividades/actions";
import { ActivityForm } from "@/app/panel/actividades/activity-form";
import { getAdminContext } from "@/lib/auth/admin-context";

export const dynamic = "force-dynamic";

export default async function NewActivityPage() {
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel/actividades");
  }

  return (
    <div>
      <Link
        href="/panel/actividades"
        className="text-sm font-semibold text-blue-700"
      >
        ← Volver a actividades
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold">
          Nueva actividad
        </h1>
      </div>

      <div className="mt-8">
        <ActivityForm
          action={createActivity}
          submitLabel="Crear actividad"
        />
      </div>
    </div>
  );
}