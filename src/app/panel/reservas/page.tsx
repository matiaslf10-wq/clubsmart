import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  cancelReservation,
  confirmReservation,
  rejectReservation,
} from "@/app/panel/reservas/actions";

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
    vista?: string;
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

  notes:
    | string
    | null;

  created_at: string;

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

type ViewMode =
  | "dia"
  | "semana";

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

function isValidDate(
  value: string,
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value,
  );
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
    return value[0] ?? null;
  }

  return value;
}

function dateObject(
  value: string,
) {
  return new Date(
    `${value}T12:00:00.000Z`,
  );
}

function getWeekStart(
  value: string,
) {
  const date =
    dateObject(value);

  const day =
    date.getUTCDay();

  const offset =
    day === 0
      ? -6
      : 1 - day;

  return addDays(
    value,
    offset,
  );
}

function formatShortDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    },
  ).format(
    dateObject(value),
  );
}

function formatLongDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    dateObject(value),
  );
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

function getPaymentStatus(
  value: string,
) {
  const values: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    unpaid: {
      label: "Sin pagar",
      className:
        "bg-slate-100 text-slate-700",
    },

    partial: {
      label: "Pago parcial",
      className:
        "bg-amber-100 text-amber-800",
    },

    paid: {
      label: "Pagada",
      className:
        "bg-green-100 text-green-800",
    },

    refunded: {
      label: "Reintegrada",
      className:
        "bg-violet-100 text-violet-800",
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

function reservationOccursOnDate(
  reservation: Reservation,
  date: string,
) {
  return (
    reservation.reservation_date <=
      date &&
    reservation.reservation_end_date >=
      date
  );
}

function reservationTimeForDate(
  reservation: Reservation,
  date: string,
) {
  if (
    reservation.reservation_date <
      date &&
    reservation.reservation_end_date ===
      date
  ) {
    return {
      label:
        `00:00–${formatTime(
          reservation.end_time,
        )}`,

      detail:
        "Viene del día anterior",
    };
  }

  if (
    reservation.reservation_date ===
      date &&
    reservation.reservation_end_date >
      date
  ) {
    return {
      label:
        `${formatTime(
          reservation.start_time,
        )}–${formatTime(
          reservation.end_time,
        )}`,

      detail:
        "Finaliza al día siguiente",
    };
  }

  return {
    label:
      `${formatTime(
        reservation.start_time,
      )}–${formatTime(
        reservation.end_time,
      )}`,

    detail: null,
  };
}

function sortReservationsForDate(
  reservations: Reservation[],
  date: string,
) {
  return [
    ...reservations,
  ].sort(
    (first, second) => {
      const firstTime =
        first.reservation_date <
        date
          ? "00:00"
          : first.start_time;

      const secondTime =
        second.reservation_date <
        date
          ? "00:00"
          : second.start_time;

      return firstTime.localeCompare(
        secondTime,
      );
    },
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
    isValidDate(
      parameters.fecha,
    )
      ? parameters.fecha
      : getToday();

  const view: ViewMode =
    parameters.vista ===
    "semana"
      ? "semana"
      : "dia";

  const rangeStart =
    view === "semana"
      ? getWeekStart(
          selectedDate,
        )
      : selectedDate;

  const rangeEnd =
    view === "semana"
      ? addDays(
          rangeStart,
          6,
        )
      : selectedDate;

  const previousDate =
    view === "semana"
      ? addDays(
          rangeStart,
          -7,
        )
      : addDays(
          selectedDate,
          -1,
        );

  const nextDate =
    view === "semana"
      ? addDays(
          rangeStart,
          7,
        )
      : addDays(
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
      notes,
      created_at,

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
      rangeEnd,
    )
    .gte(
      "reservation_end_date",
      rangeStart,
    )
    .order(
      "reservation_date",
      {
        ascending: true,
      },
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

  const pendingCount =
    reservations.filter(
      (reservation) =>
        reservation.status ===
        "pending",
    ).length;

  const confirmedCount =
    reservations.filter(
      (reservation) =>
        reservation.status ===
        "confirmed",
    ).length;

  const activeAmount =
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

  const weekDays =
    view === "semana"
      ? Array.from(
          {
            length: 7,
          },
          (_, index) =>
            addDays(
              rangeStart,
              index,
            ),
        )
      : [];

  const dailyReservations =
    sortReservationsForDate(
      reservations.filter(
        (reservation) =>
          reservationOccursOnDate(
            reservation,
            selectedDate,
          ),
      ),
      selectedDate,
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

          <p className="mt-3 max-w-3xl text-slate-600">
            Administrá los turnos de los
            espacios del club y controlá
            reservas pendientes,
            confirmadas y canceladas.
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
        <div
          role="status"
          className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {
            parameters.success
          }
        </div>
      ) : null}

      {parameters.error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {
            parameters.error
          }
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <input
              type="hidden"
              name="vista"
              value={view}
            />

            <label>
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
              className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Ir a fecha
            </button>
          </form>

          <div className="inline-flex rounded-lg border border-slate-300 bg-slate-50 p-1">
            <Link
              href={`/panel/reservas?fecha=${selectedDate}&vista=dia`}
              className={
                view === "dia"
                  ? "rounded-md bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm"
                  : "rounded-md px-4 py-2 text-sm font-semibold text-slate-600"
              }
            >
              Día
            </Link>

            <Link
              href={`/panel/reservas?fecha=${selectedDate}&vista=semana`}
              className={
                view === "semana"
                  ? "rounded-md bg-white px-4 py-2 text-sm font-semibold text-blue-700 shadow-sm"
                  : "rounded-md px-4 py-2 text-sm font-semibold text-slate-600"
              }
            >
              Semana
            </Link>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
          <Link
            href={`/panel/reservas?fecha=${previousDate}&vista=${view}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            ←{" "}
            {view ===
            "semana"
              ? "Semana anterior"
              : "Día anterior"}
          </Link>

          <p className="text-center font-semibold capitalize text-slate-900">
            {view === "dia"
              ? formatLongDate(
                  selectedDate,
                )
              : `${formatShortDate(
                  rangeStart,
                )} – ${formatShortDate(
                  rangeEnd,
                )}`}
          </p>

          <Link
            href={`/panel/reservas?fecha=${nextDate}&vista=${view}`}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            {view ===
            "semana"
              ? "Semana siguiente"
              : "Día siguiente"}{" "}
            →
          </Link>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label={
            view === "dia"
              ? "Reservas del día"
              : "Reservas de la semana"
          }
          value={String(
            view === "dia"
              ? dailyReservations.length
              : reservations.length,
          )}
        />

        <SummaryCard
          label="Pendientes"
          value={String(
            pendingCount,
          )}
        />

        <SummaryCard
          label="Confirmadas"
          value={String(
            confirmedCount,
          )}
        />

        <SummaryCard
          label="Importe reservado"
          value={formatMoney(
            activeAmount,
          )}
        />
      </section>

      {view === "dia" ? (
        <DailyView
          reservations={
            dailyReservations
          }
          selectedDate={
            selectedDate
          }
        />
      ) : (
        <WeeklyView
          reservations={
            reservations
          }
          weekDays={
            weekDays
          }
        />
      )}
    </div>
  );
}

function DailyView({
  reservations,
  selectedDate,
}: {
  reservations:
    Reservation[];

  selectedDate: string;
}) {
  if (
    reservations.length === 0
  ) {
    return (
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          No hay reservas
        </h2>

        <p className="mt-3 text-slate-600">
          No hay turnos reservados para
          este día.
        </p>

        <Link
          href={`/panel/reservas/nueva?fecha=${selectedDate}`}
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white"
        >
          Crear reserva
        </Link>
      </section>
    );
  }

  return (
    <section className="mt-6 space-y-4">
      {reservations.map(
        (reservation) => (
          <ReservationCard
            key={
              reservation.id
            }
            reservation={
              reservation
            }
            selectedDate={
              selectedDate
            }
          />
        ),
      )}
    </section>
  );
}

function ReservationCard({
  reservation,
  selectedDate,
}: {
  reservation: Reservation;
  selectedDate: string;
}) {
  const space =
    getSingleRelation(
      reservation.club_spaces,
    );

  const status =
    getStatus(
      reservation.status,
    );

  const paymentStatus =
    getPaymentStatus(
      reservation.payment_status,
    );

  const time =
    reservationTimeForDate(
      reservation,
      selectedDate,
    );

  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${paymentStatus.className}`}
            >
              {
                paymentStatus.label
              }
            </span>

            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
              {
                reservation.reservation_code
              }
            </span>

            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
              {reservation.source ===
              "public"
                ? "Web"
                : "Panel"}
            </span>
          </div>

          <h2 className="mt-4 text-xl font-bold text-slate-900">
            {
              reservation.customer_name
            }
          </h2>

          <p className="mt-1 font-medium text-slate-600">
            {space?.name ??
              "Espacio no disponible"}
          </p>
        </div>

        <div className="text-left lg:text-right">
          <p className="text-2xl font-bold text-slate-900">
            {time.label}
          </p>

          {time.detail ? (
            <p className="mt-1 text-xs font-semibold text-blue-700">
              {time.detail}
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

            <dd className="mt-1 text-sm font-medium text-slate-900">
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

            <dd className="mt-1 break-all text-sm font-medium text-slate-900">
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

            <dd className="mt-1 text-sm font-semibold text-slate-900">
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
              Seña requerida
            </dt>

            <dd className="mt-1 text-sm font-semibold text-slate-900">
              {formatMoney(
                reservation.deposit_amount,
              )}
            </dd>
          </div>
        ) : null}
      </dl>

      {reservation.notes ? (
        <div className="mt-5 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
            Observaciones
          </p>

          <p className="mt-2 text-sm leading-6 text-slate-700">
            {
              reservation.notes
            }
          </p>
        </div>
      ) : null}

      <ReservationActions
        reservation={
          reservation
        }
        returnDate={
          selectedDate
        }
        view="dia"
      />
    </article>
  );
}

function WeeklyView({
  reservations,
  weekDays,
}: {
  reservations:
    Reservation[];

  weekDays: string[];
}) {
  return (
    <section className="mt-6 overflow-x-auto">
      <div className="grid min-w-[1050px] grid-cols-7 gap-3">
        {weekDays.map(
          (day) => {
            const dayReservations =
              sortReservationsForDate(
                reservations.filter(
                  (
                    reservation,
                  ) =>
                    reservationOccursOnDate(
                      reservation,
                      day,
                    ),
                ),
                day,
              );

            return (
              <div
                key={day}
                className="min-h-[420px] rounded-2xl border border-slate-200 bg-slate-50"
              >
                <div className="border-b border-slate-200 bg-white p-4">
                  <Link
                    href={`/panel/reservas?fecha=${day}&vista=dia`}
                    className="font-bold capitalize text-slate-900 transition hover:text-blue-700"
                  >
                    {formatShortDate(
                      day,
                    )}
                  </Link>

                  <p className="mt-1 text-xs text-slate-500">
                    {
                      dayReservations.length
                    }{" "}
                    {dayReservations.length ===
                    1
                      ? "reserva"
                      : "reservas"}
                  </p>
                </div>

                <div className="space-y-3 p-3">
                  {dayReservations.length ===
                  0 ? (
                    <div className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-xs text-slate-500">
                      Sin reservas
                    </div>
                  ) : (
                    dayReservations.map(
                      (
                        reservation,
                      ) => {
                        const space =
                          getSingleRelation(
                            reservation.club_spaces,
                          );

                        const status =
                          getStatus(
                            reservation.status,
                          );

                        const time =
                          reservationTimeForDate(
                            reservation,
                            day,
                          );

                        return (
                          <article
                            key={
                              reservation.id
                            }
                            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                          >
                            <p className="text-sm font-bold text-slate-900">
                              {
                                time.label
                              }
                            </p>

                            {time.detail ? (
                              <p className="mt-1 text-[11px] font-medium text-blue-700">
                                {
                                  time.detail
                                }
                              </p>
                            ) : null}

                            <p className="mt-2 text-sm font-semibold text-slate-800">
                              {
                                reservation.customer_name
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-500">
                              {space?.name ??
                                "Espacio"}
                            </p>

                            <span
                              className={`mt-3 inline-flex rounded-full px-2.5 py-1 text-[11px] font-semibold ${status.className}`}
                            >
                              {
                                status.label
                              }
                            </span>
                          </article>
                        );
                      },
                    )
                  )}
                </div>
              </div>
            );
          },
        )}
      </div>
    </section>
  );
}

function ReservationActions({
  reservation,
  returnDate,
  view,
}: {
  reservation:
    Reservation;

  returnDate: string;

  view:
    | "dia"
    | "semana";
}) {
  if (
    ![
      "pending",
      "confirmed",
    ].includes(
      reservation.status,
    )
  ) {
    return null;
  }

  return (
    <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
      {reservation.status ===
      "pending" ? (
        <>
          <form
            action={confirmReservation.bind(
              null,
              reservation.id,
              returnDate,
              view,
            )}
          >
            <button
              type="submit"
              className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              Confirmar
            </button>
          </form>

          <form
            action={rejectReservation.bind(
              null,
              reservation.id,
              returnDate,
              view,
            )}
          >
            <button
              type="submit"
              className="rounded-lg border border-red-300 bg-white px-5 py-2.5 text-sm font-semibold text-red-700 transition hover:bg-red-50"
            >
              Rechazar
            </button>
          </form>
        </>
      ) : null}

      <form
        action={cancelReservation.bind(
          null,
          reservation.id,
          returnDate,
          view,
        )}
      >
        <button
          type="submit"
          className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
        >
          Cancelar reserva
        </button>
      </form>
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