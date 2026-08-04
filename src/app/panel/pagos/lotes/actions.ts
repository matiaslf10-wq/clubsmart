"use server";

import {
  revalidatePath,
} from "next/cache";
import {
  redirect,
} from "next/navigation";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";
import {
  createAdminClient,
} from "@/lib/supabase/admin";

type RelatedMember = {
  id: string;
  first_name: string;
  last_name: string;
  dni: string | null;
};

type RelatedActivity = {
  id: string;
  name: string;
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

  members:
    | RelatedMember
    | RelatedMember[]
    | null;

  activities:
    | RelatedActivity
    | RelatedActivity[]
    | null;
};

type PaymentSubscription = {
  id: string;
  member_id: string;
  activity_id: string;
  status: string;
};

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const openBatchStatuses = [
  "draft",
  "ready",
  "processing",
  "sent",
  "partially_processed",
];

function canManagePayments(
  role: string,
) {
  return (
    role === "owner" ||
    role === "admin"
  );
}

function readText(
  formData: FormData,
  field: string,
) {
  const value =
    formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function readInteger(
  formData: FormData,
  field: string,
) {
  const value = Number(
    readText(formData, field),
  );

  return Number.isInteger(value)
    ? value
    : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getSingleRelation<T>(
  value: T | T[] | null,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function redirectWithMessage(
  year: number,
  month: number,
  type: "error" | "success",
  message: string,
  batchId?: string,
): never {
  const parameters =
    new URLSearchParams({
      anio: String(year),
      mes: String(month),
      [type]: message,
    });

  if (batchId) {
    parameters.set(
      "lote",
      batchId,
    );
  }

  redirect(
    `/panel/pagos/lotes?${parameters.toString()}`,
  );
}

function revalidateBatchPages() {
  revalidatePath(
    "/panel/pagos/lotes",
  );

  revalidatePath(
    "/panel/cuotas",
  );

  revalidatePath(
    "/panel/pagos",
  );
}

export async function createPaymentBatch(
  formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  const year =
    readInteger(
      formData,
      "year",
    ) ?? new Date().getFullYear();

  const month =
    readInteger(
      formData,
      "month",
    ) ?? new Date().getMonth() + 1;

  if (
    !canManagePayments(
      context.role,
    )
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Tu usuario no tiene permisos para crear lotes.",
    );
  }

  if (
    year < 2020 ||
    year > 2200 ||
    month < 1 ||
    month > 12
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El período seleccionado no es válido.",
    );
  }

  const selectedFeeIds =
    Array.from(
      new Set(
        formData
          .getAll("fee_id")
          .filter(
            (
              value,
            ): value is string =>
              typeof value ===
                "string" &&
              isUuid(value),
          ),
      ),
    );

  if (
    selectedFeeIds.length === 0
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Seleccioná al menos una cuota.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: configuration,
    error: configurationError,
  } = await supabase
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
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .eq(
      "provider",
      "pagotic",
    )
    .maybeSingle();

  if (
    configurationError
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible consultar la configuración de Pago TIC: ${configurationError.message}`,
    );
  }

  if (!configuration) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Primero debe existir una configuración de Pago TIC para el club.",
    );
  }

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
      due_date,

      members (
        id,
        first_name,
        last_name,
        dni
      ),

      activities (
        id,
        name
      )
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .eq("year", year)
    .eq("month", month)
    .in(
      "id",
      selectedFeeIds,
    );

  if (feesError) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible consultar las cuotas: ${feesError.message}`,
    );
  }

  const fees =
    (feesData ??
      []) as unknown as MonthlyFee[];

  if (
    fees.length !==
    selectedFeeIds.length
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Una o más cuotas no existen, no pertenecen al club o corresponden a otro período.",
    );
  }

  const memberIds =
    Array.from(
      new Set(
        fees.map(
          (fee) =>
            fee.member_id,
        ),
      ),
    );

  const activityIds =
    Array.from(
      new Set(
        fees.map(
          (fee) =>
            fee.activity_id,
        ),
      ),
    );

  const [
    subscriptionsResult,
    existingItemsResult,
  ] = await Promise.all([
    supabase
      .from(
        "payment_subscriptions",
      )
      .select(`
        id,
        member_id,
        activity_id,
        status
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .eq(
        "provider",
        "pagotic",
      )
      .eq(
        "provider_configuration_id",
        configuration.id,
      )
      .eq(
        "status",
        "active",
      )
      .in(
        "member_id",
        memberIds,
      )
      .in(
        "activity_id",
        activityIds,
      ),

    supabase
      .from(
        "payment_batch_items",
      )
      .select(`
        monthly_fee_id,
        batch_id
      `)
      .in(
        "monthly_fee_id",
        selectedFeeIds,
      ),
  ]);

  if (
    subscriptionsResult.error
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible consultar las adhesiones: ${subscriptionsResult.error.message}`,
    );
  }

  if (
    existingItemsResult.error
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible verificar lotes anteriores: ${existingItemsResult.error.message}`,
    );
  }

  const subscriptions =
    (subscriptionsResult.data ??
      []) as PaymentSubscription[];

  const subscriptionByRelation =
    new Map<
      string,
      PaymentSubscription
    >();

  for (
    const subscription of subscriptions
  ) {
    const key =
      `${subscription.member_id}:${subscription.activity_id}`;

    if (
      !subscriptionByRelation.has(
        key,
      )
    ) {
      subscriptionByRelation.set(
        key,
        subscription,
      );
    }
  }

  const existingBatchIds =
    Array.from(
      new Set(
        (
          existingItemsResult.data ??
          []
        ).map(
          (item) =>
            item.batch_id,
        ),
      ),
    );

  const openBatchIds =
    new Set<string>();

  if (
    existingBatchIds.length > 0
  ) {
    const {
      data: openBatches,
      error: openBatchesError,
    } = await supabase
      .from("payment_batches")
      .select("id")
      .in(
        "id",
        existingBatchIds,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .in(
        "status",
        openBatchStatuses,
      );

    if (openBatchesError) {
      redirectWithMessage(
        year,
        month,
        "error",
        `No fue posible verificar los lotes abiertos: ${openBatchesError.message}`,
      );
    }

    for (
      const batch of
        openBatches ?? []
    ) {
      openBatchIds.add(
        batch.id,
      );
    }
  }

  const feeIdsInOpenBatch =
    new Set<string>();

  for (
    const item of
      existingItemsResult.data ??
      []
  ) {
    if (
      openBatchIds.has(
        item.batch_id,
      )
    ) {
      feeIdsInOpenBatch.add(
        item.monthly_fee_id,
      );
    }
  }

  const configurationReady =
    Boolean(
      configuration.enabled &&
        configuration
          .connection_status ===
          "active" &&
        configuration
          .automatic_debit_enabled &&
        configuration
          .merchant_account_id,
    );

  const items = fees.map(
    (fee) => {
      const member =
        getSingleRelation(
          fee.members,
        );

      const activity =
        getSingleRelation(
          fee.activities,
        );

      const feeAmount =
        Number(fee.amount);

      const paidAmount =
        Number(
          fee.paid_amount,
        );

      const remainingAmount =
        Math.max(
          feeAmount -
            paidAmount,
          0,
        );

      const relationKey =
        `${fee.member_id}:${fee.activity_id}`;

      const subscription =
        subscriptionByRelation.get(
          relationKey,
        );

      let blockReason:
        | string
        | null = null;

      if (
        feeIdsInOpenBatch.has(
          fee.id,
        )
      ) {
        blockReason =
          "La cuota ya está incluida en otro lote abierto.";
      } else if (
        ![
          "pending",
          "partial",
          "overdue",
        ].includes(
          fee.status,
        )
      ) {
        blockReason =
          "El estado actual de la cuota no permite cobrarla.";
      } else if (
        !Number.isFinite(
          remainingAmount,
        ) ||
        remainingAmount <= 0
      ) {
        blockReason =
          "La cuota no tiene saldo pendiente.";
      } else if (
        !subscription
      ) {
        blockReason =
          "La persona no tiene una adhesión activa para esta actividad.";
      } else if (
        !configurationReady
      ) {
        blockReason =
          "La conexión de Pago TIC todavía no está habilitada para cobros.";
      }

      return {
        organization_id:
          context.organizationId,

        club_id:
          context.clubId,

        monthly_fee_id:
          fee.id,

        payment_subscription_id:
          subscription?.id ??
          null,

        member_id:
          fee.member_id,

        activity_id:
          fee.activity_id,

        member_name:
          member
            ? `${member.first_name} ${member.last_name}`
            : "Persona no disponible",

        member_dni:
          member?.dni ?? null,

        activity_name:
          activity?.name ??
          "Actividad no disponible",

        fee_year: fee.year,
        fee_month: fee.month,

        due_date:
          fee.due_date,

        fee_amount:
          Number.isFinite(
            feeAmount,
          )
            ? feeAmount
            : 0,

        paid_amount:
          Number.isFinite(
            paidAmount,
          )
            ? paidAmount
            : 0,

        amount:
          remainingAmount,

        status: blockReason
          ? "blocked"
          : "ready",

        block_reason:
          blockReason,
      };
    },
  );

  const invalidItems =
    items.filter(
      (item) =>
        !Number.isFinite(
          item.amount,
        ) ||
        item.amount <= 0,
    );

  if (
    invalidItems.length > 0
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Una o más cuotas seleccionadas no tienen un saldo válido.",
    );
  }

  const readyItems =
    items.filter(
      (item) =>
        item.status ===
        "ready",
    );

  const blockedItems =
    items.filter(
      (item) =>
        item.status ===
        "blocked",
    );

  const totalAmount =
    items.reduce(
      (total, item) =>
        total + item.amount,
      0,
    );

  const readyAmount =
    readyItems.reduce(
      (total, item) =>
        total + item.amount,
      0,
    );

  const now =
    new Date().toISOString();

  const batchName =
    `Lote ${monthNames[month - 1]} ${year}`;

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from("payment_batches")
    .insert({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      provider_configuration_id:
        configuration.id,

      provider: "pagotic",

      name: batchName,

      year,
      month,

      status: "draft",

      total_items:
        items.length,

      ready_items:
        readyItems.length,

      blocked_items:
        blockedItems.length,

      total_amount:
        totalAmount,

      ready_amount:
        readyAmount,

      created_by_user_id:
        context.userId,

      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (
    batchError ||
    !batch
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible crear el lote: ${
        batchError?.message ??
        "Error desconocido."
      }`,
    );
  }

  const batchItems =
    items.map((item) => ({
      ...item,
      batch_id: batch.id,
      created_at: now,
      updated_at: now,
    }));

  const {
    error: itemsError,
  } = await supabase
    .from(
      "payment_batch_items",
    )
    .insert(batchItems);

  if (itemsError) {
    const {
      error: rollbackError,
    } = await supabase
      .from(
        "payment_batches",
      )
      .delete()
      .eq(
        "id",
        batch.id,
      );

    if (rollbackError) {
      console.error(
        "No fue posible revertir el lote:",
        rollbackError,
      );
    }

    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible guardar los elementos del lote: ${itemsError.message}`,
    );
  }

  revalidateBatchPages();

  redirectWithMessage(
    year,
    month,
    "success",
    readyItems.length > 0
      ? `Lote creado: ${readyItems.length} cuotas preparadas y ${blockedItems.length} bloqueadas.`
      : `Lote creado, pero sus ${blockedItems.length} cuotas quedaron bloqueadas.`,
    batch.id,
  );
}

export async function markPaymentBatchReady(
  batchId: string,
  year: number,
  month: number,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManagePayments(
      context.role,
    )
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Tu usuario no tiene permisos para preparar lotes.",
      batchId,
    );
  }

  if (!isUuid(batchId)) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El lote indicado no es válido.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from("payment_batches")
    .select(`
      id,
      status,
      ready_items
    `)
    .eq("id", batchId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .maybeSingle();

  if (
    batchError ||
    !batch
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El lote no existe o no pertenece a este club.",
    );
  }

  if (
    batch.status !==
    "draft"
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Solamente los lotes en borrador pueden marcarse como preparados.",
      batchId,
    );
  }

  if (
    batch.ready_items <= 0
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El lote no tiene cuotas habilitadas para cobrar.",
      batchId,
    );
  }

  const now =
    new Date().toISOString();

  const {
    error: updateError,
  } = await supabase
    .from("payment_batches")
    .update({
      status: "ready",
      prepared_at: now,
      updated_at: now,
    })
    .eq("id", batch.id)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .eq(
      "status",
      "draft",
    );

  if (updateError) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible preparar el lote: ${updateError.message}`,
      batchId,
    );
  }

  revalidateBatchPages();

  redirectWithMessage(
    year,
    month,
    "success",
    "El lote quedó preparado. Todavía no se envió a ningún proveedor.",
    batchId,
  );
}

