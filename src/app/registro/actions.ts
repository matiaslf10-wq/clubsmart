"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type SignupPlan =
  | "essential"
  | "pro";

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

function isSignupPlan(
  value: string,
): value is SignupPlan {
  return (
    value === "essential" ||
    value === "pro"
  );
}

function getSiteUrl() {
  const configuredUrl =
    process.env.NEXT_PUBLIC_SITE_URL;

  if (configuredUrl) {
    return configuredUrl.replace(
      /\/$/,
      "",
    );
  }

  if (
    process.env.NODE_ENV ===
    "development"
  ) {
    return "http://localhost:3000";
  }

  return "https://clubsmart.vercel.app";
}

function redirectWithError(
  message: string,
) {
  redirect(
    `/registro?error=${encodeURIComponent(
      message,
    )}`,
  );
}

export async function registerClubOwner(
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

  const plan =
    readText(
      formData,
      "plan_code",
    );

  if (
    !email ||
    !email.includes("@")
  ) {
    redirectWithError(
      "Ingresá un correo electrónico válido.",
    );
  }

  if (
    password.length < 8
  ) {
    redirectWithError(
      "La contraseña debe tener al menos 8 caracteres.",
    );
  }

  if (
    password !==
    passwordConfirmation
  ) {
    redirectWithError(
      "Las contraseñas no coinciden.",
    );
  }

  if (
    !isSignupPlan(plan)
  ) {
    redirectWithError(
      "Seleccioná un plan válido.",
    );
  }

  const supabase =
    await createClient();

  const siteUrl =
    getSiteUrl();

  const {
    data,
    error,
  } =
    await supabase.auth.signUp({
      email,
      password,

      options: {
        emailRedirectTo:
          `${siteUrl}/auth/callback?next=/alta-club`,

        data: {
          plan_code: plan,
        },
      },
    });

  if (error) {
    console.error(
      "Error registrando usuario:",
      error,
    );

    redirectWithError(
      `No fue posible crear la cuenta: ${error.message}`,
    );
  }

  /*
   * Si Supabase devuelve sesión
   * inmediatamente, por ejemplo
   * en un entorno sin confirmación
   * obligatoria de email, seguimos
   * directamente al alta del club.
   */
  if (data.session) {
    redirect("/alta-club");
  }

  redirect(
    `/registro?sent=1&plan=${plan}`,
  );
}