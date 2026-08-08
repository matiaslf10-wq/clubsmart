"use client";

import {
  useFormStatus,
} from "react-dom";

import type {
  ReservationSlot,
} from "@/lib/reservations/availability";

type Props = {
  action: (
    formData: FormData,
  ) => void | Promise<void>;

  clubSlug: string;
  spaceSlug: string;
  selectedDate: string;

  slots:
    ReservationSlot[];

  price: number;

  requiresDeposit: boolean;
  depositType: string;
  depositValue: number;
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

export function PublicReservationForm({
  action,
  clubSlug,
  spaceSlug,
  selectedDate,
  slots,
  price,
  requiresDeposit,
  depositType,
  depositValue,
}: Props) {
  let depositAmount = 0;

  if (
    requiresDeposit
  ) {
    if (
      depositType ===
      "percentage"
    ) {
      depositAmount =
        price *
        (
          depositValue /
          100
        );
    }

    if (
      depositType ===
      "fixed"
    ) {
      depositAmount =
        depositValue;
    }
  }

  depositAmount =
    Math.min(
      depositAmount,
      price,
    );

  return (
    <form
      action={action}
      className="space-y-6"
    >
      <input
        type="hidden"
        name="club_slug"
        value={clubSlug}
      />

      <input
        type="hidden"
        name="space_slug"
        value={spaceSlug}
      />

      <input
        type="hidden"
        name="selected_date"
        value={selectedDate}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Elegí un turno
        </h2>

        {slots.length ===
        0 ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            No quedan turnos disponibles
            para esta fecha.
          </div>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {slots.map(
              (slot) => (
                <label
                  key={
                    slot.key
                  }
                  className="cursor-pointer rounded-xl border border-slate-200 p-4 transition has-[:checked]:border-blue-500 has-[:checked]:bg-blue-50"
                >
                  <input
                    type="radio"
                    name="slot"
                    value={
                      slot.key
                    }
                    required
                    className="mr-3"
                  />

                  <span className="font-semibold">
                    {
                      slot.label
                    }
                  </span>
                </label>
              ),
            )}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Tus datos
        </h2>

        <div className="mt-5 space-y-5">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Nombre y apellido *
            </span>

            <input
              name="customer_name"
              type="text"
              required
              minLength={2}
              autoComplete="name"
              className="input mt-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Teléfono *
            </span>

            <input
              name="customer_phone"
              type="tel"
              required
              autoComplete="tel"
              className="input mt-2"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">
              Correo
            </span>

            <input
              name="customer_email"
              type="email"
              autoComplete="email"
              className="input mt-2"
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
        </div>
      </section>

      {(price > 0 ||
        requiresDeposit) ? (
        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
          {price > 0 ? (
            <div>
              <p className="text-sm text-blue-800">
                Precio de la reserva
              </p>

              <p className="mt-1 text-2xl font-bold text-blue-950">
                {formatMoney(
                  price,
                )}
              </p>
            </div>
          ) : null}

          {requiresDeposit ? (
            <div className="mt-5 border-t border-blue-200 pt-5">
              <p className="text-sm text-blue-800">
                Seña requerida
              </p>

              <p className="mt-1 text-xl font-bold text-blue-950">
                {formatMoney(
                  depositAmount,
                )}
              </p>

              {depositType ===
              "percentage" ? (
                <p className="mt-1 text-xs text-blue-800">
                  {
                    depositValue
                  }{" "}
                  % del valor de la
                  reserva
                </p>
              ) : null}

              <p className="mt-3 text-sm leading-6 text-blue-900">
                El pago de la seña se
                incorporará en la siguiente
                etapa del sistema.
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <SubmitButton
        disabled={
          slots.length === 0
        }
      />
    </form>
  );
}

function SubmitButton({
  disabled,
}: {
  disabled: boolean;
}) {
  const { pending } =
    useFormStatus();

  return (
    <button
      type="submit"
      disabled={
        disabled ||
        pending
      }
      className="w-full rounded-xl bg-blue-600 px-7 py-4 text-lg font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "Registrando reserva..."
        : "Solicitar reserva"}
    </button>
  );
}