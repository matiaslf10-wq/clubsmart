import { NextResponse } from "next/server";

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
    const result =
      await reconcileMercadoPagoPayment(
        dataId,
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