"use server";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

export type PublicPaymentState = {
  error: string | null;
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  message?: string;
  error?: string;
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

function normalizeDni(value: string) {
  return value.replace(/\D/g, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

export async function createPaymentPreference(
  _previousState: PublicPaymentState,
  formData: FormData,
): Promise<PublicPaymentState> {
  const clubSlug = readText(
    formData,
    "club_slug",
  );

  const activityId = readText(
    formData,
    "activity_id",
  );

  const dni = normalizeDni(
    readText(formData, "dni"),
  );

  const email = readText(
    formData,
    "email",
  ).toLowerCase();

  if (!clubSlug || !activityId) {
    return {
      error:
        "No fue posible identificar el club o la actividad.",
    };
  }

  if (dni.length < 7) {
    return {
      error:
        "Ingresá un DNI válido, sin puntos.",
    };
  }

  if (!isValidEmail(email)) {
    return {
      error:
        "Ingresá un correo electrónico válido.",
    };
  }

  const accessToken =
    process.env.MERCADO_PAGO_ACCESS_TOKEN;

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL;

  if (!accessToken) {
    return {
      error:
        "La integración con Mercado Pago todavía no está configurada.",
    };
  }

  if (!siteUrl) {
    return {
      error:
        "Falta configurar la dirección pública de ClubSmart.",
    };
  }

  const supabase = createAdminClient();

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
        "No fue posible encontrar el club.",
    };
  }

  const {
    data: activity,
    error: activityError,
  } = await supabase
    .from("activities")
    .select(`
      id,
      name,
      club_id,
      organization_id,
      active,
      is_published
    `)
    .eq("id", activityId)
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq("active", true)
    .eq("is_published", true)
    .maybeSingle();

  if (activityError || !activity) {
    return {
      error:
        "La actividad no existe o no está disponible.",
    };
  }

  const {
    data: member,
    error: memberError,
  } = await supabase
    .from("members")
    .select(`
      id,
      first_name,
      last_name,
      active,
      member_activities!inner (
        id,
        activity_id,
        active
      )
    `)
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq("dni", dni)
    .eq("active", true)
    .eq(
      "member_activities.activity_id",
      activity.id,
    )
    .eq(
      "member_activities.active",
      true,
    )
    .maybeSingle();

  if (memberError) {
    console.error(
      "Error buscando persona para pago:",
      memberError,
    );

    return {
      error:
        "No fue posible verificar los datos ingresados.",
    };
  }

  if (!member) {
    return {
      error:
        "No encontramos una inscripción activa con ese DNI para esta actividad.",
    };
  }

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  const {
    data: feeRate,
    error: feeRateError,
  } = await supabase
    .from("activity_fee_rates")
    .select(`
      id,
      amount,
      valid_from,
      valid_to
    `)
    .eq("activity_id", activity.id)
    .eq("club_id", club.id)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .lte("valid_from", today)
    .or(
      `valid_to.is.null,valid_to.gte.${today}`,
    )
    .order("valid_from", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (feeRateError) {
    console.error(
      "Error buscando importe vigente:",
      feeRateError,
    );

    return {
      error:
        "No fue posible consultar el importe de la actividad.",
    };
  }

  if (!feeRate) {
    return {
      error:
        "Esta actividad todavía no tiene un importe vigente configurado.",
    };
  }

  const amount = Number(feeRate.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    return {
      error:
        "El importe configurado para esta actividad no es válido.",
    };
  }

  const paymentId =
    crypto.randomUUID();

  const externalReference = paymentId;

  const {
    error: paymentInsertError,
  } = await supabase
    .from("payments")
    .insert({
      id: paymentId,
      organization_id:
        club.organization_id,
      club_id: club.id,
      member_id: member.id,
      activity_id: activity.id,
      provider: "mercado_pago",
      external_reference:
        externalReference,
      amount,
      currency: "ARS",
      status: "pending",
      payer_email: email,
    });

  if (paymentInsertError) {
    console.error(
      "Error creando pago pendiente:",
      paymentInsertError,
    );

    return {
      error:
        "No fue posible iniciar el pago.",
    };
  }

  const normalizedSiteUrl =
    siteUrl.replace(/\/$/, "");

  const preferenceBody = {
    items: [
      {
        id: activity.id,
        title: `${activity.name} - ${club.name}`,
        description: `Cuota de ${activity.name}`,
        quantity: 1,
        currency_id: "ARS",
        unit_price: amount,
      },
    ],

    payer: {
      name: member.first_name,
      surname: member.last_name,
      email,
      identification: {
        type: "DNI",
        number: dni,
      },
    },

    external_reference:
      externalReference,

    back_urls: {
      success:
        `${normalizedSiteUrl}/clubes/${club.slug}/pago/resultado?estado=success`,
      pending:
        `${normalizedSiteUrl}/clubes/${club.slug}/pago/resultado?estado=pending`,
      failure:
        `${normalizedSiteUrl}/clubes/${club.slug}/pago/resultado?estado=failure`,
    },

    auto_return: "approved",

    statement_descriptor:
      "CLUBSMART",

    metadata: {
      club_id: club.id,
      member_id: member.id,
      activity_id: activity.id,
      internal_payment_id: paymentId,
    },
  };

  let preferenceResponse:
    | MercadoPagoPreferenceResponse
    | null = null;

  try {
    const response = await fetch(
      "https://api.mercadopago.com/checkout/preferences",
      {
        method: "POST",
        headers: {
          Authorization:
            `Bearer ${accessToken}`,
          "Content-Type":
            "application/json",
          "X-Idempotency-Key":
            paymentId,
        },
        body: JSON.stringify(
          preferenceBody,
        ),
        cache: "no-store",
      },
    );

    preferenceResponse =
      (await response.json()) as MercadoPagoPreferenceResponse;

    if (!response.ok) {
      console.error(
        "Error de Mercado Pago:",
        preferenceResponse,
      );

      await supabase
        .from("payments")
        .update({
          status: "rejected",
          provider_payload:
            preferenceResponse,
        })
        .eq("id", paymentId);

      return {
        error:
          preferenceResponse.message ??
          "Mercado Pago rechazó la creación del pago.",
      };
    }
  } catch (error) {
    console.error(
      "Error conectando con Mercado Pago:",
      error,
    );

    await supabase
      .from("payments")
      .update({
        status: "rejected",
      })
      .eq("id", paymentId);

    return {
      error:
        "No fue posible conectarse con Mercado Pago.",
    };
  }

  if (
    !preferenceResponse?.id ||
    !preferenceResponse.init_point
  ) {
    return {
      error:
        "Mercado Pago no devolvió una preferencia válida.",
    };
  }

  const { error: paymentUpdateError } =
    await supabase
      .from("payments")
      .update({
        provider_preference_id:
          preferenceResponse.id,
        provider_payload:
          preferenceResponse,
      })
      .eq("id", paymentId);

  if (paymentUpdateError) {
    console.error(
      "No se pudo guardar la preferencia:",
      paymentUpdateError,
    );
  }

  const paymentMode =
    process.env.MERCADO_PAGO_MODE;

  const checkoutUrl =
    paymentMode === "test"
      ? preferenceResponse
          .sandbox_init_point ??
        preferenceResponse.init_point
      : preferenceResponse.init_point;

  redirect(checkoutUrl);
}