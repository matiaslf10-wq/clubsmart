"use server";

import { revalidatePath } from "next/cache";

import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { canManageActivities } from "@/lib/auth/permissions";
import { requireCapability } from "@/lib/capabilities/require-capability";
import { createAdminClient } from "@/lib/supabase/admin";

async function getEnrollmentContext(
  relationId: string,
  activityId: string,
) {
  const context = await requireCapability("club.activities");

  if (!canManageActivities(context.role)) {
    throw new Error(
      "Tu usuario no tiene permisos para modificar inscripciones.",
    );
  }

  const supabase = createAdminClient();

  const { data: relation, error } = await supabase
    .from("member_activities")
    .select(`
      id,
      active,
      start_date,
      end_date,
      activity_id,
      member_id
    `)
    .eq("id", relationId)
    .eq("activity_id", activityId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `No fue posible consultar la inscripción: ${error.message}`,
    );
  }

  if (!relation) {
    throw new Error(
      "La inscripción no existe o no pertenece a esta actividad.",
    );
  }

  const [{ data: activity }, { data: member }] = await Promise.all([
    supabase
      .from("activities")
      .select("id, name")
      .eq("id", activityId)
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .maybeSingle(),

    supabase
      .from("members")
      .select("id, first_name, last_name, active")
      .eq("id", relation.member_id)
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .maybeSingle(),
  ]);

  if (!activity || !member) {
    throw new Error(
      "No fue posible resolver la actividad o la persona.",
    );
  }

  return {
    context,
    supabase,
    relation,
    activity,
    member,
  };
}

export async function deactivateEnrollment(
  relationId: string,
  activityId: string,
): Promise<void> {
  const {
    context,
    supabase,
    relation,
    activity,
    member,
  } = await getEnrollmentContext(
    relationId,
    activityId,
  );

  if (!relation.active) {
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("member_activities")
    .update({
      active: false,
      end_date: today,
    })
    .eq("id", relation.id)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId);

  if (error) {
    throw new Error(
      `No fue posible dar de baja la inscripción: ${error.message}`,
    );
  }

  await writeAuditLog(context, {
    action: "activity.member.deactivated",
    entityType: "member_activity",
    entityId: relation.id,
    entityLabel: `${member.first_name} ${member.last_name}`,
    summary:
      `Dio de baja a "${member.first_name} ${member.last_name}" de "${activity.name}".`,
    metadata: {
      activity_id: activity.id,
      member_id: member.id,
      end_date: today,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/actividades");
  revalidatePath(
    `/panel/actividades/${activityId}/inscriptos`,
  );
  revalidatePath(
    `/panel/personas/${member.id}/editar`,
  );
}


export async function reactivateMemberFromEnrollment(
  memberId: string,
  activityId: string,
): Promise<void> {
  const context = await requireCapability("club.activities");

  if (!canManageActivities(context.role)) {
    throw new Error(
      "Tu usuario no tiene permisos para reactivar personas.",
    );
  }

  const supabase = createAdminClient();

  const { data: member, error } = await supabase
    .from("members")
    .update({
      active: true,
      inactive_at: null,
      inactive_reason: null,
    })
    .eq("id", memberId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .select("id, first_name, last_name")
    .maybeSingle();

  if (error || !member) {
    throw new Error(
      `No fue posible reactivar a la persona: ${
        error?.message ??
        "La persona no existe o no pertenece al club."
      }`,
    );
  }

  await writeAuditLog(context, {
    action: "member.reactivated",
    entityType: "member",
    entityId: member.id,
    entityLabel: `${member.first_name} ${member.last_name}`,
    summary:
      `Reactiv? a "${member.first_name} ${member.last_name}" desde la actividad.`,
    metadata: {
      source: "activity_enrollments",
      activity_id: activityId,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/personas");
  revalidatePath(
    `/panel/personas/${member.id}/editar`,
  );
  revalidatePath(
    `/panel/actividades/${activityId}/inscriptos`,
  );
}

export async function reactivateEnrollment(
  relationId: string,
  activityId: string,
): Promise<void> {
  const {
    context,
    supabase,
    relation,
    activity,
    member,
  } = await getEnrollmentContext(
    relationId,
    activityId,
  );

  if (relation.active) {
    return;
  }

  if (!member.active) {
    throw new Error(
      "No se puede reactivar esta inscripción porque la persona está dada de baja del club.",
    );
  }

  const today = new Date().toISOString().slice(0, 10);

  const { error } = await supabase
    .from("member_activities")
    .update({
      active: true,
      start_date: today,
      end_date: null,
    })
    .eq("id", relation.id)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId);

  if (error) {
    throw new Error(
      `No fue posible reactivar la inscripción: ${error.message}`,
    );
  }

  await writeAuditLog(context, {
    action: "activity.member.reactivated",
    entityType: "member_activity",
    entityId: relation.id,
    entityLabel: `${member.first_name} ${member.last_name}`,
    summary:
      `Reactivó a "${member.first_name} ${member.last_name}" en "${activity.name}".`,
    metadata: {
      activity_id: activity.id,
      member_id: member.id,
      start_date: today,
    },
  });

  revalidatePath("/panel");
  revalidatePath("/panel/actividades");
  revalidatePath(
    `/panel/actividades/${activityId}/inscriptos`,
  );
  revalidatePath(
    `/panel/personas/${member.id}/editar`,
  );
}
