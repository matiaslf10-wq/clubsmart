import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateActivity } from "@/app/panel/actividades/actions";
import { ActivityForm } from "@/app/panel/actividades/activity-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function EditActivityPage({
  params,
}: PageProps) {
  const { id } = await params;
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel/actividades");
  }

  const supabase = await createClient();

  const { data: activity, error } =
    await supabase
      .from("activities")
      .select(`
        id,
        name,
        short_description,
        description,
        category,
        level,
        age_from,
        age_to,
        price,
        price_description,
        contact_whatsapp,
        enrollment_open,
        is_published,
        activity_schedules (
          day_of_week,
          start_time,
          end_time,
          location_name
        ),
        activity_instructors (
          instructor_id,
          is_primary
        )
      `)
      .eq("id", id)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!activity) {
    notFound();
  }

  const { data: instructorData } =
    await supabase
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

  const instructors = (
    instructorData ?? []
  ).map((instructor) => ({
    id: instructor.id,
    name:
      instructor.display_name ||
      [
        instructor.first_name,
        instructor.last_name,
      ]
        .filter(Boolean)
        .join(" "),
  }));

  const primaryInstructor =
    activity.activity_instructors.find(
      (relation) => relation.is_primary,
    ) ??
    activity.activity_instructors[0];

  const updateAction =
    updateActivity.bind(null, id);

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
          Editar actividad
        </h1>

        <p className="mt-3 text-slate-600">
          {activity.name}
        </p>
      </div>

      <div className="mt-8">
        <ActivityForm
  action={updateAction}
  submitLabel="Guardar cambios"
  initialValues={{
    name: activity.name,
    shortDescription:
      activity.short_description ?? "",
    description:
      activity.description ?? "",
    category: activity.category ?? "",
    professor: activity.contact_name ?? "",
    level: activity.level ?? "",
    ageFrom:
      activity.age_from?.toString() ?? "",
    ageTo:
      activity.age_to?.toString() ?? "",
    ageMaximumIsFree:
      activity.age_to === null,
    price:
      activity.price?.toString() ?? "",
    priceDescription:
      activity.price_description ?? "",
    contactWhatsapp:
      activity.contact_whatsapp ?? "",
    schedules:
      activity.activity_schedules.map(
        (schedule) => ({
          dayOfWeek: schedule.day_of_week,
          startTime:
            schedule.start_time.slice(0, 5),
          endTime:
            schedule.end_time.slice(0, 5),
          locationName:
            schedule.location_name ?? "",
        }),
      ),
  }}
/>
      </div>
    </div>
  );
}