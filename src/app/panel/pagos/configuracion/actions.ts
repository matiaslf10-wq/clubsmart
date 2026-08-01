"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

type PaymentProvider =
  | "pagotic"
  | "mercado_pago";

type ProviderMode =
  | "sandbox"
  | "production";

type ProviderConfiguration = {
  id: string;
  provider: PaymentProvider;
  enabled: boolean;
  monthly_fees_enabled: boolean;
  one_time_enabled: boolean;
  automatic_debit_enabled: boolean;
  merchant_account_id: string | null;
};

const validProviders =
  new Set<PaymentProvider>([
    "pagotic",
    "mercado_pago",
  ]);

function canManagePayments(role: string) {
  return (
    role === "owner" ||
    role === "admin"
  );
}

function readText(
  formData: FormData,
  field: string,
) {
  const value = formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
}

function readBoolean(
  formData: FormData,
  field: string,
) {
  return formData.get(field) === "on";
}

function redirectWithMessage(
  type: "error" | "success",
  message: string,
): never {
  redirect(
    `/panel/pagos/configuracion?${type}=${encodeURIComponent(
      message,
    )}`,
  );
}

function providerName(
  provider: PaymentProvider,
) {
  return provider === "pagotic"
    ? "Pago TIC"
    : "Mercado Pago";
}

function hasUsableEnvironmentValue(
  variableName: string,
) {
  const value =
    process.env[variableName]?.trim();

  if (!value) {
    return false;
  }

  const normalized =
    value.toUpperCase();

  return !(
    normalized.startsWith("TU_") ||
    normalized.startsWith("PEGAR_") ||
    normalized.startsWith("YOUR_") ||
    normalized.includes("CHANGE_ME") ||
    normalized.includes("REEMPLAZAR")
  );
}

function hasPagoTicPlatformCredentials() {
  return [
    "PAGOTIC_USERNAME",
    "PAGOTIC_PASSWORD",
    "PAGOTIC_CLIENT_ID",
    "PAGOTIC_CLIENT_SECRET",
  ].every(
    hasUsableEnvironmentValue,
  );
}

