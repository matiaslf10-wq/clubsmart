"use server";

import {
  createHash,
  randomBytes,
} from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

function canManagePayments(role: string) {
  return (
    role === "owner" ||
    role === "admin"
  );
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

function redirectWithMessage(
  type: "error" | "success",
  message: string,
  additionalParameters?: Record<
    string,
    string
  >,
): never {
  const parameters =
    new URLSearchParams({
      [type]: message,
      ...additionalParameters,
    });

  redirect(
    `/panel/pagos/adhesiones?${parameters.toString()}`,
  );
}

function createToken() {
  return randomBytes(32).toString(
    "base64url",
  );
}

function hashToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function getExpirationDate(
  numberOfDays: number,
) {
  const expirationDate =
    new Date();

  expirationDate.setDate(
    expirationDate.getDate() +
      numberOfDays,
  );

  return expirationDate.toISOString();
}

export async function createAdhesionInvitation(
  formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (!canManagePayments(context.role)) {
    redirectWithMessage(
      "error",
      "Tu usuario no tiene permisos para generar invitaciones de adhesión.",
    );
  }

  const relationshipValue =
    readText(
      formData,
      "member_activity",
    );

  const expirationDaysText =
    readText(
      formData,
      "expiration_days",
    );

  const [
    memberId,
    activityId,
  ] = relationshipValue.split("|");

  const expirationDays =
    Number(expirationDaysText);

  if (
    !memberId ||
    !activityId
  ) {
    redirectWithMessage(
      "error",
      "Seleccioná una persona y una actividad.",
    );
  }

  if (
    ![3, 7, 14, 30].includes(
      expirationDays,
    )
  ) {
    redirectWithMessage(
      "error",
      "El plazo de vencimiento seleccionado no es válido.",
    );
  }

  const siteUrl =
    process.env
      .NEXT_PUBLIC_SITE_URL
      ?.trim()
      .replace(/\/$/, "");

  if (!siteUrl) {
    redirectWithMessage(
      "error",
      "Falta configurar NEXT_PUBLIC_SITE_URL.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: pagoTicConfiguration,
    error: configurationError,
  } = await supabase
    .from("club_payment_providers")
    .select(`
      id,
      enabled,
      connection_status,
      automatic_debit_enabled,
      merchant_account_id
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("provider", "pagotic")
    .maybeSingle();

  if (configurationError) {
    redirectWithMessage(
      "error",
      `No fue posible consultar Pago TIC: ${configurationError.message}`,
    );
  }

  if (
    !pagoTicConfiguration ||
    !pagoTicConfiguration.enabled ||
    pagoTicConfiguration
      .connection_status !==
      "active" ||
    !pagoTicConfiguration
      .automatic_debit_enabled ||
    !pagoTicConfiguration
      .merchant_account_id
  ) {
    redirectWithMessage(
      "error",
      "Pago TIC debe estar activo y habilitado para débito automático antes de generar invitaciones.",
    );
  }

  const {
    data: relationship,
    error: relationshipError,
  } = await supabase
    .from("member_activities")
    .select(`
      id,
      member_id,
      activity_id,
      active
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("member_id", memberId)
    .eq("activity_id", activityId)
    .eq("active", true)
    .maybeSingle();

  if (relationshipError) {
    redirectWithMessage(
      "error",
      `No fue posible verificar la inscripción: ${relationshipError.message}`,
    );
  }

  if (!relationship) {
    redirectWithMessage(
      "error",
      "La persona no tiene una inscripción activa en la actividad seleccionada.",
    );
  }

  const {
    data: existingSubscription,
    error: subscriptionError,
  } = await supabase
    .from("payment_subscriptions")
    .select(`
      id,
      status
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("member_id", memberId)
    .eq("activity_id", activityId)
    .eq("provider", "pagotic")
    .in("status", [
      "pending",
      "active",
      "paused",
    ])
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    redirectWithMessage(
      "error",
      `No fue posible consultar las adhesiones: ${subscriptionError.message}`,
    );
  }

  if (existingSubscription) {
    redirectWithMessage(
      "error",
      "Esta persona ya tiene una adhesión pendiente, activa o pausada para la actividad.",
    );
  }

  const now =
    new Date().toISOString();

  /*
   * Revocamos cualquier invitación anterior
   * que todavía figure activa para la misma
   * persona y actividad.
   */
  const {
    error: revokePreviousError,
  } = await supabase
    .from(
      "payment_subscription_invitations",
    )
    .update({
      status: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("member_id", memberId)
    .eq("activity_id", activityId)
    .eq("status", "active");

  if (revokePreviousError) {
    redirectWithMessage(
      "error",
      `No fue posible reemplazar la invitación anterior: ${revokePreviousError.message}`,
    );
  }

  const token = createToken();
  const tokenHash =
    hashToken(token);

  const {
    error: invitationError,
  } = await supabase
    .from(
      "payment_subscription_invitations",
    )
    .insert({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      member_id: memberId,
      activity_id: activityId,

      provider_configuration_id:
        pagoTicConfiguration.id,

      provider: "pagotic",

      token_hash: tokenHash,

      token_last_characters:
        token.slice(-6),

      status: "active",

      expires_at:
        getExpirationDate(
          expirationDays,
        ),

      created_at: now,
      updated_at: now,
    });

  if (invitationError) {
    redirectWithMessage(
      "error",
      `No fue posible generar la invitación: ${invitationError.message}`,
    );
  }

  const invitationUrl =
    `${siteUrl}/clubes/${context.clubSlug}` +
    `/pagar/adhesion/${token}`;

  revalidatePath(
    "/panel/pagos/adhesiones",
  );

  redirectWithMessage(
    "success",
    "La invitación fue generada. Copiá el enlace antes de salir de esta página.",
    {
      link: invitationUrl,
    },
  );
}

export async function revokeAdhesionInvitation(
  invitationId: string,
): Promise<void> {
  const context =
    await getAdminContext();

  if (!canManagePayments(context.role)) {
    redirectWithMessage(
      "error",
      "Tu usuario no tiene permisos para revocar invitaciones.",
    );
  }

  const supabase =
    createAdminClient();

  const now =
    new Date().toISOString();

  const {
    data,
    error,
  } = await supabase
    .from(
      "payment_subscription_invitations",
    )
    .update({
      status: "revoked",
      revoked_at: now,
      updated_at: now,
    })
    .eq("id", invitationId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("status", "active")
    .select("id")
    .maybeSingle();

  if (error) {
    redirectWithMessage(
      "error",
      `No fue posible revocar la invitación: ${error.message}`,
    );
  }

  if (!data) {
    redirectWithMessage(
      "error",
      "La invitación no existe o ya no se encuentra activa.",
    );
  }

  revalidatePath(
    "/panel/pagos/adhesiones",
  );

  redirectWithMessage(
    "success",
    "La invitación fue revocada.",
  );
}