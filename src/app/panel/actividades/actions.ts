"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  activityLevels,
  createSlug,
  readOptionalNumber,
  readSchedules,
  readText,
  validateSchedules,
  type ActivityLevel,
} from "@/lib/activities/form-utils";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export type ActivityFormState = {
  error: string | null;
};

type ActivityPayload = {
  name: string;
  shortDescription: string;
  description: string;
  professor: string;
  category: string;
  level: ActivityLevel | null;
  ageFrom: number | null;
  ageTo: number | null;
  price: number | null;
  priceDescription: string;
  contactWhatsapp: string;
  schedules: ReturnType<typeof readSchedules>;
};

function canManageActivities(role: string) {
  return role === "owner" || role === "admin";
}

function readActivityPayload(
  formData: FormData,
):
  | {
      data: ActivityPayload;
      error: null;
    }
  | {
      data: null;
      error: string;
    } {
  const name = readText(formData, "name");
  const professor = readText(formData, "professor");
  const levelValue = readText(formData, "level");

  const ageFrom = readOptionalNumber(
    formData,
    "age_from",
  );

  const ageMaximumIsFree =
    formData.get("age_maximum_is_free") === "on";

  const ageTo = ageMaximumIsFree
    ? null
    : readOptionalNumber(formData, "age_to");

  const price = readOptionalNumber(
    formData,
    "price",
  );

  const schedules = readSchedules(formData);

  if (name.length < 2) {
    return {
      data: null,
      error:
        "El nombre debe tener al menos dos caracteres.",
    };
  }

  if (professor.length < 2) {
    return {
      data: null,
      error:
        "Ingresá el nombre del profesor o responsable.",
    };
  }

  const level = activityLevels.includes(
    levelValue as ActivityLevel,
  )
    ? (levelValue as ActivityLevel)
    : null;

  if (levelValue && level === null) {
    return {
      data: null,
      error: "El nivel seleccionado no es válido.",
    };
  }

  if (
    ageFrom !== null &&
    ageTo !== null &&
    ageTo < ageFrom
  ) {
    return {
      data: null,
      error:
        "La edad máxima no puede ser menor que la mínima.",
    };
  }

  if (price !== null && price < 0) {
    return {
      data: null,
      error: "El precio no puede ser negativo.",
    };
  }

  const scheduleError =
    validateSchedules(schedules);

  if (scheduleError) {
    return {
      data: null,
      error: scheduleError,
    };
  }

  return {
    error: null,
    data: {
      name,
      professor,
      shortDescription: readText(
        formData,
        "short_description",
      ),
      description: readText(
        formData,
        "description",
      ),
      category: readText(
        formData,
        "category",
      ),
      level,
      ageFrom,
      ageTo,
      price,
      priceDescription: readText(
        formData,
        "price_description",
      ),
      contactWhatsapp: readText(
        formData,
        "contact_whatsapp",
      ),
      schedules,
    },
  };
}

