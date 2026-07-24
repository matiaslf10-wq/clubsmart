"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export type MemberFormState = {
  error: string | null;
};

type MemberPayload = {
  firstName: string;
  lastName: string;
  dni: string;
  guardianName: string;
  email: string;
  phone: string;
  activityId: string;
};

function canManageMembers(role: string) {
  return role === "owner" || role === "admin";
}

function readText(
  formData: FormData,
  field: string,
) {
  const value = formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function normalizeDni(value: string) {
  return value.replace(/\D/g, "");
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, "");
}

function isValidEmail(value: string) {
  if (!value) {
    return true;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function readMemberPayload(
  formData: FormData,
):
  | {
      data: MemberPayload;
      error: null;
    }
  | {
      data: null;
      error: string;
    } {
  const firstName = readText(
    formData,
    "first_name",
  );

  const lastName = readText(
    formData,
    "last_name",
  );

  const dni = normalizeDni(
    readText(formData, "dni"),
  );

  const guardianName = readText(
    formData,
    "guardian_name",
  );

  const email = readText(
    formData,
    "email",
  ).toLowerCase();

  const phone = normalizePhone(
    readText(formData, "phone"),
  );

  const activityId = readText(
    formData,
    "activity_id",
  );

  if (firstName.length < 2) {
    return {
      data: null,
      error:
        "El nombre debe tener al menos dos caracteres.",
    };
  }

  if (lastName.length < 2) {
    return {
      data: null,
      error:
        "El apellido debe tener al menos dos caracteres.",
    };
  }

  if (dni && dni.length < 7) {
    return {
      data: null,
      error:
        "El DNI ingresado parece incompleto.",
    };
  }

  if (!isValidEmail(email)) {
    return {
      data: null,
      error:
        "El correo electrónico no es válido.",
    };
  }

  if (!activityId) {
    return {
      data: null,
      error: "Seleccioná una actividad.",
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
      activityId,
    },
  };
}

async function activityBelongsToClub(
  activityId: string,
  organizationId: string,
  clubId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select("id")
    .eq("id", activityId)
    .eq("organization_id", organizationId)
    .eq("club_id", clubId)
    .eq("active", true)
    .maybeSingle();

  return {
    valid: !error && Boolean(data),
    error,
  };
}

export async function createMember(
  _previousState: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const context = await getAdminContext();

  if (!canManageMembers(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para cargar personas.",
    };
  }

  const parsed = readMemberPayload(formData);

  if (parsed.error || !parsed.data) {
    return {
      error: parsed.error,
    };
  }

  const payload = parsed.data;

  const activityCheck =
    await activityBelongsToClub(
      payload.activityId,
      context.organizationId,
      context.clubId,
    );

  if (!activityCheck.valid) {
    return {
      error:
        "La actividad seleccionada no pertenece al club.",
    };
  }

  const supabase = await createClient();

  if (payload.dni) {
    const { data: existingMember } =
      await supabase
        .from("members")
        .select("id, first_name, last_name")
        .eq("club_id", context.clubId)
        .eq("dni", payload.dni)
        .maybeSingle();

    if (existingMember) {
      return {
        error:
          `Ya existe una persona con ese DNI: ${existingMember.first_name} ${existingMember.last_name}.`,
      };
    }
  }

  const {
    data: member,
    error: memberError,
  } = await supabase
    .from("members")
    .insert({
      organization_id:
        context.organizationId,
      club_id: context.clubId,
      first_name: payload.firstName,
      last_name: payload.lastName,
      dni: payload.dni || null,
      guardian_name:
        payload.guardianName || null,
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
        memberError?.message ??
        "Error desconocido"
      }`,
    };
  }

  const { error: relationError } =
    await supabase
      .from("member_activities")
      .insert({
        organization_id:
          context.organizationId,
        club_id: context.clubId,
        member_id: member.id,
        activity_id: payload.activityId,
        active: true,
        start_date: new Date()
          .toISOString()
          .slice(0, 10),
        end_date: null,
      });

  if (relationError) {
    await supabase
      .from("members")
      .delete()
      .eq("id", member.id)
      .eq(
        "organization_id",
        context.organizationId,
      );

    return {
      error: `No fue posible asignar la actividad: ${relationError.message}`,
    };
  }

  revalidatePath("/panel/personas");

  redirect("/panel/personas");
}

export async function updateMember(
  memberId: string,
  _previousState: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const context = await getAdminContext();

  if (!canManageMembers(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para editar personas.",
    };
  }

  const parsed = readMemberPayload(formData);

  if (parsed.error || !parsed.data) {
    return {
      error: parsed.error,
    };
  }

  const payload = parsed.data;

  const activityCheck =
    await activityBelongsToClub(
      payload.activityId,
      context.organizationId,
      context.clubId,
    );

  if (!activityCheck.valid) {
    return {
      error:
        "La actividad seleccionada no pertenece al club.",
    };
  }

  const supabase = await createClient();

  const { data: existingMember } =
    await supabase
      .from("members")
      .select("id")
      .eq("id", memberId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .maybeSingle();

  if (!existingMember) {
    return {
      error:
        "La persona no existe o no pertenece al club.",
    };
  }

  if (payload.dni) {
    const { data: duplicatedMember } =
      await supabase
        .from("members")
        .select("id")
        .eq("club_id", context.clubId)
        .eq("dni", payload.dni)
        .neq("id", memberId)
        .maybeSingle();

    if (duplicatedMember) {
      return {
        error:
          "Ya existe otra persona con ese DNI.",
      };
    }
  }

  const { error: memberError } =
    await supabase
      .from("members")
      .update({
        first_name: payload.firstName,
        last_name: payload.lastName,
        dni: payload.dni || null,
        guardian_name:
          payload.guardianName || null,
        email: payload.email || null,
        phone: payload.phone || null,
      })
      .eq("id", memberId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId);

  if (memberError) {
    return {
      error: `No fue posible actualizar la persona: ${memberError.message}`,
    };
  }

  const { data: currentRelation } =
    await supabase
      .from("member_activities")
      .select("id, activity_id")
      .eq("member_id", memberId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

  if (
    currentRelation &&
    currentRelation.activity_id ===
      payload.activityId
  ) {
    const { error: relationUpdateError } =
      await supabase
        .from("member_activities")
        .update({
        })
        .eq("id", currentRelation.id)
        .eq(
          "organization_id",
          context.organizationId,
        );

    if (relationUpdateError) {
      return {
        error: `La persona se actualizó, pero no fue posible actualizar el importe: ${relationUpdateError.message}`,
      };
    }
  } else {
    if (currentRelation) {
      const { error: endRelationError } =
        await supabase
          .from("member_activities")
          .update({
            active: false,
            end_date: new Date()
              .toISOString()
              .slice(0, 10),
          })
          .eq("id", currentRelation.id)
          .eq(
            "organization_id",
            context.organizationId,
          );

      if (endRelationError) {
        return {
          error: `No fue posible cerrar la actividad anterior: ${endRelationError.message}`,
        };
      }
    }

    const { error: newRelationError } =
      await supabase
        .from("member_activities")
        .insert({
          organization_id:
            context.organizationId,
          club_id: context.clubId,
          member_id: memberId,
          activity_id: payload.activityId,
          active: true,
          start_date: new Date()
            .toISOString()
            .slice(0, 10),
          end_date: null,
        });

    if (newRelationError) {
      return {
        error: `No fue posible asignar la nueva actividad: ${newRelationError.message}`,
      };
    }
  }

  revalidatePath("/panel/personas");
  revalidatePath(
    `/panel/personas/${memberId}/editar`,
  );

  redirect("/panel/personas");
}

export async function deactivateMember(
  memberId: string,
): Promise<{
  error: string | null;
}> {
  const context = await getAdminContext();

  if (!canManageMembers(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para dar de baja personas.",
    };
  }

  const supabase = await createClient();

  const { data: member } = await supabase
    .from("members")
    .select("id")
    .eq("id", memberId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (!member) {
    return {
      error:
        "La persona no existe o no pertenece al club.",
    };
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const { error: memberError } =
    await supabase
      .from("members")
      .update({
        active: false,
        inactive_at: new Date().toISOString(),
      })
      .eq("id", memberId)
      .eq(
        "organization_id",
        context.organizationId,
      );

  if (memberError) {
    return {
      error: `No fue posible dar de baja a la persona: ${memberError.message}`,
    };
  }

  const { error: relationError } =
    await supabase
      .from("member_activities")
      .update({
        active: false,
        end_date: today,
      })
      .eq("member_id", memberId)
      .eq("active", true)
      .eq(
        "organization_id",
        context.organizationId,
      );

  if (relationError) {
    return {
      error:
        `La persona fue dada de baja, pero no fue posible cerrar su actividad: ${relationError.message}`,
    };
  }

  revalidatePath("/panel/personas");

  return {
    error: null,
  };
}

export async function reactivateMember(
  memberId: string,
): Promise<{
  error: string | null;
}> {
  const context = await getAdminContext();

  if (!canManageMembers(context.role)) {
    return {
      error:
        "Tu usuario no tiene permisos para reactivar personas.",
    };
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("members")
    .update({
      active: true,
      inactive_at: null,
      inactive_reason: null,
    })
    .eq("id", memberId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId);

  if (error) {
    return {
      error: `No fue posible reactivar a la persona: ${error.message}`,
    };
  }

  revalidatePath("/panel/personas");

  return {
    error: null,
  };
}