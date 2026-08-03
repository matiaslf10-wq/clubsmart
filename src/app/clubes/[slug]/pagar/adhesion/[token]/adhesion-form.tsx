"use client";

import { useActionState } from "react";

import {
  requestPagoTicAdhesion,
  type PublicAdhesionState,
} from "@/app/clubes/[slug]/pagar/adhesion/[token]/actions";

type AdhesionFormProps = {
  clubSlug: string;
  token: string;
};

const initialState: PublicAdhesionState = {
  error: null,
  success: false,
  message: null,
};

export function AdhesionForm({
  clubSlug,
  token,
}: AdhesionFormProps) {
  const [state, formAction, pending] =
    useActionState(
      requestPagoTicAdhesion,
      initialState,
    );

  if (state.success) {
    return (
      <div className="rounded-2xl border border-green-200 bg-green-50 p-6 text-green-900">
        <h2 className="text-xl font-bold">
          Solicitud registrada
        </h2>

        <p className="mt-3 leading-6">
          {state.message}
        </p>

        <p className="mt-3 text-sm leading-6">
          No es necesario crear un usuario ni
          una contraseña en ClubSmart.
        </p>
      </div>
    );
  }

  return (
    <form
      action={formAction}
      className="space-y-6"
    >
      <input
        type="hidden"
        name="club_slug"
        value={clubSlug}
      />

      <input
        type="hidden"
        name="token"
        value={token}
      />

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

        <p className="mt-2 text-xs leading-5 text-slate-500">
          Se utilizará para identificar la
          solicitud y enviar comunicaciones
          relacionadas con el cobro.
        </p>
      </div>

      <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
        <input
          name="accepted"
          type="checkbox"
          required
          className="mt-1 h-4 w-4 rounded border-blue-300"
        />

        <span>
          <span className="block text-sm font-semibold text-blue-950">
            Acepto solicitar la adhesión al
            débito automático
          </span>

          <span className="mt-1 block text-xs leading-5 text-blue-900">
            Autorizo a iniciar el proceso para
            que las futuras cuotas de esta
            actividad puedan ser debitadas
            mediante Pago TIC.
          </span>
        </span>
      </label>

      {state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
        >
          {state.error}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-lg bg-blue-600 px-6 py-4 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Registrando solicitud..."
          : "Solicitar adhesión"}
      </button>
    </form>
  );
}