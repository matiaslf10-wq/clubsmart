import type {
  NextRequest,
} from "next/server";

import {
  POST as handlePagoTicWebhook,
} from "@/lib/payments/pagotic/webhook/route";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export async function POST(
  request: NextRequest,
) {
  return handlePagoTicWebhook(
    request,
  );
}