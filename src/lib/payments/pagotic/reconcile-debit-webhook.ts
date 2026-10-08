import {
  mapPagoTicPaymentStatus,
  type InternalPagoTicPaymentStatus,
} from "@/lib/payments/pagotic/payment-status";
import {
  reconcilePagoTicPaymentBatch,
} from "@/lib/payments/pagotic/reconcile-batch";
import {
  reconcileMonthlyFee,
} from "@/lib/payments/reconcile-monthly-fee";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

type JsonRecord = Record<
  string,
  unknown
>;

type LocalPayment = {
  id: string;
  organization_id: string;
  club_id: string;
  monthly_fee_id: string | null;
  payment_subscription_id: string | null;
  provider_configuration_id: string | null;
  provider: string;
  provider_payment_id: string | null;
  external_reference: string | null;
  amount: number | string;
  currency: string | null;
  payment_kind: string;
  status: string;
  paid_at: string | null;
};

type PaymentConfiguration = {
  id: string;
  organization_id: string;
  club_id: string;
  provider: string;
  merchant_account_id: string | null;
};

type BatchItem = {
  id: string;
  batch_id: string;
  organization_id: string;
  club_id: string;
  monthly_fee_id: string;
  payment_subscription_id: string | null;
  status: string;
};

export type PagoTicDebitReconciliationResult = {
  outcome:
    | "processed"
    | "ignored"
    | "rejected";

  reason: string | null;

  paymentId: string | null;
  batchId: string | null;
  status: string | null;
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
  const value =
    source[field];

  if (
    typeof value === "string"
  ) {
    return value.trim();
  }

  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return String(value);
  }

  return "";
}

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getDetailsAmount(
  payload: JsonRecord,
) {
  if (
    !Array.isArray(
      payload.details,
    )
  ) {
    return null;
  }

  let total = 0;
  let found = false;

  for (
    const detail of
      payload.details
  ) {
    if (!isRecord(detail)) {
      continue;
    }

    const amount =
      Number(
        detail.amount,
      );

    if (
      !Number.isFinite(amount)
    ) {
      continue;
    }

    total += amount;
    found = true;
  }

  return found
    ? total
    : null;
}

function getPaymentMethod(
  payload: JsonRecord,
) {
  if (
    !Array.isArray(
      payload.payment_methods,
    )
  ) {
    return null;
  }

  for (
    const method of
      payload.payment_methods
  ) {
    if (!isRecord(method)) {
      continue;
    }

    const detail =
      getString(
        method,
        "media_payment_detail",
      );

    if (detail) {
      return detail;
    }
  }

  return null;
}

function getProviderEventDate(
  payload: JsonRecord,
) {
  const value =
    getString(
      payload,
      "last_update_date",
    );

  if (
    value &&
    !Number.isNaN(
      Date.parse(value),
    )
  ) {
    return new Date(
      value,
    ).toISOString();
  }

  return new Date().toISOString();
}

function selectStatusToApply(
  currentStatus: string,
  incomingStatus:
    InternalPagoTicPaymentStatus,
) {
  const current =
    currentStatus
      .trim()
      .toLowerCase();

  if (
    current === "refunded"
  ) {
    return "refunded";
  }

  if (
    current === "approved" &&
    incomingStatus !==
      "refunded"
  ) {
    return "approved";
  }

  if (
    (
      current === "rejected" ||
      current === "cancelled"
    ) &&
    (
      incomingStatus ===
        "pending" ||
      incomingStatus ===
        "in_process"
    )
  ) {
    return current;
  }

  return incomingStatus;
}

function getBatchItemId(
  externalReference:
    | string
    | null,
) {
  const prefix =
    "pagotic-fee:";

  if (
    !externalReference ||
    !externalReference.startsWith(
      prefix,
    )
  ) {
    return null;
  }

  const value =
    externalReference.slice(
      prefix.length,
    );

  return isUuid(value)
    ? value
    : null;
}

