import { createAdminClient } from "@/lib/supabase/admin";

type MonthlyFee = {
  id: string;
  amount: number | string;
  status: string;
  due_date: string | null;
};

type ApprovedPayment = {
  amount: number | string;
  paid_at: string | null;
};

function getArgentinaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export async function reconcileMonthlyFee(
  monthlyFeeId: string,
) {
  const supabase =
    createAdminClient();

  const {
    data: feeData,
    error: feeError,
  } = await supabase
    .from("monthly_fees")
    .select(`
      id,
      amount,
      status,
      due_date
    `)
    .eq("id", monthlyFeeId)
    .maybeSingle();

  if (feeError) {
    throw new Error(
      `No fue posible consultar la cuota: ${feeError.message}`,
    );
  }

  if (!feeData) {
    return;
  }

  const fee =
    feeData as MonthlyFee;

  if (fee.status === "exempt") {
    return;
  }

  const {
    data: approvedPaymentsData,
    error: approvedPaymentsError,
  } = await supabase
    .from("payments")
    .select(`
      amount,
      paid_at
    `)
    .eq(
      "monthly_fee_id",
      monthlyFeeId,
    )
    .eq("status", "approved");

  if (approvedPaymentsError) {
    throw new Error(
      `No fue posible calcular los pagos aprobados: ${approvedPaymentsError.message}`,
    );
  }

  const approvedPayments =
    (approvedPaymentsData ??
      []) as ApprovedPayment[];

  const feeAmount =
    Number(fee.amount);

  const approvedTotal =
    approvedPayments.reduce(
      (total, payment) => {
        const amount =
          Number(payment.amount);

        return Number.isFinite(amount)
          ? total + amount
          : total;
      },
      0,
    );

  const paidAmount =
    Math.min(
      approvedTotal,
      feeAmount,
    );

  let feeStatus:
    | "paid"
    | "partial"
    | "pending"
    | "overdue";

  if (paidAmount >= feeAmount) {
    feeStatus = "paid";
  } else if (paidAmount > 0) {
    feeStatus = "partial";
  } else if (
    fee.due_date &&
    fee.due_date <
      getArgentinaDate()
  ) {
    feeStatus = "overdue";
  } else {
    feeStatus = "pending";
  }

  const latestPaidAt =
    approvedPayments
      .map(
        (payment) =>
          payment.paid_at,
      )
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      )
      .sort()
      .at(-1) ?? null;

  const {
    error: updateError,
  } = await supabase
    .from("monthly_fees")
    .update({
      paid_amount:
        paidAmount,
      status:
        feeStatus,
      paid_at:
        paidAmount > 0
          ? latestPaidAt
          : null,
    })
    .eq("id", monthlyFeeId);

  if (updateError) {
    throw new Error(
      `No fue posible actualizar la cuota: ${updateError.message}`,
    );
  }
}