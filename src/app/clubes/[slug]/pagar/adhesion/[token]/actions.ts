"use server";

import {
  createHash,
  randomUUID,
} from "node:crypto";

import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";

import {
  createPagoTicAdhesion,
} from "@/lib/payments/pagotic";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

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

function getSiteUrl() {
  return process.env
    .NEXT_PUBLIC_SITE_URL
    ?.trim()
    .replace(/\/$/, "");
}

export async function requestPagoTicAdhesion(
  _previousState:
    PublicAdhesionState,
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
    formData.get("accepted") ===
    "on";

  if (
    !clubSlug ||
    !isValidToken(token)
  ) {
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

  const siteUrl = getSiteUrl();

  if (!siteUrl) {
    return {
      error:
        "El club todavía no puede iniciar adhesiones porque falta configurar su dirección pública.",
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
      name,
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
    .eq(
      "token_hash",
      hashToken(token),
    )
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .maybeSingle();

  if (
    invitationError ||
    !invitation
  ) {
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
        "Esta invitación ya fue utilizada. La solicitud quedó registrada anteriormente.",
    };
  }

  if (invitation.status !== "active") {
    return {
      error:
        "Esta invitación fue revocada.",
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

  const [
    configurationResult,
    memberResult,
    activityResult,
    relationshipResult,
  ] = await Promise.all([
    supabase
      .from(
        "club_payment_providers",
      )
      .select(`
        id,
        enabled,
        connection_status,
        automatic_debit_enabled,
        merchant_account_id
      `)
      .eq(
        "id",
        invitation
          .provider_configuration_id,
      )
      .eq("provider", "pagotic")
      .eq("club_id", club.id)
      .maybeSingle(),

    supabase
      .from("members")
      .select(`
        id,
        first_name,
        last_name,
        dni,
        active
      `)
      .eq(
        "id",
        invitation.member_id,
      )
      .eq("club_id", club.id)
      .eq("active", true)
      .maybeSingle(),

    supabase
      .from("activities")
      .select(`
        id,
        name,
        active
      `)
      .eq(
        "id",
        invitation.activity_id,
      )
      .eq("club_id", club.id)
      .eq("active", true)
      .maybeSingle(),

    supabase
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
      .maybeSingle(),
  ]);

  const configuration =
    configurationResult.data;

  const member =
    memberResult.data;

  const activity =
    activityResult.data;

  const relationship =
    relationshipResult.data;

  if (
    configurationResult.error ||
    !configuration ||
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

  if (
    memberResult.error ||
    !member
  ) {
    return {
      error:
        "La persona asociada con esta invitación ya no se encuentra activa.",
      success: false,
      message: null,
    };
  }

  if (
    activityResult.error ||
    !activity
  ) {
    return {
      error:
        "La actividad asociada con esta invitación ya no se encuentra activa.",
      success: false,
      message: null,
    };
  }

  if (
    relationshipResult.error ||
    !relationship
  ) {
    return {
      error:
        "La inscripción asociada con esta invitación ya no está activa.",
      success: false,
      message: null,
    };
  }

  const {
    data: existingSubscription,
    error:
      existingSubscriptionError,
  } = await supabase
    .from("payment_subscriptions")
    .select(`
      id,
      status,
      provider_subscription_id
    `)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq("club_id", club.id)
    .eq("member_id", member.id)
    .eq(
      "activity_id",
      activity.id,
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
    return {
      error:
        "No fue posible verificar las adhesiones existentes.",
      success: false,
      message: null,
    };
  }

  if (existingSubscription) {
    await supabase
      .from(
        "payment_subscription_invitations",
      )
      .update({
        status: "used",
        used_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
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

  const now =
    new Date().toISOString();

  const initialPayload = {
    source:
      "public_invitation",

    invitation_id:
      invitation.id,

    consent_at: now,

    payer_email: email,

    collector_id:
      configuration
        .merchant_account_id,
  };

  const {
    error:
      insertSubscriptionError,
  } = await supabase
    .from("payment_subscriptions")
    .insert({
      id: subscriptionId,

      organization_id:
        club.organization_id,

      club_id: club.id,

      member_id: member.id,

      activity_id:
        activity.id,

      provider_configuration_id:
        configuration.id,

      provider: "pagotic",

      external_reference:
        externalReference,

      status: "pending",

      provider_payload:
        initialPayload,

      created_at: now,
      updated_at: now,
    });

  if (insertSubscriptionError) {
    return {
      error:
        `No fue posible registrar la adhesión: ${insertSubscriptionError.message}`,
      success: false,
      message: null,
    };
  }

  const resultUrl =
    `${siteUrl}/clubes/${club.slug}` +
    `/pagar/adhesion/resultado` +
    `?solicitud=${subscriptionId}`;

  try {
    const pagoTicResult =
      await createPagoTicAdhesion({
        collectorId:
          configuration
            .merchant_account_id,

        externalReference,

        conceptId:
          activity.id,

        conceptDescription:
          `Adhesión a ${activity.name}`,

        payerReference:
          member.id,

        payerName:
          `${member.first_name} ${member.last_name}`,

        payerEmail: email,

        payerDni:
          member.dni,

        notificationUrl:
          `${siteUrl}/api/payments/pagotic/webhook`,

        returnUrl:
          resultUrl,

        backUrl:
          `${resultUrl}&regreso=cancelado`,

        metadata: {
          internal_subscription_id:
            subscriptionId,

          invitation_id:
            invitation.id,

          organization_id:
            club.organization_id,

          club_id:
            club.id,

          member_id:
            member.id,

          activity_id:
            activity.id,
        },
      });

    const {
      error:
        subscriptionUpdateError,
    } = await supabase
      .from(
        "payment_subscriptions",
      )
      .update({
        provider_subscription_id:
          pagoTicResult.id,

        status: "pending",

        provider_payload: {
          ...initialPayload,

          provider_status:
            pagoTicResult.status ??
            "pending",

          provider_response:
            pagoTicResult,
        },

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    if (
      subscriptionUpdateError
    ) {
      console.error(
        "La adhesión fue creada en Pago TIC, pero no pudo actualizarse localmente:",
        subscriptionUpdateError,
      );

      return {
        error:
          "Pago TIC creó la adhesión, pero ClubSmart no pudo completar el registro. Contactá al club antes de volver a intentarlo.",
        success: false,
        message: null,
      };
    }

    const {
      error:
        invitationUpdateError,
    } = await supabase
      .from(
        "payment_subscription_invitations",
      )
      .update({
        status: "used",
        used_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", invitation.id)
      .eq("status", "active");

    if (
      invitationUpdateError
    ) {
      console.error(
        "No se pudo marcar la invitación como utilizada:",
        invitationUpdateError,
      );
    }

    revalidatePath(
      "/panel/pagos/adhesiones",
    );

    redirect(
      pagoTicResult.form_url,
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "No fue posible conectarse con Pago TIC.";

    console.error(
      "Error iniciando adhesión:",
      error,
    );

    await supabase
      .from(
        "payment_subscriptions",
      )
      .update({
        status: "error",

        provider_payload: {
          ...initialPayload,

          connection_error:
            message,
        },

        updated_at:
          new Date().toISOString(),
      })
      .eq("id", subscriptionId);

    return {
      error: message,
      success: false,
      message: null,
    };
  }
}