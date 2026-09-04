"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { writeAuditLog } from "@/lib/audit/write-audit-log";
import { canManageMembers } from "@/lib/auth/permissions";
import { requirePlanFeature } from "@/lib/plans/require-feature";
import { createClient } from "@/lib/supabase/server";

export type MemberFormState = {
  error: string | null;
};

export type MemberCardActionState = {
  error: string | null;
  success: string | null;
};

type MemberPayload = {
  firstName: string;
  lastName: string;
  dni: string;
  guardianName: string;
  email: string;
  phone: string;
  activityIds: string[];
};

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

function readText(formData: FormData, field: string) {
  const value = formData.get(field);

  return typeof value === "string" ? value.trim() : "";
}

function readActivityIds(formData: FormData) {
  const values = formData
    .getAll("activity_ids")
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.trim())
    .filter(Boolean);

  return [...new Set(values)];
}

function normalizeDni(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhone(value: string) {
  return value.replace(/\D/g, "");
}

function isValidEmail(value: string) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isValidPhone(value: string) {
  if (!value) {
    return true;
  }

  return /^\d{10,15}$/.test(value);
}

function readMemberPayload(formData: FormData):
  | {
      data: MemberPayload;
      error: null;
    }
  | {
      data: null;
      error: string;
    } {
  const firstName = readText(formData, "first_name");

  const lastName = readText(formData, "last_name");

  const dni = normalizeDni(readText(formData, "dni"));

  const guardianName = readText(formData, "guardian_name");

  const email = readText(formData, "email").toLowerCase();

  const phone = normalizePhone(readText(formData, "phone"));

  const activityIds = readActivityIds(formData);

  if (firstName.length < 2) {
    return {
      data: null,
      error: "El nombre debe tener al menos dos caracteres.",
    };
  }

  if (firstName.length > 100) {
    return {
      data: null,
      error: "El nombre no puede superar los 100 caracteres.",
    };
  }

  if (lastName.length < 2) {
    return {
      data: null,
      error: "El apellido debe tener al menos dos caracteres.",
    };
  }

  if (lastName.length > 100) {
    return {
      data: null,
      error: "El apellido no puede superar los 100 caracteres.",
    };
  }

  if (!/^\d{7,8}$/.test(dni)) {
    return {
      data: null,
      error: "Ingresá un DNI válido de 7 u 8 números, sin puntos.",
    };
  }

  if (guardianName.length > 200) {
    return {
      data: null,
      error: "El nombre del responsable no puede superar los 200 caracteres.",
    };
  }

  if (!isValidEmail(email)) {
    return {
      data: null,
      error: "El correo electrónico no es válido.",
    };
  }

  if (!isValidPhone(phone)) {
    return {
      data: null,
      error:
        "El teléfono debe contener entre 10 y 15 números, incluyendo el código de país.",
    };
  }

  if (activityIds.length === 0) {
    return {
      data: null,
      error: "Seleccioná al menos una actividad.",
    };
  }

  return {
    error: null,
    data: {
      firstName,
      lastName,
      dni,
      guardianName,
      email,
      phone,
      activityIds,
    },
  };
}

async function activitiesBelongToClub(
  activityIds: string[],
  organizationId: string,
  clubId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select("id")
    .in("id", activityIds)
    .eq("organization_id", organizationId)
    .eq("club_id", clubId)
    .eq("active", true);

  return {
    valid: !error && (data?.length ?? 0) === activityIds.length,
    error,
  };
}

async function syncMemberActivities(
  supabase: SupabaseClient,
  memberId: string,
  activityIds: string[],
  organizationId: string,
  clubId: string,
): Promise<string | null> {
  const today = new Date().toISOString().slice(0, 10);

  const { data: relations, error } = await supabase
    .from("member_activities")
    .select(
      `
        id,
        activity_id,
        active
      `,
    )
    .eq("member_id", memberId)
    .eq("organization_id", organizationId)
    .eq("club_id", clubId);

  if (error) {
    return `No fue posible consultar las actividades actuales: ${error.message}`;
  }

  const existingRelations = relations ?? [];

  const desiredActivityIds = new Set(activityIds);

  const activeRelations = existingRelations.filter(
    (relation) => relation.active,
  );

  const activeActivityIds = new Set(
    activeRelations.map((relation) => relation.activity_id),
  );

  const relationsToClose = activeRelations.filter(
    (relation) => !desiredActivityIds.has(relation.activity_id),
  );

  if (relationsToClose.length > 0) {
    const { error: closeError } = await supabase
      .from("member_activities")
      .update({
        active: false,
        end_date: today,
      })
      .in(
        "id",
        relationsToClose.map((relation) => relation.id),
      )
      .eq("organization_id", organizationId)
      .eq("club_id", clubId);

    if (closeError) {
      return `No fue posible cerrar las inscripciones retiradas: ${closeError.message}`;
    }
  }

  const inactiveRelationByActivity = new Map<string, string>();

  for (const relation of existingRelations) {
    if (
      !relation.active &&
      !inactiveRelationByActivity.has(relation.activity_id)
    ) {
      inactiveRelationByActivity.set(relation.activity_id, relation.id);
    }
  }

  const relationsToReactivate: string[] = [];

  const activitiesToInsert: string[] = [];

  for (const activityId of activityIds) {
    if (activeActivityIds.has(activityId)) {
      continue;
    }

    const inactiveRelationId = inactiveRelationByActivity.get(activityId);

    if (inactiveRelationId) {
      relationsToReactivate.push(inactiveRelationId);
    } else {
      activitiesToInsert.push(activityId);
    }
  }

  if (relationsToReactivate.length > 0) {
    const { error: reactivateError } = await supabase
      .from("member_activities")
      .update({
        active: true,
        start_date: today,
        end_date: null,
      })
      .in("id", relationsToReactivate)
      .eq("organization_id", organizationId)
      .eq("club_id", clubId);

    if (reactivateError) {
      return `No fue posible reactivar las inscripciones seleccionadas: ${reactivateError.message}`;
    }
  }

  if (activitiesToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("member_activities")
      .insert(
        activitiesToInsert.map((activityId) => ({
          organization_id: organizationId,
          club_id: clubId,
          member_id: memberId,
          activity_id: activityId,
          active: true,
          start_date: today,
          end_date: null,
        })),
      );

    if (insertError) {
      return `No fue posible guardar las nuevas inscripciones: ${insertError.message}`;
    }
  }

  return null;
}

export async function createMember(
  _previousState: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const context = await requirePlanFeature("members");

  if (!canManageMembers(context.role)) {
    return {
      error: "Tu usuario no tiene permisos para cargar personas.",
    };
  }

  const parsed = readMemberPayload(formData);

  if (parsed.error || !parsed.data) {
    return {
      error: parsed.error,
    };
  }

  const payload = parsed.data;

  const activityCheck = await activitiesBelongToClub(
    payload.activityIds,
    context.organizationId,
    context.clubId,
  );

  if (!activityCheck.valid) {
    console.error("Error validando actividades:", activityCheck.error);

    return {
      error: "Una o más actividades seleccionadas no pertenecen al club.",
    };
  }

  const supabase = await createClient();

  const { data: existingMember, error: existingMemberError } = await supabase
    .from("members")
    .select("id, first_name, last_name")
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .eq("dni", payload.dni)
    .maybeSingle();

  if (existingMemberError) {
    return {
      error: `No fue posible verificar el DNI: ${existingMemberError.message}`,
    };
  }

  if (existingMember) {
    return {
      error: `Ya existe una persona con ese DNI: ${existingMember.first_name} ${existingMember.last_name}.`,
    };
  }

  const { data: member, error: memberError } = await supabase
    .from("members")
    .insert({
      organization_id: context.organizationId,
      club_id: context.clubId,
      first_name: payload.firstName,
      last_name: payload.lastName,
      dni: payload.dni,
      guardian_name: payload.guardianName || null,
      email: payload.email || null,
      phone: payload.phone || null,
      active: true,
      inactive_at: null,
      inactive_reason: null,
    })
    .select("id")
    .single();

  if (memberError || !member) {
    return {
      error: `No fue posible crear la persona: ${
        memberError?.message ?? "Error desconocido"
      }`,
    };
  }

  const { error: relationError } = await supabase
    .from("member_activities")
    .insert(
      payload.activityIds.map((activityId) => ({
        organization_id: context.organizationId,
        club_id: context.clubId,
        member_id: member.id,
        activity_id: activityId,
        active: true,
        start_date: new Date().toISOString().slice(0, 10),
        end_date: null,
      })),
    );

  if (relationError) {
    await supabase
      .from("members")
      .delete()
      .eq("id", member.id)
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId);

    return {
      error: `No fue posible asignar las actividades: ${relationError.message}`,
    };
  }

  await writeAuditLog(context, {
    action: "member.created",

    entityType: "member",

    entityId: member.id,

    entityLabel: `${payload.firstName} ${payload.lastName}`,

    summary: `Creó a la persona "${payload.firstName} ${payload.lastName}".`,

    metadata: {
      dni: payload.dni,

      activity_ids: payload.activityIds,

      email: payload.email || null,

      phone: payload.phone || null,
    },
  });

  revalidateMemberPages();

  redirect("/panel/personas");
}

