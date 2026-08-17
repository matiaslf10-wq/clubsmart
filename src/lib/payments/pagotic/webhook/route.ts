import {
  createHash,
  timingSafeEqual,
} from "node:crypto";

import {
  revalidatePath,
} from "next/cache";
import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type JsonRecord = Record<
  string,
  unknown
>;

type LocalSubscriptionStatus =
  | "pending"
  | "active"
  | "paused"
  | "cancelled"
  | "error";

type LocalSubscription = {
  id: string;
  organization_id: string;
  club_id: string;
  provider_configuration_id:
    | string
    | null;
  provider_subscription_id:
    | string
    | null;
  external_reference:
    | string
    | null;
  status: string;
  provider_payload:
    | JsonRecord
    | null;
};

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function getString(
  source: JsonRecord,
  field: string,
) {
  const value = source[field];

  return typeof value === "string"
    ? value.trim()
    : "";
}

function getNestedRecord(
  source: JsonRecord,
  field: string,
) {
  const value = source[field];

  return isRecord(value)
    ? value
    : {};
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function safeSecretEquals(
  received: string,
  expected: string,
) {
  const receivedBuffer =
    Buffer.from(received);

  const expectedBuffer =
    Buffer.from(expected);

  if (
    receivedBuffer.length !==
    expectedBuffer.length
  ) {
    return false;
  }

  return timingSafeEqual(
    receivedBuffer,
    expectedBuffer,
  );
}

function mapPagoTicStatus(
  providerStatus: string,
): LocalSubscriptionStatus | null {
  switch (
    providerStatus
      .trim()
      .toLowerCase()
  ) {
    case "pending":
    case "review":
    case "validate":
      return "pending";

    case "active":
      return "active";

    case "paused":
    case "suspended":
      return "paused";

    case "cancelled":
    case "canceled":
    case "revoked":
    case "rejected":
      return "cancelled";

    case "error":
    case "failed":
      return "error";

    default:
      return null;
  }
}

function getNotificationId(
  payload: JsonRecord,
) {
  const notifications =
    payload.notifications;

  if (!Array.isArray(notifications)) {
    return "";
  }

  for (
    let index =
      notifications.length - 1;
    index >= 0;
    index -= 1
  ) {
    const notification =
      notifications[index];

    if (!isRecord(notification)) {
      continue;
    }

    const id =
      getString(
        notification,
        "id",
      );

    if (id) {
      return id;
    }
  }

  return "";
}

function createEventKey(
  payload: JsonRecord,
) {
  const providerObjectId =
    getString(payload, "id");

  const providerStatus =
    getString(payload, "status");

  const lastUpdateDate =
    getString(
      payload,
      "last_update_date",
    );

  const notificationId =
    getNotificationId(payload);

  const value = [
    providerObjectId,
    providerStatus,
    lastUpdateDate,
    notificationId,
  ].join("|");

  return createHash("sha256")
    .update(value)
    .digest("hex");
}

const blockedPayloadFields =
  new Set([
    "number",
    "security_code",
    "expiration_month",
    "expiration_year",
    "first_six_digits",
    "authorization_code",
    "authorization_transaction_id",
  ]);

function sanitizePayload(
  value: unknown,
): unknown {
  if (Array.isArray(value)) {
    return value.map(
      sanitizePayload,
    );
  }

  if (isRecord(value)) {
    const sanitized: JsonRecord =
      {};

    for (const [
      key,
      item,
    ] of Object.entries(value)) {
      if (
        blockedPayloadFields.has(
          key.toLowerCase(),
        )
      ) {
        continue;
      }

      sanitized[key] =
        sanitizePayload(item);
    }

    return sanitized;
  }

  return value;
}

function selectStatusToApply(
  currentStatus: string,
  incomingStatus:
    LocalSubscriptionStatus,
) {
  const normalizedCurrent =
    currentStatus.toLowerCase();

  if (
    normalizedCurrent ===
      "active" &&
    incomingStatus ===
      "pending"
  ) {
    return "active";
  }

  if (
    normalizedCurrent ===
      "cancelled" &&
    incomingStatus !==
      "cancelled"
  ) {
    return "cancelled";
  }

  return incomingStatus;
}

export async function POST(
  request: NextRequest,
) {
  const configuredSecret =
    process.env
      .PAGOTIC_WEBHOOK_SECRET
      ?.trim();

  if (!configuredSecret) {
    console.error(
      "PAGOTIC_WEBHOOK_SECRET no está configurada.",
    );

    return NextResponse.json(
      {
        received: false,
        error:
          "Webhook no configurado.",
      },
      {
        status: 503,
      },
    );
  }

  const receivedSecret =
    request.nextUrl.searchParams
      .get("secret")
      ?.trim() ?? "";

  if (
    !receivedSecret ||
    !safeSecretEquals(
      receivedSecret,
      configuredSecret,
    )
  ) {
    return NextResponse.json(
      {
        received: false,
        error: "No autorizado.",
      },
      {
        status: 401,
      },
    );
  }

  const rawBody =
    await request.text();

  if (!rawBody) {
    return NextResponse.json(
      {
        received: false,
        error:
          "La notificación está vacía.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    Buffer.byteLength(
      rawBody,
      "utf8",
    ) > 1_000_000
  ) {
    return NextResponse.json(
      {
        received: false,
        error:
          "La notificación es demasiado grande.",
      },
      {
        status: 413,
      },
    );
  }

  let parsedPayload: unknown;

  try {
    parsedPayload =
      JSON.parse(rawBody);
  } catch {
    return NextResponse.json(
      {
        received: false,
        error:
          "El cuerpo no contiene JSON válido.",
      },
      {
        status: 400,
      },
    );
  }

  if (!isRecord(parsedPayload)) {
    return NextResponse.json(
      {
        received: false,
        error:
          "El formato de la notificación no es válido.",
      },
      {
        status: 400,
      },
    );
  }

  const payload =
    parsedPayload;

  const providerObjectId =
    getString(payload, "id");

  const providerStatus =
    getString(
      payload,
      "status",
    ).toLowerCase();

  const providerType =
    getString(
      payload,
      "type",
    ).toLowerCase();

  const collectorId =
    getString(
      payload,
      "collector_id",
    );

  if (
    providerType !==
      "adhesion" ||
    !providerObjectId ||
    !providerStatus
  ) {
    return NextResponse.json(
      {
        received: false,
        error:
          "La notificación no corresponde a una adhesión válida.",
      },
      {
        status: 400,
      },
    );
  }

  const eventKey =
    createEventKey(payload);

  const sanitizedPayload =
    sanitizePayload(
      payload,
    ) as JsonRecord;

  const supabase =
    createAdminClient();

  const {
    data: existingEvent,
    error: existingEventError,
  } = await supabase
    .from(
      "payment_provider_events",
    )
    .select(`
      id,
      processing_status
    `)
    .eq("provider", "pagotic")
    .eq("event_key", eventKey)
    .maybeSingle();

  if (existingEventError) {
    console.error(
      "Error buscando evento Pago TIC:",
      existingEventError,
    );

    return NextResponse.json(
      {
        received: false,
        error:
          "No se pudo verificar el evento.",
      },
      {
        status: 500,
      },
    );
  }

  if (
    existingEvent
      ?.processing_status ===
    "processed"
  ) {
    return NextResponse.json({
      received: true,
      duplicate: true,
    });
  }

  let eventId =
    existingEvent?.id ?? null;

  if (!eventId) {
    const {
      data: insertedEvent,
      error: insertEventError,
    } = await supabase
      .from(
        "payment_provider_events",
      )
      .insert({
        provider: "pagotic",
        event_key: eventKey,
        event_type:
          "subscription.adhesion",
        provider_object_id:
          providerObjectId,
        collector_id:
          collectorId || null,
        provider_status:
          providerStatus,
        payload:
          sanitizedPayload,
        processing_status:
          "received",
        created_at:
          new Date().toISOString(),
        updated_at:
          new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertEventError) {
      if (
        insertEventError.code ===
        "23505"
      ) {
        return NextResponse.json({
          received: true,
          duplicate: true,
        });
      }

      console.error(
        "Error guardando evento Pago TIC:",
        insertEventError,
      );

      return NextResponse.json(
        {
          received: false,
          error:
            "No se pudo registrar el evento.",
        },
        {
          status: 500,
        },
      );
    }

    eventId =
      insertedEvent.id;
  }

  async function updateEvent(
    values: {
      processing_status: string;
      error_message:
        | string
        | null;
      processed_at:
        | string
        | null;
    },
  ) {
    if (!eventId) {
      return;
    }

    await supabase
      .from(
        "payment_provider_events",
      )
      .update({
        ...values,
        updated_at:
          new Date().toISOString(),
      })
      .eq("id", eventId);
  }

  const metadata =
    getNestedRecord(
      payload,
      "metadata",
    );

  const detail =
    getNestedRecord(
      payload,
      "detail",
    );

  const internalSubscriptionId =
    getString(
      metadata,
      "internal_subscription_id",
    );

  const externalReference =
    getString(
      detail,
      "external_reference",
    );

  let subscription:
    | LocalSubscription
    | null = null;

  if (
    internalSubscriptionId &&
    isUuid(
      internalSubscriptionId,
    )
  ) {
    const result =
      await supabase
        .from(
          "payment_subscriptions",
        )
        .select(`
          id,
          organization_id,
          club_id,
          provider_configuration_id,
          provider_subscription_id,
          external_reference,
          status,
          provider_payload
        `)
        .eq(
          "id",
          internalSubscriptionId,
        )
        .eq(
          "provider",
          "pagotic",
        )
        .maybeSingle();

    subscription =
      result.data as
        | LocalSubscription
        | null;
  }

  if (!subscription) {
    const result =
      await supabase
        .from(
          "payment_subscriptions",
        )
        .select(`
          id,
          organization_id,
          club_id,
          provider_configuration_id,
          provider_subscription_id,
          external_reference,
          status,
          provider_payload
        `)
        .eq(
          "provider",
          "pagotic",
        )
        .eq(
          "provider_subscription_id",
          providerObjectId,
        )
        .maybeSingle();

    subscription =
      result.data as
        | LocalSubscription
        | null;
  }

  if (
    !subscription &&
    externalReference
  ) {
    const result =
      await supabase
        .from(
          "payment_subscriptions",
        )
        .select(`
          id,
          organization_id,
          club_id,
          provider_configuration_id,
          provider_subscription_id,
          external_reference,
          status,
          provider_payload
        `)
        .eq(
          "provider",
          "pagotic",
        )
        .eq(
          "external_reference",
          externalReference,
        )
        .maybeSingle();

    subscription =
      result.data as
        | LocalSubscription
        | null;
  }

  if (!subscription) {
    await updateEvent({
      processing_status:
        "ignored",
      error_message:
        "No se encontró una adhesión local relacionada.",
      processed_at:
        new Date().toISOString(),
    });

    return NextResponse.json({
      received: true,
      processed: false,
      reason:
        "Subscription not found",
    });
  }

  if (
    !subscription
      .provider_configuration_id
  ) {
    await updateEvent({
      processing_status:
        "rejected",
      error_message:
        "La adhesión no tiene una configuración de proveedor asociada.",
      processed_at:
        new Date().toISOString(),
    });

    return NextResponse.json({
      received: true,
      processed: false,
      reason:
        "Provider configuration missing",
    });
  }

  const {
    data: configuration,
    error: configurationError,
  } = await supabase
    .from(
      "club_payment_providers",
    )
    .select(`
      id,
      organization_id,
      club_id,
      provider,
      merchant_account_id
    `)
    .eq(
      "id",
      subscription
        .provider_configuration_id,
    )
    .eq("provider", "pagotic")
    .maybeSingle();

  if (
    configurationError ||
    !configuration
  ) {
    await updateEvent({
      processing_status:
        "rejected",
      error_message:
        "No se encontró la configuración de Pago TIC.",
      processed_at:
        new Date().toISOString(),
    });

    return NextResponse.json({
      received: true,
      processed: false,
      reason:
        "Configuration not found",
    });
  }

  if (
    configuration.club_id !==
      subscription.club_id ||
    configuration
      .organization_id !==
      subscription.organization_id
  ) {
    await updateEvent({
      processing_status:
        "rejected",
      error_message:
        "La configuración no pertenece al club de la adhesión.",
      processed_at:
        new Date().toISOString(),
    });

    return NextResponse.json({
      received: true,
      processed: false,
      reason:
        "Tenant mismatch",
    });
  }

  if (
    !collectorId ||
    !configuration
      .merchant_account_id ||
    collectorId !==
      configuration
        .merchant_account_id
  ) {
    await updateEvent({
      processing_status:
        "rejected",
      error_message:
        "El Collector ID recibido no coincide con el club.",
      processed_at:
        new Date().toISOString(),
    });

    console.error(
      "Collector ID incorrecto en webhook Pago TIC.",
      {
        subscriptionId:
          subscription.id,
        receivedCollectorId:
          collectorId,
        expectedCollectorId:
          configuration
            .merchant_account_id,
      },
    );

    return NextResponse.json({
      received: true,
      processed: false,
      reason:
        "Collector mismatch",
    });
  }

  const mappedStatus =
    mapPagoTicStatus(
      providerStatus,
    );

  if (!mappedStatus) {
    await updateEvent({
      processing_status:
        "ignored",
      error_message:
        `Estado desconocido de Pago TIC: ${providerStatus}`,
      processed_at:
        new Date().toISOString(),
    });

    return NextResponse.json({
      received: true,
      processed: false,
      reason:
        "Unknown status",
    });
  }

  const statusToApply =
    selectStatusToApply(
      subscription.status,
      mappedStatus,
    );

  const previousPayload =
    isRecord(
      subscription.provider_payload,
    )
      ? subscription.provider_payload
      : {};

  const paymentMethod =
    getNestedRecord(
      payload,
      "payment_method",
    );

  const lastFourDigits =
    getString(
      paymentMethod,
      "last_four_digits",
    );

  const mediaPaymentDetail =
    getString(
      paymentMethod,
      "media_payment_detail",
    );

  const providerLastUpdate =
    getString(
      payload,
      "last_update_date",
    );

  const {
    error: updateSubscriptionError,
  } = await supabase
    .from(
      "payment_subscriptions",
    )
    .update({
      provider_subscription_id:
        providerObjectId,

      status: statusToApply,

      provider_payload: {
        ...previousPayload,

        provider_status:
          providerStatus,

        provider_last_update_date:
          providerLastUpdate ||
          new Date().toISOString(),

        last_webhook_event_key:
          eventKey,

        collector_id:
          collectorId,

        payment_method:
          lastFourDigits ||
          mediaPaymentDetail
            ? {
                last_four_digits:
                  lastFourDigits ||
                  null,

                description:
                  mediaPaymentDetail ||
                  null,
              }
            : null,

        last_notification:
          sanitizedPayload,
      },

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      subscription.id,
    )
    .eq(
      "organization_id",
      subscription
        .organization_id,
    )
    .eq(
      "club_id",
      subscription.club_id,
    );

  if (updateSubscriptionError) {
    console.error(
      "Error actualizando adhesión:",
      updateSubscriptionError,
    );

    await updateEvent({
      processing_status:
        "failed",
      error_message:
        updateSubscriptionError.message,
      processed_at: null,
    });

    return NextResponse.json(
      {
        received: false,
        error:
          "No se pudo actualizar la adhesión.",
      },
      {
        status: 500,
      },
    );
  }

  await updateEvent({
    processing_status:
      "processed",
    error_message: null,
    processed_at:
      new Date().toISOString(),
  });

  revalidatePath(
    "/panel/pagos/adhesiones",
  );

  return NextResponse.json({
    received: true,
    processed: true,
    subscription_id:
      subscription.id,
    status: statusToApply,
  });
}