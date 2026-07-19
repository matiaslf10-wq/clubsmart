import Link from "next/link";
import { redirect } from "next/navigation";

import { createActivity } from "@/app/panel/actividades/actions";
import { ActivityForm } from "@/app/panel/actividades/activity-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewActivityPage() {
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel/actividades");
  }

  const supabase = await createClient();

  const { data } = await supabase
    .from("instructors")
    .select(
      "id, display_name, first_name, last_name",
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("active", true)
    .order("first_name");

  const instructors = (data ?? []).map(
    (instructor) => ({
      id: instructor.id,
      name:
        instructor.display_name ||
        [
          instructor.first_name,
          instructor.last_name,
        ]
          .filter(Boolean)
          .join(" "),
    }),
  );

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
          instructors={instructors}
          submitLabel="Crear actividad"
        />
      </div>
    </div>
  );
}