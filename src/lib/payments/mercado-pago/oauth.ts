import { createAdminClient } from "@/lib/supabase/admin";

export type MercadoPagoOAuthToken = {
  access_token: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id?: number | string;
  refresh_token?: string;
  public_key?: string;
  live_mode?: boolean;
  obtained_at: string;
};

function readRequiredEnvironmentValue(
  name: string,
) {
  const value =
    process.env[name]?.trim();

  if (!value) {
    throw new Error(
      `Falta ${name}.`,
    );
  }

  return value;
}

export function getMercadoPagoOAuthConfig() {
  const clientId =
    readRequiredEnvironmentValue(
      "MERCADO_PAGO_CLIENT_ID",
    );

  const clientSecret =
    readRequiredEnvironmentValue(
      "MERCADO_PAGO_CLIENT_SECRET",
    );

  const siteUrl =
    readRequiredEnvironmentValue(
      "NEXT_PUBLIC_SITE_URL",
    ).replace(/\/$/, "");

  return {
    clientId,
    clientSecret,
    siteUrl,
    redirectUri:
      `${siteUrl}/api/payments/mercado-pago/oauth/callback`,
  };
}

export async function storeMercadoPagoToken(
  providerConfigurationId: string,
  token: MercadoPagoOAuthToken,
) {
  const supabase =
    createAdminClient();

  const {
    error,
  } = await supabase.rpc(
    "store_payment_provider_secret",
    {
      p_provider_configuration_id:
        providerConfigurationId,

      p_secret:
        JSON.stringify(token),
    },
  );

  if (error) {
    throw new Error(
      `No fue posible guardar las credenciales de Mercado Pago: ${error.message}`,
    );
  }
}

export async function getMercadoPagoAccessToken(
  providerConfigurationId: string,
) {
  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } = await supabase.rpc(
    "get_payment_provider_secret",
    {
      p_provider_configuration_id:
        providerConfigurationId,
    },
  );

  if (error) {
    throw new Error(
      `No fue posible leer las credenciales de Mercado Pago: ${error.message}`,
    );
  }

  if (
    typeof data !== "string" ||
    !data.trim()
  ) {
    throw new Error(
      "La cuenta de Mercado Pago no tiene credenciales guardadas.",
    );
  }

  let parsed:
    MercadoPagoOAuthToken;

  try {
    parsed =
      JSON.parse(
        data,
      ) as MercadoPagoOAuthToken;
  } catch {
    throw new Error(
      "Las credenciales guardadas de Mercado Pago no son válidas.",
    );
  }

  if (
    !parsed.access_token ||
    typeof parsed.access_token !==
      "string"
  ) {
    throw new Error(
      "La cuenta de Mercado Pago no tiene un Access Token válido.",
    );
  }

  return parsed.access_token;
}