export async function reconcilePagoTicDebitWebhook(
  payload: JsonRecord,
  sanitizedPayload: JsonRecord,
): Promise<PagoTicDebitReconciliationResult> {
  const providerObjectId =
    getString(
      payload,
      "id",
    );

  const externalTransactionId =
    getString(
      payload,
      "external_transaction_id",
    );

  const providerStatus =
    getString(
      payload,
      "status",
    ).toLowerCase();

  const collectorId =
    getString(
      payload,
      "collector_id",
    );

  const currency =
    getString(
      payload,
      "currency_id",
    ).toUpperCase();

  if (
    !providerObjectId ||
    !externalTransactionId ||
    !providerStatus ||
    !collectorId
  ) {
    return {
      outcome: "rejected",
      reason:
        "La notificación de débito está incompleta.",
      paymentId: null,
      batchId: null,
      status: null,
    };
  }

  const mappedStatus =
    mapPagoTicPaymentStatus(
      providerStatus,
    );

  if (!mappedStatus) {
    return {
      outcome: "ignored",
      reason:
        `Estado desconocido de Pago TIC: ${providerStatus}`,
      paymentId: null,
      batchId: null,
      status: null,
    };
  }

  const supabase =
    createAdminClient();

  let payment:
    | LocalPayment
    | null = null;

  if (
    isUuid(
      externalTransactionId,
    )
  ) {
    const {
      data,
      error,
    } = await supabase
      .from("payments")
      .select(`
        id,
        organization_id,
        club_id,
        monthly_fee_id,
        payment_subscription_id,
        provider_configuration_id,
        provider,
        provider_payment_id,
        external_reference,
        amount,
        currency,
        payment_kind,
        status,
        paid_at
      `)
      .eq(
        "id",
        externalTransactionId,
      )
      .eq(
        "provider",
        "pagotic",
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `No fue posible buscar el pago por external_transaction_id: ${error.message}`,
      );
    }

    payment =
      data as
        | LocalPayment
        | null;
  }

  if (!payment) {
    const {
      data,
      error,
    } = await supabase
      .from("payments")
      .select(`
        id,
        organization_id,
        club_id,
        monthly_fee_id,
        payment_subscription_id,
        provider_configuration_id,
        provider,
        provider_payment_id,
        external_reference,
        amount,
        currency,
        payment_kind,
        status,
        paid_at
      `)
      .eq(
        "provider",
        "pagotic",
      )
      .eq(
        "provider_payment_id",
        providerObjectId,
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `No fue posible buscar el pago por ID de Pago TIC: ${error.message}`,
      );
    }

    payment =
      data as
        | LocalPayment
        | null;
  }

  if (!payment) {
    return {
      outcome: "ignored",
      reason:
        "No se encontró un pago local relacionado.",
      paymentId: null,
      batchId: null,
      status: null,
    };
  }

  if (
    payment.payment_kind !==
      "monthly_fee" ||
    !payment.monthly_fee_id
  ) {
    return {
      outcome: "ignored",
      reason:
        "El pago recibido no corresponde a una cuota mensual.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  if (
    payment.provider_payment_id &&
    payment.provider_payment_id !==
      providerObjectId
  ) {
    return {
      outcome: "rejected",
      reason:
        "El ID de Pago TIC no coincide con el pago registrado.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  if (
    !payment
      .provider_configuration_id
  ) {
    return {
      outcome: "rejected",
      reason:
        "El pago no tiene una configuración de proveedor asociada.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  const {
    data: configurationData,
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
      payment
        .provider_configuration_id,
    )
    .eq(
      "provider",
      "pagotic",
    )
    .maybeSingle();

  if (
    configurationError ||
    !configurationData
  ) {
    return {
      outcome: "rejected",
      reason:
        "No se encontró la configuración de Pago TIC.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  const configuration =
    configurationData as PaymentConfiguration;

  if (
    configuration
      .organization_id !==
      payment.organization_id ||
    configuration.club_id !==
      payment.club_id
  ) {
    return {
      outcome: "rejected",
      reason:
        "La configuración no pertenece al club del pago.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  if (
    !configuration
      .merchant_account_id ||
    collectorId !==
      configuration
        .merchant_account_id
  ) {
    return {
      outcome: "rejected",
      reason:
        "El Collector ID recibido no coincide con el club.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  const expectedCurrency =
    (
      payment.currency ||
      "ARS"
    ).toUpperCase();

  if (
    !currency ||
    currency !==
      expectedCurrency
  ) {
    return {
      outcome: "rejected",
      reason:
        "La moneda recibida no coincide con el pago.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  const receivedAmount =
    getDetailsAmount(
      payload,
    );

  const expectedAmount =
    Number(
      payment.amount,
    );

  if (
    receivedAmount === null ||
    !Number.isFinite(
      expectedAmount,
    ) ||
    Math.abs(
      receivedAmount -
        expectedAmount,
    ) > 0.01
  ) {
    return {
      outcome: "rejected",
      reason:
        "El importe recibido no coincide con el pago.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  const batchItemId =
    getBatchItemId(
      payment
        .external_reference,
    );

  if (!batchItemId) {
    return {
      outcome: "rejected",
      reason:
        "El pago no contiene una referencia válida al ítem del lote.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  const {
    data: itemData,
    error: itemError,
  } = await supabase
    .from(
      "payment_batch_items",
    )
    .select(`
      id,
      batch_id,
      organization_id,
      club_id,
      monthly_fee_id,
      payment_subscription_id,
      status
    `)
    .eq(
      "id",
      batchItemId,
    )
    .maybeSingle();

  if (
    itemError ||
    !itemData
  ) {
    return {
      outcome: "rejected",
      reason:
        "No se encontró el ítem del lote relacionado.",
      paymentId:
        payment.id,
      batchId: null,
      status:
        payment.status,
    };
  }

  const item =
    itemData as BatchItem;

  if (
    item.organization_id !==
      payment.organization_id ||
    item.club_id !==
      payment.club_id ||
    item.monthly_fee_id !==
      payment.monthly_fee_id ||
    item.payment_subscription_id !==
      payment.payment_subscription_id
  ) {
    return {
      outcome: "rejected",
      reason:
        "El ítem del lote no coincide con el pago recibido.",
      paymentId:
        payment.id,
      batchId:
        item.batch_id,
      status:
        payment.status,
    };
  }

  const statusToApply =
    selectStatusToApply(
      payment.status,
      mappedStatus,
    );

  const now =
    new Date().toISOString();

  const providerEventAt =
    getProviderEventDate(
      payload,
    );

  const statusDetail =
    getString(
      payload,
      "status_detail",
    );

  const paymentMethod =
    getPaymentMethod(
      payload,
    );

  const paidAt =
    statusToApply ===
      "approved"
      ? payment.paid_at ??
        providerEventAt
      : statusToApply ===
          "refunded"
        ? null
        : payment.paid_at;

  const {
    error: paymentUpdateError,
  } = await supabase
    .from("payments")
    .update({
      provider_payment_id:
        providerObjectId,

      status:
        statusToApply,

      provider_status:
        providerStatus,

      payment_method:
        paymentMethod,

      provider_payload:
        sanitizedPayload,

      last_provider_event_at:
        providerEventAt,

      paid_at:
        paidAt,

      failure_code:
        statusToApply ===
          "rejected" ||
        statusToApply ===
          "cancelled"
          ? providerStatus
          : null,

      failure_message:
        statusToApply ===
          "rejected" ||
        statusToApply ===
          "cancelled"
          ? statusDetail ||
            null
          : null,

      updated_at:
        now,
    })
    .eq(
      "id",
      payment.id,
    )
    .eq(
      "organization_id",
      payment.organization_id,
    )
    .eq(
      "club_id",
      payment.club_id,
    );

  if (paymentUpdateError) {
    throw new Error(
      `No fue posible actualizar el pago: ${paymentUpdateError.message}`,
    );
  }

  const itemStatus =
    statusToApply ===
      "approved"
      ? "approved"
      : statusToApply ===
          "rejected"
        ? "rejected"
        : statusToApply ===
            "cancelled" ||
          statusToApply ===
            "refunded"
          ? "cancelled"
          : "sent";

  const isFinal =
    [
      "approved",
      "rejected",
      "cancelled",
    ].includes(
      itemStatus,
    );

  const {
    error: itemUpdateError,
  } = await supabase
    .from(
      "payment_batch_items",
    )
    .update({
      status:
        itemStatus,

      external_reference:
        payment
          .external_reference,

      provider_payment_id:
        providerObjectId,

      provider_status:
        providerStatus,

      error_message:
        statusToApply ===
          "rejected" ||
        statusToApply ===
          "cancelled"
          ? statusDetail ||
            null
          : null,

      sent_at:
        now,

      processed_at:
        isFinal
          ? now
          : null,

      updated_at:
        now,
    })
    .eq(
      "id",
      item.id,
    )
    .eq(
      "organization_id",
      item.organization_id,
    )
    .eq(
      "club_id",
      item.club_id,
    );

  if (itemUpdateError) {
    throw new Error(
      `El pago se actualizó, pero no fue posible actualizar el ítem del lote: ${itemUpdateError.message}`,
    );
  }

  await reconcileMonthlyFee(
    payment.monthly_fee_id,
  );

  await reconcilePagoTicPaymentBatch(
    item.batch_id,
  );

  return {
    outcome:
      "processed",

    reason: null,

    paymentId:
      payment.id,

    batchId:
      item.batch_id,

    status:
      statusToApply,
  };
}