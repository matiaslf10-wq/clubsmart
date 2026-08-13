import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  canSendNotifications,
  canViewNotifications,
} from "@/lib/auth/permissions";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

type ActivityRelation = {
  name: string;
};

type ReservationRelation = {
  reservation_code: string;
  customer_name: string;
};

type NotificationRow = {
  id: string;

  audience_type: string;

  title: string;
  body: string;

  status: string;

  published_at:
    | string
    | null;

  created_at: string;

  activities:
    | ActivityRelation
    | ActivityRelation[]
    | null;

  space_reservations:
    | ReservationRelation
    | ReservationRelation[]
    | null;
};

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

function formatDateTime(
  value:
    | string
    | null,
) {
  if (!value) {
    return "";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",

      timeZone:
        "America/Argentina/Buenos_Aires",
    },
  ).format(
    new Date(value),
  );
}

function audienceLabel(
  notification:
    NotificationRow,
) {
  if (
    notification.audience_type ===
    "all_members"
  ) {
    return "Todo el club";
  }

  if (
    notification.audience_type ===
    "activity"
  ) {
    const activity =
      getSingleRelation(
        notification.activities,
      );

    return activity
      ? `Actividad · ${activity.name}`
      : "Actividad";
  }

  if (
    notification.audience_type ===
    "reservation"
  ) {
    const reservation =
      getSingleRelation(
        notification.space_reservations,
      );

    return reservation
      ? `Reserva · ${reservation.customer_name}`
      : "Reserva";
  }

  return "Destinatarios";
}

function audienceBadgeClass(
  audienceType: string,
) {
  if (
    audienceType ===
    "activity"
  ) {
    return "bg-blue-100 text-blue-800";
  }

  if (
    audienceType ===
    "reservation"
  ) {
    return "bg-violet-100 text-violet-800";
  }

  return "bg-green-100 text-green-800";
}

export default async function NotificationsPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
    !canViewNotifications(
      context.role,
    )
  ) {
    redirect("/panel");
  }

  const query =
    await searchParams;

  const canSend =
    canSendNotifications(
      context.role,
    );

  const supabase =
    createAdminClient();

  const {
    data:
      notificationsData,
    error:
      notificationsError,
  } = await supabase
    .from(
      "club_notifications",
    )
    .select(`
      id,
      audience_type,
      title,
      body,
      status,
      published_at,
      created_at,

      activities (
        name
      ),

      space_reservations (
        reservation_code,
        customer_name
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
    .order(
      "created_at",
      {
        ascending: false,
      },
    );

  if (
    notificationsError
  ) {
    throw new Error(
      `No fue posible cargar las notificaciones: ${notificationsError.message}`,
    );
  }

  const notifications =
    (
      notificationsData ??
      []
    ) as unknown as NotificationRow[];

  /*
   * Obtenemos los destinatarios por
   * separado para mostrar el total
   * real congelado al publicar.
   */
  const notificationIds =
    notifications.map(
      (
        notification,
      ) =>
        notification.id,
    );

  const recipientCounts =
    new Map<
      string,
      number
    >();

  if (
    notificationIds.length >
    0
  ) {
    const {
      data:
        recipientRows,
      error:
        recipientsError,
    } = await supabase
      .from(
        "club_notification_recipients",
      )
      .select(`
        notification_id
      `)
      .in(
        "notification_id",
        notificationIds,
      );

    if (
      recipientsError
    ) {
      throw new Error(
        `No fue posible cargar los destinatarios: ${recipientsError.message}`,
      );
    }

    for (
      const recipient of
        recipientRows ?? []
    ) {
      recipientCounts.set(
        recipient.notification_id,
        (
          recipientCounts.get(
            recipient.notification_id,
          ) ?? 0
        ) + 1,
      );
    }
  }

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Notificaciones
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Comunicaciones para
            actividades, reservas y
            personas del club.
          </p>
        </div>

        {canSend ? (
          <Link
            href="/panel/notificaciones/nueva"
            className="inline-flex rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Nueva notificación
          </Link>
        ) : null}
      </div>

      {query.success ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {query.success}
        </div>
      ) : null}

      {query.error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {query.error}
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <SummaryCard
          label="Publicadas"
          value={String(
            notifications.filter(
              (
                notification,
              ) =>
                notification.status ===
                "published",
            ).length,
          )}
        />

        <SummaryCard
          label="A actividades"
          value={String(
            notifications.filter(
              (
                notification,
              ) =>
                notification.audience_type ===
                "activity",
            ).length,
          )}
        />

        <SummaryCard
          label="Generales"
          value={String(
            notifications.filter(
              (
                notification,
              ) =>
                notification.audience_type ===
                "all_members",
            ).length,
          )}
        />
      </section>

      {notifications.length ===
      0 ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="text-4xl">
            🔔
          </div>

          <h2 className="mt-4 text-xl font-bold text-slate-900">
            Todavía no hay notificaciones
          </h2>

          <p className="mt-2 text-slate-600">
            Las comunicaciones publicadas
            aparecerán acá.
          </p>

          {canSend ? (
            <Link
              href="/panel/notificaciones/nueva"
              className="mt-6 inline-flex rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white"
            >
              Crear primera notificación
            </Link>
          ) : null}
        </section>
      ) : (
        <section className="mt-8 space-y-4">
          {notifications.map(
            (
              notification,
            ) => {
              const recipientCount =
                recipientCounts.get(
                  notification.id,
                ) ?? 0;

              const reservation =
                getSingleRelation(
                  notification.space_reservations,
                );

              return (
                <article
                  key={
                    notification.id
                  }
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div className="max-w-3xl">
                      <div className="flex flex-wrap gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${audienceBadgeClass(
                            notification.audience_type,
                          )}`}
                        >
                          {audienceLabel(
                            notification,
                          )}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                          {recipientCount}{" "}
                          {recipientCount ===
                          1
                            ? "destinatario"
                            : "destinatarios"}
                        </span>

                        {notification.status ===
                        "published" ? (
                          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                            Publicada
                          </span>
                        ) : null}
                      </div>

                      <h2 className="mt-4 text-xl font-bold text-slate-900">
                        {
                          notification.title
                        }
                      </h2>

                      <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
                        {
                          notification.body
                        }
                      </p>

                      {reservation ? (
                        <p className="mt-4 text-sm text-slate-500">
                          Reserva{" "}
                          {
                            reservation.reservation_code
                          }
                        </p>
                      ) : null}
                    </div>

                    <div className="shrink-0 lg:text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-500">
                        Publicada
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-900">
                        {formatDateTime(
                          notification.published_at ??
                            notification.created_at,
                        )}
                      </p>
                    </div>
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