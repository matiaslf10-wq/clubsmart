"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";
import { createAdminClient } from "@/lib/supabase/admin";

type ProviderMode =
  | "sandbox"
  | "production";

type ConnectionStatus =
  | "not_started"
  | "pending"
  | "active"
  | "suspended"
  | "rejected";

type PagoTicConfiguration = {
  id: string;
  mode: ProviderMode;
  monthly_fees_enabled: boolean;
  one_time_enabled: boolean;
  automatic_debit_enabled: boolean;
  merchant_account_id: string | null;
  external_entity_id: string | null;
  connection_status: ConnectionStatus;
};

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

async function getPagoTicConfiguration(
  organizationId: string,
  clubId: string,
) {
  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } = await supabase
    .from("club_payment_providers")
    .select(`
      id,
      mode,
      monthly_fees_enabled,
      one_time_enabled,
      automatic_debit_enabled,
      merchant_account_id,
      external_entity_id,
      connection_status
    `)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("club_id", clubId)
    .eq("provider", "pagotic")
    .maybeSingle();

  if (error) {
    throw new Error(
      `No fue posible consultar Pago TIC: ${error.message}`,
    );
  }

  return data as
    | PagoTicConfiguration
    | null;
}

export async function startPagoTicSetup(): Promise<void> {
  const context =
  await requirePlanFeature(
    "payments",
  );

  if (!canManagePayments(context.role)) {
    redirectWithMessage(
      "error",
      "Tu usuario no tiene permisos para configurar los medios de pago.",
    );
  }

  const supabase =
    createAdminClient();

  const current =
    await getPagoTicConfiguration(
      context.organizationId,
      context.clubId,
    );

  const now =
    new Date().toISOString();

  if (current) {
    const { error } = await supabase
      .from("club_payment_providers")
      .update({
        connection_status:
          "pending",

        onboarding_started_at:
          now,

        enabled: false,

        default_for_monthly_fees:
          false,

        default_for_one_time:
          false,

        last_connection_error:
          null,

        updated_at: now,
      })
      .eq("id", current.id);

    if (error) {
      redirectWithMessage(
        "error",
        `No fue posible iniciar la configuración: ${error.message}`,
      );
    }
  } else {
    const { error } = await supabase
      .from("club_payment_providers")
      .insert({
        organization_id:
          context.organizationId,

        club_id:
          context.clubId,

        provider: "pagotic",
        enabled: false,
        mode: "sandbox",

        monthly_fees_enabled:
          false,

        one_time_enabled:
          false,

        automatic_debit_enabled:
          false,

        default_for_monthly_fees:
          false,

        default_for_one_time:
          false,

        connection_status:
          "pending",

        onboarding_started_at:
          now,

        updated_at: now,
      });

    if (error) {
      redirectWithMessage(
        "error",
        `No fue posible iniciar la configuración: ${error.message}`,
      );
    }
  }

  revalidatePath(
    "/panel/pagos/configuracion",
  );

  redirectWithMessage(
    "success",
    "Se inició la configuración de Pago TIC. El administrador ya puede cargar los datos entregados al club.",
  );
}

