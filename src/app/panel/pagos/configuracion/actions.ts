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
  organization_id: string;
  club_id: string;
  provider: PaymentProvider;
  enabled: boolean;
  mode: ProviderMode;
  monthly_fees_enabled: boolean;
  one_time_enabled: boolean;
  automatic_debit_enabled: boolean;
  default_for_monthly_fees: boolean;
  default_for_one_time: boolean;
  merchant_account_id: string | null;
  public_settings: unknown;
  secret_reference: string | null;
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

  const monthlyFeesEnabled =
    readBoolean(
      formData,
      "monthly_fees_enabled",
    );

  const oneTimeEnabled =
    readBoolean(
      formData,
      "one_time_enabled",
    );

  const automaticDebitEnabled =
    provider === "pagotic"
      ? readBoolean(
          formData,
          "automatic_debit_enabled",
        )
      : false;

  const merchantAccountId =
    readText(
      formData,
      "merchant_account_id",
    ) || null;

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

  /*
   * Si se deshabilita el proveedor o una de
   * sus funciones, también deja de ser el
   * proveedor predeterminado para esa función.
   */
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
    !validProviders.has(monthlyProvider)
  ) {
    redirectWithMessage(
      "error",
      "El proveedor seleccionado para mensualidades no es válido.",
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

  const supabase =
    createAdminClient();

  const {
    data: configurationsData,
    error: configurationsError,
  } = await supabase
    .from("club_payment_providers")
    .select(`
      id,
      organization_id,
      club_id,
      provider,
      enabled,
      mode,
      monthly_fees_enabled,
      one_time_enabled,
      automatic_debit_enabled,
      default_for_monthly_fees,
      default_for_one_time,
      merchant_account_id,
      public_settings,
      secret_reference
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
        .monthly_fees_enabled
    ) {
      redirectWithMessage(
        "error",
        "El proveedor elegido para mensualidades debe estar habilitado y aceptar cuotas mensuales.",
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
        "El proveedor elegido para pagos puntuales debe estar habilitado y aceptar pagos únicos.",
      );
    }
  }

  /*
   * Actualizamos todas las filas juntas para
   * respetar los índices únicos que permiten
   * un solo proveedor predeterminado.
   */
  const updatedConfigurations =
    configurations.map(
      (configuration) => ({
        id: configuration.id,

        organization_id:
          configuration.organization_id,

        club_id:
          configuration.club_id,

        provider:
          configuration.provider,

        enabled:
          configuration.enabled,

        mode:
          configuration.mode,

        monthly_fees_enabled:
          configuration
            .monthly_fees_enabled,

        one_time_enabled:
          configuration.one_time_enabled,

        automatic_debit_enabled:
          configuration
            .automatic_debit_enabled,

        default_for_monthly_fees:
          configuration.provider ===
          monthlyProvider,

        default_for_one_time:
          configuration.provider ===
          oneTimeProvider,

        merchant_account_id:
          configuration
            .merchant_account_id,

        public_settings:
          configuration.public_settings,

        secret_reference:
          configuration.secret_reference,

        updated_at:
          new Date().toISOString(),
      }),
    );

  const { error: updateError } =
    await supabase
      .from("club_payment_providers")
      .upsert(updatedConfigurations, {
        onConflict: "id",
      });

  if (updateError) {
    redirectWithMessage(
      "error",
      `No fue posible guardar los proveedores predeterminados: ${updateError.message}`,
    );
  }

  revalidatePath(
    "/panel/pagos/configuracion",
  );

  redirectWithMessage(
    "success",
    "Los proveedores predeterminados fueron actualizados.",
  );
}