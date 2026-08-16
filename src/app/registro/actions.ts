"use server";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

function readText(
  formData: FormData,
  field: string,
) {
  const value =
    formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function redirectToRegistration(
  type: "error" | "sent",
  message?: string,
): never {
  const parameters =
    new URLSearchParams();

  parameters.set(
    type,
    type === "sent"
      ? "1"
      : message ?? "Ocurrió un error.",
  );

  redirect(
    `/registro?${parameters.toString()}`,
  );
}

function getSignupCallbackUrl() {
  if (
    process.env.NODE_ENV ===
    "development"
  ) {
    return "http://localhost:3000/auth/callback?next=/alta-club";
  }

  return "https://clubsmart.vercel.app/auth/callback?next=/alta-club";
}

export async function signUp(
  formData: FormData,
): Promise<void> {
  const email =
    readText(
      formData,
      "email",
    ).toLowerCase();

  const password =
    readText(
      formData,
      "password",
    );

  const passwordConfirmation =
    readText(
      formData,
      "password_confirmation",
    );

  const emailIsValid =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      email,
    );

  if (!emailIsValid) {
    redirectToRegistration(
      "error",
      "Ingresá un correo electrónico válido.",
    );
  }

  if (
    password.length <
    8
  ) {
    redirectToRegistration(
      "error",
      "La contraseña debe tener al menos 8 caracteres.",
    );
  }

  if (
    password !==
    passwordConfirmation
  ) {
    redirectToRegistration(
      "error",
      "Las contraseñas no coinciden.",
    );
  }

  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.auth.signUp({
      email,
      password,

      options: {
        emailRedirectTo:
          getSignupCallbackUrl(),
      },
    });

  if (error) {
    console.error(
      "No fue posible registrar el usuario:",
      error.message,
    );

    redirectToRegistration(
      "error",
      "No fue posible crear la cuenta. Revisá los datos e intentá nuevamente.",
    );
  }

  /*
   * Normalmente, con confirmación
   * de email habilitada, todavía
   * no tendremos sesión.
   *
   * Si Supabase estuviera configurado
   * con confirmación automática,
   * continuamos directamente.
   */
  if (
    data.session
  ) {
    redirect(
      "/alta-club",
    );
  }

  /*
   * No revelamos información adicional
   * sobre cuentas preexistentes.
   */
  redirectToRegistration(
    "sent",
  );
}