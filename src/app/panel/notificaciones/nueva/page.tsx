import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createNotification,
} from "@/app/panel/notificaciones/actions";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  canSendNotifications,
} from "@/lib/auth/permissions";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
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
  ).format(
    new Date(),
  );
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
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

function getSingleRelation<T>(
  value:
    | T
    | T[]
    | null,
): T | null {
  if (
    Array.isArray(value)
  ) {
    return value[0] ?? null;
  }

  return value;
}

export default async function NewNotificationPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
    !canSendNotifications(
      context.role,
    )
  ) {
    redirect(
      "/panel/notificaciones",
    );
  }

  const query =
    await searchParams;

  const supabase =
    createAdminClient();

  const today =
    getToday();

  const [
    activitiesResult,
    reservationsResult,
  ] =
    await Promise.all([
      supabase
        .from(
          "activities",
        )
        .select(`
          id,
          name
        `)
        .eq(
          "organization_id",
          context.organizationId,
        )
        .eq(
          "club_id",
          context.clubId,
        )
        .order(
          "name",
          {
            ascending: true,
          },
        ),

      supabase
        .from(
          "space_reservations",
        )
        .select(`
          id,
          reservation_code,
          reservation_date,
          start_time,
          customer_name,
          status,

          club_spaces (
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
        .gte(
          "reservation_date",
          today,
        )
        .in(
          "status",
          [
            "pending",
            "confirmed",
          ],
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
        ),
    ]);

  if (
    activitiesResult.error
  ) {
    throw new Error(
      `No fue posible cargar las actividades: ${activitiesResult.error.message}`,
    );
  }

  if (
    reservationsResult.error
  ) {
    throw new Error(
      `No fue posible cargar las reservas: ${reservationsResult.error.message}`,
    );
  }

  const activities =
    activitiesResult.data ??
    [];

  const reservations =
    reservationsResult.data ??
    [];

  return (
    <div>
      <Link
        href="/panel/notificaciones"
        className="text-sm font-semibold text-blue-700"
      >
        ← Volver a notificaciones
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Nueva notificación
        </h1>

        <p className="mt-3 max-w-3xl text-slate-600">
          Enviá información a una
          actividad, a una reserva
          específica o a todas las
          personas activas del club.
        </p>
      </div>

      {query.error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {query.error}
        </div>
      ) : null}

      <form
        action={
          createNotification
        }
        className="mt-8 space-y-8"
      >
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Destinatarios
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Elegí a qué grupo está
            dirigida la comunicación.
            ClubSmart resolverá
            automáticamente las personas.
          </p>

          <div className="mt-6">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Tipo de destinatario *
              </span>

              <select
                name="audience_type"
                required
                defaultValue="activity"
                className="input mt-2"
              >
                <option value="activity">
                  Participantes de una actividad
                </option>

                <option value="reservation">
                  Persona de una reserva
                </option>

                <option value="all_members">
                  Todas las personas del club
                </option>
              </select>
            </label>
          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">
            <label>
              <span className="text-sm font-medium text-slate-700">
                Actividad
              </span>

              <select
                name="activity_id"
                defaultValue=""
                className="input mt-2"
              >
                <option value="">
                  Seleccionar actividad
                </option>

                {activities.map(
                  (
                    activity,
                  ) => (
                    <option
                      key={
                        activity.id
                      }
                      value={
                        activity.id
                      }
                    >
                      {
                        activity.name
                      }
                    </option>
                  ),
                )}
              </select>

              <span className="mt-2 block text-xs text-slate-500">
                Completalo solamente si
                elegiste participantes de
                una actividad.
              </span>
            </label>

            <label>
              <span className="text-sm font-medium text-slate-700">
                Reserva
              </span>

              <select
                name="reservation_id"
                defaultValue=""
                className="input mt-2"
              >
                <option value="">
                  Seleccionar reserva
                </option>

                {reservations.map(
                  (
                    reservation,
                  ) => {
                    const space =
                      getSingleRelation(
                        reservation.club_spaces,
                      );

                    return (
                      <option
                        key={
                          reservation.id
                        }
                        value={
                          reservation.id
                        }
                      >
                        {formatDate(
                          reservation.reservation_date,
                        )}
                        {" · "}
                        {formatTime(
                          reservation.start_time,
                        )}
                        {" · "}
                        {space?.name ??
                          "Espacio"}
                        {" · "}
                        {
                          reservation.customer_name
                        }
                      </option>
                    );
                  },
                )}
              </select>

              <span className="mt-2 block text-xs text-slate-500">
                Completalo solamente si
                elegiste una reserva.
              </span>
            </label>
          </div>

          <div className="mt-6 rounded-xl bg-blue-50 p-4 text-sm leading-6 text-blue-900">
            Para una notificación general,
            no hace falta seleccionar
            actividad ni reserva.
          </div>
        </section>

        <section className="rounded-2xl border border-blue-200 bg-blue-50 p-6">
  <div className="flex gap-4">
    <div className="text-2xl">
      🔔
    </div>

    <div>
      <h2 className="font-bold text-slate-900">
        Notificación ClubSmart
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-700">
        La comunicación quedará
        registrada para las personas
        seleccionadas.
      </p>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        Cuando esté disponible la app
        de ClubSmart, estas
        notificaciones aparecerán en
        la bandeja personal y podrán
        generar avisos push en el
        celular.
      </p>
    </div>
  </div>
</section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Mensaje
          </h2>

          <div className="mt-6 space-y-5">
            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Título *
              </span>

              <input
                name="title"
                type="text"
                minLength={3}
                maxLength={120}
                required
                placeholder="Ej.: Cambio de horario"
                className="input mt-2"
              />
            </label>

            <label className="block">
              <span className="text-sm font-medium text-slate-700">
                Mensaje *
              </span>

              <textarea
                name="body"
                rows={7}
                minLength={3}
                maxLength={3000}
                required
                placeholder="Escribí el mensaje que recibirán las personas..."
                className="input mt-2 resize-y"
              />
            </label>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="rounded-xl bg-blue-600 px-7 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Publicar notificación
          </button>

          <Link
            href="/panel/notificaciones"
            className="rounded-xl border border-slate-300 bg-white px-7 py-3 font-semibold text-slate-700 transition hover:bg-slate-100"
          >
            Cancelar
          </Link>
        </div>
      </form>
    </div>
  );
}