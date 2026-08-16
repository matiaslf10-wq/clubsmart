"use server";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

function readEmail(
  formData: FormData,
) {
  const value =
    formData.get(
      "email",
    );

  return typeof value ===
    "string"
    ? value
        .trim()
        .toLowerCase()
    : "";
}

export async function requestPasswordReset(
  formData: FormData,
): Promise<void> {
  const email =
    readEmail(
      formData,
    );

  if (
    !email ||
    !email.includes("@")
  ) {
    redirect(
      "/auth/recuperar-clave?error=Ingresá un correo electrónico válido.",
    );
  }

  const supabase =
    await createClient();

 const redirectTo =
  process.env.NODE_ENV ===
  "development"
    ? "http://localhost:3000/auth/callback?next=/auth/nueva-clave"
    : "https://clubsmart.vercel.app/auth/callback?next=/auth/nueva-clave";

  const {
    error,
  } =
    await supabase.auth.resetPasswordForEmail(
      email,
      {
        redirectTo,
      },
    );

  if (
    error
  ) {
    console.error(
      "No fue posible enviar recuperación de contraseña:",
      error.message,
    );

    redirect(
      "/auth/recuperar-clave?error=No fue posible enviar el correo de recuperación. Intentá nuevamente.",
    );
  }

  /*
   * No revelamos si la dirección
   * corresponde o no a una cuenta.
   */
  redirect(
    "/auth/recuperar-clave?sent=1",
  );
}