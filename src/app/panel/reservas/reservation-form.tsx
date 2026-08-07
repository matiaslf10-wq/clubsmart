"use client";

import {
  useState,
} from "react";

import {
  useFormStatus,
} from "react-dom";

import type {
  ReservationSlot,
} from "@/lib/reservations/availability";

type MemberOption = {
  id: string;
  first_name: string;
  last_name: string;
  dni: string | null;
};

type ReservationFormProps = {
  action: (
    formData: FormData,
  ) => void | Promise<void>;

  spaceId: string;
  selectedDate: string;

  slots:
    ReservationSlot[];

  members:
    MemberOption[];

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

export function ReservationForm({
  action,
  spaceId,
  selectedDate,
  slots,
  members,
  price,
  requiresDeposit,
  depositType,
  depositValue,
}: ReservationFormProps) {
  const [
    participantType,
    setParticipantType,
  ] = useState<
    "member" | "external"
  >("member");

  let depositAmount = 0;

  if (requiresDeposit) {
    if (
      depositType ===
      "percentage"
    ) {
      depositAmount =
        price *
        (depositValue / 100);
    } else if (
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
        name="space_id"
        value={spaceId}
      />

      <input
        type="hidden"
        name="selected_date"
        value={selectedDate}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Turno
        </h2>

        {slots.length === 0 ? (
          <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
            No quedan turnos disponibles para
            esta fecha.
          </p>
        ) : (
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
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

                  <span className="font-semibold text-slate-900">
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
          Persona
        </h2>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              setParticipantType(
                "member",
              )
            }
            className={
              participantType ===
              "member"
                ? "rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                : "rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
            }
          >
            Persona registrada
          </button>

          <button
            type="button"
            onClick={() =>
              setParticipantType(
                "external",
              )
            }
            className={
              participantType ===
              "external"
                ? "rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white"
                : "rounded-lg border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
            }
          >
            Persona externa
          </button>
        </div>

        <div className="mt-6">
          {participantType ===
          "member" ? (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Persona
              </span>

              <select
                name="member_id"
                required
                className="input mt-2"
                defaultValue=""
              >
                <option
                  value=""
                  disabled
                >
                  Seleccionar persona
                </option>

                {members.map(
                  (member) => (
                    <option
                      key={
                        member.id
                      }
                      value={
                        member.id
                      }
                    >
                      {
                        member.last_name
                      }
                      ,{" "}
                      {
                        member.first_name
                      }
                      {member.dni
                        ? ` · DNI ${member.dni}`
                        : ""}
                    </option>
                  ),
                )}
              </select>
            </label>
          ) : (
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Nombre y apellido
              </span>

              <input
                type="text"
                name="customer_name"
                required
                minLength={2}
                className="input mt-2"
                placeholder="Nombre de quien reserva"
              />
            </label>
          )}
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2">
          <label>
            <span className="text-sm font-medium text-slate-700">
              Teléfono
            </span>

            <input
              type="text"
              name="customer_phone"
              className="input mt-2"
              placeholder="Opcional"
            />
          </label>

          <label>
            <span className="text-sm font-medium text-slate-700">
              Correo
            </span>

            <input
              type="email"
              name="customer_email"
              className="input mt-2"
              placeholder="Opcional"
            />
          </label>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Importe
        </h2>

        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-slate-500">
              Precio de la reserva
            </dt>

            <dd className="mt-1 text-xl font-bold text-slate-900">
              {price > 0
                ? formatMoney(
                    price,
                  )
                : "Sin cargo"}
            </dd>
          </div>

          {requiresDeposit ? (
            <div>
              <dt className="text-sm text-slate-500">
                Seña requerida
              </dt>

              <dd className="mt-1 text-xl font-bold text-slate-900">
                {formatMoney(
                  depositAmount,
                )}
              </dd>

              <p className="mt-1 text-xs text-slate-500">
                {depositType ===
                "percentage"
                  ? `${depositValue} % del total`
                  : "Importe fijo"}
              </p>
            </div>
          ) : null}
        </dl>

        {requiresDeposit ? (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Por ahora la seña queda registrada
            como pendiente. El pago se incorporará
            en la siguiente etapa.
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <label>
          <span className="font-semibold text-slate-900">
            Observaciones
          </span>

          <textarea
            name="notes"
            rows={4}
            className="input mt-3 resize-y"
            placeholder="Información adicional de la reserva"
          />
        </label>
      </section>

      <div className="flex justify-end">
        <SubmitButton
          disabled={
            slots.length === 0
          }
        />
      </div>
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
      className="rounded-lg bg-blue-600 px-7 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending
        ? "Creando reserva..."
        : "Crear reserva"}
    </button>
  );
}