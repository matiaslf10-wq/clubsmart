import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  addDays,
} from "@/lib/reservations/availability";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    fecha?: string;
    success?: string;
    error?: string;
  }>;
};

type Reservation = {
  id: string;

  reservation_code: string;

  reservation_date: string;
  reservation_end_date: string;

  start_time: string;
  end_time: string;

  customer_name: string;

  customer_email:
    | string
    | null;

  customer_phone:
    | string
    | null;

  status: string;

  amount:
    | number
    | string;

  deposit_amount:
    | number
    | string;

  paid_amount:
    | number
    | string;

  payment_status: string;

  source: string;

  club_spaces:
    | {
        id: string;
        name: string;
      }
    | Array<{
        id: string;
        name: string;
      }>
    | null;
};

function getToday() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "America/Argentina/Buenos_Aires",

      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date());
}

function getSingleRelation<T>(
  value:
    | T
    | T[]
    | null,
) {
  if (
    Array.isArray(value)
  ) {
    return (
      value[0] ??
      null
    );
  }

  return value;
}

function formatTime(
  value: string,
) {
  return value.slice(
    0,
    5,
  );
}

function formatMoney(
  value:
    | number
    | string,
) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    },
  ).format(
    Number(value) || 0,
  );
}

function getStatus(
  value: string,
) {
  const values: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    pending: {
      label: "Pendiente",
      className:
        "bg-amber-100 text-amber-800",
    },

    confirmed: {
      label: "Confirmada",
      className:
        "bg-green-100 text-green-800",
    },

    rejected: {
      label: "Rechazada",
      className:
        "bg-red-100 text-red-800",
    },

    cancelled: {
      label: "Cancelada",
      className:
        "bg-slate-200 text-slate-700",
    },

    completed: {
      label: "Completada",
      className:
        "bg-blue-100 text-blue-800",
    },

    no_show: {
      label: "No asistió",
      className:
        "bg-red-100 text-red-800",
    },
  };

  return (
    values[value] ?? {
      label: value,
      className:
        "bg-slate-100 text-slate-700",
    }
  );
}

