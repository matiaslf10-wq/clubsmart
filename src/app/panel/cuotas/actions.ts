"use server";

import {
  randomUUID,
} from "node:crypto";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  writeAuditLog,
} from "@/lib/audit/write-audit-log";

import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";

import {
  canManageFees,
} from "@/lib/auth/permissions";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

type FeeRate = {
  id: string;
  activity_id: string;
  amount: number | string;
  valid_from: string;
  valid_to: string | null;
};

type MemberActivity = {
  member_id: string;
  activity_id: string;
};

type MonthlyFee = {
  id: string;
  organization_id: string;
  club_id: string;
  member_id: string;
  activity_id: string;

  year: number;
  month: number;

  amount: number | string;
  paid_amount: number | string;

  status: string;

  due_date:
    | string
    | null;
};

function readText(
  formData: FormData,
  field: string,
) {
  const value =
    formData.get(field);

  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function readInteger(
  formData: FormData,
  field: string,
) {
  const value =
    Number(
      readText(
        formData,
        field,
      ),
    );

  return Number.isInteger(
    value,
  )
    ? value
    : null;
}

function getTodayArgentina() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "America/Argentina/Buenos_Aires",

      year:
        "numeric",

      month:
        "2-digit",

      day:
        "2-digit",
    },
  ).format(
    new Date(),
  );
}

function padNumber(
  value: number,
) {
  return String(
    value,
  ).padStart(
    2,
    "0",
  );
}

function buildDate(
  year: number,
  month: number,
  day: number,
) {
  return `${year}-${padNumber(
    month,
  )}-${padNumber(
    day,
  )}`;
}

function redirectWithMessage(
  year: number,
  month: number,
  type:
    | "error"
    | "success",
  message: string,
): never {
  const query =
    new URLSearchParams({
      anio:
        String(year),

      mes:
        String(month),

      [type]:
        message,
    });

  redirect(
    `/panel/cuotas?${query.toString()}`,
  );
}

function revalidateFeePages() {
  revalidatePath(
    "/panel",
  );

  revalidatePath(
    "/panel/cuotas",
  );

  revalidatePath(
    "/panel/pagos",
  );
}

/*
 * ========================================
 * GENERAR CUOTAS MENSUALES
 * ========================================
 */