export async function createActivity(
  _previousState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const context = await getAdminContext();

  if (!canManageActivities(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para crear actividades.",
    };
  }

  const parsed = readActivityPayload(formData);

  if (parsed.error || !parsed.data) {
    return {
      error: parsed.error,
    };
  }

  const payload = parsed.data;
  const supabase = await createClient();

  const baseSlug = createSlug(payload.name);

  if (!baseSlug) {
    return {
      error:
        "No fue posible generar una dirección válida para la actividad.",
    };
  }

  const { data: existingActivities } =
    await supabase
      .from("activities")
      .select("slug")
      .eq("club_id", context.clubId)
      .like("slug", `${baseSlug}%`);

  const usedSlugs = new Set(
    (existingActivities ?? []).map(
      (activity) => activity.slug,
    ),
  );

  let slug = baseSlug;
  let suffix = 2;

  while (usedSlugs.has(slug)) {
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  const {
    data: activity,
    error: activityError,
  } = await supabase
    .from("activities")
    .insert({
      organization_id: context.organizationId,
      club_id: context.clubId,
      name: payload.name,
      slug,
      short_description:
        payload.shortDescription || null,
      description:
        payload.description || null,
      category: payload.category || null,
      target_audience: null,
      contact_name: payload.professor,
      age_from: payload.ageFrom,
      age_to: payload.ageTo,
      level: payload.level,
      price: payload.price,
      price_description:
        payload.priceDescription || null,
      contact_whatsapp:
        payload.contactWhatsapp || null,
      enrollment_open: true,
      is_published: true,
      active: true,
    })
    .select("id")
    .single();

  if (activityError || !activity) {
    return {
      error: `No fue posible crear la actividad: ${
        activityError?.message ??
        "Error desconocido"
      }`,
    };
  }

  const schedulesToInsert =
    payload.schedules.map((schedule) => ({
      organization_id: context.organizationId,
      club_id: context.clubId,
      activity_id: activity.id,
      day_of_week: schedule.dayOfWeek,
      start_time: schedule.startTime,
      end_time: schedule.endTime,
      location_name:
        schedule.locationName || null,
      active: true,
    }));

  const { error: scheduleError } =
    await supabase
      .from("activity_schedules")
      .insert(schedulesToInsert);

  if (scheduleError) {
    await supabase
      .from("activities")
      .delete()
      .eq("id", activity.id)
      .eq(
        "organization_id",
        context.organizationId,
      );

    return {
      error: `No fue posible guardar los horarios: ${scheduleError.message}`,
    };
  }

  revalidateActivityPages(context.clubSlug);

  redirect("/panel/actividades");
}

export async function updateActivity(
  activityId: string,
  _previousState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const context = await getAdminContext();

  if (!canManageActivities(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para editar actividades.",
    };
  }

  const parsed = readActivityPayload(formData);

  if (parsed.error || !parsed.data) {
    return {
      error: parsed.error,
    };
  }

  const payload = parsed.data;
  const supabase = await createClient();

  const {
    data: existingActivity,
    error: existingActivityError,
  } = await supabase
    .from("activities")
    .select("id")
    .eq("id", activityId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (existingActivityError) {
    return {
      error: `No fue posible consultar la actividad: ${existingActivityError.message}`,
    };
  }

  if (!existingActivity) {
    return {
      error:
        "La actividad no existe o no pertenece a este club.",
    };
  }

  const { error: activityError } =
    await supabase
      .from("activities")
      .update({
        name: payload.name,
        short_description:
          payload.shortDescription || null,
        description:
          payload.description || null,
        category: payload.category || null,
        target_audience: null,
        contact_name: payload.professor,
        age_from: payload.ageFrom,
        age_to: payload.ageTo,
        level: payload.level,
        price: payload.price,
        price_description:
          payload.priceDescription || null,
        contact_whatsapp:
          payload.contactWhatsapp || null,
        enrollment_open: true,
        is_published: true,
        active: true,
      })
      .eq("id", activityId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId);

  if (activityError) {
    return {
      error: `No fue posible actualizar la actividad: ${activityError.message}`,
    };
  }

  const { error: deleteSchedulesError } =
    await supabase
      .from("activity_schedules")
      .delete()
      .eq("activity_id", activityId)
      .eq(
        "organization_id",
        context.organizationId,
      );

  if (deleteSchedulesError) {
    return {
      error: `La actividad se actualizó, pero no fue posible reemplazar sus horarios: ${deleteSchedulesError.message}`,
    };
  }

  const { error: insertSchedulesError } =
    await supabase
      .from("activity_schedules")
      .insert(
        payload.schedules.map(
          (schedule) => ({
            organization_id:
              context.organizationId,
            club_id: context.clubId,
            activity_id: activityId,
            day_of_week:
              schedule.dayOfWeek,
            start_time:
              schedule.startTime,
            end_time: schedule.endTime,
            location_name:
              schedule.locationName ||
              null,
            active: true,
          }),
        ),
      );

  if (insertSchedulesError) {
    return {
      error: `La actividad se actualizó, pero no fue posible guardar los nuevos horarios: ${insertSchedulesError.message}`,
    };
  }

  revalidateActivityPages(
    context.clubSlug,
    activityId,
  );

  redirect("/panel/actividades");
}

export async function deleteActivity(
  activityId: string,
): Promise<{
  error: string | null;
}> {
  const context = await getAdminContext();

  if (!canManageActivities(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para eliminar actividades.",
    };
  }

  const supabase = await createClient();

  const {
    data: activity,
    error: readError,
  } = await supabase
    .from("activities")
    .select("id, cover_image_storage_path")
    .eq("id", activityId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (readError) {
    return {
      error: `No fue posible consultar la actividad: ${readError.message}`,
    };
  }

  if (!activity) {
    return {
      error:
        "La actividad no existe o no pertenece a este club.",
    };
  }

  const { error: schedulesError } =
    await supabase
      .from("activity_schedules")
      .delete()
      .eq("activity_id", activityId)
      .eq(
        "organization_id",
        context.organizationId,
      );

  if (schedulesError) {
    return {
      error: `No fue posible eliminar los horarios: ${schedulesError.message}`,
    };
  }

  const { error: instructorRelationsError } =
    await supabase
      .from("activity_instructors")
      .delete()
      .eq("activity_id", activityId)
      .eq(
        "organization_id",
        context.organizationId,
      );

  if (instructorRelationsError) {
    return {
      error: `No fue posible eliminar las relaciones de profesores: ${instructorRelationsError.message}`,
    };
  }

  const { error: activityImagesError } =
    await supabase
      .from("activity_images")
      .delete()
      .eq("activity_id", activityId)
      .eq(
        "organization_id",
        context.organizationId,
      );

  if (activityImagesError) {
    return {
      error: `No fue posible eliminar las imágenes relacionadas: ${activityImagesError.message}`,
    };
  }

  const { error: activityError } =
    await supabase
      .from("activities")
      .delete()
      .eq("id", activityId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId);

  if (activityError) {
    return {
      error: `No fue posible eliminar la actividad: ${activityError.message}`,
    };
  }

  if (activity.cover_image_storage_path) {
    const { error: storageError } =
      await supabase.storage
        .from("club-media")
        .remove([
          activity.cover_image_storage_path,
        ]);

    if (storageError) {
      console.error(
        "La actividad fue eliminada, pero no pudo borrarse su imagen:",
        storageError,
      );
    }
  }

  revalidatePath("/panel");
  revalidatePath("/panel/actividades");
  revalidatePath(`/clubes/${context.clubSlug}`);

  return {
    error: null,
  };
}

function revalidateActivityPages(
  clubSlug: string,
  activityId?: string,
) {
  revalidatePath("/panel");
  revalidatePath("/panel/actividades");
  revalidatePath(`/clubes/${clubSlug}`);

  if (activityId) {
    revalidatePath(
      `/panel/actividades/${activityId}/editar`,
    );
  }
}