export async function cancelPaymentBatch(
  batchId: string,
  year: number,
  month: number,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManagePayments(
      context.role,
    )
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Tu usuario no tiene permisos para cancelar lotes.",
      batchId,
    );
  }

  if (!isUuid(batchId)) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El lote indicado no es válido.",
    );
  }

  const supabase =
    createAdminClient();

  const now =
    new Date().toISOString();

  const {
    data: updatedBatch,
    error: updateError,
  } = await supabase
    .from("payment_batches")
    .update({
      status:
        "cancelled",

      cancelled_at: now,
      updated_at: now,
    })
    .eq("id", batchId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .in(
      "status",
      [
        "draft",
        "ready",
      ],
    )
    .select("id")
    .maybeSingle();

  if (
    updateError ||
    !updatedBatch
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El lote no existe, no pertenece al club o ya no puede cancelarse.",
      batchId,
    );
  }

  revalidateBatchPages();

  redirectWithMessage(
    year,
    month,
    "success",
    "El lote fue cancelado. No se realizó ningún cobro.",
    batchId,
  );
}

export async function refreshPaymentBatch(
  batchId: string,
  year: number,
  month: number,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManagePayments(
      context.role,
    )
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Tu usuario no tiene permisos para actualizar lotes.",
      batchId,
    );
  }

  if (!isUuid(batchId)) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El lote indicado no es válido.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: batch,
    error: batchError,
  } = await supabase
    .from("payment_batches")
    .select(`
      id,
      organization_id,
      club_id,
      provider_configuration_id,
      provider,
      status,
      year,
      month
    `)
    .eq("id", batchId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .maybeSingle();

  if (
    batchError ||
    !batch
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El lote no existe o no pertenece a este club.",
    );
  }

  if (
    batch.status !== "draft"
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Solamente pueden actualizarse los lotes en borrador.",
      batchId,
    );
  }

  const [
    itemsResult,
    configurationResult,
  ] = await Promise.all([
    supabase
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
        member_id,
        activity_id,
        member_name,
        member_dni,
        activity_name,
        fee_year,
        fee_month,
        due_date,
        fee_amount,
        paid_amount,
        amount,
        status,
        block_reason,
        external_reference,
        provider_payment_id,
        provider_status,
        error_message,
        sent_at,
        processed_at,
        created_at,
        updated_at
      `)
      .eq(
        "batch_id",
        batch.id,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      ),

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
        batch.provider_configuration_id,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .eq(
        "provider",
        "pagotic",
      )
      .maybeSingle(),
  ]);

  if (itemsResult.error) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible cargar las cuotas del lote: ${itemsResult.error.message}`,
      batchId,
    );
  }

  if (
    configurationResult.error
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible revisar la configuración de Pago TIC: ${configurationResult.error.message}`,
      batchId,
    );
  }

  const items =
    itemsResult.data ?? [];

  if (items.length === 0) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El lote no contiene cuotas.",
      batchId,
    );
  }

  const feeIds =
    items.map(
      (item) =>
        item.monthly_fee_id,
    );

  const memberIds =
    Array.from(
      new Set(
        items.map(
          (item) =>
            item.member_id,
        ),
      ),
    );

  const activityIds =
    Array.from(
      new Set(
        items.map(
          (item) =>
            item.activity_id,
        ),
      ),
    );

  const [
    feesResult,
    subscriptionsResult,
  ] = await Promise.all([
    supabase
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
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .in("id", feeIds),

    supabase
      .from(
        "payment_subscriptions",
      )
      .select(`
        id,
        member_id,
        activity_id,
        status
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .eq(
        "provider",
        "pagotic",
      )
      .eq(
        "provider_configuration_id",
        batch.provider_configuration_id,
      )
      .eq(
        "status",
        "active",
      )
      .in(
        "member_id",
        memberIds,
      )
      .in(
        "activity_id",
        activityIds,
      ),
  ]);

  if (feesResult.error) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible volver a consultar las cuotas: ${feesResult.error.message}`,
      batchId,
    );
  }

  if (
    subscriptionsResult.error
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible volver a consultar las adhesiones: ${subscriptionsResult.error.message}`,
      batchId,
    );
  }

  const feeById =
    new Map(
      (
        feesResult.data ?? []
      ).map((fee) => [
        fee.id,
        fee,
      ]),
    );

  const subscriptionByRelation =
    new Map<
      string,
      {
        id: string;
        member_id: string;
        activity_id: string;
        status: string;
      }
    >();

  for (
    const subscription of
      subscriptionsResult.data ??
      []
  ) {
    const key =
      `${subscription.member_id}:${subscription.activity_id}`;

    if (
      !subscriptionByRelation.has(
        key,
      )
    ) {
      subscriptionByRelation.set(
        key,
        subscription,
      );
    }
  }

  const configuration =
    configurationResult.data;

  const configurationReady =
    Boolean(
      configuration?.enabled &&
        configuration
          .connection_status ===
          "active" &&
        configuration
          .automatic_debit_enabled &&
        configuration
          .merchant_account_id,
    );

  const now =
    new Date().toISOString();

  const refreshedItems =
    items.map((item) => {
      const fee =
        feeById.get(
          item.monthly_fee_id,
        );

      if (!fee) {
        return {
          ...item,

          payment_subscription_id:
            null,

          status: "blocked",

          block_reason:
            "La cuota ya no se encuentra disponible.",

          updated_at: now,
        };
      }

      const feeAmount =
        Number(fee.amount);

      const paidAmount =
        Number(
          fee.paid_amount,
        );

      const remainingAmount =
        Math.max(
          feeAmount -
            paidAmount,
          0,
        );

      const relationKey =
        `${fee.member_id}:${fee.activity_id}`;

      const subscription =
        subscriptionByRelation.get(
          relationKey,
        );

      let blockReason:
        | string
        | null = null;

      if (
        ![
          "pending",
          "partial",
          "overdue",
        ].includes(
          fee.status,
        )
      ) {
        blockReason =
          fee.status === "paid"
            ? "La cuota ya fue pagada."
            : "El estado actual de la cuota no permite cobrarla.";
      } else if (
        !Number.isFinite(
          remainingAmount,
        ) ||
        remainingAmount <= 0
      ) {
        blockReason =
          "La cuota ya no tiene saldo pendiente.";
      } else if (
        !subscription
      ) {
        blockReason =
          "La persona no tiene una adhesión activa para esta actividad.";
      } else if (
        !configurationReady
      ) {
        blockReason =
          "La conexión de Pago TIC todavía no está habilitada para cobros.";
      }

      return {
        ...item,

        payment_subscription_id:
          subscription?.id ??
          null,

        fee_year: fee.year,
        fee_month: fee.month,

        due_date:
          fee.due_date,

        fee_amount:
          Number.isFinite(
            feeAmount,
          )
            ? feeAmount
            : 0,

        paid_amount:
          Number.isFinite(
            paidAmount,
          )
            ? paidAmount
            : 0,

        amount:
          Number.isFinite(
            remainingAmount,
          )
            ? remainingAmount
            : 0,

        status: blockReason
          ? "blocked"
          : "ready",

        block_reason:
          blockReason,

        error_message: null,

        updated_at: now,
      };
    });

  const readyItems =
    refreshedItems.filter(
      (item) =>
        item.status ===
        "ready",
    );

  const blockedItems =
    refreshedItems.filter(
      (item) =>
        item.status ===
        "blocked",
    );

  const totalAmount =
    refreshedItems.reduce(
      (total, item) =>
        total +
        Number(item.amount),
      0,
    );

  const readyAmount =
    readyItems.reduce(
      (total, item) =>
        total +
        Number(item.amount),
      0,
    );

  const {
    error: updateItemsError,
  } = await supabase
    .from(
      "payment_batch_items",
    )
    .upsert(
      refreshedItems,
      {
        onConflict: "id",
      },
    );

  if (updateItemsError) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible actualizar las cuotas del lote: ${updateItemsError.message}`,
      batchId,
    );
  }

  const {
    error: updateBatchError,
  } = await supabase
    .from("payment_batches")
    .update({
      total_items:
        refreshedItems.length,

      ready_items:
        readyItems.length,

      blocked_items:
        blockedItems.length,

      total_amount:
        totalAmount,

      ready_amount:
        readyAmount,

      updated_at: now,
    })
    .eq("id", batch.id)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .eq(
      "status",
      "draft",
    );

  if (updateBatchError) {
    redirectWithMessage(
      year,
      month,
      "error",
      `Las cuotas se actualizaron, pero no fue posible recalcular el lote: ${updateBatchError.message}`,
      batchId,
    );
  }

  revalidateBatchPages();

  redirectWithMessage(
    year,
    month,
    "success",
    `Lote actualizado: ${readyItems.length} cuotas preparadas y ${blockedItems.length} bloqueadas.`,
    batch.id,
  );
}