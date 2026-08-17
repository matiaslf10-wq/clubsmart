"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  requirePlanFeature,
} from "@/lib/plans/require-feature";
import { createClient } from "@/lib/supabase/server";

type FeeRate = {
  id: string;
  amount: number | string;
  valid_from: string;
  valid_to: string | null;
};

function canManageRates(role: string) {
  return role === "owner" || role === "admin";
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

function getTodayArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDays(
  value: string,
  days: number,
) {
  const date = new Date(
    `${value}T12:00:00.000Z`,
  );

  date.setUTCDate(
    date.getUTCDate() + days,
  );

  return date.toISOString().slice(0, 10);
}

function redirectWithMessage(
  activityId: string,
  type: "error" | "success",
  message: string,
): never {
  redirect(
    `/panel/actividades/${activityId}/tarifas?${type}=${encodeURIComponent(
      message,
    )}`,
  );
}

function revalidateRatePages(
  activityId: string,
  clubSlug: string,
) {
  revalidatePath("/panel");
  revalidatePath("/panel/actividades");
  revalidatePath(
    `/panel/actividades/${activityId}/tarifas`,
  );
  revalidatePath(`/clubes/${clubSlug}`);
}

async function getManagedActivity(
  activityId: string,
  organizationId: string,
  clubId: string,
) {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      name,
      active
    `)
    .eq("id", activityId)
    .eq(
      "organization_id",
      organizationId,
    )
    .eq("club_id", clubId)
    .maybeSingle();

  return {
    activity: data,
    error,
  };
}

export async function createFeeRate(
  activityId: string,
  formData: FormData,
): Promise<void> {
  const context =
  await requirePlanFeature(
    "fees",
  );

  if (!canManageRates(context.role)) {
    redirectWithMessage(
      activityId,
      "error",
      "Tu usuario no tiene permisos para administrar tarifas.",
    );
  }

  const amountText = readText(
    formData,
    "amount",
  ).replace(",", ".");

  const validFrom = readText(
    formData,
    "valid_from",
  );

  const amount = Number(amountText);
  const today = getTodayArgentina();

  if (
    !Number.isFinite(amount) ||
    amount <= 0
  ) {
    redirectWithMessage(
      activityId,
      "error",
      "Ingresá un importe mayor que cero.",
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      validFrom,
    )
  ) {
    redirectWithMessage(
      activityId,
      "error",
      "Ingresá una fecha de vigencia válida.",
    );
  }

  if (validFrom < today) {
    redirectWithMessage(
      activityId,
      "error",
      "La nueva tarifa debe comenzar hoy o en una fecha futura.",
    );
  }

  const activityCheck =
    await getManagedActivity(
      activityId,
      context.organizationId,
      context.clubId,
    );

  if (
    activityCheck.error ||
    !activityCheck.activity
  ) {
    redirectWithMessage(
      activityId,
      "error",
      "La actividad no existe o no pertenece al club.",
    );
  }

  const supabase = await createClient();

  const {
    data: currentRates,
    error: ratesError,
  } = await supabase
    .from("activity_fee_rates")
    .select(`
      id,
      amount,
      valid_from,
      valid_to
    `)
    .eq("activity_id", activityId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .order("valid_from", {
      ascending: true,
    });

  if (ratesError) {
    redirectWithMessage(
      activityId,
      "error",
      `No fue posible consultar las tarifas actuales: ${ratesError.message}`,
    );
  }

  const rates =
    (currentRates ?? []) as FeeRate[];

  const sameDateRate = rates.find(
    (rate) =>
      rate.valid_from === validFrom,
  );

  if (sameDateRate) {
    redirectWithMessage(
      activityId,
      "error",
      "Ya existe una tarifa que comienza en esa fecha.",
    );
  }

  const previousCoveringRate = rates
    .filter(
      (rate) =>
        rate.valid_from < validFrom &&
        (
          rate.valid_to === null ||
          rate.valid_to >= validFrom
        ),
    )
    .sort((first, second) =>
      second.valid_from.localeCompare(
        first.valid_from,
      ),
    )[0];

  const nextRate = rates
    .filter(
      (rate) =>
        rate.valid_from > validFrom,
    )
    .sort((first, second) =>
      first.valid_from.localeCompare(
        second.valid_from,
      ),
    )[0];

  const newValidTo = nextRate
    ? addDays(nextRate.valid_from, -1)
    : null;

  const previousOriginalValidTo =
    previousCoveringRate?.valid_to ?? null;

  if (previousCoveringRate) {
    const { error: closeError } =
      await supabase
        .from("activity_fee_rates")
        .update({
          valid_to: addDays(
            validFrom,
            -1,
          ),
          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          previousCoveringRate.id,
        )
        .eq(
          "organization_id",
          context.organizationId,
        )
        .eq("club_id", context.clubId)
        .eq(
          "activity_id",
          activityId,
        );

    if (closeError) {
      redirectWithMessage(
        activityId,
        "error",
        `No fue posible cerrar la tarifa anterior: ${closeError.message}`,
      );
    }
  }

  const { error: insertError } =
    await supabase
      .from("activity_fee_rates")
      .insert({
        organization_id:
          context.organizationId,
        club_id: context.clubId,
        activity_id: activityId,
        amount,
        valid_from: validFrom,
        valid_to: newValidTo,
      });

  if (insertError) {
    /*
     * Si la inserción falla, intentamos restaurar
     * la fecha final anterior para no dejar un
     * período incompleto.
     */
    if (previousCoveringRate) {
      const { error: rollbackError } =
        await supabase
          .from("activity_fee_rates")
          .update({
            valid_to:
              previousOriginalValidTo,
            updated_at:
              new Date().toISOString(),
          })
          .eq(
            "id",
            previousCoveringRate.id,
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
            "activity_id",
            activityId,
          );

      if (rollbackError) {
        console.error(
          "No fue posible restaurar la tarifa anterior:",
          rollbackError,
        );
      }
    }

    redirectWithMessage(
      activityId,
      "error",
      `No fue posible crear la tarifa: ${insertError.message}`,
    );
  }

  revalidateRatePages(
    activityId,
    context.clubSlug,
  );

  redirectWithMessage(
    activityId,
    "success",
    "La nueva tarifa fue guardada correctamente.",
  );
}

export async function deleteFutureFeeRate(
  activityId: string,
  rateId: string,
): Promise<void> {
  const context =
  await requirePlanFeature(
    "fees",
  );

  if (!canManageRates(context.role)) {
    redirectWithMessage(
      activityId,
      "error",
      "Tu usuario no tiene permisos para eliminar tarifas.",
    );
  }

  const activityCheck =
    await getManagedActivity(
      activityId,
      context.organizationId,
      context.clubId,
    );

  if (
    activityCheck.error ||
    !activityCheck.activity
  ) {
    redirectWithMessage(
      activityId,
      "error",
      "La actividad no existe o no pertenece al club.",
    );
  }

  const supabase = await createClient();
  const today = getTodayArgentina();

  const {
    data: ratesData,
    error: ratesError,
  } = await supabase
    .from("activity_fee_rates")
    .select(`
      id,
      amount,
      valid_from,
      valid_to
    `)
    .eq("activity_id", activityId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .order("valid_from", {
      ascending: true,
    });

  if (ratesError) {
    redirectWithMessage(
      activityId,
      "error",
      `No fue posible consultar las tarifas: ${ratesError.message}`,
    );
  }

  const rates =
    (ratesData ?? []) as FeeRate[];

  const targetIndex = rates.findIndex(
    (rate) => rate.id === rateId,
  );

  if (targetIndex === -1) {
    redirectWithMessage(
      activityId,
      "error",
      "La tarifa no existe o no pertenece a esta actividad.",
    );
  }

  const targetRate = rates[targetIndex];

  if (targetRate.valid_from <= today) {
    redirectWithMessage(
      activityId,
      "error",
      "Solo se pueden eliminar tarifas futuras que todavía no entraron en vigencia.",
    );
  }

  const previousRate =
    targetIndex > 0
      ? rates[targetIndex - 1]
      : null;

  const nextRate =
    targetIndex < rates.length - 1
      ? rates[targetIndex + 1]
      : null;

  const { error: deleteError } =
    await supabase
      .from("activity_fee_rates")
      .delete()
      .eq("id", rateId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq(
        "activity_id",
        activityId,
      );

  if (deleteError) {
    redirectWithMessage(
      activityId,
      "error",
      `No fue posible eliminar la tarifa: ${deleteError.message}`,
    );
  }

  if (previousRate) {
    const restoredValidTo = nextRate
      ? addDays(
          nextRate.valid_from,
          -1,
        )
      : null;

    const { error: restoreError } =
      await supabase
        .from("activity_fee_rates")
        .update({
          valid_to: restoredValidTo,
          updated_at:
            new Date().toISOString(),
        })
        .eq("id", previousRate.id)
        .eq(
          "organization_id",
          context.organizationId,
        )
        .eq("club_id", context.clubId)
        .eq(
          "activity_id",
          activityId,
        );

    if (restoreError) {
      redirectWithMessage(
        activityId,
        "error",
        `La tarifa futura fue eliminada, pero no fue posible extender el período anterior: ${restoreError.message}`,
      );
    }
  }

  revalidateRatePages(
    activityId,
    context.clubSlug,
  );

  redirectWithMessage(
    activityId,
    "success",
    "La tarifa futura fue eliminada.",
  );
}