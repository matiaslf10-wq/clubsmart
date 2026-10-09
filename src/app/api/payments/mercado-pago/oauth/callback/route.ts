import {
  cookies,
} from "next/headers";

import {
  NextResponse,
} from "next/server";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  getMercadoPagoOAuthConfig,
  storeMercadoPagoToken,
  type MercadoPagoOAuthToken,
} from "@/lib/payments/mercado-pago/oauth";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MercadoPagoTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id?: number | string;
  refresh_token?: string;
  public_key?: string;
  live_mode?: boolean;
  message?: string;
  error?: string;
};

function configurationUrl(
  siteUrl: string,
  type:
    | "success"
    | "error",
  message: string,
) {
  const url =
    new URL(
      "/panel/pagos/configuracion",
      siteUrl,
    );

  url.searchParams.set(
    type,
    message,
  );

  return url;
}

export async function GET(
  request: Request,
) {
  const {
    clientId,
    clientSecret,
    siteUrl,
    redirectUri,
  } =
    getMercadoPagoOAuthConfig();

  const url =
    new URL(request.url);

  const error =
    url.searchParams.get(
      "error",
    );

  if (error) {
    return NextResponse.redirect(
      configurationUrl(
        siteUrl,
        "error",
        "Mercado Pago no autorizó la conexión.",
      ),
    );
  }

  const code =
    url.searchParams.get(
      "code",
    );

  const state =
    url.searchParams.get(
      "state",
    );

  const cookieStore =
    await cookies();

  const expectedState =
    cookieStore.get(
      "clubsmart_mp_oauth_state",
    )?.value;

  const verifier =
    cookieStore.get(
      "clubsmart_mp_oauth_verifier",
    )?.value;

  cookieStore.delete(
    "clubsmart_mp_oauth_state",
  );

  cookieStore.delete(
    "clubsmart_mp_oauth_verifier",
  );

  if (
    !code ||
    !state ||
    !expectedState ||
    state !== expectedState ||
    !verifier
  ) {
    return NextResponse.redirect(
      configurationUrl(
        siteUrl,
        "error",
        "No fue posible validar la conexión con Mercado Pago.",
      ),
    );
  }

  const context =
    await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    return NextResponse.redirect(
      configurationUrl(
        siteUrl,
        "error",
        "Tu usuario no puede configurar Mercado Pago.",
      ),
    );
  }

  const response =
    await fetch(
      "https://api.mercadopago.com/oauth/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/json",

          Accept:
            "application/json",
        },

        body:
          JSON.stringify({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            grant_type:
              "authorization_code",

            code,

            redirect_uri:
              redirectUri,

            code_verifier:
              verifier,
          }),

        cache: "no-store",
      },
    );

  const tokenResult =
    (await response.json()) as
      MercadoPagoTokenResponse;

  if (
    !response.ok ||
    !tokenResult.access_token ||
    tokenResult.user_id ===
      undefined
  ) {
    console.error(
      "Error OAuth Mercado Pago:",
      tokenResult,
    );

    return NextResponse.redirect(
      configurationUrl(
        siteUrl,
        "error",
        tokenResult.message ??
          "Mercado Pago no pudo completar la vinculación.",
      ),
    );
  }

  const supabase =
    createAdminClient();

  const now =
    new Date().toISOString();

  const {
    data: existing,
    error:
      existingError,
  } =
    await supabase
      .from(
        "club_payment_providers",
      )
      .select(
        "id",
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
        "mercado_pago",
      )
      .maybeSingle();

  if (existingError) {
    throw new Error(
      `No fue posible consultar Mercado Pago: ${existingError.message}`,
    );
  }

  let providerId:
    string;

  if (existing) {
    const {
      error:
        updateError,
    } =
      await supabase
        .from(
          "club_payment_providers",
        )
        .update({
          enabled: true,
          mode:
            "production",
          monthly_fees_enabled:
            false,
          one_time_enabled:
            true,
          automatic_debit_enabled:
            false,
          default_for_monthly_fees:
            false,
          default_for_one_time:
            true,
          merchant_account_id:
            String(
              tokenResult.user_id,
            ),
          connection_status:
            "active",
          connected_at:
            now,
          last_connection_error:
            null,
          updated_at:
            now,
        })
        .eq(
          "id",
          existing.id,
        );

    if (updateError) {
      throw new Error(
        `No fue posible actualizar Mercado Pago: ${updateError.message}`,
      );
    }

    providerId =
      existing.id;
  } else {
    const {
      data:
        inserted,
      error:
        insertError,
    } =
      await supabase
        .from(
          "club_payment_providers",
        )
        .insert({
          organization_id:
            context.organizationId,
          club_id:
            context.clubId,
          provider:
            "mercado_pago",
          enabled: true,
          mode:
            "production",
          monthly_fees_enabled:
            false,
          one_time_enabled:
            true,
          automatic_debit_enabled:
            false,
          default_for_monthly_fees:
            false,
          default_for_one_time:
            true,
          merchant_account_id:
            String(
              tokenResult.user_id,
            ),
          public_settings:
            {},
          connection_status:
            "active",
          onboarding_started_at:
            now,
          connected_at:
            now,
          last_connection_error:
            null,
          updated_at:
            now,
        })
        .select("id")
        .single();

    if (
      insertError ||
      !inserted
    ) {
      throw new Error(
        `No fue posible guardar Mercado Pago: ${
          insertError?.message ??
          "sin identificador"
        }`,
      );
    }

    providerId =
      inserted.id;
  }

  const token:
    MercadoPagoOAuthToken =
    {
      access_token:
        tokenResult.access_token,

      token_type:
        tokenResult.token_type,

      expires_in:
        tokenResult.expires_in,

      scope:
        tokenResult.scope,

      user_id:
        tokenResult.user_id,

      refresh_token:
        tokenResult.refresh_token,

      public_key:
        tokenResult.public_key,

      live_mode:
        tokenResult.live_mode,

      obtained_at:
        now,
    };

  await storeMercadoPagoToken(
    providerId,
    token,
  );

  return NextResponse.redirect(
    configurationUrl(
      siteUrl,
      "success",
      "Mercado Pago quedó conectado a la cuenta del club.",
    ),
  );
}