export async function savePagoTicSetup(
  formData: FormData,
): Promise<void> {
  const context =
  await requirePlanFeature(
    "payments",
  );

  if (!canManagePayments(context.role)) {
    redirectWithMessage(
      "error",
      "Tu usuario no tiene permisos para configurar los medios de pago.",
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

  const collectorId =
    readText(
      formData,
      "merchant_account_id",
    );

  const externalEntityId =
    readText(
      formData,
      "external_entity_id",
    );

  const monthlyFeesEnabled =
    readBoolean(
      formData,
      "monthly_fees_enabled",
    );

  const automaticDebitEnabled =
    readBoolean(
      formData,
      "automatic_debit_enabled",
    );

  const oneTimeEnabled =
    readBoolean(
      formData,
      "one_time_enabled",
    );

  const providerApproved =
    readBoolean(
      formData,
      "provider_approved",
    );

  if (!collectorId) {
    redirectWithMessage(
      "error",
      "Ingresá el Collector ID entregado por Pago TIC al club.",
    );
  }

  if (
    automaticDebitEnabled &&
    !monthlyFeesEnabled
  ) {
    redirectWithMessage(
      "error",
      "Para habilitar el débito automático también deben habilitarse las cuotas mensuales.",
    );
  }

  if (
    providerApproved &&
    !hasPagoTicPlatformCredentials()
  ) {
    redirectWithMessage(
      "error",
      "El conector técnico de Pago TIC todavía no está disponible en el servidor. Los datos del club pueden guardarse, pero no puede activarse la conexión.",
    );
  }

  const supabase =
    createAdminClient();

  const current =
    await getPagoTicConfiguration(
      context.organizationId,
      context.clubId,
    );

  const now =
    new Date().toISOString();

  const connectionStatus:
    ConnectionStatus =
      providerApproved
        ? "active"
        : "pending";

  const enabled =
    connectionStatus === "active";

  /*
   * Pago TIC será el único proveedor
   * predeterminado para mensualidades
   * cuando la conexión esté activa.
   */
  if (
    enabled &&
    monthlyFeesEnabled
  ) {
    const { error } = await supabase
      .from("club_payment_providers")
      .update({
        default_for_monthly_fees:
          false,

        updated_at: now,
      })
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId);

    if (error) {
      redirectWithMessage(
        "error",
        `No fue posible actualizar el proveedor predeterminado: ${error.message}`,
      );
    }
  }

  const payload = {
    organization_id:
      context.organizationId,

    club_id:
      context.clubId,

    provider: "pagotic" as const,

    mode,

    merchant_account_id:
      collectorId,

    external_entity_id:
      externalEntityId || null,

    monthly_fees_enabled:
      monthlyFeesEnabled,

    automatic_debit_enabled:
      automaticDebitEnabled,

    one_time_enabled:
      oneTimeEnabled,

    connection_status:
      connectionStatus,

    enabled,

    default_for_monthly_fees:
      enabled &&
      monthlyFeesEnabled,

    default_for_one_time:
      false,

    onboarding_started_at:
      current
        ? undefined
        : now,

    connected_at:
      enabled
        ? now
        : null,

    last_connection_error:
      null,

    updated_at: now,
  };

  let saveError:
    | { message: string }
    | null = null;

  if (current) {
    const {
      error,
    } = await supabase
      .from("club_payment_providers")
      .update(payload)
      .eq("id", current.id);

    saveError = error;
  } else {
    const {
      error,
    } = await supabase
      .from("club_payment_providers")
      .insert({
        ...payload,

        onboarding_started_at:
          now,
      });

    saveError = error;
  }

  if (saveError) {
    redirectWithMessage(
      "error",
      `No fue posible guardar Pago TIC: ${saveError.message}`,
    );
  }

  revalidatePath(
    "/panel/pagos/configuracion",
  );

  redirectWithMessage(
    "success",
    enabled
      ? "Pago TIC quedó activo para este club."
      : "Los datos fueron guardados. La conexión permanecerá pendiente hasta que Pago TIC confirme el alta.",
  );
}

export async function suspendPagoTic(): Promise<void> {
  const context =
  await requirePlanFeature(
    "payments",
  );

  if (!canManagePayments(context.role)) {
    redirectWithMessage(
      "error",
      "Tu usuario no tiene permisos para suspender Pago TIC.",
    );
  }

  const current =
    await getPagoTicConfiguration(
      context.organizationId,
      context.clubId,
    );

  if (!current) {
    redirectWithMessage(
      "error",
      "El club todavía no configuró Pago TIC.",
    );
  }

  const supabase =
    createAdminClient();

  const { error } = await supabase
    .from("club_payment_providers")
    .update({
      enabled: false,

      connection_status:
        "suspended",

      default_for_monthly_fees:
        false,

      default_for_one_time:
        false,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", current.id);

  if (error) {
    redirectWithMessage(
      "error",
      `No fue posible suspender Pago TIC: ${error.message}`,
    );
  }

  revalidatePath(
    "/panel/pagos/configuracion",
  );

  redirectWithMessage(
    "success",
    "Pago TIC fue suspendido para este club. No se generarán nuevos cobros automáticos.",
  );
}

export async function reactivatePagoTic(): Promise<void> {
  const context =
  await requirePlanFeature(
    "payments",
  );

  if (!canManagePayments(context.role)) {
    redirectWithMessage(
      "error",
      "Tu usuario no tiene permisos para reactivar Pago TIC.",
    );
  }

  const current =
    await getPagoTicConfiguration(
      context.organizationId,
      context.clubId,
    );

  if (!current) {
    redirectWithMessage(
      "error",
      "El club todavía no configuró Pago TIC.",
    );
  }

  if (!current.merchant_account_id) {
    redirectWithMessage(
      "error",
      "Ingresá el Collector ID antes de reactivar Pago TIC.",
    );
  }

  if (!hasPagoTicPlatformCredentials()) {
    redirectWithMessage(
      "error",
      "El conector técnico de Pago TIC todavía no está disponible en el servidor.",
    );
  }

  const supabase =
    createAdminClient();

  const { error } = await supabase
    .from("club_payment_providers")
    .update({
      enabled: true,

      connection_status:
        "active",

      default_for_monthly_fees:
        current.monthly_fees_enabled,

      connected_at:
        new Date().toISOString(),

      last_connection_error:
        null,

      updated_at:
        new Date().toISOString(),
    })
    .eq("id", current.id);

  if (error) {
    redirectWithMessage(
      "error",
      `No fue posible reactivar Pago TIC: ${error.message}`,
    );
  }

  revalidatePath(
    "/panel/pagos/configuracion",
  );

  redirectWithMessage(
    "success",
    "Pago TIC volvió a quedar activo para este club.",
  );
}