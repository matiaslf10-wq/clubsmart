"use client";

import { useActionState } from "react";

import {
  processPublicPayment,
  type PublicPaymentState,
} from "@/app/clubes/[slug]/pagar/actions";

type PaymentFormProps = {
  clubSlug: string;
  activityId: string;
  activityName: string;
  amount: number;
};

const initialState: PublicPaymentState = {
  step: "identify",
  error: null,
  notice: null,
  memberName: null,
  dni: "",
  email: "",
  fees: [],
  providers: [],
};

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin vencimiento";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
  ).format(
    new Date(
      `${value}T12:00:00.000Z`,
    ),
  );
}

export function PaymentForm({
  clubSlug,
  activityId,
  activityName,
  amount,
}: PaymentFormProps) {
  const [state, formAction, pending] =
    useActionState(
      processPublicPayment,
      initialState,
    );

  const fees = state.fees ?? [];
  const providers =
    state.providers ?? [];

  if (state.step === "choose") {
    return (
      <form
        action={formAction}
        className="space-y-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
      >
        <input
          type="hidden"
          name="intent"
          value="pay"
        />

        <input
          type="hidden"
          name="club_slug"
          value={clubSlug}
        />

        <input
          type="hidden"
          name="activity_id"
          value={activityId}
        />

        <input
          type="hidden"
          name="dni"
          value={state.dni}
        />

        <input
          type="hidden"
          name="email"
          value={state.email}
        />

        <div className="rounded-xl bg-slate-50 p-5">
          <p className="text-sm text-slate-500">
            Participante
          </p>

          <p className="mt-1 text-lg font-semibold text-slate-900">
            {state.memberName}
          </p>

          <p className="mt-4 text-sm text-slate-500">
            Actividad
          </p>

          <p className="mt-1 font-semibold text-slate-900">
            {activityName}
          </p>
        </div>

        <div>
          <label
            htmlFor="monthly_fee_id"
            className="text-sm font-medium text-slate-700"
          >
            Cuota a pagar
          </label>

          <select
            id="monthly_fee_id"
            name="monthly_fee_id"
            required
            defaultValue={
              fees[0]?.id ?? ""
            }
            className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          >
            {fees.map((fee) => (
              <option
                key={fee.id}
                value={fee.id}
              >
                {
                  monthNames[
                    fee.month - 1
                  ]
                }{" "}
                {fee.year} —{" "}
                {formatMoney(
                  fee.remainingAmount,
                )}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-3">
          {fees.map((fee) => (
            <div
              key={fee.id}
              className="rounded-xl border border-slate-200 p-4"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-slate-900">
                    {
                      monthNames[
                        fee.month - 1
                      ]
                    }{" "}
                    {fee.year}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    Vencimiento:{" "}
                    {formatDate(
                      fee.dueDate,
                    )}
                  </p>
                </div>

                <div className="sm:text-right">
                  <p className="text-sm text-slate-500">
                    Saldo pendiente
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {formatMoney(
                      fee.remainingAmount,
                    )}
                  </p>

                  {fee.paidAmount > 0 ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Pagado anteriormente:{" "}
                      {formatMoney(
                        fee.paidAmount,
                      )}
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>

        {state.notice ? (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            {state.notice}
          </div>
        ) : null}

        {state.error ? (
          <div
            role="alert"
            className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            {state.error}
          </div>
        ) : null}

        {providers.length > 0 ? (
          <div>
            <p className="text-sm font-medium text-slate-700">
              Elegí cómo pagar
            </p>

            <div className="mt-3 space-y-3">
              {providers.map(
                (provider) => (
                  <button
                    key={provider.id}
                    type="submit"
                    name="provider"
                    value={provider.id}
                    disabled={pending}
                    className={
                      provider.id ===
                      "pagotic"
                        ? "w-full rounded-xl bg-indigo-700 px-6 py-4 text-left font-semibold text-white transition hover:bg-indigo-800 disabled:cursor-not-allowed disabled:opacity-50"
                        : "w-full rounded-xl bg-sky-500 px-6 py-4 text-left font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
                    }
                  >
                    <span className="block">
                      {pending
                        ? "Iniciando operación..."
                        : provider.label}
                    </span>

                    <span className="mt-1 block text-sm font-normal text-white/80">
                      {provider.description}
                    </span>
                  </button>
                ),
              )}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            <p className="font-semibold">
              No hay medios de pago disponibles
            </p>

            <p className="mt-2 text-sm leading-6">
              El club todavía no tiene un
              proveedor electrónico habilitado
              y configurado para mensualidades.
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() =>
            window.location.reload()
          }
          className="w-full rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Cambiar DNI o correo
        </button>
      </form>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
    >
      <input
        type="hidden"
        name="intent"
        value="identify"
      />

      <input
        type="hidden"
        name="club_slug"
        value={clubSlug}
      />

      <input
        type="hidden"
        name="activity_id"
        value={activityId}
      />

      <div className="rounded-xl bg-slate-50 p-5">
        <p className="text-sm text-slate-500">
          Actividad
        </p>

        <p className="mt-1 text-lg font-semibold text-slate-900">
          {activityName}
        </p>

        <p className="mt-4 text-sm text-slate-500">
          Tarifa mensual de referencia
        </p>

        <p className="mt-1 text-3xl font-bold text-slate-900">
          {formatMoney(amount)}
        </p>

        <p className="mt-2 text-xs leading-5 text-slate-500">
          El importe definitivo será el saldo de
          la cuota mensual seleccionada.
        </p>
      </div>

      <div>
        <label
          htmlFor="dni"
          className="text-sm font-medium text-slate-700"
        >
          DNI del jugador o participante
        </label>

        <input
          id="dni"
          name="dni"
          inputMode="numeric"
          required
          minLength={7}
          maxLength={8}
          autoComplete="off"
          defaultValue={state.dni}
          placeholder="Sin puntos"
          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />

        <p className="mt-2 text-sm text-slate-500">
          Se verificará que la persona esté
          inscripta en esta actividad.
        </p>
      </div>

      <div>
        <label
          htmlFor="email"
          className="text-sm font-medium text-slate-700"
        >
          Correo electrónico
        </label>

        <input
          id="email"
          name="email"
          type="email"
          required
          autoComplete="email"
          defaultValue={state.email}
          placeholder="correo@ejemplo.com"
          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      {state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
        >
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Consultando cuotas..."
          : "Consultar cuotas pendientes"}
      </button>
    </form>
  );
}