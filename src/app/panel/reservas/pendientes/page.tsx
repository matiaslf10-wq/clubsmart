import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  confirmReservation,
  rejectReservation,
} from "@/app/panel/reservas/actions";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  canManageReservations,
  canViewReservations,
} from "@/lib/auth/permissions";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
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

  customer_phone:
    | string
    | null;

  customer_email:
    | string
    | null;

  amount:
    | number
    | string;

  deposit_amount:
    | number
    | string;

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

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      weekday: "short",
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      `${value}T12:00:00Z`,
    ),
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
  ).format(
    new Date(),
  );
}

export default async function PendingReservationsPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
  !canViewReservations(
    context.role,
  )
) {
  redirect("/panel");
}

const canManage =
  canManageReservations(
    context.role,
  );

  const parameters =
    await searchParams;

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
      customer_phone,
      customer_email,
      amount,
      deposit_amount,
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
    .eq(
      "status",
      "pending",
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
      `No fue posible cargar las solicitudes pendientes: ${error.message}`,
    );
  }

  const reservations =
    (data ??
      []) as unknown as Reservation[];

  const today =
    getToday();

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <Link
            href="/panel/reservas"
            className="text-sm font-semibold text-blue-700"
          >
            ← Volver a reservas
          </Link>

          <p className="mt-6 text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Solicitudes pendientes
          </h1>

          <p className="mt-3 text-slate-600">
            Reservas que todavía requieren
            confirmación del club.
          </p>
        </div>

        {reservations.length >
        0 ? (
          <div className="rounded-2xl bg-red-50 px-6 py-4 text-center">
            <p className="text-3xl font-bold text-red-700">
              {
                reservations.length
              }
            </p>

            <p className="mt-1 text-sm font-semibold text-red-800">
              pendientes
            </p>
          </div>
        ) : null}
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

      {reservations.length ===
      0 ? (
        <section className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-10 text-center">
          <div className="text-4xl">
            ✓
          </div>

          <h2 className="mt-4 text-xl font-bold text-green-950">
            No hay solicitudes pendientes
          </h2>

          <p className="mt-2 text-green-800">
            Todas las reservas fueron
            revisadas.
          </p>
        </section>
      ) : (
        <section className="mt-8 space-y-4">
          {reservations.map(
            (
              reservation,
            ) => {
              const space =
                getSingleRelation(
                  reservation.club_spaces,
                );

              const isPast =
                reservation.reservation_date <
                today;

              const nextDay =
                reservation.reservation_date !==
                reservation.reservation_end_date;

              return (
                <article
                  key={
                    reservation.id
                  }
                  className={
                    isPast
                      ? "rounded-2xl border border-red-300 bg-red-50 p-6 shadow-sm"
                      : "rounded-2xl border border-amber-200 bg-white p-6 shadow-sm"
                  }
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                          Requiere confirmación
                        </span>

                        {reservation.source ===
                        "public" ? (
                          <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                            Solicitud web
                          </span>
                        ) : null}

                        {isPast ? (
                          <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
                            Fecha vencida
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-4 text-xl font-bold text-slate-900">
                        {
                          reservation.customer_name
                        }
                      </h2>

                      <p className="mt-1 font-medium text-slate-600">
                        {space?.name ??
                          "Espacio"}
                      </p>

                      <p className="mt-3 font-semibold capitalize text-slate-900">
                        {formatDate(
                          reservation.reservation_date,
                        )}
                      </p>

                      <p className="mt-1 text-xl font-bold text-slate-900">
                        {formatTime(
                          reservation.start_time,
                        )}
                        {" – "}
                        {formatTime(
                          reservation.end_time,
                        )}
                      </p>

                      {nextDay ? (
                        <p className="mt-1 text-xs font-semibold text-blue-700">
                          Finaliza al día siguiente
                        </p>
                      ) : null}
                    </div>

                    <div className="text-left lg:text-right">
                      <p className="text-xs text-slate-500">
                        Código
                      </p>

                      <p className="mt-1 font-mono text-sm font-semibold text-slate-800">
                        {
                          reservation.reservation_code
                        }
                      </p>
                    </div>
                  </div>

                  <dl className="mt-6 grid gap-4 border-t border-slate-200 pt-5 sm:grid-cols-2 lg:grid-cols-4">
                    {reservation.customer_phone ? (
                      <div>
                        <dt className="text-xs text-slate-500">
                          Teléfono
                        </dt>

                        <dd className="mt-1 font-medium text-slate-900">
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

                        <dd className="mt-1 break-all font-medium text-slate-900">
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

                        <dd className="mt-1 font-semibold text-slate-900">
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

                        <dd className="mt-1 font-semibold text-slate-900">
                          {formatMoney(
                            reservation.deposit_amount,
                          )}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {reservation.notes ? (
                    <div className="mt-5 rounded-xl bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase text-slate-500">
                        Observaciones
                      </p>

                      <p className="mt-2 text-sm text-slate-700">
                        {
                          reservation.notes
                        }
                      </p>
                    </div>
                  ) : null}

                  <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
  {canManage ? (
    <>
      {!isPast ? (
        <form
          action={confirmReservation.bind(
            null,
            reservation.id,
            reservation.reservation_date,
            "pendientes",
          )}
        >
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
          >
            Confirmar
          </button>
        </form>
      ) : null}

      <form
        action={rejectReservation.bind(
          null,
          reservation.id,
          reservation.reservation_date,
          "pendientes",
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

  <Link
    href={`/panel/reservas?fecha=${reservation.reservation_date}&vista=dia`}
    className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
  >
    Ver día
  </Link>

  <Link
    href={`/panel/reservas/${reservation.id}`}
    className="rounded-lg border border-blue-300 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
  >
    Ver detalle y pagos
  </Link>
</div>
                </article>
              );
            },
          )}
        </section>
      )}
    </div>
  );
}
