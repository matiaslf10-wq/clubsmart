import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import {
  createFeeRate,
  deleteFutureFeeRate,
} from "@/app/panel/actividades/[id]/tarifas/actions";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type FeeRate = {
  id: string;
  amount: number | string;
  valid_from: string;
  valid_to: string | null;
};

export const dynamic = "force-dynamic";

function getTodayArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatMoney(
  value: number | string,
) {
  const amount = Number(value);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(
    "es-AR",
  ).format(
    new Date(
      `${value}T12:00:00.000Z`,
    ),
  );
}

function getCurrentRate(
  rates: FeeRate[],
  today: string,
) {
  return (
    rates
      .filter(
        (rate) =>
          rate.valid_from <= today &&
          (
            rate.valid_to === null ||
            rate.valid_to >= today
          ),
      )
      .sort((first, second) =>
        second.valid_from.localeCompare(
          first.valid_from,
        ),
      )[0] ?? null
  );
}

export default async function ActivityRatesPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const messages = await searchParams;
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel/actividades");
  }

  const supabase = await createClient();

  const {
    data: activity,
    error: activityError,
  } = await supabase
    .from("activities")
    .select(`
      id,
      name,
      category,
      active
    `)
    .eq("id", id)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (activityError) {
    throw new Error(
      `No fue posible cargar la actividad: ${activityError.message}`,
    );
  }

  if (!activity) {
    notFound();
  }

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
    .eq("activity_id", activity.id)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .order("valid_from", {
      ascending: false,
    });

  if (ratesError) {
    throw new Error(
      `No fue posible cargar las tarifas: ${ratesError.message}`,
    );
  }

  const rates =
    (ratesData ?? []) as FeeRate[];

  const today = getTodayArgentina();

  const currentRate =
    getCurrentRate(rates, today);

  const futureRates = rates
    .filter(
      (rate) =>
        rate.valid_from > today,
    )
    .sort((first, second) =>
      first.valid_from.localeCompare(
        second.valid_from,
      ),
    );

  const historicalRates = rates
    .filter(
      (rate) =>
        rate.valid_to !== null &&
        rate.valid_to < today,
    )
    .sort((first, second) =>
      second.valid_from.localeCompare(
        first.valid_from,
      ),
    );

  const createAction =
    createFeeRate.bind(
      null,
      activity.id,
    );

  return (
    <div>
      <Link
        href="/panel/actividades"
        className="text-sm font-semibold text-blue-700"
      >
        ← Volver a actividades
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Tarifas de {activity.name}
        </h1>

        <p className="mt-3 max-w-2xl text-slate-600">
          Administrá el importe vigente y
          programá futuros aumentos sin perder
          el historial.
        </p>
      </div>

      {messages.error ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {messages.error}
        </div>
      ) : null}

      {messages.success ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {messages.success}
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
          Tarifa vigente
        </p>

        {currentRate ? (
          <div className="mt-4">
            <p className="text-4xl font-bold text-slate-900">
              {formatMoney(
                currentRate.amount,
              )}
            </p>

            <p className="mt-3 text-sm text-slate-600">
              Vigente desde el{" "}
              {formatDate(
                currentRate.valid_from,
              )}
              {currentRate.valid_to
                ? ` hasta el ${formatDate(
                    currentRate.valid_to,
                  )}`
                : " sin fecha de finalización"}
              .
            </p>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-5">
            <p className="font-semibold text-amber-900">
              No hay una tarifa vigente.
            </p>

            <p className="mt-2 text-sm leading-6 text-amber-800">
              Cargá un importe con vigencia desde
              hoy para habilitar los pagos de esta
              actividad.
            </p>
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Nueva tarifa
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-500">
          Si ya existe una tarifa que cubre esa
          fecha, su período se cerrará
          automáticamente el día anterior.
        </p>

        <form
          action={createAction}
          className="mt-6 grid gap-6 md:grid-cols-[1fr_1fr_auto]"
        >
          <div>
            <label
              htmlFor="amount"
              className="text-sm font-medium text-slate-700"
            >
              Importe *
            </label>

            <input
              id="amount"
              name="amount"
              type="number"
              required
              min="0.01"
              step="0.01"
              inputMode="decimal"
              placeholder="25000"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="valid_from"
              className="text-sm font-medium text-slate-700"
            >
              Vigente desde *
            </label>

            <input
              id="valid_from"
              name="valid_from"
              type="date"
              required
              min={today}
              defaultValue={today}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Guardar tarifa
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Aumentos programados
        </h2>

        {futureRates.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            No hay tarifas futuras programadas.
          </p>
        ) : (
          <div className="mt-6 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200">
            {futureRates.map((rate) => {
              const deleteAction =
                deleteFutureFeeRate.bind(
                  null,
                  activity.id,
                  rate.id,
                );

              return (
                <div
                  key={rate.id}
                  className="flex flex-col gap-4 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {formatMoney(rate.amount)}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Desde el{" "}
                      {formatDate(
                        rate.valid_from,
                      )}
                      {rate.valid_to
                        ? ` hasta el ${formatDate(
                            rate.valid_to,
                          )}`
                        : " en adelante"}
                    </p>
                  </div>

                  <form action={deleteAction}>
                    <button
                      type="submit"
                      className="rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Eliminar programación
                    </button>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Historial
        </h2>

        {historicalRates.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Todavía no hay tarifas históricas.
          </p>
        ) : (
          <div className="mt-6 overflow-hidden rounded-xl border border-slate-200">
            <div className="hidden grid-cols-[1fr_1fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-sm font-semibold text-slate-600 sm:grid">
              <span>Importe</span>
              <span>Desde</span>
              <span>Hasta</span>
            </div>

            <div className="divide-y divide-slate-200">
              {historicalRates.map(
                (rate) => (
                  <div
                    key={rate.id}
                    className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_1fr]"
                  >
                    <p className="font-semibold text-slate-900">
                      {formatMoney(
                        rate.amount,
                      )}
                    </p>

                    <p className="text-sm text-slate-600">
                      {formatDate(
                        rate.valid_from,
                      )}
                    </p>

                    <p className="text-sm text-slate-600">
                      {rate.valid_to
                        ? formatDate(
                            rate.valid_to,
                          )
                        : "Sin finalización"}
                    </p>
                  </div>
                ),
              )}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}