import {
  createAdminClient,
} from "@/lib/supabase/admin";

type PaymentBatch = {
  id: string;
  organization_id: string;
  club_id: string;
  status: string;
  sent_at: string | null;
  completed_at: string | null;
};

type BatchItem = {
  id: string;
  status: string;
  sent_at: string | null;
  processed_at: string | null;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export async function reconcilePagoTicPaymentBatch(
  batchId: string,
) {
  if (!isUuid(batchId)) {
    throw new Error(
      "El lote indicado no es válido.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: batchData,
    error: batchError,
  } = await supabase
    .from("payment_batches")
    .select(`
      id,
      organization_id,
      club_id,
      status,
      sent_at,
      completed_at
    `)
    .eq("id", batchId)
    .maybeSingle();

  if (
    batchError ||
    !batchData
  ) {
    throw new Error(
      "No se encontró el lote.",
    );
  }

  const batch =
    batchData as PaymentBatch;

  if (
    [
      "draft",
      "ready",
      "cancelled",
    ].includes(batch.status)
  ) {
    return {
      batchId:
        batch.id,
      status:
        batch.status,
      changed: false,
    };
  }

  const {
    data: itemsData,
    error: itemsError,
  } = await supabase
    .from(
      "payment_batch_items",
    )
    .select(`
      id,
      status,
      sent_at,
      processed_at
    `)
    .eq(
      "batch_id",
      batch.id,
    )
    .eq(
      "organization_id",
      batch.organization_id,
    )
    .eq(
      "club_id",
      batch.club_id,
    );

  if (itemsError) {
    throw new Error(
      `No fue posible consultar los ítems del lote: ${itemsError.message}`,
    );
  }

  const items =
    (itemsData ??
      []) as BatchItem[];

  const actionableItems =
    items.filter(
      (item) =>
        item.status !==
        "blocked",
    );

  if (
    actionableItems.length === 0
  ) {
    return {
      batchId:
        batch.id,
      status:
        batch.status,
      changed: false,
    };
  }

  const readyCount =
    actionableItems.filter(
      (item) =>
        item.status ===
        "ready",
    ).length;

  const queuedCount =
    actionableItems.filter(
      (item) =>
        item.status ===
        "queued",
    ).length;

  const sentCount =
    actionableItems.filter(
      (item) =>
        item.status ===
        "sent",
    ).length;

  const approvedCount =
    actionableItems.filter(
      (item) =>
        item.status ===
        "approved",
    ).length;

  const rejectedCount =
    actionableItems.filter(
      (item) =>
        item.status ===
        "rejected",
    ).length;

  const cancelledCount =
    actionableItems.filter(
      (item) =>
        item.status ===
        "cancelled",
    ).length;

  const errorCount =
    actionableItems.filter(
      (item) =>
        item.status ===
        "error",
    ).length;

  const processedCount =
    approvedCount +
    rejectedCount +
    cancelledCount +
    errorCount;

  let nextStatus:
    | "processing"
    | "sent"
    | "partially_processed"
    | "completed"
    | "error";

  if (
    readyCount > 0 ||
    queuedCount > 0
  ) {
    nextStatus =
      "processing";
  } else if (
    sentCount ===
      actionableItems.length
  ) {
    nextStatus =
      "sent";
  } else if (
    processedCount ===
      actionableItems.length
  ) {
    if (
      errorCount ===
      actionableItems.length
    ) {
      nextStatus =
        "error";
    } else if (
      errorCount > 0
    ) {
      nextStatus =
        "partially_processed";
    } else {
      nextStatus =
        "completed";
    }
  } else {
    nextStatus =
      "partially_processed";
  }

  const sentDates =
    actionableItems
      .map(
        (item) =>
          item.sent_at,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      )
      .sort();

  const now =
    new Date().toISOString();

  const completedAt =
    nextStatus ===
      "completed" ||
    nextStatus ===
      "error"
      ? batch.completed_at ??
        now
      : null;

  const {
    error: updateError,
  } = await supabase
    .from("payment_batches")
    .update({
      status:
        nextStatus,

      sent_at:
        batch.sent_at ??
        sentDates[0] ??
        null,

      completed_at:
        completedAt,

      updated_at:
        now,
    })
    .eq(
      "id",
      batch.id,
    )
    .eq(
      "organization_id",
      batch.organization_id,
    )
    .eq(
      "club_id",
      batch.club_id,
    );

  if (updateError) {
    throw new Error(
      `No fue posible actualizar el estado del lote: ${updateError.message}`,
    );
  }

  return {
    batchId:
      batch.id,

    status:
      nextStatus,

    changed:
      nextStatus !==
      batch.status,

    totals: {
      items:
        actionableItems.length,

      ready:
        readyCount,

      queued:
        queuedCount,

      sent:
        sentCount,

      approved:
        approvedCount,

      rejected:
        rejectedCount,

      cancelled:
        cancelledCount,

      error:
        errorCount,
    },
  };
}