export async function generateMonthlyFees(
  formData: FormData,
): Promise<void> {
  const context =
  await requirePlanFeature(
    "fees",
  );

  const year =
    readInteger(
      formData,
      "year",
    ) ??
    new Date().getFullYear();

  const month =
    readInteger(
      formData,
      "month",
    ) ??
    new Date().getMonth() +
      1;

  const dueDay =
    readInteger(
      formData,
      "due_day",
    ) ??
    10;

  if (
    !canManageFees(
      context.role,
    )
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Tu usuario no tiene permisos para generar cuotas.",
    );
  }

  if (
    year < 2020 ||
    year > 2200
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El año indicado no es válido.",
    );
  }

  if (
    month < 1 ||
    month > 12
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El mes indicado no es válido.",
    );
  }

  /*
   * Limitamos el vencimiento al día 28
   * para garantizar que exista en todos
   * los meses.
   */
  if (
    dueDay < 1 ||
    dueDay > 28
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El día de vencimiento debe estar entre 1 y 28.",
    );
  }

  const dueDate =
    buildDate(
      year,
      month,
      dueDay,
    );

  const today =
    getTodayArgentina();

  const supabase =
    createAdminClient();

  const {
    data:
      relationsData,
    error:
      relationsError,
  } = await supabase
    .from(
      "member_activities",
    )
    .select(`
      member_id,
      activity_id,

      members!inner (
        id,
        active
      ),

      activities!inner (
        id,
        active
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
    .eq(
      "active",
      true,
    )
    .eq(
      "members.active",
      true,
    )
    .eq(
      "activities.active",
      true,
    );

  if (
    relationsError
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible consultar las inscripciones: ${relationsError.message}`,
    );
  }

  const relations =
    (
      relationsData ??
      []
    ) as unknown as MemberActivity[];

  if (
    relations.length ===
    0
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "No hay inscripciones activas para generar cuotas.",
    );
  }

  const activityIds =
    Array.from(
      new Set(
        relations.map(
          (
            relation,
          ) =>
            relation.activity_id,
        ),
      ),
    );

  const {
    data:
      ratesData,
    error:
      ratesError,
  } = await supabase
    .from(
      "activity_fee_rates",
    )
    .select(`
      id,
      activity_id,
      amount,
      valid_from,
      valid_to
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .in(
      "activity_id",
      activityIds,
    )
    .lte(
      "valid_from",
      dueDate,
    )
    .or(
      `valid_to.is.null,valid_to.gte.${dueDate}`,
    )
    .order(
      "valid_from",
      {
        ascending:
          false,
      },
    );

  if (
    ratesError
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible consultar las tarifas: ${ratesError.message}`,
    );
  }

  const rates =
    (
      ratesData ??
      []
    ) as FeeRate[];

  /*
   * Como las tarifas vienen ordenadas
   * desde la vigencia más reciente,
   * conservamos solamente la primera
   * para cada actividad.
   */
  const rateByActivity =
    new Map<
      string,
      FeeRate
    >();

  for (
    const rate of
      rates
  ) {
    if (
      !rateByActivity.has(
        rate.activity_id,
      )
    ) {
      rateByActivity.set(
        rate.activity_id,
        rate,
      );
    }
  }

  const {
    data:
      existingFeesData,
    error:
      existingFeesError,
  } = await supabase
    .from(
      "monthly_fees",
    )
    .select(`
      member_id,
      activity_id
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
      "year",
      year,
    )
    .eq(
      "month",
      month,
    );

  if (
    existingFeesError
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible verificar las cuotas existentes: ${existingFeesError.message}`,
    );
  }

  const existingKeys =
    new Set(
      (
        existingFeesData ??
        []
      ).map(
        (
          fee,
        ) =>
          `${fee.member_id}:${fee.activity_id}`,
      ),
    );

  let skippedWithoutRate =
    0;

  let alreadyExisting =
    0;

  const rowsToInsert =
    relations.flatMap(
      (
        relation,
      ) => {
        const relationKey =
          `${relation.member_id}:${relation.activity_id}`;

        if (
          existingKeys.has(
            relationKey,
          )
        ) {
          alreadyExisting +=
            1;

          return [];
        }

        const rate =
          rateByActivity.get(
            relation.activity_id,
          );

        if (!rate) {
          skippedWithoutRate +=
            1;

          return [];
        }

        const amount =
          Number(
            rate.amount,
          );

        if (
          !Number.isFinite(
            amount,
          ) ||
          amount < 0
        ) {
          skippedWithoutRate +=
            1;

          return [];
        }

        return [
          {
            organization_id:
              context.organizationId,

            club_id:
              context.clubId,

            member_id:
              relation.member_id,

            activity_id:
              relation.activity_id,

            fee_rate_id:
              rate.id,

            year,

            month,

            amount,

            paid_amount:
              0,

            status:
              dueDate <
              today
                ? "overdue"
                : "pending",

            due_date:
              dueDate,
          },
        ];
      },
    );

  if (
    rowsToInsert.length ===
    0
  ) {
    const details = [
      alreadyExisting >
      0
        ? `${alreadyExisting} ya existían`
        : null,

      skippedWithoutRate >
      0
        ? `${skippedWithoutRate} no tenían tarifa vigente`
        : null,
    ]
      .filter(
        Boolean,
      )
      .join(
        " y ",
      );

    redirectWithMessage(
      year,
      month,
      "error",
      details
        ? `No se generaron cuotas nuevas: ${details}.`
        : "No había cuotas nuevas para generar.",
    );
  }

  const {
    data:
      insertedFees,
    error:
      insertError,
  } = await supabase
    .from(
      "monthly_fees",
    )
    .upsert(
      rowsToInsert,
      {
        onConflict:
          "member_id,activity_id,year,month",

        ignoreDuplicates:
          true,
      },
    )
    .select(
      "id",
    );

  if (
    insertError
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible generar las cuotas: ${insertError.message}`,
    );
  }

  const createdCount =
    insertedFees?.length ??
    0;

  const details = [
    `${createdCount} generadas`,

    alreadyExisting >
    0
      ? `${alreadyExisting} ya existentes`
      : null,

    skippedWithoutRate >
    0
      ? `${skippedWithoutRate} omitidas por falta de tarifa`
      : null,
  ]
    .filter(
      Boolean,
    )
    .join(
      ", ",
    );

  /*
   * Auditoría.
   *
   * Registramos el proceso como una
   * sola operación, no una fila de
   * auditoría por cada cuota creada.
   */
  await writeAuditLog(
    context,
    {
      action:
        "monthly_fees.generated",

      entityType:
        "fee",

      entityLabel:
        `Cuotas ${padNumber(
          month,
        )}/${year}`,

      summary:
        `Generó ${createdCount} ${
          createdCount ===
          1
            ? "cuota"
            : "cuotas"
        } para ${padNumber(
          month,
        )}/${year}.`,

      metadata: {
        year,

        month,

        due_day:
          dueDay,

        due_date:
          dueDate,

        created_count:
          createdCount,

        already_existing:
          alreadyExisting,

        skipped_without_rate:
          skippedWithoutRate,
      },
    },
  );

  revalidateFeePages();

  redirectWithMessage(
    year,
    month,
    "success",
    `Proceso completado: ${details}.`,
  );
}

/*
 * ========================================
 * REGISTRAR PAGO MANUAL
 * ========================================
 */

export async function registerManualPayment(
  monthlyFeeId: string,
  year: number,
  month: number,
  formData: FormData,
): Promise<void> {
  const context =
  await requirePlanFeature(
    "fees",
  );

  if (
    !canManageFees(
      context.role,
    )
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Tu usuario no tiene permisos para registrar pagos.",
    );
  }

  const amountText =
    readText(
      formData,
      "amount",
    ).replace(
      ",",
      ".",
    );

  const amount =
    Number(
      amountText,
    );

  const notes =
    readText(
      formData,
      "notes",
    ) ||
    null;

  if (
    !Number.isFinite(
      amount,
    ) ||
    amount <= 0
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Ingresá un importe mayor que cero.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data:
      feeData,
    error:
      feeError,
  } = await supabase
    .from(
      "monthly_fees",
    )
    .select(`
      id,
      organization_id,
      club_id,
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
      "id",
      monthlyFeeId,
    )
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
    feeError ||
    !feeData
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "La cuota no existe o no pertenece a este club.",
    );
  }

  const fee =
    feeData as MonthlyFee;

  if (
    fee.status ===
      "paid" ||
    fee.status ===
      "exempt" ||
    fee.status ===
      "cancelled"
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Esta cuota no admite nuevos pagos.",
    );
  }

  const feeAmount =
    Number(
      fee.amount,
    );

  const currentPaidAmount =
    Number(
      fee.paid_amount,
    );

  const remainingAmount =
    feeAmount -
    currentPaidAmount;

  if (
    !Number.isFinite(
      remainingAmount,
    ) ||
    remainingAmount <=
      0
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "La cuota ya se encuentra cancelada.",
    );
  }

  if (
    amount >
    remainingAmount +
      0.005
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "El importe supera el saldo pendiente de la cuota.",
    );
  }

  const paidAt =
    new Date().toISOString();

  const externalReference =
    `manual-${monthlyFeeId}-${randomUUID()}`;

  /*
   * Primero registramos el movimiento.
   */
  const {
    data:
      payment,
    error:
      paymentError,
  } = await supabase
    .from(
      "payments",
    )
    .insert({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      member_id:
        fee.member_id,

      activity_id:
        fee.activity_id,

      monthly_fee_id:
        fee.id,

      provider:
        "manual",

      payment_kind:
        "monthly_fee",

      external_reference:
        externalReference,

      amount,

      currency:
        "ARS",

      status:
        "approved",

      provider_status:
        "approved",

      payment_method:
        "manual",

      paid_at:
        paidAt,

      notes,
    })
    .select(
      "id",
    )
    .single();

  if (
    paymentError ||
    !payment
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      `No fue posible registrar el pago: ${
        paymentError?.message ??
        "Error desconocido."
      }`,
    );
  }

  const newPaidAmount =
    currentPaidAmount +
    amount;

  const isFullyPaid =
    newPaidAmount >=
    feeAmount -
      0.005;

  /*
   * Después actualizamos la cuota.
   */
  const {
    data:
      updatedFee,
    error:
      updateError,
  } = await supabase
    .from(
      "monthly_fees",
    )
    .update({
      paid_amount:
        isFullyPaid
          ? feeAmount
          : newPaidAmount,

      status:
        isFullyPaid
          ? "paid"
          : "partial",

      paid_at:
        isFullyPaid
          ? paidAt
          : null,

      updated_at:
        paidAt,
    })
    .eq(
      "id",
      monthlyFeeId,
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
      "paid_amount",
      currentPaidAmount,
    )
    .select(
      "id",
    )
    .maybeSingle();

  if (
    updateError ||
    !updatedFee
  ) {
    /*
     * Si la cuota cambió simultáneamente
     * o falló la actualización, eliminamos
     * el movimiento manual recién creado
     * para no dejar datos inconsistentes.
     */
    const {
      error:
        rollbackError,
    } = await supabase
      .from(
        "payments",
      )
      .delete()
      .eq(
        "id",
        payment.id,
      );

    if (
      rollbackError
    ) {
      console.error(
        "No fue posible revertir el pago manual:",
        rollbackError,
      );
    }

    redirectWithMessage(
      year,
      month,
      "error",
      updateError
        ? `No fue posible actualizar la cuota: ${updateError.message}`
        : "La cuota fue modificada por otra operación. Volvé a intentarlo.",
    );
  }

  /*
   * Auditoría.
   */
  await writeAuditLog(
    context,
    {
      action:
        "monthly_fee_payment.recorded",

      entityType:
        "payment",

      entityId:
        payment.id,

      entityLabel:
        `Pago cuota ${padNumber(
          month,
        )}/${year}`,

      summary:
        `Registró un pago manual de $${amount.toLocaleString(
          "es-AR",
        )} para una cuota de ${padNumber(
          month,
        )}/${year}.`,

      metadata: {
        payment_id:
          payment.id,

        monthly_fee_id:
          monthlyFeeId,

        member_id:
          fee.member_id,

        activity_id:
          fee.activity_id,

        year:
          fee.year,

        month:
          fee.month,

        amount,

        previous_paid_amount:
          currentPaidAmount,

        new_paid_amount:
          isFullyPaid
            ? feeAmount
            : newPaidAmount,

        fee_amount:
          feeAmount,

        fully_paid:
          isFullyPaid,

        previous_status:
          fee.status,

        new_status:
          isFullyPaid
            ? "paid"
            : "partial",

        external_reference:
          externalReference,

        notes,
      },
    },
  );

  revalidateFeePages();

  redirectWithMessage(
    year,
    month,
    "success",
    isFullyPaid
      ? "El pago fue registrado y la cuota quedó pagada."
      : "El pago parcial fue registrado correctamente.",
  );
}

