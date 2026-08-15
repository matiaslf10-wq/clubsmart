"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  writeAuditLog,
} from "@/lib/audit/write-audit-log";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  canManageUsers,
} from "@/lib/auth/permissions";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

const assignableRoles =
  new Set([
    "admin",
    "operator",
    "viewer",
  ]);

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function readText(
  formData: FormData,
  name: string,
) {
  const value =
    formData.get(name);

  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function redirectToUsers(
  type:
    | "success"
    | "error",
  message: string,
): never {
  const parameters =
    new URLSearchParams({
      [type]: message,
    });

  redirect(
    `/panel/usuarios?${parameters.toString()}`,
  );
}

/*
 * ========================================
 * CAMBIAR ROL
 * ========================================
 */

export async function updateOrganizationUserRole(
  userId: string,
  formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManageUsers(
      context.role,
    )
  ) {
    redirect("/panel");
  }

  if (!isUuid(userId)) {
    redirectToUsers(
      "error",
      "El usuario no es válido.",
    );
  }

  /*
   * No permitimos modificar
   * el propio rol desde esta pantalla.
   */
  if (
    userId ===
    context.userId
  ) {
    redirectToUsers(
      "error",
      "No podés modificar tu propio rol desde esta pantalla.",
    );
  }

  const newRole =
    readText(
      formData,
      "role",
    );

  /*
   * El rol owner nunca se asigna
   * desde este selector.
   *
   * La transferencia de propiedad
   * será un flujo específico.
   */
  if (
    !assignableRoles.has(
      newRole,
    )
  ) {
    redirectToUsers(
      "error",
      "El rol seleccionado no es válido.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: membership,
    error:
      membershipError,
  } = await supabase
    .from(
      "organization_users",
    )
    .select(`
      user_id,
      role
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "user_id",
      userId,
    )
    .maybeSingle();

  if (
    membershipError ||
    !membership
  ) {
    redirectToUsers(
      "error",
      "El usuario no pertenece a esta organización.",
    );
  }

  /*
   * Un owner tampoco puede ser
   * degradado mediante esta acción.
   */
  if (
    membership.role ===
    "owner"
  ) {
    redirectToUsers(
      "error",
      "El propietario no puede cambiarse desde esta acción.",
    );
  }

  /*
   * Si eligieron exactamente
   * el mismo rol no hacemos
   * ninguna modificación.
   */
  if (
    membership.role ===
    newRole
  ) {
    redirectToUsers(
      "success",
      "El usuario ya tenía ese rol.",
    );
  }

  const {
    error: updateError,
  } = await supabase
    .from(
      "organization_users",
    )
    .update({
      role:
        newRole,
    })
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "user_id",
      userId,
    );

  if (updateError) {
    redirectToUsers(
      "error",
      `No fue posible cambiar el rol: ${updateError.message}`,
    );
  }

  /*
   * Auditoría.
   */
  await writeAuditLog(
    context,
    {
      action:
        "user.role_changed",

      entityType:
        "user",

      entityId:
        userId,

      summary:
        `Cambió el rol de un usuario de "${membership.role}" a "${newRole}".`,

      metadata: {
        target_user_id:
          userId,

        previous_role:
          membership.role,

        new_role:
          newRole,
      },
    },
  );

  revalidatePath(
    "/panel/usuarios",
  );

  revalidatePath(
    "/panel",
    "layout",
  );

  redirectToUsers(
    "success",
    "El rol fue actualizado correctamente.",
  );
}

/*
 * ========================================
 * QUITAR ACCESO
 * ========================================
 */

export async function removeOrganizationUser(
  userId: string,
  _formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManageUsers(
      context.role,
    )
  ) {
    redirect("/panel");
  }

  if (!isUuid(userId)) {
    redirectToUsers(
      "error",
      "El usuario no es válido.",
    );
  }

  /*
   * Evitamos que una persona
   * se quite accidentalmente
   * su propio acceso.
   */
  if (
    userId ===
    context.userId
  ) {
    redirectToUsers(
      "error",
      "No podés quitar tu propio acceso desde esta pantalla.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: membership,
    error:
      membershipError,
  } = await supabase
    .from(
      "organization_users",
    )
    .select(`
      user_id,
      role
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "user_id",
      userId,
    )
    .maybeSingle();

  if (
    membershipError ||
    !membership
  ) {
    redirectToUsers(
      "error",
      "El usuario no pertenece a esta organización.",
    );
  }

  /*
   * Nunca quitamos al owner
   * mediante esta acción.
   */
  if (
    membership.role ===
    "owner"
  ) {
    redirectToUsers(
      "error",
      "El propietario del club no puede eliminarse.",
    );
  }

  const {
    error: deleteError,
  } = await supabase
    .from(
      "organization_users",
    )
    .delete()
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "user_id",
      userId,
    );

  if (deleteError) {
    redirectToUsers(
      "error",
      `No fue posible quitar el usuario: ${deleteError.message}`,
    );
  }

  /*
   * Auditoría.
   *
   * Guardamos el rol que tenía
   * antes de quitarle el acceso.
   */
  await writeAuditLog(
    context,
    {
      action:
        "user.access_removed",

      entityType:
        "user",

      entityId:
        userId,

      summary:
        "Quitó el acceso de un usuario al club.",

      metadata: {
        target_user_id:
          userId,

        previous_role:
          membership.role,
      },
    },
  );

  /*
   * MUY IMPORTANTE:
   *
   * NO hacemos:
   *
   * supabase.auth.admin.deleteUser(...)
   *
   * porque solamente queremos
   * quitar la relación del usuario
   * con esta organización.
   *
   * Su cuenta de ClubSmart puede
   * seguir existiendo y eventualmente
   * pertenecer a otro club.
   */

  revalidatePath(
    "/panel/usuarios",
  );

  revalidatePath(
    "/panel",
    "layout",
  );

  redirectToUsers(
    "success",
    "El usuario ya no tiene acceso a este club.",
  );
}

