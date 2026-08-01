"use server";

import { randomUUID } from "node:crypto";

import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

type PaymentProvider =
  | "mercado_pago"
  | "pagotic";

export type PublicPaymentFee = {
  id: string;
  year: number;
  month: number;
  amount: number;
  paidAmount: number;
  remainingAmount: number;
  dueDate: string | null;
  status: string;
};

export type PublicPaymentProvider = {
  id: PaymentProvider;
  label: string;
  description: string;
};

export type PublicPaymentState = {
  step: "identify" | "choose";
  error: string | null;
  notice: string | null;
  memberName: string | null;
  dni: string;
  email: string;
  fees: PublicPaymentFee[];
  providers: PublicPaymentProvider[];
};

type Club = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
};

type Activity = {
  id: string;
  name: string;
  club_id: string;
  organization_id: string;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
};

type MonthlyFee = {
  id: string;
  member_id: string;
  activity_id: string;
  year: number;
  month: number;
  amount: number | string;
  paid_amount: number | string;
  status: string;
  due_date: string | null;
};

type ProviderConfiguration = {
  id: string;
  provider: PaymentProvider;
  enabled: boolean;
  mode: string;
  monthly_fees_enabled: boolean;
  automatic_debit_enabled: boolean;
  default_for_monthly_fees: boolean;
  merchant_account_id: string | null;
  public_settings:
    | Record<string, unknown>
    | null;
};

type PaymentContext = {
  club: Club;
  activity: Activity;
  member: Member;
  fees: PublicPaymentFee[];
  configurations:
    ProviderConfiguration[];
  existingPagoTicSubscription:
    | {
        id: string;
        status: string;
      }
    | null;
};

type MercadoPagoPreferenceResponse = {
  id?: string;
  init_point?: string;
  sandbox_init_point?: string;
  message?: string;
  error?: string;
};

type PagoTicTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

type PagoTicPaymentResponse = {
  id?: string;
  external_transaction_id?:
    | string
    | number;
  form_url?: string;
  status?: string;
  status_detail?: string;
  message?: string;
  error?: string;
  [key: string]: unknown;
};

function emptyState(
  error: string | null = null,
  dni = "",
  email = "",
): PublicPaymentState {
  return {
    step: "identify",
    error,
    notice: null,
    memberName: null,
    dni,
    email,
    fees: [],
    providers: [],
  };
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

function normalizeDni(value: string) {
  return value.replace(/\D/g, "");
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value,
  );
}

function getSiteUrl() {
  return process.env
    .NEXT_PUBLIC_SITE_URL
    ?.trim()
    .replace(/\/$/, "");
}

function hasMercadoPagoCredentials() {
  return Boolean(
    process.env
      .MERCADO_PAGO_ACCESS_TOKEN
      ?.trim(),
  );
}

function hasPagoTicCredentials() {
  return Boolean(
    process.env.PAGOTIC_USERNAME?.trim() &&
      process.env.PAGOTIC_PASSWORD?.trim() &&
      process.env.PAGOTIC_CLIENT_ID?.trim() &&
      process.env
        .PAGOTIC_CLIENT_SECRET
        ?.trim(),
  );
}

function getTodayArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(
  value: string,
  days: number,
) {
  const date = new Date(
    `${value}T12:00:00.000Z`,
  );

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function buildPagoTicDueDate(
  feeDueDate: string | null,
) {
  const tomorrow = addDays(
    getTodayArgentina(),
    1,
  );

  const selectedDate =
    feeDueDate &&
    feeDueDate > tomorrow
      ? feeDueDate
      : tomorrow;

  return `${selectedDate}T23:59:59-0300`;
}

function getPagoTicConceptId(
  configuration:
    ProviderConfiguration,
  activityId: string,
) {
  const value =
    configuration.public_settings
      ?.default_concept_id;

  return typeof value === "string" &&
    value.trim()
    ? value.trim()
    : activityId;
}

function normalizeProviderStatus(
  value: string | undefined,
) {
  if (
    value === "approved"
  ) {
    return "approved";
  }

  if (
    value === "rejected" ||
    value === "cancelled"
  ) {
    return "rejected";
  }

  if (
    value === "issued" ||
    value === "in_process"
  ) {
    return "in_process";
  }

  return "pending";
}

async function loadPaymentContext(
  clubSlug: string,
  activityId: string,
  dni: string,
): Promise<
  | {
      context: PaymentContext;
      error: null;
    }
  | {
      context: null;
      error: string;
    }
> {
  const supabase =
    createAdminClient();

  const {
    data: clubData,
    error: clubError,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      organization_id,
      name,
      slug,
      active,
      is_published
    `)
    .eq("slug", clubSlug)
    .eq("active", true)
    .eq("is_published", true)
    .maybeSingle();

  if (clubError || !clubData) {
    return {
      context: null,
      error:
        "No fue posible encontrar el club.",
    };
  }

  const club = clubData as Club;

  const {
    data: activityData,
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

  if (
    activityError ||
    !activityData
  ) {
    return {
      context: null,
      error:
        "La actividad no existe o no está disponible.",
    };
  }

  const activity =
    activityData as Activity;

  const {
    data: memberData,
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
      "Error buscando persona:",
      memberError,
    );

    return {
      context: null,
      error:
        "No fue posible verificar los datos ingresados.",
    };
  }

  if (!memberData) {
    return {
      context: null,
      error:
        "No encontramos una inscripción activa con ese DNI para esta actividad.",
    };
  }

  const member =
    memberData as unknown as Member;

  const {
    data: feesData,
    error: feesError,
  } = await supabase
    .from("monthly_fees")
    .select(`
      id,
      member_id,
      activity_id,
      year,
      month,
      amount,
      paid_amount,
      status,
      due_date
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
    .in("status", [
      "pending",
      "partial",
      "overdue",
    ])
    .order("year", {
      ascending: true,
    })
    .order("month", {
      ascending: true,
    });

  if (feesError) {
    console.error(
      "Error buscando cuotas:",
      feesError,
    );

    return {
      context: null,
      error:
        "No fue posible consultar las cuotas pendientes.",
    };
  }

  const fees = (
    (feesData ?? []) as MonthlyFee[]
  )
    .map((fee) => {
      const amount = Number(
        fee.amount,
      );

      const paidAmount = Number(
        fee.paid_amount,
      );

      return {
        id: fee.id,
        year: fee.year,
        month: fee.month,
        amount,
        paidAmount,
        remainingAmount: Math.max(
          amount - paidAmount,
          0,
        ),
        dueDate: fee.due_date,
        status: fee.status,
      };
    })
    .filter(
      (fee) =>
        Number.isFinite(
          fee.remainingAmount,
        ) &&
        fee.remainingAmount > 0,
    );

  if (fees.length === 0) {
    return {
      context: null,
      error:
        "No hay cuotas pendientes para esta persona y actividad.",
    };
  }

  const {
    data: configurationsData,
    error: configurationsError,
  } = await supabase
    .from("club_payment_providers")
    .select(`
      id,
      provider,
      enabled,
      mode,
      monthly_fees_enabled,
      automatic_debit_enabled,
      default_for_monthly_fees,
      merchant_account_id,
      public_settings
    `)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq("club_id", club.id)
    .eq("enabled", true)
    .eq(
      "monthly_fees_enabled",
      true,
    );

  if (configurationsError) {
    console.error(
      "Error buscando proveedores:",
      configurationsError,
    );

    return {
      context: null,
      error:
        "No fue posible consultar los medios de pago disponibles.",
    };
  }

  const configurations =
    (
      configurationsData ?? []
    ) as ProviderConfiguration[];

  const {
    data: subscriptionData,
    error: subscriptionError,
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
    .order("created_at", {
      ascending: false,
    })
    .limit(1)
    .maybeSingle();

  if (subscriptionError) {
    console.error(
      "Error buscando adhesión:",
      subscriptionError,
    );
  }

  return {
    context: {
      club,
      activity,
      member,
      fees,
      configurations,
      existingPagoTicSubscription:
        subscriptionData ?? null,
    },
    error: null,
  };
}

function buildPublicProviders(
  context: PaymentContext,
) {
  const providers:
    PublicPaymentProvider[] = [];

  const notices: string[] = [];

  const sortedConfigurations =
    [...context.configurations].sort(
      (first, second) =>
        Number(
          second
            .default_for_monthly_fees,
        ) -
        Number(
          first
            .default_for_monthly_fees,
        ),
    );

  for (
    const configuration of
    sortedConfigurations
  ) {
    if (
      configuration.provider ===
      "mercado_pago"
    ) {
      if (
        hasMercadoPagoCredentials()
      ) {
        providers.push({
          id: "mercado_pago",
          label:
            "Pagar con Mercado Pago",
          description:
            "Pago puntual de la cuota seleccionada.",
        });
      } else {
        notices.push(
          "Mercado Pago está habilitado, pero sus credenciales todavía no están completas.",
        );
      }
    }

    if (
      configuration.provider ===
      "pagotic"
    ) {
      if (
        context
          .existingPagoTicSubscription
      ) {
        notices.push(
          "Esta actividad ya tiene una adhesión a Pago TIC pendiente, activa o pausada. No se ofrecerá una nueva adhesión para evitar duplicados.",
        );

        continue;
      }

      if (hasPagoTicCredentials()) {
        providers.push({
          id: "pagotic",

          label:
            configuration
              .automatic_debit_enabled
              ? "Pagar o adherirme con Pago TIC"
              : "Pagar con Pago TIC",

          description:
            configuration
              .automatic_debit_enabled
              ? "Permite pagar esta cuota y solicitar la adhesión para futuros débitos."
              : "Pago online de la cuota seleccionada.",
        });
      } else {
        notices.push(
          "Pago TIC está habilitado, pero sus credenciales todavía no están completas.",
        );
      }
    }
  }

  if (!getSiteUrl()) {
    providers.length = 0;

    notices.push(
      "Falta configurar NEXT_PUBLIC_SITE_URL para iniciar pagos electrónicos.",
    );
  }

  return {
    providers,
    notice:
      notices.length > 0
        ? notices.join(" ")
        : null,
  };
}

async function ensureNoPendingPayment(
  monthlyFeeId: string,
  provider: PaymentProvider,
) {
  const supabase =
    createAdminClient();

  const thirtyMinutesAgo =
    new Date(
      Date.now() -
        30 * 60 * 1000,
    ).toISOString();

  const {
    data,
    error,
  } = await supabase
    .from("payments")
    .select("id")
    .eq(
      "monthly_fee_id",
      monthlyFeeId,
    )
    .eq("provider", provider)
    .in("status", [
      "created",
      "pending",
      "in_process",
    ])
    .gte(
      "created_at",
      thirtyMinutesAgo,
    )
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error(
      "Error verificando pagos pendientes:",
      error,
    );
  }

  return Boolean(data);
}

async function createMercadoPagoPayment(
  context: PaymentContext,
  configuration:
    ProviderConfiguration,
  fee: PublicPaymentFee,
  email: string,
  dni: string,
): Promise<PublicPaymentState> {
  const accessToken =
    process.env
      .MERCADO_PAGO_ACCESS_TOKEN
      ?.trim();

  const siteUrl = getSiteUrl();

  if (!accessToken || !siteUrl) {
    return {
      ...emptyState(
        "Mercado Pago todavía no está configurado.",
        dni,
        email,
      ),
      step: "choose",
      memberName:
        `${context.member.first_name} ${context.member.last_name}`,
      fees: context.fees,
      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  const paymentId = randomUUID();

  const supabase =
    createAdminClient();

  const {
    error: paymentInsertError,
  } = await supabase
    .from("payments")
    .insert({
      id: paymentId,

      organization_id:
        context.club
          .organization_id,

      club_id: context.club.id,

      member_id:
        context.member.id,

      activity_id:
        context.activity.id,

      monthly_fee_id: fee.id,

      provider:
        "mercado_pago",

      provider_configuration_id:
        configuration.id,

      payment_kind:
        "monthly_fee",

      external_reference:
        paymentId,

      idempotency_key:
        paymentId,

      amount:
        fee.remainingAmount,

      currency: "ARS",

      status: "created",

      provider_status:
        "created",

      payer_email: email,
    });

  if (paymentInsertError) {
    console.error(
      "Error creando pago interno:",
      paymentInsertError,
    );

    return {
      ...emptyState(
        "No fue posible iniciar el pago.",
        dni,
        email,
      ),
      step: "choose",
      memberName:
        `${context.member.first_name} ${context.member.last_name}`,
      fees: context.fees,
      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  const resultBaseUrl =
    `${siteUrl}/clubes/${context.club.slug}/pago/resultado`;

  const preferenceBody = {
    items: [
      {
        id: fee.id,

        title:
          `${context.activity.name} - ${context.club.name}`,

        description:
          `Cuota ${fee.month}/${fee.year}`,

        quantity: 1,
        currency_id: "ARS",

        unit_price:
          fee.remainingAmount,
      },
    ],

    payer: {
      name:
        context.member.first_name,

      surname:
        context.member.last_name,

      email,

      identification: {
        type: "DNI",
        number: dni,
      },
    },

    external_reference:
      paymentId,

    notification_url:
      `${siteUrl}/api/payments/mercado-pago/webhook`,

    back_urls: {
      success:
        `${resultBaseUrl}?pago=${paymentId}&estado=success`,

      pending:
        `${resultBaseUrl}?pago=${paymentId}&estado=pending`,

      failure:
        `${resultBaseUrl}?pago=${paymentId}&estado=failure`,
    },

    auto_return: "approved",

    statement_descriptor:
      "CLUBSMART",

    metadata: {
      internal_payment_id:
        paymentId,

      club_id:
        context.club.id,

      member_id:
        context.member.id,

      activity_id:
        context.activity.id,

      monthly_fee_id:
        fee.id,
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
          status: "error",

          provider_status:
            preferenceResponse.error ??
            "preference_error",

          provider_payload:
            preferenceResponse,

          failure_message:
            preferenceResponse.message ??
            "Mercado Pago rechazó la creación de la preferencia.",
        })
        .eq("id", paymentId);

      return {
        ...emptyState(
          preferenceResponse.message ??
            "Mercado Pago rechazó la creación del pago.",
          dni,
          email,
        ),

        step: "choose",

        memberName:
          `${context.member.first_name} ${context.member.last_name}`,

        fees: context.fees,

        providers:
          buildPublicProviders(context)
            .providers,
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
        status: "error",

        provider_status:
          "connection_error",

        failure_message:
          "No fue posible conectarse con Mercado Pago.",
      })
      .eq("id", paymentId);

    return {
      ...emptyState(
        "No fue posible conectarse con Mercado Pago.",
        dni,
        email,
      ),

      step: "choose",

      memberName:
        `${context.member.first_name} ${context.member.last_name}`,

      fees: context.fees,

      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  const checkoutUrl =
    configuration.mode ===
      "sandbox"
      ? preferenceResponse
          ?.sandbox_init_point ??
        preferenceResponse
          ?.init_point
      : preferenceResponse
          ?.init_point;

  if (
    !preferenceResponse?.id ||
    !checkoutUrl
  ) {
    await supabase
      .from("payments")
      .update({
        status: "error",

        provider_status:
          "invalid_preference",

        provider_payload:
          preferenceResponse,

        failure_message:
          "Mercado Pago no devolvió una preferencia válida.",
      })
      .eq("id", paymentId);

    return {
      ...emptyState(
        "Mercado Pago no devolvió una preferencia válida.",
        dni,
        email,
      ),

      step: "choose",

      memberName:
        `${context.member.first_name} ${context.member.last_name}`,

      fees: context.fees,

      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  await supabase
    .from("payments")
    .update({
      status: "pending",

      provider_status:
        "pending",

      provider_preference_id:
        preferenceResponse.id,

      provider_payload:
        preferenceResponse,
    })
    .eq("id", paymentId);

  redirect(checkoutUrl);
}

async function getPagoTicToken() {
  const username =
    process.env
      .PAGOTIC_USERNAME
      ?.trim();

  const password =
    process.env
      .PAGOTIC_PASSWORD
      ?.trim();

  const clientId =
    process.env
      .PAGOTIC_CLIENT_ID
      ?.trim();

  const clientSecret =
    process.env
      .PAGOTIC_CLIENT_SECRET
      ?.trim();

  const authUrl =
    process.env
      .PAGOTIC_AUTH_URL
      ?.trim() ??
    "https://a.paypertic.com/auth/realms/entidades/protocol/openid-connect/token";

  if (
    !username ||
    !password ||
    !clientId ||
    !clientSecret
  ) {
    return {
      token: null,
      error:
        "Las credenciales de Pago TIC están incompletas.",
    };
  }

  const body =
    new URLSearchParams({
      username,
      password,
      grant_type: "password",
      client_id: clientId,
      client_secret: clientSecret,
    });

  try {
    const response = await fetch(
      authUrl,
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body,
        cache: "no-store",
      },
    );

    const result =
      (await response.json()) as PagoTicTokenResponse;

    if (
      !response.ok ||
      !result.access_token
    ) {
      console.error(
        "Error autenticando Pago TIC:",
        result,
      );

      return {
        token: null,

        error:
          result.error_description ??
          result.error ??
          "Pago TIC rechazó la autenticación.",
      };
    }

    return {
      token: result.access_token,
      error: null,
    };
  } catch (error) {
    console.error(
      "Error conectando con Pago TIC:",
      error,
    );

    return {
      token: null,
      error:
        "No fue posible conectarse con Pago TIC.",
    };
  }
}

async function createPagoTicPayment(
  context: PaymentContext,
  configuration:
    ProviderConfiguration,
  fee: PublicPaymentFee,
  email: string,
  dni: string,
): Promise<PublicPaymentState> {
  const siteUrl = getSiteUrl();

  if (!siteUrl) {
    return {
      ...emptyState(
        "Falta configurar la dirección pública de ClubSmart.",
        dni,
        email,
      ),

      step: "choose",

      memberName:
        `${context.member.first_name} ${context.member.last_name}`,

      fees: context.fees,

      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  const tokenResult =
    await getPagoTicToken();

  if (!tokenResult.token) {
    return {
      ...emptyState(
        tokenResult.error,
        dni,
        email,
      ),

      step: "choose",

      memberName:
        `${context.member.first_name} ${context.member.last_name}`,

      fees: context.fees,

      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  const supabase =
    createAdminClient();

  const paymentId = randomUUID();

  let subscriptionId:
    | string
    | null = null;

  if (
    configuration
      .automatic_debit_enabled
  ) {
    const subscriptionReference =
      `pagotic-subscription-${paymentId}`;

    const {
      data: subscription,
      error: subscriptionError,
    } = await supabase
      .from("payment_subscriptions")
      .insert({
        organization_id:
          context.club
            .organization_id,

        club_id:
          context.club.id,

        member_id:
          context.member.id,

        activity_id:
          context.activity.id,

        provider_configuration_id:
          configuration.id,

        provider: "pagotic",

        external_reference:
          subscriptionReference,

        status: "pending",
      })
      .select("id")
      .single();

    if (
      subscriptionError ||
      !subscription
    ) {
      console.error(
        "Error creando adhesión pendiente:",
        subscriptionError,
      );

      return {
        ...emptyState(
          "No fue posible iniciar la adhesión a Pago TIC.",
          dni,
          email,
        ),

        step: "choose",

        memberName:
          `${context.member.first_name} ${context.member.last_name}`,

        fees: context.fees,

        providers:
          buildPublicProviders(context)
            .providers,
      };
    }

    subscriptionId =
      subscription.id;
  }

  const externalTransactionId =
    Date.now() * 100 +
    Math.floor(Math.random() * 100);

  const {
    error: paymentInsertError,
  } = await supabase
    .from("payments")
    .insert({
      id: paymentId,

      organization_id:
        context.club
          .organization_id,

      club_id:
        context.club.id,

      member_id:
        context.member.id,

      activity_id:
        context.activity.id,

      monthly_fee_id:
        fee.id,

      payment_subscription_id:
        subscriptionId,

      provider:
        "pagotic",

      provider_configuration_id:
        configuration.id,

      payment_kind:
        "monthly_fee",

      provider_reference:
        String(
          externalTransactionId,
        ),

      external_reference:
        paymentId,

      idempotency_key:
        paymentId,

      amount:
        fee.remainingAmount,

      currency: "ARS",

      status: "created",

      provider_status:
        "created",

      payer_email: email,
    });

  if (paymentInsertError) {
    console.error(
      "Error creando pago Pago TIC:",
      paymentInsertError,
    );

    if (subscriptionId) {
      await supabase
        .from(
          "payment_subscriptions",
        )
        .update({
          status: "error",
        })
        .eq("id", subscriptionId);
    }

    return {
      ...emptyState(
        "No fue posible iniciar el pago.",
        dni,
        email,
      ),

      step: "choose",

      memberName:
        `${context.member.first_name} ${context.member.last_name}`,

      fees: context.fees,

      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  const apiUrl =
    (
      process.env.PAGOTIC_API_URL ??
      "https://api.paypertic.com"
    ).replace(/\/$/, "");

  const paymentBody = {
    currency_id: "ARS",

    external_transaction_id:
      externalTransactionId,

    due_date:
      buildPagoTicDueDate(
        fee.dueDate,
      ),

    notification_url:
      `${siteUrl}/api/payments/pagotic/webhook`,

    details: [
      {
        external_reference:
          paymentId,

        concept_id:
          getPagoTicConceptId(
            configuration,
            context.activity.id,
          ),

        concept_description:
          `Cuota ${fee.month}/${fee.year} - ${context.activity.name}`,

        amount:
          fee.remainingAmount,
      },
    ],

    payer: {
      name:
        `${context.member.first_name} ${context.member.last_name}`,

      email,

      identification: {
        type: "DNI_ARG",
        number: dni,
        country: "ARG",
      },
    },
  };

  let pagoTicResponse:
    | PagoTicPaymentResponse
    | null = null;

  try {
    const response = await fetch(
      `${apiUrl}/pagos`,
      {
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${tokenResult.token}`,

          "Cache-Control":
            "no-cache",

          "Content-Type":
            "application/json",
        },

        body: JSON.stringify(
          paymentBody,
        ),

        cache: "no-store",
      },
    );

    pagoTicResponse =
      (await response.json()) as PagoTicPaymentResponse;

    if (!response.ok) {
      console.error(
        "Error de Pago TIC:",
        pagoTicResponse,
      );

      await supabase
        .from("payments")
        .update({
          status: "error",

          provider_status:
            pagoTicResponse.status ??
            pagoTicResponse.error ??
            "creation_error",

          provider_payload:
            pagoTicResponse,

          failure_message:
            pagoTicResponse.message ??
            "Pago TIC rechazó la creación del pago.",
        })
        .eq("id", paymentId);

      if (subscriptionId) {
        await supabase
          .from(
            "payment_subscriptions",
          )
          .update({
            status: "error",

            provider_payload:
              pagoTicResponse,
          })
          .eq(
            "id",
            subscriptionId,
          );
      }

      return {
        ...emptyState(
          pagoTicResponse.message ??
            "Pago TIC rechazó la creación del pago.",
          dni,
          email,
        ),

        step: "choose",

        memberName:
          `${context.member.first_name} ${context.member.last_name}`,

        fees: context.fees,

        providers:
          buildPublicProviders(context)
            .providers,
      };
    }
  } catch (error) {
    console.error(
      "Error conectando con Pago TIC:",
      error,
    );

    await supabase
      .from("payments")
      .update({
        status: "error",

        provider_status:
          "connection_error",

        failure_message:
          "No fue posible conectarse con Pago TIC.",
      })
      .eq("id", paymentId);

    if (subscriptionId) {
      await supabase
        .from(
          "payment_subscriptions",
        )
        .update({
          status: "error",
        })
        .eq("id", subscriptionId);
    }

    return {
      ...emptyState(
        "No fue posible conectarse con Pago TIC.",
        dni,
        email,
      ),

      step: "choose",

      memberName:
        `${context.member.first_name} ${context.member.last_name}`,

      fees: context.fees,

      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  if (
    !pagoTicResponse?.id ||
    !pagoTicResponse.form_url
  ) {
    await supabase
      .from("payments")
      .update({
        status: "error",

        provider_status:
          "invalid_response",

        provider_payload:
          pagoTicResponse,

        failure_message:
          "Pago TIC no devolvió un formulario válido.",
      })
      .eq("id", paymentId);

    if (subscriptionId) {
      await supabase
        .from(
          "payment_subscriptions",
        )
        .update({
          status: "error",

          provider_payload:
            pagoTicResponse,
        })
        .eq("id", subscriptionId);
    }

    return {
      ...emptyState(
        "Pago TIC no devolvió un formulario válido.",
        dni,
        email,
      ),

      step: "choose",

      memberName:
        `${context.member.first_name} ${context.member.last_name}`,

      fees: context.fees,

      providers:
        buildPublicProviders(context)
          .providers,
    };
  }

  await supabase
    .from("payments")
    .update({
      provider_payment_id:
        pagoTicResponse.id,

      provider_reference:
        String(
          pagoTicResponse
            .external_transaction_id ??
            externalTransactionId,
        ),

      status:
        normalizeProviderStatus(
          pagoTicResponse.status,
        ),

      provider_status:
        pagoTicResponse.status ??
        "pending",

      provider_payload:
        pagoTicResponse,
    })
    .eq("id", paymentId);

  if (subscriptionId) {
    await supabase
      .from(
        "payment_subscriptions",
      )
      .update({
        provider_payload:
          pagoTicResponse,
      })
      .eq("id", subscriptionId);
  }

  redirect(
    pagoTicResponse.form_url,
  );
}

export async function processPublicPayment(
  previousState:
    PublicPaymentState,
  formData: FormData,
): Promise<PublicPaymentState> {
  const intent = readText(
    formData,
    "intent",
  );

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
    return emptyState(
      "No fue posible identificar el club o la actividad.",
      dni,
      email,
    );
  }

  if (
    dni.length < 7 ||
    dni.length > 8
  ) {
    return emptyState(
      "Ingresá un DNI válido de 7 u 8 dígitos, sin puntos.",
      dni,
      email,
    );
  }

  if (!isValidEmail(email)) {
    return emptyState(
      "Ingresá un correo electrónico válido.",
      dni,
      email,
    );
  }

  const contextResult =
    await loadPaymentContext(
      clubSlug,
      activityId,
      dni,
    );

  if (
    contextResult.error ||
    !contextResult.context
  ) {
    return emptyState(
      contextResult.error,
      dni,
      email,
    );
  }

  const context =
    contextResult.context;

  const providerResult =
    buildPublicProviders(context);

  const chooseState:
    PublicPaymentState = {
      step: "choose",
      error: null,
      notice:
        providerResult.notice,
      memberName:
        `${context.member.first_name} ${context.member.last_name}`,
      dni,
      email,
      fees: context.fees,
      providers:
        providerResult.providers,
    };

  if (intent !== "pay") {
    return chooseState;
  }

  const providerText = readText(
    formData,
    "provider",
  );

  if (
    providerText !==
      "mercado_pago" &&
    providerText !== "pagotic"
  ) {
    return {
      ...chooseState,
      error:
        "Seleccioná un medio de pago válido.",
    };
  }

  const provider =
    providerText as PaymentProvider;

  const monthlyFeeId = readText(
    formData,
    "monthly_fee_id",
  );

  const fee =
    context.fees.find(
      (item) =>
        item.id === monthlyFeeId,
    );

  if (!fee) {
    return {
      ...chooseState,
      error:
        "La cuota seleccionada no está disponible.",
    };
  }

  const configuration =
    context.configurations.find(
      (item) =>
        item.provider === provider &&
        item.enabled &&
        item.monthly_fees_enabled,
    );

  if (!configuration) {
    return {
      ...chooseState,
      error:
        "El proveedor seleccionado no está habilitado para mensualidades.",
    };
  }

  const hasPendingPayment =
    await ensureNoPendingPayment(
      fee.id,
      provider,
    );

  if (hasPendingPayment) {
    return {
      ...chooseState,

      error:
        "Ya existe una operación reciente pendiente con este proveedor para la cuota seleccionada. Esperá su resultado antes de volver a intentarlo.",
    };
  }

  if (
    provider === "mercado_pago"
  ) {
    return createMercadoPagoPayment(
      context,
      configuration,
      fee,
      email,
      dni,
    );
  }

  return createPagoTicPayment(
    context,
    configuration,
    fee,
    email,
    dni,
  );
}