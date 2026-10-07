import {
  createPagoTicAdhesionPayment,
} from "@/lib/payments/pagotic";
import {
  mapPagoTicPaymentStatus,
} from "@/lib/payments/pagotic/payment-status";
import {
  preparePagoTicBatchItemPayment,
} from "@/lib/payments/pagotic/prepare-batch-item-payment";
import {
  reconcileMonthlyFee,
} from "@/lib/payments/reconcile-monthly-fee";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

type BatchItem = {
  id: string;
  batch_id: string;
  organization_id: string;
  club_id: string;
  monthly_fee_id: string;
  payment_subscription_id: string | null;
  member_id: string;
  activity_id: string;
  activity_name: string;
  fee_year: number;
  fee_month: number;
  due_date: string | null;
  amount: number | string;
  status: string;
};

type PaymentBatch = {
  id: string;
  organization_id: string;
  club_id: string;
  provider_configuration_id: string;
  provider: string;
  status: string;
};

type PaymentSubscription = {
  id: string;
  organization_id: string;
  club_id: string;
  member_id: string;
  activity_id: string;
  provider_configuration_id: string;
  provider: string;
  provider_subscription_id: string | null;
  status: string;
};

type PaymentConfiguration = {
  id: string;
  organization_id: string;
  club_id: string;
  provider: string;
  enabled: boolean;
  connection_status: string;
  automatic_debit_enabled: boolean;
  merchant_account_id: string | null;
};

function getProviderDueDate(
  dueDate: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      dueDate,
    );

  if (!match) {
    throw new Error(
      "La cuota no tiene una fecha de vencimiento válida.",
    );
  }

  const year =
    Number(match[1]);

  const month =
    Number(match[2]);

  const day =
    Number(match[3]);

  const date =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day + 1,
      ),
    );

  const nextYear =
    String(
      date.getUTCFullYear(),
    );

  const nextMonth =
    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0");

  const nextDay =
    String(
      date.getUTCDate(),
    ).padStart(2, "0");

  return (
    `${nextYear}-${nextMonth}-${nextDay}` +
    "T00:00:00-0300"
  );
}

function getErrorMessage(
  error: unknown,
) {
  return error instanceof Error
    ? error.message
    : "Pago TIC no pudo procesar el débito.";
}

