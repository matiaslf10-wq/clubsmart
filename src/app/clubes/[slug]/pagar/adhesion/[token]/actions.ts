"use server";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicAdhesionState = {
  error: string | null;
  success: boolean;
  message: string | null;
};

function readText(
  formData: FormData,
  field: string,
) {
  const value = formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function hashToken(token: string) {
  return createHash("sha256")
    .update(token)
    .digest("hex");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function isValidToken(value: string) {
  return /^[A-Za-z0-9_-]{40,}$/.test(
    value,
  );
}

export async function requestPagoTicAdhesion(
  _previousState: PublicAdhesionState,
  formData: FormData,
): Promise<PublicAdhesionState> {
  const clubSlug = readText(
    formData,
    "club_slug",
  );

  const token = readText(
    formData,
    "token",
  );

  const email = readText(
    formData,
    "email",
  ).toLowerCase();

  const accepted =
    formData.get("accepted") === "on";

  if (!clubSlug || !isValidToken(token)) {
    return {
      error:
        "El enlace de adhesión no es válido.",
      success: false,
      message: null,
    };
  }

  if (!isValidEmail(email)) {
    return {
      error:
        "Ingresá un correo electrónico válido.",
      success: false,
      message: null,
    };
  }

  if (!accepted) {
    return {
      error:
        "Debés aceptar la adhesión al débito automático para continuar.",
      success: false,
      message: null,
    };
  }

  const supabase =
    createAdminClient();

  const {
    data: club,
    error: clubError,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      organization_id,
      slug
    `)
    .eq("slug", clubSlug)
    .maybeSingle();

  if (clubError || !club) {
    return {
      error:
        "No fue posible identificar el club.",
      success: false,
      message: null,
    };
  }

  const tokenHash =
    hashToken(token);

  const {
    data: invitation,
    error: invitationError,
  } = await supabase
    .from(
      "payment_subscription_invitations",
    )
    .select(`
      id,
      organization_id,
      club_id,
      member_id,
      activity_id,
      provider_configuration_id,
      status,
      expires_at
    `)
    .eq("token_hash", tokenHash)
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .maybeSingle();

  if (invitationError) {
    console.error(
      "Error consultando invitación:",
      invitationError,
    );

    return {
      error:
        "No fue posible verificar el enlace.",
      success: false,
      message: null,
    };
  }

  if (!invitation) {
    return {
      error:
        "El enlace no existe o no pertenece a este club.",
      success: false,
      message: null,
    };
  }

  if (invitation.status === "used") {
    return {
      error: null,
      success: true,
      message:
        "Esta invitación ya fue utilizada. La solicitud de adhesión quedó registrada.",
    };
  }

  if (invitation.status !== "active") {
    return {
      error:
        "Esta invitación fue revocada y ya no puede utilizarse.",
      success: false,
      message: null,
    };
  }

  if (
    new Date(
      invitation.expires_at,
    ).getTime() <= Date.now()
  ) {
    return {
      error:
        "Esta invitación venció. Solicitá al club un nuevo enlace.",
      success: false,
      message: null,
    };
  }

  const {
    data: configuration,
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
      "id",
      invitation.provider_configuration_id,
    )
    .eq("provider", "pagotic")
    .eq("club_id", club.id)
    .maybeSingle();

  if (
    configurationError ||
    !configuration
  ) {
    return {
      error:
        "No fue posible consultar la configuración de Pago TIC.",
      success: false,
      message: null,
    };
  }

  if (
    !configuration.enabled ||
    configuration.connection_status !==
      "active" ||
    !configuration
      .automatic_debit_enabled ||
    !configuration
      .merchant_account_id
  ) {
    return {
      error:
        "El club todavía no está habilitado para recibir adhesiones mediante Pago TIC.",
      success: false,
      message: null,
    };
  }

  const {
    data: member,
    error: memberError,
  } = await supabase
    .from("members")
    .select(`
      id,
      active
    `)
    .eq(
      "id",
      invitation.member_id,
    )
    .eq("club_id", club.id)
    .eq("active", true)
    .maybeSingle();

  if (memberError || !member) {
    return {
      error:
        "La persona asociada a la invitación ya no se encuentra activa.",
      success: false,
      message: null,
    };
  }

  const {
    data: relationship,
    error: relationshipError,
  } = await supabase
    .from("member_activities")
    .select("id")
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq("club_id", club.id)
    .eq(
      "member_id",
      invitation.member_id,
    )
    .eq(
      "activity_id",
      invitation.activity_id,
    )
    .eq("active", true)
    .maybeSingle();

  if (
    relationshipError ||
    !relationship
  ) {
    return {
      error:
        "La inscripción vinculada con esta invitación ya no se encuentra activa.",
      success: false,
      message: null,
    };
  }

  const {
    data: existingSubscription,
    error: existingSubscriptionError,
  } = await supabase
    .from("payment_subscriptions")
    .select(`
      id,
      status
    `)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq("club_id", club.id)
    .eq(
      "member_id",
      invitation.member_id,
    )
    .eq(
      "activity_id",
      invitation.activity_id,
    )
    .eq("provider", "pagotic")
    .in("status", [
      "pending",
      "active",
      "paused",
    ])
    .limit(1)
    .maybeSingle();

  if (existingSubscriptionError) {
    console.error(
      "Error consultando adhesión existente:",
      existingSubscriptionError,
    );

    return {
      error:
        "No fue posible verificar las adhesiones existentes.",
      success: false,
      message: null,
    };
  }

  const now =
    new Date().toISOString();

  if (existingSubscription) {
    await supabase
      .from(
        "payment_subscription_invitations",
      )
      .update({
        status: "used",
        used_at: now,
        updated_at: now,
      })
      .eq("id", invitation.id);

    return {
      error: null,
      success: true,
      message:
        existingSubscription.status ===
        "active"
          ? "La adhesión ya se encuentra activa."
          : "Ya existe una solicitud de adhesión en proceso.",
    };
  }

  const subscriptionId =
    randomUUID();

  const externalReference =
    randomUUID();

  const {
    error: insertSubscriptionError,
  } = await supabase
    .from("payment_subscriptions")
    .insert({
      id: subscriptionId,

      organization_id:
        club.organization_id,

      club_id: club.id,

      member_id:
        invitation.member_id,

      activity_id:
        invitation.activity_id,

      provider_configuration_id:
        configuration.id,

      provider: "pagotic",

      external_reference:
        externalReference,

      status: "pending",

      provider_payload: {
        source:
          "public_invitation",

        invitation_id:
          invitation.id,

        consent_at: now,

        payer_email: email,

        collector_id:
          configuration
            .merchant_account_id,
      },

      created_at: now,
      updated_at: now,
    });

  if (insertSubscriptionError) {
    console.error(
      "Error creando adhesión pendiente:",
      insertSubscriptionError,
    );

    return {
      error:
        `No fue posible registrar la adhesión: ${insertSubscriptionError.message}`,
      success: false,
      message: null,
    };
  }

  const {
    error: updateInvitationError,
  } = await supabase
    .from(
      "payment_subscription_invitations",
    )
    .update({
      status: "used",
      used_at: now,
      updated_at: now,
    })
    .eq("id", invitation.id)
    .eq("status", "active");

  if (updateInvitationError) {
    await supabase
      .from("payment_subscriptions")
      .delete()
      .eq("id", subscriptionId);

    console.error(
      "Error consumiendo invitación:",
      updateInvitationError,
    );

    return {
      error:
        "No fue posible completar la solicitud. Volvé a intentarlo.",
      success: false,
      message: null,
    };
  }

  revalidatePath(
    "/panel/pagos/adhesiones",
  );

  return {
    error: null,
    success: true,
    message:
      "La solicitud de adhesión fue registrada correctamente. El club podrá continuar el proceso mediante Pago TIC.",
  };
}