export async function updateMember(
  memberId: string,
  _previousState: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const context = await requirePlanFeature("members");

  if (!canManageMembers(context.role)) {
    return {
      error: "Tu usuario no tiene permisos para editar personas.",
    };
  }

  const parsed = readMemberPayload(formData);

  if (parsed.error || !parsed.data) {
    return {
      error: parsed.error,
    };
  }

  const payload = parsed.data;

  const activityCheck = await activitiesBelongToClub(
    payload.activityIds,
    context.organizationId,
    context.clubId,
  );

  if (!activityCheck.valid) {
    console.error("Error validando actividades:", activityCheck.error);

    return {
      error: "Una o más actividades seleccionadas no pertenecen al club.",
    };
  }

  const supabase = await createClient();

  const { data: existingMember, error: existingMemberError } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (existingMemberError) {
    return {
      error: `No fue posible consultar la persona: ${existingMemberError.message}`,
    };
  }

  if (!existingMember) {
    return {
      error: "La persona no existe o no pertenece al club.",
    };
  }

  const { data: duplicatedMember, error: duplicatedMemberError } =
    await supabase
      .from("members")
      .select("id")
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .eq("dni", payload.dni)
      .neq("id", memberId)
      .maybeSingle();

  if (duplicatedMemberError) {
    return {
      error: `No fue posible verificar el DNI: ${duplicatedMemberError.message}`,
    };
  }

  if (duplicatedMember) {
    return {
      error: "Ya existe otra persona con ese DNI.",
    };
  }

  const { error: memberError } = await supabase
    .from("members")
    .update({
      first_name: payload.firstName,
      last_name: payload.lastName,
      dni: payload.dni,
      guardian_name: payload.guardianName || null,
      email: payload.email || null,
      phone: payload.phone || null,
    })
    .eq("id", memberId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId);

  if (memberError) {
    return {
      error: `No fue posible actualizar la persona: ${memberError.message}`,
    };
  }

  const relationError = await syncMemberActivities(
    supabase,
    memberId,
    payload.activityIds,
    context.organizationId,
    context.clubId,
  );

  if (relationError) {
    return {
      error: `Los datos personales se actualizaron, pero ocurrió un problema con las actividades. ${relationError}`,
    };
  }

  await writeAuditLog(context, {
    action: "member.updated",

    entityType: "member",

    entityId: memberId,

    entityLabel: `${payload.firstName} ${payload.lastName}`,

    summary: `Actualizó los datos de "${payload.firstName} ${payload.lastName}".`,

    metadata: {
      dni: payload.dni,

      activity_ids: payload.activityIds,

      email: payload.email || null,

      phone: payload.phone || null,
    },
  });

  revalidateMemberPages(memberId);

  redirect("/panel/personas");
}