export async function sendPagoTicBatchItemPayment(
  batchItemId: string,
  notificationUrl: string,
) {
  if (
    !notificationUrl.trim() ||
    !/^https?:\/\//i.test(
      notificationUrl,
    )
  ) {
    throw new Error(
      "La URL de notificaciones de Pago TIC no es válida.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: itemData,
    error: itemError,
  } = await supabase
    .from("payment_batch_items")
    .select(`
      id,
      batch_id,
      organization_id,
      club_id,
      monthly_fee_id,
      payment_subscription_id,
      member_id,
      activity_id,
      activity_name,
      fee_year,
      fee_month,
      due_date,
      amount,
      status
    `)
    .eq("id", batchItemId)
    .maybeSingle();

  if (
    itemError ||
    !itemData
  ) {
    throw new Error(
      "No se encontró el ítem del lote.",
    );
  }

  const item =
    itemData as BatchItem;

  if (
    item.status !== "ready"
  ) {
    throw new Error(
      "El ítem ya no está disponible para envío.",
    );
  }

  if (
    !item.payment_subscription_id
  ) {
    throw new Error(
      "El ítem no tiene una adhesión asociada.",
    );
  }

  if (!item.due_date) {
    throw new Error(
      "La cuota no tiene fecha de vencimiento y no puede enviarse a Pago TIC.",
    );
  }

  const amount =
    Number(item.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "El importe del débito no es válido.",
    );
  }

  const [
    batchResult,
    subscriptionResult,
  ] = await Promise.all([
    supabase
      .from("payment_batches")
      .select(`
        id,
        organization_id,
        club_id,
        provider_configuration_id,
        provider,
        status
      `)
      .eq(
        "id",
        item.batch_id,
      )
      .maybeSingle(),

    supabase
      .from(
        "payment_subscriptions",
      )
      .select(`
        id,
        organization_id,
        club_id,
        member_id,
        activity_id,
        provider_configuration_id,
        provider,
        provider_subscription_id,
        status
      `)
      .eq(
        "id",
        item.payment_subscription_id,
      )
      .maybeSingle(),
  ]);

  if (
    batchResult.error ||
    !batchResult.data
  ) {
    throw new Error(
      "No se encontró el lote del débito.",
    );
  }

  if (
    subscriptionResult.error ||
    !subscriptionResult.data
  ) {
    throw new Error(
      "No se encontró la adhesión del débito.",
    );
  }

  const batch =
    batchResult.data as PaymentBatch;

  const subscription =
    subscriptionResult.data as PaymentSubscription;

  if (
    batch.organization_id !==
      item.organization_id ||
    batch.club_id !==
      item.club_id ||
    batch.provider !== "pagotic" ||
    ![
      "ready",
      "processing",
    ].includes(batch.status)
  ) {
    throw new Error(
      "El lote no está habilitado para envío a Pago TIC.",
    );
  }

  if (
    subscription.organization_id !==
      item.organization_id ||
    subscription.club_id !==
      item.club_id ||
    subscription.member_id !==
      item.member_id ||
    subscription.activity_id !==
      item.activity_id ||
    subscription.provider_configuration_id !==
      batch.provider_configuration_id ||
    subscription.provider !==
      "pagotic" ||
    subscription.status !==
      "active" ||
    !subscription.provider_subscription_id
  ) {
    throw new Error(
      "La adhesión ya no está activa o no corresponde a este cobro.",
    );
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
      enabled,
      connection_status,
      automatic_debit_enabled,
      merchant_account_id
    `)
    .eq(
      "id",
      batch.provider_configuration_id,
    )
    .maybeSingle();

  if (
    configurationError ||
    !configurationData
  ) {
    throw new Error(
      "No se encontró la configuración de Pago TIC.",
    );
  }

  const configuration =
    configurationData as PaymentConfiguration;

  if (
    configuration.organization_id !==
      item.organization_id ||
    configuration.club_id !==
      item.club_id ||
    configuration.provider !==
      "pagotic" ||
    !configuration.enabled ||
    configuration.connection_status !==
      "active" ||
    !configuration.automatic_debit_enabled ||
    !configuration.merchant_account_id
  ) {
    throw new Error(
      "Pago TIC no está habilitado para débito automático.",
    );
  }

  const payment =
    await preparePagoTicBatchItemPayment(
      item.id,
    );

  const {
    data: claimedItem,
    error: claimError,
  } = await supabase
    .from(
      "payment_batch_items",
    )
    .update({
      status: "queued",
      error_message: null,
      updated_at:
        new Date().toISOString(),
    })
    .eq("id", item.id)
    .eq(
      "organization_id",
      item.organization_id,
    )
    .eq(
      "club_id",
      item.club_id,
    )
    .eq("status", "ready")
    .select("id")
    .maybeSingle();

  if (
    claimError ||
    !claimedItem
  ) {
    throw new Error(
      "El ítem ya fue tomado por otro proceso o dejó de estar disponible.",
    );
  }

  let providerResult;

  try {
    providerResult =
      await createPagoTicAdhesionPayment({
        subscriptionId:
          subscription
            .provider_subscription_id,

        collectorId:
          configuration
            .merchant_account_id,

        externalTransactionId:
          payment.id,

        dueDate:
          getProviderDueDate(
            item.due_date,
          ),

        notificationUrl,

        externalReference:
          payment.external_reference ??
          `pagotic-fee:${item.id}`,

        conceptId:
          item.activity_id,

        conceptDescription:
          `Cuota ${item.activity_name} ${item.fee_month}/${item.fee_year}`,

        amount,
      });
  } catch (error) {
    const message =
      getErrorMessage(error);

    const now =
      new Date().toISOString();

    await Promise.all([
      supabase
        .from("payments")
        .update({
          status: "error",
          failure_message:
            message,
          updated_at: now,
        })
        .eq(
          "id",
          payment.id,
        )
        .eq(
          "organization_id",
          item.organization_id,
        )
        .eq(
          "club_id",
          item.club_id,
        ),

      supabase
        .from(
          "payment_batch_items",
        )
        .update({
          status: "error",
          error_message:
            message,
          processed_at: now,
          updated_at: now,
        })
        .eq("id", item.id)
        .eq(
          "organization_id",
          item.organization_id,
        )
        .eq(
          "club_id",
          item.club_id,
        ),
    ]);

    throw error;
  }

  const now =
    new Date().toISOString();

  const providerStatus =
    providerResult.status
      ?.trim()
      .toLowerCase() ||
    "issued";

  const internalStatus =
    mapPagoTicPaymentStatus(
      providerStatus,
    ) ?? "pending";

  const providerReference =
    String(
      providerResult
        .external_transaction_id ??
        payment.id,
    );

  const {
    error: paymentUpdateError,
  } = await supabase
    .from("payments")
    .update({
      provider_payment_id:
        providerResult.id,

      provider_reference:
        providerReference,

      status:
        internalStatus,

      provider_status:
        providerStatus,

      provider_payload:
        providerResult,

      last_provider_event_at:
        now,

      failure_code: null,
      failure_message: null,

      paid_at:
        internalStatus ===
        "approved"
          ? now
          : null,

      updated_at: now,
    })
    .eq("id", payment.id)
    .eq(
      "organization_id",
      item.organization_id,
    )
    .eq(
      "club_id",
      item.club_id,
    );

  if (paymentUpdateError) {
    await supabase
      .from(
        "payment_batch_items",
      )
      .update({
        status: "error",

        provider_payment_id:
          providerResult.id,

        provider_status:
          providerStatus,

        error_message:
          "Pago TIC recibió el débito, pero ClubSmart no pudo guardar completamente la respuesta.",

        sent_at: now,
        updated_at: now,
      })
      .eq("id", item.id)
      .eq(
        "organization_id",
        item.organization_id,
      )
      .eq(
        "club_id",
        item.club_id,
      );

    throw new Error(
      `Pago TIC recibió el débito, pero no fue posible actualizar el pago interno: ${paymentUpdateError.message}`,
    );
  }

  const itemStatus =
    internalStatus ===
    "approved"
      ? "approved"
      : internalStatus ===
          "rejected"
        ? "rejected"
        : internalStatus ===
            "cancelled"
          ? "cancelled"
          : "sent";

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
        payment.external_reference,

      provider_payment_id:
        providerResult.id,

      provider_status:
        providerStatus,

      error_message: null,

      sent_at: now,

      processed_at:
        [
          "approved",
          "rejected",
          "cancelled",
        ].includes(
          itemStatus,
        )
          ? now
          : null,

      updated_at: now,
    })
    .eq("id", item.id)
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
      `El débito fue creado en Pago TIC, pero no fue posible actualizar el ítem del lote: ${itemUpdateError.message}`,
    );
  }

  if (
    internalStatus ===
    "approved"
  ) {
    await reconcileMonthlyFee(
      item.monthly_fee_id,
    );
  }

  return {
    batchItemId:
      item.id,

    paymentId:
      payment.id,

    providerPaymentId:
      providerResult.id,

    providerStatus,

    status:
      internalStatus,
  };
}