/*
 * ========================================
 * MARCAR CUOTA COMO EXENTA
 * ========================================
 */

export async function markMonthlyFeeExempt(
  monthlyFeeId: string,
  year: number,
  month: number,
): Promise<void> {
  const context =
  await requirePlanFeature(
    "fees",
  );

  if (
    !canManageFees(
      context.role,
    )
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Tu usuario no tiene permisos para modificar cuotas.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data:
      fee,
    error:
      feeError,
  } = await supabase
    .from(
      "monthly_fees",
    )
    .select(`
      id,
      status
    `)
    .eq(
      "id",
      monthlyFeeId,
    )
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
    feeError ||
    !fee
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "La cuota no existe o no pertenece a este club.",
    );
  }

  if (
    fee.status ===
      "paid" ||
    fee.status ===
      "cancelled"
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "Una cuota pagada o anulada no puede marcarse como exenta.",
    );
  }

  if (
    fee.status ===
    "exempt"
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      "La cuota ya se encuentra exenta.",
    );
  }

  const {
    data:
      updatedFee,
    error:
      updateError,
  } = await supabase
    .from(
      "monthly_fees",
    )
    .update({
      status:
        "exempt",

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "id",
      monthlyFeeId,
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
      "status",
      fee.status,
    )
    .select(
      "id",
    )
    .maybeSingle();

  if (
    updateError ||
    !updatedFee
  ) {
    redirectWithMessage(
      year,
      month,
      "error",
      updateError
        ? `No fue posible marcar la cuota como exenta: ${updateError.message}`
        : "La cuota cambió mientras la estabas modificando. Volvé a intentarlo.",
    );
  }

  /*
   * Auditoría.
   */
  await writeAuditLog(
    context,
    {
      action:
        "monthly_fee.exempted",

      entityType:
        "fee",

      entityId:
        monthlyFeeId,

      entityLabel:
        `Cuota ${padNumber(
          month,
        )}/${year}`,

      summary:
        `Marcó como exenta una cuota de ${padNumber(
          month,
        )}/${year}.`,

      metadata: {
        monthly_fee_id:
          monthlyFeeId,

        year,

        month,

        previous_status:
          fee.status,

        new_status:
          "exempt",
      },
    },
  );

  revalidateFeePages();

  redirectWithMessage(
    year,
    month,
    "success",
    "La cuota fue marcada como exenta.",
  );
}