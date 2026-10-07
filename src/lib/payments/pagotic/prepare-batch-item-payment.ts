import { createAdminClient } from "@/lib/supabase/admin";

type BatchItem = {
  id: string;
  batch_id: string;
  organization_id: string;
  club_id: string;
  monthly_fee_id: string;
  payment_subscription_id: string | null;
  member_id: string;
  activity_id: string;
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

type PreparedPayment = {
  id: string;
  organization_id: string;
  club_id: string;
  monthly_fee_id: string | null;
  payment_subscription_id: string | null;
  provider: string;
  amount: number | string;
  status: string;
  external_reference: string | null;
  idempotency_key: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function preparePagoTicBatchItemPayment(
  batchItemId: string,
) {
  if (!isUuid(batchItemId)) {
    throw new Error(
      "El ítem de lote indicado no es válido.",
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
      amount,
      status
    `)
    .eq("id", batchItemId)
    .maybeSingle();

  if (itemError || !itemData) {
    throw new Error(
      "No se encontró el ítem del lote.",
    );
  }

  const item =
    itemData as BatchItem;

  const amount =
    Number(item.amount);

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    throw new Error(
      "El ítem no tiene un importe válido.",
    );
  }

  if (!item.payment_subscription_id) {
    throw new Error(
      "El ítem no tiene una adhesión asociada.",
    );
  }

  const idempotencyKey =
    `pagotic:batch-item:${item.id}`;

  const externalReference =
    `pagotic-fee:${item.id}`;

  const {
    data: existingData,
    error: existingError,
  } = await supabase
    .from("payments")
    .select(`
      id,
      organization_id,
      club_id,
      monthly_fee_id,
      payment_subscription_id,
      provider,
      amount,
      status,
      external_reference,
      idempotency_key
    `)
    .eq(
      "idempotency_key",
      idempotencyKey,
    )
    .maybeSingle();

  if (existingError) {
    throw new Error(
      `No fue posible verificar pagos anteriores: ${existingError.message}`,
    );
  }

  if (existingData) {
    const existing =
      existingData as PreparedPayment;

    if (
      existing.organization_id !==
        item.organization_id ||
      existing.club_id !==
        item.club_id ||
      existing.monthly_fee_id !==
        item.monthly_fee_id ||
      existing.payment_subscription_id !==
        item.payment_subscription_id ||
      existing.provider !==
        "pagotic" ||
      Number(existing.amount) !==
        amount
    ) {
      throw new Error(
        "La clave de idempotencia ya está asociada a otro pago.",
      );
    }

    return existing;
  }

  if (item.status !== "ready") {
    throw new Error(
      "El ítem no está listo para ser cobrado.",
    );
  }

  const {
    data: batchData,
    error: batchError,
  } = await supabase
    .from("payment_batches")
    .select(`
      id,
      organization_id,
      club_id,
      provider_configuration_id,
      provider,
      status
    `)
    .eq("id", item.batch_id)
    .maybeSingle();

  if (batchError || !batchData) {
    throw new Error(
      "No se encontró el lote del pago.",
    );
  }

  const batch =
    batchData as PaymentBatch;

  if (
    batch.organization_id !==
      item.organization_id ||
    batch.club_id !==
      item.club_id
  ) {
    throw new Error(
      "El lote y el ítem no pertenecen al mismo club.",
    );
  }

  if (
    batch.provider !== "pagotic" ||
    ![
      "ready",
      "processing",
    ].includes(batch.status)
  ) {
    throw new Error(
      "El lote no está listo para enviarse a Pago TIC.",
    );
  }

  const now =
    new Date().toISOString();

  const {
    data: paymentData,
    error: paymentError,
  } = await supabase
    .from("payments")
    .insert({
      organization_id:
        item.organization_id,

      club_id:
        item.club_id,

      member_id:
        item.member_id,

      monthly_fee_id:
        item.monthly_fee_id,

      activity_id:
        item.activity_id,

      provider:
        "pagotic",

      amount,

      status:
        "created",

      currency:
        "ARS",

      payment_kind:
        "monthly_fee",

      provider_configuration_id:
        batch.provider_configuration_id,

      payment_subscription_id:
        item.payment_subscription_id,

      external_reference:
        externalReference,

      idempotency_key:
        idempotencyKey,

      created_at:
        now,

      updated_at:
        now,
    })
    .select(`
      id,
      organization_id,
      club_id,
      monthly_fee_id,
      payment_subscription_id,
      provider,
      amount,
      status,
      external_reference,
      idempotency_key
    `)
    .single();

  if (paymentError || !paymentData) {
    throw new Error(
      `No fue posible preparar el pago interno: ${
        paymentError?.message ??
        "Error desconocido."
      }`,
    );
  }

  return paymentData as PreparedPayment;
}