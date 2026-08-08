"use server";

import {
  redirect,
} from "next/navigation";

import {
  revalidatePath,
} from "next/cache";

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
   * Por seguridad no permitimos
   * cambiar el propio rol desde
   * esta pantalla.
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
   * Owner no se asigna desde
   * el selector normal.
   *
   * La transferencia de propiedad
   * será un flujo independiente.
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
   * Un owner no puede degradarse
   * mediante esta acción genérica.
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

  const {
    error: updateError,
  } = await supabase
    .from(
      "organization_users",
    )
    .update({
      role: newRole,
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
   * Evitamos que una persona se
   * quite accidentalmente su
   * propio acceso.
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
   * Nunca quitamos un owner
   * utilizando esta acción.
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
   * MUY IMPORTANTE:
   *
   * NO hacemos:
   *
   * supabase.auth.admin.deleteUser(...)
   *
   * porque solamente queremos
   * quitar la relación con este
   * club/organización.
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