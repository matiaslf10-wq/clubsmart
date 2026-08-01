import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

type InternalPaymentStatus =
  | "created"
  | "pending"
  | "in_process"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"
  | "error";

type MercadoPagoPayment = {
  id: number;
  status?: string;
  status_detail?: string | null;
  external_reference?: string | null;
  transaction_amount?: number;
  currency_id?: string;
  payment_method_id?: string | null;
  payment_type_id?: string | null;
  date_approved?: string | null;
  date_last_updated?: string | null;
  metadata?: Record<string, unknown> | null;
  [key: string]: unknown;
};

type InternalPayment = {
  id: string;
  monthly_fee_id: string | null;
  amount: number | string;
  currency: string;
  status: string;
  paid_at: string | null;
  provider_payment_id: string | null;
};

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

type VerifySignatureInput = {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string | null;
  secret: string;
};

function mapMercadoPagoStatus(
  status: string | undefined,
): InternalPaymentStatus {
  switch (status) {
    case "created":
      return "created";

    case "approved":
      return "approved";

    case "pending":
      return "pending";

    case "authorized":
    case "in_process":
    case "in_mediation":
      return "in_process";

    case "rejected":
      return "rejected";

    case "cancelled":
      return "cancelled";

    case "refunded":
      return "refunded";

    case "charged_back":
      return "charged_back";

    default:
      return "pending";
  }
}

function getArgentinaDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function parseSignature(
  signature: string,
) {
  const parts = signature.split(",");

  let timestamp: string | null = null;
  let hash: string | null = null;

  for (const part of parts) {
    const [rawKey, rawValue] =
      part.split("=");

    const key = rawKey?.trim();
    const value = rawValue?.trim();

    if (key === "ts" && value) {
      timestamp = value;
    }

    if (key === "v1" && value) {
      hash = value;
    }
  }

  return {
    timestamp,
    hash,
  };
}

export function verifyMercadoPagoSignature({
  xSignature,
  xRequestId,
  dataId,
  secret,
}: VerifySignatureInput) {
  if (
    !xSignature ||
    !xRequestId ||
    !dataId ||
    !secret
  ) {
    return false;
  }

  const { timestamp, hash } =
    parseSignature(xSignature);

  if (!timestamp || !hash) {
    return false;
  }

  const manifest =
    `id:${dataId};` +
    `request-id:${xRequestId};` +
    `ts:${timestamp};`;

  const expectedHash = createHmac(
    "sha256",
    secret,
  )
    .update(manifest)
    .digest("hex");

  try {
    const expectedBuffer =
      Buffer.from(expectedHash, "hex");

    const receivedBuffer =
      Buffer.from(hash, "hex");

    if (
      expectedBuffer.length !==
      receivedBuffer.length
    ) {
      return false;
    }

    return timingSafeEqual(
      expectedBuffer,
      receivedBuffer,
    );
  } catch {
    return false;
  }
}