export default async function ReservationsPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel");
  }

  const parameters =
    await searchParams;

  const selectedDate =
    parameters.fecha &&
    /^\d{4}-\d{2}-\d{2}$/.test(
      parameters.fecha,
    )
      ? parameters.fecha
      : getToday();

  const previousDate =
    addDays(
      selectedDate,
      -1,
    );

  const nextDate =
    addDays(
      selectedDate,
      1,
    );

  const supabase =
    createAdminClient();

  const {
    data,
    error,
  } = await supabase
    .from(
      "space_reservations",
    )
    .select(`
      id,
      reservation_code,
      reservation_date,
      reservation_end_date,
      start_time,
      end_time,
      customer_name,
      customer_email,
      customer_phone,
      status,
      amount,
      deposit_amount,
      paid_amount,
      payment_status,
      source,

      club_spaces (
        id,
        name
      )
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .lte(
      "reservation_date",
      selectedDate,
    )
    .gte(
      "reservation_end_date",
      selectedDate,
    )
    .order(
      "start_time",
      {
        ascending: true,
      },
    );

  if (error) {
    throw new Error(
      `No fue posible cargar las reservas: ${error.message}`,
    );
  }

  const reservations =
    (data ??
      []) as unknown as Reservation[];

  const pending =
    reservations.filter(
      (reservation) =>
        reservation.status ===
        "pending",
    ).length;

  const confirmed =
    reservations.filter(
      (reservation) =>
        reservation.status ===
        "confirmed",
    ).length;

  const totalAmount =
    reservations
      .filter(
        (reservation) =>
          ![
            "rejected",
            "cancelled",
          ].includes(
            reservation.status,
          ),
      )
      .reduce(
        (
          total,
          reservation,
        ) =>
          total +
          Number(
            reservation.amount,
          ),
        0,
      );

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Reservas
          </h1>

          <p className="mt-3 text-slate-600">
            Consultá los turnos y registrá
            nuevas reservas de los espacios
            del club.
          </p>
        </div>

        <Link
          href={`/panel/reservas/nueva?fecha=${selectedDate}`}
          className="inline-flex justify-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Nueva reserva
        </Link>
      </div>

      {parameters.success ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800">
          {
            parameters.success
          }
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <label className="flex-1">
            <span className="text-sm font-medium text-slate-700">
              Fecha
            </span>

            <input
              type="date"
              name="fecha"
              defaultValue={
                selectedDate
              }
              className="input mt-2"
            />
          </label>

          <button
            type="submit"
            className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white"
          >
            Ver día
          </button>
        </form>

        <div className="mt-5 flex gap-3">
          <Link
            href={`/panel/reservas?fecha=${previousDate}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            ← Día anterior
          </Link>

          <Link
            href={`/panel/reservas?fecha=${nextDate}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
          >
            Día siguiente →
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Reservas"
          value={String(
            reservations.length,
          )}
        />

        <SummaryCard
          label="Pendientes / confirmadas"
          value={`${pending} / ${confirmed}`}
        />

        <SummaryCard
          label="Importe del día"
          value={formatMoney(
            totalAmount,
          )}
        />
      </section>

      {reservations.length ===
      0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            No hay reservas
          </h2>

          <p className="mt-3 text-slate-600">
            No hay turnos reservados para la
            fecha seleccionada.
          </p>

          <Link
            href={`/panel/reservas/nueva?fecha=${selectedDate}`}
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white"
          >
            Crear reserva
          </Link>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {reservations.map(
            (reservation) => {
              const space =
                getSingleRelation(
                  reservation.club_spaces,
                );

              const status =
                getStatus(
                  reservation.status,
                );

              const nextDay =
                reservation.reservation_date !==
                reservation.reservation_end_date;

              return (
                <article
                  key={
                    reservation.id
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {
                            status.label
                          }
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {
                            reservation.reservation_code
                          }
                        </span>
                      </div>

                      <h2 className="mt-4 text-xl font-bold text-slate-900">
                        {
                          reservation.customer_name
                        }
                      </h2>

                      <p className="mt-1 text-sm text-slate-600">
                        {space?.name ??
                          "Espacio no disponible"}
                      </p>
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-2xl font-bold text-slate-900">
                        {formatTime(
                          reservation.start_time,
                        )}
                        {" – "}
                        {formatTime(
                          reservation.end_time,
                        )}
                      </p>

                      {nextDay ? (
                        <p className="mt-1 text-xs font-medium text-blue-700">
                          Finaliza al día siguiente
                        </p>
                      ) : null}
                    </div>
                  </div>

                  <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                    {reservation.customer_phone ? (
                      <div>
                        <dt className="text-xs text-slate-500">
                          Teléfono
                        </dt>

                        <dd className="mt-1 text-sm font-medium">
                          {
                            reservation.customer_phone
                          }
                        </dd>
                      </div>
                    ) : null}

                    {reservation.customer_email ? (
                      <div>
                        <dt className="text-xs text-slate-500">
                          Correo
                        </dt>

                        <dd className="mt-1 text-sm font-medium">
                          {
                            reservation.customer_email
                          }
                        </dd>
                      </div>
                    ) : null}

                    {Number(
                      reservation.amount,
                    ) > 0 ? (
                      <div>
                        <dt className="text-xs text-slate-500">
                          Importe
                        </dt>

                        <dd className="mt-1 text-sm font-semibold">
                          {formatMoney(
                            reservation.amount,
                          )}
                        </dd>
                      </div>
                    ) : null}

                    {Number(
                      reservation.deposit_amount,
                    ) > 0 ? (
                      <div>
                        <dt className="text-xs text-slate-500">
                          Seña
                        </dt>

                        <dd className="mt-1 text-sm font-semibold">
                          {formatMoney(
                            reservation.deposit_amount,
                          )}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </article>
              );
            },
          )}
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </article>
  );
}