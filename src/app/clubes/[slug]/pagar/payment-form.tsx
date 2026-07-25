"use client";

import { useActionState } from "react";

import {
  createPaymentPreference,
  type PublicPaymentState,
} from "@/app/clubes/[slug]/pagar/actions";

type PaymentFormProps = {
  clubSlug: string;
  activityId: string;
  activityName: string;
  amount: number;
};

const initialState: PublicPaymentState = {
  error: null,
};

function formatMoney(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

export function PaymentForm({
  clubSlug,
  activityId,
  activityName,
  amount,
}: PaymentFormProps) {
  const [state, formAction, pending] =
    useActionState(
      createPaymentPreference,
      initialState,
    );

  return (
    <form
      action={formAction}
      className="space-y-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
    >
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
          Importe vigente
        </p>

        <p className="mt-1 text-3xl font-bold text-slate-900">
          {formatMoney(amount)}
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
        className="w-full rounded-lg bg-sky-500 px-6 py-4 font-semibold text-white transition hover:bg-sky-600 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Conectando con Mercado Pago..."
          : "Pagar con Mercado Pago"}
      </button>

      <p className="text-center text-xs text-slate-500">
        Serás redirigido al sitio seguro de
        Mercado Pago.
      </p>
    </form>
  );
}