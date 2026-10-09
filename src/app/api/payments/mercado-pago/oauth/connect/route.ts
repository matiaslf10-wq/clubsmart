import {
  createHash,
  randomBytes,
} from "node:crypto";

import {
  NextResponse,
} from "next/server";

import {
  cookies,
} from "next/headers";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  getMercadoPagoOAuthConfig,
} from "@/lib/payments/mercado-pago/oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function toBase64Url(
  value: Buffer,
) {
  return value
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function GET() {
  const context =
    await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    return NextResponse.redirect(
      new URL(
        "/panel",
        getMercadoPagoOAuthConfig()
          .siteUrl,
      ),
    );
  }

  const {
    clientId,
    redirectUri,
  } =
    getMercadoPagoOAuthConfig();

  const state =
    toBase64Url(
      randomBytes(24),
    );

  const verifier =
    toBase64Url(
      randomBytes(48),
    );

  const challenge =
    toBase64Url(
      createHash("sha256")
        .update(verifier)
        .digest(),
    );

  const cookieStore =
    await cookies();

  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite:
      "lax" as const,
    maxAge: 10 * 60,
    path:
      "/api/payments/mercado-pago/oauth",
  };

  cookieStore.set(
    "clubsmart_mp_oauth_state",
    state,
    cookieOptions,
  );

  cookieStore.set(
    "clubsmart_mp_oauth_verifier",
    verifier,
    cookieOptions,
  );

  const authorizationUrl =
    new URL(
      "https://auth.mercadopago.com/authorization",
    );

  authorizationUrl
    .searchParams
    .set(
      "response_type",
      "code",
    );

  authorizationUrl
    .searchParams
    .set(
      "client_id",
      clientId,
    );

  authorizationUrl
    .searchParams
    .set(
      "redirect_uri",
      redirectUri,
    );

  authorizationUrl
    .searchParams
    .set(
      "state",
      state,
    );

  authorizationUrl
    .searchParams
    .set(
      "code_challenge",
      challenge,
    );

  authorizationUrl
    .searchParams
    .set(
      "code_challenge_method",
      "S256",
    );

  return NextResponse.redirect(
    authorizationUrl,
  );
}