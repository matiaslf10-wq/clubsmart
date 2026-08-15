"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  activityLevels,
  createSlug,
  readOptionalNumber,
  readSchedules,
  readText,
  validateSchedules,
  type ActivityLevel,
} from "@/lib/activities/form-utils";

import {
  writeAuditLog,
} from "@/lib/audit/write-audit-log";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  canManageActivities,
} from "@/lib/auth/permissions";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  createClient,
} from "@/lib/supabase/server";

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
  contactWhatsapp: string;
  schedules: ReturnType<
    typeof readSchedules
  >;
};

function normalizeWhatsApp(
  value: string,
) {
  return value.replace(
    /\D/g,
    "",
  );
}

function isValidWhatsApp(
  value: string,
) {
  if (!value) {
    return true;
  }

  return /^\d{10,15}$/.test(
    value,
  );
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
  const name =
    readText(
      formData,
      "name",
    );

  const professor =
    readText(
      formData,
      "professor",
    );

  const levelValue =
    readText(
      formData,
      "level",
    );

  const contactWhatsapp =
    normalizeWhatsApp(
      readText(
        formData,
        "contact_whatsapp",
      ),
    );

  const ageFrom =
    readOptionalNumber(
      formData,
      "age_from",
    );

  const ageMaximumIsFree =
    formData.get(
      "age_maximum_is_free",
    ) === "on";

  const ageTo =
    ageMaximumIsFree
      ? null
      : readOptionalNumber(
          formData,
          "age_to",
        );

  const schedules =
    readSchedules(
      formData,
    );

  if (
    name.length < 2
  ) {
    return {
      data: null,
      error:
        "El nombre debe tener al menos dos caracteres.",
    };
  }

  if (
    professor.length < 2
  ) {
    return {
      data: null,
      error:
        "Ingresá el nombre del profesor o responsable.",
    };
  }

  const level =
    activityLevels.includes(
      levelValue as ActivityLevel,
    )
      ? (
          levelValue as ActivityLevel
        )
      : null;

  if (
    levelValue &&
    level === null
  ) {
    return {
      data: null,
      error:
        "El nivel seleccionado no es válido.",
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

  if (
    !isValidWhatsApp(
      contactWhatsapp,
    )
  ) {
    return {
      data: null,
      error:
        "El WhatsApp debe contener entre 10 y 15 números, incluyendo el código de país.",
    };
  }

  const scheduleError =
    validateSchedules(
      schedules,
    );

  if (
    scheduleError
  ) {
    return {
      data: null,
      error:
        scheduleError,
    };
  }

  return {
    error: null,

    data: {
      name,

      professor,

      shortDescription:
        readText(
          formData,
          "short_description",
        ),

      description:
        readText(
          formData,
          "description",
        ),

      category:
        readText(
          formData,
          "category",
        ),

      level,

      ageFrom,

      ageTo,

      contactWhatsapp,

      schedules,
    },
  };
}

/*
 * ========================================
 * CREAR ACTIVIDAD
 * ========================================
 */

export async function createActivity(
  _previousState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const context =
    await getAdminContext();

  if (
    !canManageActivities(
      context.role,
    )
  ) {
    return {
      error:
        "Tu usuario no tiene permisos para crear actividades.",
    };
  }

  const parsed =
    readActivityPayload(
      formData,
    );

  if (
    parsed.error ||
    !parsed.data
  ) {
    return {
      error:
        parsed.error,
    };
  }

  const payload =
    parsed.data;

  const supabase =
    await createClient();

  const baseSlug =
    createSlug(
      payload.name,
    );

  if (
    !baseSlug
  ) {
    return {
      error:
        "No fue posible generar una dirección válida para la actividad.",
    };
  }

  const {
    data:
      existingActivities,
    error:
      existingActivitiesError,
  } = await supabase
    .from(
      "activities",
    )
    .select(
      "slug",
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .like(
      "slug",
      `${baseSlug}%`,
    );

  if (
    existingActivitiesError
  ) {
    return {
      error:
        `No fue posible verificar el nombre de la actividad: ${existingActivitiesError.message}`,
    };
  }

  const usedSlugs =
    new Set(
      (
        existingActivities ??
        []
      ).map(
        (
          activity,
        ) =>
          activity.slug,
      ),
    );

  let slug =
    baseSlug;

  let suffix =
    2;

  while (
    usedSlugs.has(
      slug,
    )
  ) {
    slug =
      `${baseSlug}-${suffix}`;

    suffix +=
      1;
  }

  const {
    data:
      activity,
    error:
      activityError,
  } = await supabase
    .from(
      "activities",
    )
    .insert({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      name:
        payload.name,

      slug,

      short_description:
        payload.shortDescription ||
        null,

      description:
        payload.description ||
        null,

      category:
        payload.category ||
        null,

      target_audience:
        null,

      contact_name:
        payload.professor,

      age_from:
        payload.ageFrom,

      age_to:
        payload.ageTo,

      level:
        payload.level,

      contact_whatsapp:
        payload.contactWhatsapp ||
        null,

      enrollment_open:
        true,

      is_published:
        true,

      active:
        true,
    })
    .select(`
      id,
      slug
    `)
    .single();

  if (
    activityError ||
    !activity
  ) {
    return {
      error:
        `No fue posible crear la actividad: ${
          activityError?.message ??
          "Error desconocido"
        }`,
    };
  }

  const schedulesToInsert =
    payload.schedules.map(
      (
        schedule,
      ) => ({
        organization_id:
          context.organizationId,

        club_id:
          context.clubId,

        activity_id:
          activity.id,

        day_of_week:
          schedule.dayOfWeek,

        start_time:
          schedule.startTime,

        end_time:
          schedule.endTime,

        location_name:
          schedule.locationName ||
          null,

        active:
          true,
      }),
    );

  const {
    error:
      scheduleError,
  } = await supabase
    .from(
      "activity_schedules",
    )
    .insert(
      schedulesToInsert,
    );

  if (
    scheduleError
  ) {
    await supabase
      .from(
        "activities",
      )
      .delete()
      .eq(
        "id",
        activity.id,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      );

    return {
      error:
        `No fue posible guardar los horarios: ${scheduleError.message}`,
    };
  }

  await writeAuditLog(
    context,
    {
      action:
        "activity.created",

      entityType:
        "activity",

      entityId:
        activity.id,

      entityLabel:
        payload.name,

      summary:
        `Creó la actividad "${payload.name}".`,

      metadata: {
        activity_id:
          activity.id,

        slug:
          activity.slug,

        professor:
          payload.professor,

        category:
          payload.category ||
          null,

        level:
          payload.level,

        age_from:
          payload.ageFrom,

        age_to:
          payload.ageTo,

        schedule_count:
          payload.schedules.length,
      },
    },
  );

  revalidateActivityPages(
    context.clubSlug,
  );

  redirect(
    "/panel/actividades",
  );
}

/*
 * ========================================
 * EDITAR ACTIVIDAD
 * ========================================
 */

export async function updateActivity(
  activityId: string,
  _previousState: ActivityFormState,
  formData: FormData,
): Promise<ActivityFormState> {
  const context =
    await getAdminContext();

  if (
    !canManageActivities(
      context.role,
    )
  ) {
    return {
      error:
        "Tu usuario no tiene permisos para editar actividades.",
    };
  }

  const parsed =
    readActivityPayload(
      formData,
    );

  if (
    parsed.error ||
    !parsed.data
  ) {
    return {
      error:
        parsed.error,
    };
  }

  const payload =
    parsed.data;

  const supabase =
    await createClient();

  const {
    data:
      existingActivity,
    error:
      existingActivityError,
  } = await supabase
    .from(
      "activities",
    )
    .select(`
      id,
      name,
      slug,
      contact_name,
      category,
      level,
      age_from,
      age_to
    `)
    .eq(
      "id",
      activityId,
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
    existingActivityError
  ) {
    return {
      error:
        `No fue posible consultar la actividad: ${existingActivityError.message}`,
    };
  }

  if (
    !existingActivity
  ) {
    return {
      error:
        "La actividad no existe o no pertenece a este club.",
    };
  }

  const {
    error:
      activityError,
  } = await supabase
    .from(
      "activities",
    )
    .update({
      name:
        payload.name,

      short_description:
        payload.shortDescription ||
        null,

      description:
        payload.description ||
        null,

      category:
        payload.category ||
        null,

      target_audience:
        null,

      contact_name:
        payload.professor,

      age_from:
        payload.ageFrom,

      age_to:
        payload.ageTo,

      level:
        payload.level,

      contact_whatsapp:
        payload.contactWhatsapp ||
        null,

      enrollment_open:
        true,

      is_published:
        true,

      active:
        true,
    })
    .eq(
      "id",
      activityId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    );

  if (
    activityError
  ) {
    return {
      error:
        `No fue posible actualizar la actividad: ${activityError.message}`,
    };
  }

  const {
    error:
      deleteSchedulesError,
  } = await supabase
    .from(
      "activity_schedules",
    )
    .delete()
    .eq(
      "activity_id",
      activityId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    );

  if (
    deleteSchedulesError
  ) {
    return {
      error:
        `La actividad se actualizó, pero no fue posible reemplazar sus horarios: ${deleteSchedulesError.message}`,
    };
  }

  const {
    error:
      insertSchedulesError,
  } = await supabase
    .from(
      "activity_schedules",
    )
    .insert(
      payload.schedules.map(
        (
          schedule,
        ) => ({
          organization_id:
            context.organizationId,

          club_id:
            context.clubId,

          activity_id:
            activityId,

          day_of_week:
            schedule.dayOfWeek,

          start_time:
            schedule.startTime,

          end_time:
            schedule.endTime,

          location_name:
            schedule.locationName ||
            null,

          active:
            true,
        }),
      ),
    );

  if (
    insertSchedulesError
  ) {
    return {
      error:
        `La actividad se actualizó, pero no fue posible guardar los nuevos horarios: ${insertSchedulesError.message}`,
    };
  }

  await writeAuditLog(
    context,
    {
      action:
        "activity.updated",

      entityType:
        "activity",

      entityId:
        activityId,

      entityLabel:
        payload.name,

      summary:
        existingActivity.name ===
        payload.name
          ? `Actualizó la actividad "${payload.name}".`
          : `Actualizó la actividad "${existingActivity.name}", ahora llamada "${payload.name}".`,

      metadata: {
        slug:
          existingActivity.slug,

        previous: {
          name:
            existingActivity.name,

          professor:
            existingActivity.contact_name,

          category:
            existingActivity.category,

          level:
            existingActivity.level,

          age_from:
            existingActivity.age_from,

          age_to:
            existingActivity.age_to,
        },

        current: {
          name:
            payload.name,

          professor:
            payload.professor,

          category:
            payload.category ||
            null,

          level:
            payload.level,

          age_from:
            payload.ageFrom,

          age_to:
            payload.ageTo,

          schedule_count:
            payload.schedules.length,
        },
      },
    },
  );

  revalidateActivityPages(
    context.clubSlug,
    activityId,
  );

  redirect(
    "/panel/actividades",
  );
}

/*
 * ========================================
 * ELIMINAR ACTIVIDAD
 * ========================================
 */

export async function deleteActivity(
  activityId: string,
): Promise<{
  error: string | null;
}> {
  const context =
    await getAdminContext();

  if (
    !canManageActivities(
      context.role,
    )
  ) {
    return {
      error:
        "Tu usuario no tiene permisos para eliminar actividades.",
    };
  }

  const supabase =
    await createClient();

  const {
    data:
      activity,
    error:
      readError,
  } = await supabase
    .from(
      "activities",
    )
    .select(`
      id,
      name,
      slug,
      cover_image_storage_path
    `)
    .eq(
      "id",
      activityId,
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
    readError
  ) {
    return {
      error:
        `No fue posible consultar la actividad: ${readError.message}`,
    };
  }

  if (
    !activity
  ) {
    return {
      error:
        "La actividad no existe o no pertenece a este club.",
    };
  }

  const adminSupabase =
    createAdminClient();

  const [
    memberRelationsResult,
    feeRatesResult,
    monthlyFeesResult,
    paymentsResult,
    subscriptionsResult,
  ] = await Promise.all([
    adminSupabase
      .from(
        "member_activities",
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        },
      )
      .eq(
        "activity_id",
        activityId,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      ),

    adminSupabase
      .from(
        "activity_fee_rates",
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        },
      )
      .eq(
        "activity_id",
        activityId,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      ),

    adminSupabase
      .from(
        "monthly_fees",
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        },
      )
      .eq(
        "activity_id",
        activityId,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      ),

    adminSupabase
      .from(
        "payments",
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        },
      )
      .eq(
        "activity_id",
        activityId,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      ),

    adminSupabase
      .from(
        "payment_subscriptions",
      )
      .select(
        "id",
        {
          count:
            "exact",

          head:
            true,
        },
      )
      .eq(
        "activity_id",
        activityId,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      ),
  ]);

  if (
    memberRelationsResult.error
  ) {
    return {
      error:
        `No fue posible verificar las inscripciones: ${memberRelationsResult.error.message}`,
    };
  }

  if (
    feeRatesResult.error
  ) {
    return {
      error:
        `No fue posible verificar las tarifas: ${feeRatesResult.error.message}`,
    };
  }

  if (
    monthlyFeesResult.error
  ) {
    return {
      error:
        `No fue posible verificar las cuotas: ${monthlyFeesResult.error.message}`,
    };
  }

  if (
    paymentsResult.error
  ) {
    return {
      error:
        `No fue posible verificar los pagos: ${paymentsResult.error.message}`,
    };
  }

  if (
    subscriptionsResult.error
  ) {
    return {
      error:
        `No fue posible verificar las adhesiones: ${subscriptionsResult.error.message}`,
    };
  }

  const hasHistoricalInformation =
    (
      memberRelationsResult.count ??
      0
    ) > 0 ||
    (
      feeRatesResult.count ??
      0
    ) > 0 ||
    (
      monthlyFeesResult.count ??
      0
    ) > 0 ||
    (
      paymentsResult.count ??
      0
    ) > 0 ||
    (
      subscriptionsResult.count ??
      0
    ) > 0;

  if (
    hasHistoricalInformation
  ) {
    return {
      error:
        "No se puede eliminar esta actividad porque tiene inscripciones, tarifas, cuotas, pagos o adhesiones asociados. La información debe conservarse para mantener el historial.",
    };
  }

  const {
    error:
      schedulesError,
  } = await supabase
    .from(
      "activity_schedules",
    )
    .delete()
    .eq(
      "activity_id",
      activityId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    );

  if (
    schedulesError
  ) {
    return {
      error:
        `No fue posible eliminar los horarios: ${schedulesError.message}`,
    };
  }

  const {
    error:
      instructorRelationsError,
  } = await supabase
    .from(
      "activity_instructors",
    )
    .delete()
    .eq(
      "activity_id",
      activityId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    );

  if (
    instructorRelationsError
  ) {
    return {
      error:
        `No fue posible eliminar las relaciones de profesores: ${instructorRelationsError.message}`,
    };
  }

  const {
    error:
      activityImagesError,
  } = await supabase
    .from(
      "activity_images",
    )
    .delete()
    .eq(
      "activity_id",
      activityId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    );

  if (
    activityImagesError
  ) {
    return {
      error:
        `No fue posible eliminar las imágenes relacionadas: ${activityImagesError.message}`,
    };
  }

  const {
    error:
      activityError,
  } = await supabase
    .from(
      "activities",
    )
    .delete()
    .eq(
      "id",
      activityId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    );

  if (
    activityError
  ) {
    return {
      error:
        `No fue posible eliminar la actividad: ${activityError.message}`,
    };
  }

  await writeAuditLog(
    context,
    {
      action:
        "activity.deleted",

      entityType:
        "activity",

      entityId:
        activityId,

      entityLabel:
        activity.name,

      summary:
        `Eliminó la actividad "${activity.name}".`,

      metadata: {
        activity_id:
          activityId,

        name:
          activity.name,

        slug:
          activity.slug,

        had_cover_image:
          Boolean(
            activity.cover_image_storage_path,
          ),
      },
    },
  );

  if (
    activity.cover_image_storage_path
  ) {
    const {
      error:
        storageError,
    } = await supabase.storage
      .from(
        "club-media",
      )
      .remove([
        activity.cover_image_storage_path,
      ]);

    if (
      storageError
    ) {
      console.error(
        "La actividad fue eliminada, pero no pudo borrarse su imagen:",
        storageError,
      );
    }
  }

  revalidatePath(
    "/panel",
  );

  revalidatePath(
    "/panel/actividades",
  );

  revalidatePath(
    `/clubes/${context.clubSlug}`,
  );

  return {
    error:
      null,
  };
}

function revalidateActivityPages(
  clubSlug: string,
  activityId?: string,
) {
  revalidatePath(
    "/panel",
  );

  revalidatePath(
    "/panel/actividades",
  );

  revalidatePath(
    `/clubes/${clubSlug}`,
  );

  if (
    activityId
  ) {
    revalidatePath(
      `/panel/actividades/${activityId}/editar`,
    );
  }
}