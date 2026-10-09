import {
  POST as handleMercadoPagoWebhook,
} from "@/lib/payments/mercado-pago/webhook/route";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export async function POST(
  request: Request,
) {
  return handleMercadoPagoWebhook(
    request,
  );
}