export async function deactivateMember(memberId: string): Promise<{
  error: string | null;
}> {
  const context = await requirePlanFeature("members");

  if (!canManageMembers(context.role)) {
    return {
      error: "Tu usuario no tiene permisos para dar de baja personas.",
    };
  }

  const supabase = await createClient();

  const { data: member, error: memberReadError } = await supabase
    .from("members")
    .select(
      `
  id,
  first_name,
  last_name
`,
    )
    .eq("id", memberId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (memberReadError) {
    return {
      error: `No fue posible consultar la persona: ${memberReadError.message}`,
    };
  }

  if (!member) {
    return {
      error: "La persona no existe o no pertenece al club.",
    };
  }

  const today = new Date().toISOString().slice(0, 10);

  const { error: memberError } = await supabase
    .from("members")
    .update({
      active: false,
      inactive_at: new Date().toISOString(),
    })
    .eq("id", memberId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId);

  if (memberError) {
    return {
      error: `No fue posible dar de baja a la persona: ${memberError.message}`,
    };
  }

  const { error: relationError } = await supabase
    .from("member_activities")
    .update({
      active: false,
      end_date: today,
    })
    .eq("member_id", memberId)
    .eq("active", true)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId);

  if (relationError) {
    return {
      error: `La persona fue dada de baja, pero no fue posible cerrar sus actividades: ${relationError.message}`,
    };
  }

  await writeAuditLog(context, {
    action: "member.deactivated",

    entityType: "member",

    entityId: memberId,

    entityLabel: `${member.first_name} ${member.last_name}`,

    summary: `Dio de baja a "${member.first_name} ${member.last_name}".`,
  });

  revalidateMemberPages(memberId);

  return {
    error: null,
  };
}