export async function getMercadoPagoPayment(
  providerPaymentId: string,
) {
  const accessToken =
    process.env
      .MERCADO_PAGO_ACCESS_TOKEN
      ?.trim();

  if (!accessToken) {
    throw new Error(
      "Falta MERCADO_PAGO_ACCESS_TOKEN.",
    );
  }

  const response = await fetch(
    `https://api.mercadopago.com/v1/payments/${encodeURIComponent(
      providerPaymentId,
    )}`,
    {
      method: "GET",
      headers: {
        Authorization:
          `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      cache: "no-store",
    },
  );

  const rawResponse =
    await response.text();

  let result:
    | MercadoPagoPayment
    | Record<string, unknown>;

  try {
    result = JSON.parse(rawResponse) as
      | MercadoPagoPayment
      | Record<string, unknown>;
  } catch {
    throw new Error(
      "Mercado Pago devolvió una respuesta inválida.",
    );
  }

  if (!response.ok) {
    console.error(
      "Error consultando pago en Mercado Pago:",
      result,
    );

    throw new Error(
      "No fue posible consultar el pago en Mercado Pago.",
    );
  }

  return result as MercadoPagoPayment;
}

async function findInternalPayment(
  mercadoPagoPayment:
    MercadoPagoPayment,
) {
  const supabase =
    createAdminClient();

  const metadataPaymentId =
    mercadoPagoPayment.metadata
      ?.internal_payment_id;

  const externalReference =
    mercadoPagoPayment
      .external_reference
      ?.trim() ||
    (typeof metadataPaymentId ===
    "string"
      ? metadataPaymentId.trim()
      : "");

  let payment:
    | InternalPayment
    | null = null;

  if (externalReference) {
    const {
      data,
      error,
    } = await supabase
      .from("payments")
      .select(`
        id,
        monthly_fee_id,
        amount,
        currency,
        status,
        paid_at,
        provider_payment_id
      `)
      .eq(
        "provider",
        "mercado_pago",
      )
      .eq(
        "external_reference",
        externalReference,
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `No fue posible consultar el pago interno: ${error.message}`,
      );
    }

    payment =
      data as InternalPayment | null;
  }

  if (!payment) {
    const {
      data,
      error,
    } = await supabase
      .from("payments")
      .select(`
        id,
        monthly_fee_id,
        amount,
        currency,
        status,
        paid_at,
        provider_payment_id
      `)
      .eq(
        "provider",
        "mercado_pago",
      )
      .eq(
        "provider_payment_id",
        String(
          mercadoPagoPayment.id,
        ),
      )
      .maybeSingle();

    if (error) {
      throw new Error(
        `No fue posible consultar el pago interno: ${error.message}`,
      );
    }

    payment =
      data as InternalPayment | null;
  }

  return payment;
}

async function recalculateMonthlyFee(
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
        const amount = Number(
          payment.amount,
        );

        return Number.isFinite(amount)
          ? total + amount
          : total;
      },
      0,
    );

  const paidAmount = Math.min(
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
      paid_amount: paidAmount,
      status: feeStatus,
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

export async function reconcileMercadoPagoPayment(
  providerPaymentId: string,
) {
  const mercadoPagoPayment =
    await getMercadoPagoPayment(
      providerPaymentId,
    );

  const internalPayment =
    await findInternalPayment(
      mercadoPagoPayment,
    );

  if (!internalPayment) {
    throw new Error(
      "La operación de Mercado Pago no está asociada a un pago interno.",
    );
  }

  const providerPaymentIdText =
    String(mercadoPagoPayment.id);

  if (
    internalPayment.provider_payment_id &&
    internalPayment.provider_payment_id !==
      providerPaymentIdText
  ) {
    throw new Error(
      "El pago interno ya está asociado a otra operación de Mercado Pago.",
    );
  }

  const internalAmount = Number(
    internalPayment.amount,
  );

  const providerAmount = Number(
    mercadoPagoPayment
      .transaction_amount,
  );

  if (
    !Number.isFinite(
      internalAmount,
    ) ||
    !Number.isFinite(
      providerAmount,
    ) ||
    Math.abs(
      internalAmount -
        providerAmount,
    ) > 0.01
  ) {
    throw new Error(
      "El importe informado por Mercado Pago no coincide con ClubSmart.",
    );
  }

  if (
    mercadoPagoPayment.currency_id &&
    mercadoPagoPayment.currency_id !==
      internalPayment.currency
  ) {
    throw new Error(
      "La moneda informada por Mercado Pago no coincide con ClubSmart.",
    );
  }

  const mappedStatus =
    mapMercadoPagoStatus(
      mercadoPagoPayment.status,
    );

  const isFailureStatus =
    mappedStatus === "rejected" ||
    mappedStatus === "cancelled" ||
    mappedStatus === "charged_back" ||
    mappedStatus === "error";

  const updatePayload: Record<
    string,
    unknown
  > = {
    provider_payment_id:
      providerPaymentIdText,

    status: mappedStatus,

    provider_status:
      mercadoPagoPayment.status ??
      "unknown",

    payment_method:
      mercadoPagoPayment
        .payment_method_id ??
      mercadoPagoPayment
        .payment_type_id ??
      null,

    provider_payload:
      mercadoPagoPayment,

    last_provider_event_at:
      mercadoPagoPayment
        .date_last_updated ??
      new Date().toISOString(),

    failure_code:
      isFailureStatus
        ? mercadoPagoPayment
            .status_detail ??
          mercadoPagoPayment.status ??
          null
        : null,

    failure_message:
      isFailureStatus
        ? mercadoPagoPayment
            .status_detail ??
          "La operación no fue aprobada."
        : null,
  };

  if (
    mappedStatus === "approved"
  ) {
    updatePayload.paid_at =
      mercadoPagoPayment
        .date_approved ??
      internalPayment.paid_at ??
      new Date().toISOString();
  }

  const supabase =
    createAdminClient();

  const {
    error: paymentUpdateError,
  } = await supabase
    .from("payments")
    .update(updatePayload)
    .eq(
      "id",
      internalPayment.id,
    );

  if (paymentUpdateError) {
    throw new Error(
      `No fue posible actualizar el pago interno: ${paymentUpdateError.message}`,
    );
  }

  if (
    internalPayment.monthly_fee_id
  ) {
    await recalculateMonthlyFee(
      internalPayment.monthly_fee_id,
    );
  }

  return {
    internalPaymentId:
      internalPayment.id,

    providerPaymentId:
      providerPaymentIdText,

    status: mappedStatus,
  };
}