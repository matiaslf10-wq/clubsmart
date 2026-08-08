"use client";

import {
  useFormStatus,
} from "react-dom";

type Props = {
  action: (
    formData: FormData,
  ) => void | Promise<void>;

  remainingAmount: number;
};

function formatMoney(
  value: number,
) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    },
  ).format(value);
}

export function ReservationPaymentForm({
  action,
  remainingAmount,
}: Props) {
  return (
    <form
      action={action}
      className="space-y-5"
    >
      <div className="rounded-xl bg-blue-50 p-4">
        <p className="text-sm text-blue-800">
          Saldo pendiente
        </p>

        <p className="mt-1 text-2xl font-bold text-blue-950">
          {formatMoney(
            remainingAmount,
          )}
        </p>
      </div>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Importe *
        </span>

        <input
          name="amount"
          type="number"
          min="0.01"
          max={
            remainingAmount
          }
          step="0.01"
          defaultValue={
            remainingAmount
          }
          required
          className="input mt-2"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Medio de pago *
        </span>

        <select
          name="payment_method"
          required
          defaultValue="transfer"
          className="input mt-2"
        >
          <option value="cash">
            Efectivo
          </option>

          <option value="transfer">
            Transferencia
          </option>

          <option value="debit_card">
            Tarjeta de débito
          </option>

          <option value="credit_card">
            Tarjeta de crédito
          </option>

          <option value="mercado_pago">
            Mercado Pago
          </option>

          <option value="pagotic">
            Pago TIC
          </option>

          <option value="other">
            Otro
          </option>
        </select>
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Referencia o comprobante
        </span>

        <input
          name="external_reference"
          type="text"
          className="input mt-2"
          placeholder="Número de transferencia, operación, etc."
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium text-slate-700">
          Observaciones
        </span>

        <textarea
          name="notes"
          rows={3}
          className="input mt-2 resize-y"
        />
      </label>

      <SubmitButton />
    </form>
  );
}

function SubmitButton() {
  const { pending } =
    useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "Registrando..."
        : "Registrar pago"}
    </button>
  );
}