export async function reactivateMember(memberId: string): Promise<{
  error: string | null;
}> {
  const context = await requirePlanFeature("members");

  if (!canManageMembers(context.role)) {
    return {
      error: "Tu usuario no tiene permisos para reactivar personas.",
    };
  }

  const supabase = await createClient();

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
    .select(
      `
    id,
    first_name,
    last_name
  `,
    )
    .maybeSingle();

  if (error || !member) {
    return {
      error: `No fue posible reactivar a la persona: ${
        error?.message ?? "La persona no existe o no pertenece al club."
      }`,
    };
  }

  await writeAuditLog(context, {
    action: "member.reactivated",

    entityType: "member",

    entityId: memberId,

    entityLabel: `${member.first_name} ${member.last_name}`,

    summary: `Reactivó a "${member.first_name} ${member.last_name}".`,
  });

  revalidateMemberPages(memberId);

  return {
    error: null,
  };
}

function revalidateMemberPages(memberId?: string) {
  revalidatePath("/panel");

  revalidatePath("/panel/personas");

  if (memberId) {
    revalidatePath(`/panel/personas/${memberId}/editar`);
  }
}

async function getMemberForCardAction(memberId: string) {
  const context = await requirePlanFeature("members");

  if (context.role !== "owner" && context.role !== "admin") {
    return {
      context,
      member: null,
      error: "Tu usuario no tiene permisos para gestionar carnets.",
    };
  }

  const supabase = await createClient();
  const { data: member, error: memberError } = await supabase
    .from("members")
    .select("id, active")
    .eq("id", memberId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (memberError) {
    return {
      context,
      member: null,
      error: `No fue posible consultar la persona: ${memberError.message}`,
    };
  }

  if (!member) {
    return {
      context,
      member: null,
      error: "La persona no existe o no pertenece al club.",
    };
  }

  return {
    context,
    member,
    error: null,
  };
}

export async function revokeMemberCardCredential(
  memberId: string,
): Promise<MemberCardActionState> {
  const result = await getMemberForCardAction(memberId);

  if (result.error || !result.member) {
    return {
      error: result.error,
      success: null,
    };
  }

  const supabase = await createClient();
  const { data: revoked, error: revokeError } = await supabase.rpc(
    "revoke_member_card_credential",
    {
      requested_member_id: memberId,
    },
  );

  if (revokeError) {
    return {
      error: "No fue posible revocar el carnet. Intentá nuevamente.",
      success: null,
    };
  }

  if (!revoked) {
    revalidateMemberPages(memberId);

    return {
      error: null,
      success: "El socio ya no tenía un carnet activo.",
    };
  }

  revalidateMemberPages(memberId);

  return {
    error: null,
    success: "Carnet revocado correctamente.",
  };
}

export async function reissueMemberCardCredential(
  memberId: string,
): Promise<MemberCardActionState> {
  const result = await getMemberForCardAction(memberId);

  if (result.error || !result.member) {
    return {
      error: result.error,
      success: null,
    };
  }

  if (!result.member.active) {
    return {
      error: "No se puede emitir o reemitir el carnet de una persona inactiva.",
      success: null,
    };
  }

  const supabase = await createClient();
  const { data: newCredentialId, error: reissueError } = await supabase.rpc(
    "reissue_member_card_credential",
    {
      requested_member_id: memberId,
    },
  );

  if (reissueError || !newCredentialId) {
    return {
      error: "No fue posible generar el carnet. Intentá nuevamente.",
      success: null,
    };
  }

  revalidateMemberPages(memberId);

  return {
    error: null,
    success: "Se generó un nuevo carnet correctamente.",
  };
}
