type PagoTicTokenResponse = {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
};

export type PagoTicAdhesionResponse = {
  id: string;
  form_url: string;
  type?: string;
  status?: string;
  collector_id?: string;
  request_date?: string;
  last_update_date?: string;
  [key: string]: unknown;
};

type CreatePagoTicAdhesionInput = {
  collectorId: string;
  externalReference: string;
  conceptId: string;
  conceptDescription: string;
  payerReference: string;
  payerName: string;
  payerEmail: string;
  payerDni: string;
  notificationUrl: string;
  returnUrl: string;
  backUrl: string;
  metadata: Record<string, unknown>;
};

function getEnvironmentValue(
  variableName: string,
) {
  const value =
    process.env[variableName]?.trim();

  if (!value) {
    throw new Error(
      `Falta configurar ${variableName}.`,
    );
  }

  const normalized =
    value.toUpperCase();

  if (
    normalized.startsWith("TU_") ||
    normalized.startsWith("PEGAR_") ||
    normalized.startsWith("YOUR_") ||
    normalized.includes("CHANGE_ME")
  ) {
    throw new Error(
      `${variableName} todavía contiene un valor de ejemplo.`,
    );
  }

  return value;
}

async function readJsonResponse(
  response: Response,
) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text) as Record<
      string,
      unknown
    >;
  } catch {
    throw new Error(
      "Pago TIC devolvió una respuesta que no tiene formato JSON.",
    );
  }
}

async function getPagoTicToken() {
  const username =
    getEnvironmentValue(
      "PAGOTIC_USERNAME",
    );

  const password =
    getEnvironmentValue(
      "PAGOTIC_PASSWORD",
    );

  const clientId =
    getEnvironmentValue(
      "PAGOTIC_CLIENT_ID",
    );

  const clientSecret =
    getEnvironmentValue(
      "PAGOTIC_CLIENT_SECRET",
    );

  const authUrl =
    process.env.PAGOTIC_AUTH_URL?.trim() ||
    "https://a.paypertic.com/auth/realms/entidades/protocol/openid-connect/token";

  const body =
    new URLSearchParams({
      username,
      password,
      grant_type: "password",
      client_id: clientId,
      client_secret: clientSecret,
    });

  const response = await fetch(
    authUrl,
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },

      body,
      cache: "no-store",
    },
  );

  const result =
    (await readJsonResponse(
      response,
    )) as PagoTicTokenResponse;

  if (
    !response.ok ||
    !result.access_token
  ) {
    console.error(
      "Error autenticando en Pago TIC:",
      result,
    );

    throw new Error(
      result.error_description ??
        result.error ??
        "Pago TIC rechazó la autenticación.",
    );
  }

  return result.access_token;
}

export async function createPagoTicAdhesion({
  collectorId,
  externalReference,
  conceptId,
  conceptDescription,
  payerReference,
  payerName,
  payerEmail,
  payerDni,
  notificationUrl,
  returnUrl,
  backUrl,
  metadata,
}: CreatePagoTicAdhesionInput) {
  const accessToken =
    await getPagoTicToken();

  const apiUrl =
    (
      process.env.PAGOTIC_API_URL?.trim() ||
      "https://api.paypertic.com"
    ).replace(/\/$/, "");

  const requestBody = {
    type: "adhesion",

    currency_id: "ARS",

    collector_id: collectorId,

    notification_url:
      notificationUrl,

    return_url: returnUrl,

    back_url: backUrl,

    detail: {
      external_reference:
        externalReference,

      concept_id: conceptId,

      concept_description:
        conceptDescription,

      collector_id:
        collectorId,
    },

    payer: {
      external_reference:
        payerReference,

      name: payerName,

      email: payerEmail,

      identification: {
        type: "DNI_ARG",
        number: payerDni,
        country: "ARG",
      },
    },

    metadata,
  };

  const response = await fetch(
    `${apiUrl}/suscripciones`,
    {
      method: "POST",

      headers: {
        Authorization:
          `Bearer ${accessToken}`,

        "Content-Type":
          "application/json",

        "Cache-Control":
          "no-cache",
      },

      body: JSON.stringify(
        requestBody,
      ),

      cache: "no-store",
    },
  );

  const result =
    await readJsonResponse(
      response,
    );

  if (!response.ok) {
    console.error(
      "Error creando adhesión en Pago TIC:",
      result,
    );

    const message =
      typeof result.message ===
      "string"
        ? result.message
        : typeof result.error ===
            "string"
          ? result.error
          : "Pago TIC rechazó la creación de la adhesión.";

    throw new Error(message);
  }

  const id =
    typeof result.id === "string"
      ? result.id
      : "";

  const formUrl =
    typeof result.form_url ===
    "string"
      ? result.form_url
      : "";

  if (!id || !formUrl) {
    console.error(
      "Respuesta incompleta de Pago TIC:",
      result,
    );

    throw new Error(
      "Pago TIC no devolvió un identificador y un formulario válidos.",
    );
  }

  return {
    ...result,
    id,
    form_url: formUrl,
  } as PagoTicAdhesionResponse;
}