export async function updatePaymentProvider(
  provider: PaymentProvider,
  formData: FormData,
): Promise<void> {
  const context = await getAdminContext();

  if (!canManagePayments(context.role)) {
    redirectWithMessage(
      "error",
      "Tu usuario no tiene permisos para configurar los medios de pago.",
    );
  }

  if (!validProviders.has(provider)) {
    redirectWithMessage(
      "error",
      "El proveedor indicado no es válido.",
    );
  }

  const mode = readText(
    formData,
    "mode",
  ) as ProviderMode;

  if (
    mode !== "sandbox" &&
    mode !== "production"
  ) {
    redirectWithMessage(
      "error",
      "El modo seleccionado no es válido.",
    );
  }

  const enabled = readBoolean(
    formData,
    "enabled",
  );

  let monthlyFeesEnabled =
    readBoolean(
      formData,
      "monthly_fees_enabled",
    );

  let oneTimeEnabled =
    readBoolean(
      formData,
      "one_time_enabled",
    );

  let automaticDebitEnabled =
    readBoolean(
      formData,
      "automatic_debit_enabled",
    );

  const merchantAccountId =
    readText(
      formData,
      "merchant_account_id",
    ) || null;

  /*
   * Mercado Pago queda postergado hasta que
   * implementemos OAuth por club. Nunca debe
   * utilizarse un access token global para
   * cobrar operaciones de clubes diferentes.
   */
  if (
    provider === "mercado_pago"
  ) {
    if (
      enabled ||
      monthlyFeesEnabled ||
      oneTimeEnabled ||
      automaticDebitEnabled
    ) {
      redirectWithMessage(
        "error",
        "Mercado Pago permanecerá deshabilitado hasta implementar la conexión individual de cada club.",
      );
    }

    monthlyFeesEnabled = false;
    oneTimeEnabled = false;
    automaticDebitEnabled = false;
  }

  if (provider === "pagotic") {
    if (
      automaticDebitEnabled &&
      !monthlyFeesEnabled
    ) {
      redirectWithMessage(
        "error",
        "Para habilitar el débito automático también deben estar habilitadas las cuotas mensuales.",
      );
    }

    if (
      enabled &&
      !merchantAccountId
    ) {
      redirectWithMessage(
        "error",
        "Ingresá el Collector ID asignado por Pago TIC al club.",
      );
    }

    if (
      enabled &&
      !hasPagoTicPlatformCredentials()
    ) {
      redirectWithMessage(
        "error",
        "La integración general de ClubSmart con Pago TIC todavía no tiene credenciales válidas en el servidor.",
      );
    }
  }

  const supabase =
    createAdminClient();

  const {
    data: currentConfiguration,
    error: configurationError,
  } = await supabase
    .from("club_payment_providers")
    .select(`
      id,
      default_for_monthly_fees,
      default_for_one_time
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("provider", provider)
    .maybeSingle();

  if (configurationError) {
    redirectWithMessage(
      "error",
      `No fue posible consultar la configuración: ${configurationError.message}`,
    );
  }

  const defaultForMonthlyFees =
    enabled && monthlyFeesEnabled
      ? (
          currentConfiguration
            ?.default_for_monthly_fees ??
          false
        )
      : false;

  const defaultForOneTime =
    enabled && oneTimeEnabled
      ? (
          currentConfiguration
            ?.default_for_one_time ??
          false
        )
      : false;

  const { error: saveError } =
    await supabase
      .from("club_payment_providers")
      .upsert(
        {
          organization_id:
            context.organizationId,

          club_id: context.clubId,
          provider,
          enabled,
          mode,

          monthly_fees_enabled:
            monthlyFeesEnabled,

          one_time_enabled:
            oneTimeEnabled,

          automatic_debit_enabled:
            automaticDebitEnabled,

          default_for_monthly_fees:
            defaultForMonthlyFees,

          default_for_one_time:
            defaultForOneTime,

          /*
           * Para Pago TIC representa el
           * Collector ID propio del club.
           * Nunca contiene contraseñas.
           */
          merchant_account_id:
            merchantAccountId,

          updated_at:
            new Date().toISOString(),
        },
        {
          onConflict:
            "organization_id,club_id,provider",
        },
      );

  if (saveError) {
    redirectWithMessage(
      "error",
      `No fue posible guardar la configuración de ${providerName(
        provider,
      )}: ${saveError.message}`,
    );
  }

  revalidatePath(
    "/panel/pagos/configuracion",
  );

  redirectWithMessage(
    "success",
    `La configuración de ${providerName(
      provider,
    )} fue actualizada.`,
  );
}

export async function updateDefaultProviders(
  formData: FormData,
): Promise<void> {
  const context = await getAdminContext();

  if (!canManagePayments(context.role)) {
    redirectWithMessage(
      "error",
      "Tu usuario no tiene permisos para configurar los medios de pago.",
    );
  }

  const monthlyProviderText =
    readText(
      formData,
      "monthly_provider",
    );

  const oneTimeProviderText =
    readText(
      formData,
      "one_time_provider",
    );

  const monthlyProvider =
    monthlyProviderText === ""
      ? null
      : monthlyProviderText as PaymentProvider;

  const oneTimeProvider =
    oneTimeProviderText === ""
      ? null
      : oneTimeProviderText as PaymentProvider;

  if (
    monthlyProvider !== null &&
    monthlyProvider !== "pagotic"
  ) {
    redirectWithMessage(
      "error",
      "Pago TIC es el único proveedor habilitado actualmente para mensualidades.",
    );
  }

  if (
    oneTimeProvider !== null &&
    !validProviders.has(oneTimeProvider)
  ) {
    redirectWithMessage(
      "error",
      "El proveedor seleccionado para pagos puntuales no es válido.",
    );
  }

  if (
    oneTimeProvider ===
    "mercado_pago"
  ) {
    redirectWithMessage(
      "error",
      "Mercado Pago todavía no puede seleccionarse porque falta implementar la conexión individual por club.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: configurationsData,
    error: configurationsError,
  } = await supabase
    .from("club_payment_providers")
    .select(`
      id,
      provider,
      enabled,
      monthly_fees_enabled,
      one_time_enabled,
      automatic_debit_enabled,
      merchant_account_id
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId);

  if (configurationsError) {
    redirectWithMessage(
      "error",
      `No fue posible consultar los proveedores: ${configurationsError.message}`,
    );
  }

  const configurations =
    (
      configurationsData ?? []
    ) as ProviderConfiguration[];

  const configurationByProvider =
    new Map(
      configurations.map(
        (configuration) => [
          configuration.provider,
          configuration,
        ],
      ),
    );

  if (monthlyProvider) {
    const configuration =
      configurationByProvider.get(
        monthlyProvider,
      );

    if (
      !configuration ||
      !configuration.enabled ||
      !configuration
        .monthly_fees_enabled ||
      !configuration
        .automatic_debit_enabled ||
      !configuration
        .merchant_account_id
    ) {
      redirectWithMessage(
        "error",
        "Pago TIC debe estar habilitado, vinculado al club y configurado para cuotas y débito automático.",
      );
    }
  }

  if (oneTimeProvider) {
    const configuration =
      configurationByProvider.get(
        oneTimeProvider,
      );

    if (
      !configuration ||
      !configuration.enabled ||
      !configuration.one_time_enabled
    ) {
      redirectWithMessage(
        "error",
        "El proveedor de pagos puntuales debe estar habilitado y aceptar pagos únicos.",
      );
    }
  }

  /*
   * Primero quitamos los predeterminados.
   * Luego marcamos las filas seleccionadas.
   * Así evitamos conflictos con los índices
   * únicos de la base.
   */
  const {
    error: clearDefaultsError,
  } = await supabase
    .from("club_payment_providers")
    .update({
      default_for_monthly_fees:
        false,

      default_for_one_time:
        false,

      updated_at:
        new Date().toISOString(),
    })
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId);

  if (clearDefaultsError) {
    redirectWithMessage(
      "error",
      `No fue posible limpiar los proveedores predeterminados: ${clearDefaultsError.message}`,
    );
  }

  if (monthlyProvider) {
    const {
      error: monthlyUpdateError,
    } = await supabase
      .from("club_payment_providers")
      .update({
        default_for_monthly_fees:
          true,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq(
        "provider",
        monthlyProvider,
      );

    if (monthlyUpdateError) {
      redirectWithMessage(
        "error",
        `No fue posible definir el proveedor de mensualidades: ${monthlyUpdateError.message}`,
      );
    }
  }

  if (oneTimeProvider) {
    const {
      error: oneTimeUpdateError,
    } = await supabase
      .from("club_payment_providers")
      .update({
        default_for_one_time:
          true,

        updated_at:
          new Date().toISOString(),
      })
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq(
        "provider",
        oneTimeProvider,
      );

    if (oneTimeUpdateError) {
      redirectWithMessage(
        "error",
        `No fue posible definir el proveedor de pagos puntuales: ${oneTimeUpdateError.message}`,
      );
    }
  }

  revalidatePath(
    "/panel/pagos/configuracion",
  );

  redirectWithMessage(
    "success",
    "Los proveedores predeterminados fueron actualizados.",
  );
}