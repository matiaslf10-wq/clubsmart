import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import {
  updateActivity,
} from "@/app/panel/actividades/actions";

import {
  ActivityForm,
} from "@/app/panel/actividades/activity-form";

import {
  ImageUploader,
} from "@/app/panel/image-uploader";

import {
  removeActivityImage,
  updateActivityImage,
} from "@/app/panel/media-actions";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  canManageActivities,
} from "@/lib/auth/permissions";

import {
  createClient,
} from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic =
  "force-dynamic";

export default async function EditActivityPage({
  params,
}: PageProps) {
  const {
    id,
  } = await params;

  const context =
    await getAdminContext();

  if (
    !canManageActivities(
      context.role,
    )
  ) {
    redirect(
      "/panel/actividades",
    );
  }

  const supabase =
    await createClient();

  const {
    data:
      activity,
    error,
  } = await supabase
    .from(
      "activities",
    )
    .select(`
      id,
      name,
      short_description,
      description,
      contact_name,
      category,
      level,
      age_from,
      age_to,
      cover_image_url,
      contact_whatsapp,
      activity_schedules (
        day_of_week,
        start_time,
        end_time,
        location_name
      )
    `)
    .eq(
      "id",
      id,
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .maybeSingle();

  if (
    error
  ) {
    throw new Error(
      `No fue posible cargar la actividad: ${error.message}`,
    );
  }

  if (
    !activity
  ) {
    notFound();
  }

  const updateAction =
    updateActivity.bind(
      null,
      id,
    );

  const saveActivityImage =
    updateActivityImage.bind(
      null,
      id,
    );

  const deleteActivityImage =
    removeActivityImage.bind(
      null,
      id,
    );

  const sortedSchedules = [
    ...activity.activity_schedules,
  ].sort(
    (
      first,
      second,
    ) =>
      first.day_of_week -
        second.day_of_week ||
      first.start_time.localeCompare(
        second.start_time,
      ),
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
          Editar actividad
        </h1>

        <p className="mt-3 text-slate-600">
          {activity.name}
        </p>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Los cambios guardados se
          mostrarán automáticamente en
          la página pública del club.
        </p>

        <div className="mt-4 max-w-2xl rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-900">
            Arancel de la actividad
          </p>

          <p className="mt-1 text-sm leading-6 text-slate-600">
            Los aranceles se administran
            desde Tarifas para conservar
            correctamente su vigencia e
            historial.
          </p>

          <Link
            href={`/panel/actividades/${activity.id}/tarifas`}
            className="mt-3 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            Administrar tarifas →
          </Link>
        </div>
      </div>

      <div className="mt-8">
        <ImageUploader
          label="Imagen de la actividad"
          description="Esta imagen aparecerá en la tarjeta pública de la actividad."
          currentUrl={
            activity.cover_image_url
          }
          storageFolder={`${context.organizationId}/clubs/${context.clubId}/activities/${activity.id}`}
          aspect="cover"
          saveImage={
            saveActivityImage
          }
          removeImage={
            deleteActivityImage
          }
        />
      </div>

      <div className="mt-8">
        <ActivityForm
          action={
            updateAction
          }
          submitLabel="Guardar cambios"
          initialValues={{
            name:
              activity.name,

            shortDescription:
              activity.short_description ??
              "",

            description:
              activity.description ??
              "",

            category:
              activity.category ??
              "",

            professor:
              activity.contact_name ??
              "",

            level:
              activity.level ??
              "",

            ageFrom:
              activity.age_from?.toString() ??
              "",

            ageTo:
              activity.age_to?.toString() ??
              "",

            ageMaximumIsFree:
              activity.age_to ===
              null,

            contactWhatsapp:
              activity.contact_whatsapp ??
              "",

            schedules:
              sortedSchedules.map(
                (
                  schedule,
                ) => ({
                  dayOfWeek:
                    schedule.day_of_week,

                  startTime:
                    schedule.start_time.slice(
                      0,
                      5,
                    ),

                  endTime:
                    schedule.end_time.slice(
                      0,
                      5,
                    ),

                  locationName:
                    schedule.location_name ??
                    "",
                }),
              ),
          }}
        />
      </div>
    </div>
  );
}