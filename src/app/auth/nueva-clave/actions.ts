"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

function readPassword(
  formData: FormData,
  field: string,
) {
  const value =
    formData.get(
      field,
    );

  return typeof value ===
    "string"
    ? value
    : "";
}

export async function updatePassword(
  formData: FormData,
): Promise<void> {
  const password =
    readPassword(
      formData,
      "password",
    );

  const confirmation =
    readPassword(
      formData,
      "password_confirmation",
    );

  if (
    password.length <
    8
  ) {
    redirect(
      "/auth/nueva-clave?error=La contraseña debe tener al menos 8 caracteres.",
    );
  }

  if (
    password !==
    confirmation
  ) {
    redirect(
      "/auth/nueva-clave?error=Las contraseñas no coinciden.",
    );
  }

  const supabase =
    await createClient();

  /*
   * Comprobamos que el enlace de recuperación
   * realmente haya creado una sesión válida.
   */
  const {
    data:
      userData,
    error:
      userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !userData.user
  ) {
    redirect(
      "/auth/error",
    );
  }

  const {
    error:
      passwordError,
  } =
    await supabase.auth.updateUser({
      password,
    });

  if (
    passwordError
  ) {
    console.error(
      "No fue posible cambiar la contraseña:",
      passwordError.message,
    );

    const message =
      encodeURIComponent(
        passwordError.message,
      );

    redirect(
      `/auth/nueva-clave?error=${message}`,
    );
  }

  /*
   * Cerramos la sesión temporal de recuperación.
   *
   * Así obligamos a ingresar normalmente
   * con la nueva contraseña.
   */
  await supabase.auth.signOut();

  revalidatePath(
    "/",
    "layout",
  );

  redirect(
    "/login?password_updated=1",
  );
}