/*
 * ========================================
 * INVITAR USUARIO
 * ========================================
 */

export async function inviteOrganizationUser(
  formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManageUsers(
      context.role,
    )
  ) {
    redirect("/panel");
  }

  const email =
    readText(
      formData,
      "email",
    ).toLowerCase();

  const role =
    readText(
      formData,
      "role",
    );

  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    )
  ) {
    redirectToUsers(
      "error",
      "Ingresá un correo electrónico válido.",
    );
  }

  if (
    !assignableRoles.has(
      role,
    )
  ) {
    redirectToUsers(
      "error",
      "El rol seleccionado no es válido.",
    );
  }

  const supabase =
    createAdminClient();

  /*
   * Primero enviamos la invitación
   * mediante Supabase Auth.
   */
  const {
    data:
      invitationData,
    error:
      invitationError,
  } =
    await supabase.auth.admin.inviteUserByEmail(
      email,
      {
        redirectTo:
          "https://clubsmart.vercel.app/auth/crear-clave",

        data: {
          invited_to_organization_id:
            context.organizationId,

          invited_to_club_id:
            context.clubId,

          invited_to_club_name:
            context.clubName,

          invited_role:
            role,
        },
      },
    );

  if (
    invitationError ||
    !invitationData.user
  ) {
    redirectToUsers(
      "error",
      invitationError?.message ??
        "No fue posible enviar la invitación.",
    );
  }

  const invitedUserId =
    invitationData.user.id;

  /*
   * Verificamos que no exista
   * ya una vinculación con
   * esta organización.
   */
  const {
    data:
      existingMembership,
    error:
      existingMembershipError,
  } = await supabase
    .from(
      "organization_users",
    )
    .select(`
      user_id,
      role
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "user_id",
      invitedUserId,
    )
    .maybeSingle();

  if (
    existingMembershipError
  ) {
    redirectToUsers(
      "error",
      `No fue posible verificar el usuario: ${existingMembershipError.message}`,
    );
  }

  if (
    existingMembership
  ) {
    redirectToUsers(
      "error",
      "Ese usuario ya pertenece a este club.",
    );
  }

  /*
   * Vinculamos la cuenta
   * con la organización.
   */
  const {
    error:
      membershipError,
  } = await supabase
    .from(
      "organization_users",
    )
    .insert({
      organization_id:
        context.organizationId,

      user_id:
        invitedUserId,

      role,
    });

  if (
    membershipError
  ) {
    /*
     * La invitación acaba de ser
     * creada dentro de este flujo.
     *
     * Si no podemos vincularla
     * con el club, evitamos dejar
     * una cuenta huérfana.
     */
    await supabase.auth.admin.deleteUser(
      invitedUserId,
    );

    redirectToUsers(
      "error",
      `No fue posible vincular el usuario al club: ${membershipError.message}`,
    );
  }

  /*
   * Auditoría.
   */
  await writeAuditLog(
    context,
    {
      action:
        "user.invited",

      entityType:
        "user",

      entityId:
        invitedUserId,

      entityLabel:
        email,

      summary:
        `Invitó a "${email}" con rol "${role}".`,

      metadata: {
        email,

        role,

        invited_user_id:
          invitedUserId,
      },
    },
  );

  revalidatePath(
    "/panel/usuarios",
  );

  revalidatePath(
    "/panel",
    "layout",
  );

  redirectToUsers(
    "success",
    `Invitación enviada a ${email}.`,
  );
}