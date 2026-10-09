import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  reconcileMercadoPagoPayment,
  verifyMercadoPagoSignature,
} from "@/lib/payments/mercado-pago";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoWebhookBody = {
  id?: string | number;
  type?: string;
  action?: string;
  live_mode?: boolean;
  user_id?: string | number;
  data?: {
    id?: string | number;
  };
};

function readDataId(
  request: Request,
  body: MercadoPagoWebhookBody,
) {
  const url = new URL(
    request.url,
  );

  const queryDataId =
    url.searchParams.get(
      "data.id",
    );

  if (queryDataId) {
    return queryDataId;
  }

  const bodyDataId =
    body.data?.id;

  if (
    typeof bodyDataId ===
      "string" ||
    typeof bodyDataId ===
      "number"
  ) {
    return String(bodyDataId);
  }

  return null;
}

function readTopic(
  request: Request,
  body: MercadoPagoWebhookBody,
) {
  const url = new URL(
    request.url,
  );

  return (
    url.searchParams.get("type") ??
    body.type ??
    null
  );
}

export async function POST(
  request: Request,
) {
  let body:
    MercadoPagoWebhookBody = {};

  try {
    body =
      (await request.json()) as
        MercadoPagoWebhookBody;
  } catch {
    return NextResponse.json(
      {
        received: false,
        error:
          "El cuerpo de la notificación no es válido.",
      },
      {
        status: 400,
      },
    );
  }

  const topic = readTopic(
    request,
    body,
  );

  /*
   * Mercado Pago puede enviar otras clases
   * de eventos a la misma URL.
   */
  if (
    topic &&
    topic !== "payment"
  ) {
    return NextResponse.json(
      {
        received: true,
        ignored: true,
      },
      {
        status: 200,
      },
    );
  }

  const dataId = readDataId(
    request,
    body,
  );

  if (!dataId) {
    return NextResponse.json(
      {
        received: false,
        error:
          "La notificación no contiene data.id.",
      },
      {
        status: 400,
      },
    );
  }

  const webhookSecret =
    process.env
      .MERCADO_PAGO_WEBHOOK_SECRET
      ?.trim();

  if (!webhookSecret) {
    console.error(
      "Falta MERCADO_PAGO_WEBHOOK_SECRET.",
    );

    return NextResponse.json(
      {
        received: false,
        error:
          "El webhook no está configurado.",
      },
      {
        status: 500,
      },
    );
  }

  const signatureIsValid =
    verifyMercadoPagoSignature({
      xSignature:
        request.headers.get(
          "x-signature",
        ),

      xRequestId:
        request.headers.get(
          "x-request-id",
        ),

      dataId,

      secret: webhookSecret,
    });

  if (!signatureIsValid) {
    console.error(
      "Firma inválida de Mercado Pago.",
      {
        dataId,
        requestId:
          request.headers.get(
            "x-request-id",
          ),
      },
    );

    return NextResponse.json(
      {
        received: false,
        error:
          "La firma de la notificación no es válida.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const merchantAccountId =
      body.user_id !== undefined
        ? String(body.user_id)
        : null;

    if (!merchantAccountId) {
      throw new Error(
        "La notificaci?n de Mercado Pago no contiene user_id.",
      );
    }

    const supabase =
      createAdminClient();

    const {
      data: providerConfiguration,
      error: providerError,
    } = await supabase
      .from("club_payment_providers")
      .select("id")
      .eq("provider", "mercado_pago")
      .eq("merchant_account_id", merchantAccountId)
      .eq("enabled", true)
      .eq("connection_status", "active")
      .maybeSingle();

    if (
      providerError ||
      !providerConfiguration
    ) {
      throw new Error(
        providerError
          ? `No fue posible resolver la cuenta Mercado Pago: ${providerError.message}`
          : "No existe una cuenta Mercado Pago activa para esta notificaci?n.",
      );
    }

    const result =
      await reconcileMercadoPagoPayment(
        dataId,
        providerConfiguration.id,
      );

    return NextResponse.json(
      {
        received: true,
        payment_id:
          result.internalPaymentId,
        status: result.status,
      },
      {
        status: 200,
      },
    );
  } catch (error) {
    console.error(
      "Error procesando webhook de Mercado Pago:",
      error,
    );

    /*
     * Respondemos 500 para que Mercado Pago
     * vuelva a intentar la notificación.
     */
    return NextResponse.json(
      {
        received: false,
        error:
          "No fue posible procesar la notificación.",
      },
      {
        status: 500,
      },
    );
  }
}