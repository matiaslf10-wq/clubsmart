import Link from "next/link";
import { redirect } from "next/navigation";

import {
  createAdhesionInvitation,
  revokeAdhesionInvitation,
} from "@/app/panel/pagos/adhesiones/actions";
import { CopyLinkButton } from "@/app/panel/pagos/adhesiones/copy-link-button";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  searchParams: Promise<{
    estado?: string;
    actividad?: string;
    buscar?: string;
    error?: string;
    success?: string;
    link?: string;
  }>;
};

type Subscription = {
  id: string;
  member_id: string;
  activity_id: string;
  provider: string;
  status: string;
  provider_subscription_id:
    | string
    | null;
  external_reference:
    | string
    | null;
  created_at: string;
  updated_at: string;
};

type Invitation = {
  id: string;
  member_id: string;
  activity_id: string;
  status: string;
  token_last_characters: string;
  expires_at: string;
  used_at: string | null;
  revoked_at: string | null;
  created_at: string;
};

type MemberActivity = {
  id: string;
  member_id: string;
  activity_id: string;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  dni: string;
  active: boolean;
};

type Activity = {
  id: string;
  name: string;
};

type PagoTicConfiguration = {
  enabled: boolean;
  connection_status: string;
  automatic_debit_enabled: boolean;
  merchant_account_id: string | null;
};

export const dynamic =
  "force-dynamic";

function formatDate(
  value: string | null,
) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone:
        "America/Argentina/Buenos_Aires",
    },
  ).format(new Date(value));
}

function normalizeSearch(
  value: string,
) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(
      /[\u0300-\u036f]/g,
      "",
    )
    .trim();
}

function getStatusContent(
  status: string,
) {
  if (status === "active") {
    return {
      label: "Activa",
      className:
        "bg-green-100 text-green-800",
    };
  }

  if (status === "pending") {
    return {
      label: "Pendiente",
      className:
        "bg-amber-100 text-amber-800",
    };
  }

  if (status === "paused") {
    return {
      label: "Pausada",
      className:
        "bg-slate-200 text-slate-700",
    };
  }

  if (
    status === "cancelled" ||
    status === "revoked"
  ) {
    return {
      label: "Cancelada",
      className:
        "bg-red-100 text-red-800",
    };
  }

  if (status === "error") {
    return {
      label: "Con error",
      className:
        "bg-red-100 text-red-800",
    };
  }

  return {
    label: status,
    className:
      "bg-slate-100 text-slate-700",
  };
}

function getInvitationStatus(
  invitation: Invitation,
) {
  if (
    invitation.status === "active" &&
    new Date(
      invitation.expires_at,
    ).getTime() < Date.now()
  ) {
    return {
      value: "expired",
      label: "Vencida",
      className:
        "bg-slate-200 text-slate-700",
    };
  }

  if (
    invitation.status === "active"
  ) {
    return {
      value: "active",
      label: "Vigente",
      className:
        "bg-blue-100 text-blue-800",
    };
  }

  if (
    invitation.status === "used"
  ) {
    return {
      value: "used",
      label: "Utilizada",
      className:
        "bg-green-100 text-green-800",
    };
  }

  return {
    value: "revoked",
    label: "Revocada",
    className:
      "bg-red-100 text-red-800",
  };
}

export default async function AdhesionsPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  const parameters =
    await searchParams;

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel");
  }

  const selectedStatus =
    parameters.estado ?? "todos";

  const selectedActivity =
    parameters.actividad ?? "";

  const search =
    normalizeSearch(
      parameters.buscar ?? "",
    );

  const supabase =
    createAdminClient();

  const [
    subscriptionsResult,
    invitationsResult,
    relationshipsResult,
    configurationResult,
  ] = await Promise.all([
    supabase
      .from("payment_subscriptions")
      .select(`
        id,
        member_id,
        activity_id,
        provider,
        status,
        provider_subscription_id,
        external_reference,
        created_at,
        updated_at
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq("provider", "pagotic")
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from(
        "payment_subscription_invitations",
      )
      .select(`
        id,
        member_id,
        activity_id,
        status,
        token_last_characters,
        expires_at,
        used_at,
        revoked_at,
        created_at
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .order("created_at", {
        ascending: false,
      })
      .limit(30),

    supabase
      .from("member_activities")
      .select(`
        id,
        member_id,
        activity_id
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq("active", true),

    supabase
      .from("club_payment_providers")
      .select(`
        enabled,
        connection_status,
        automatic_debit_enabled,
        merchant_account_id
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq("provider", "pagotic")
      .maybeSingle(),
  ]);

  if (subscriptionsResult.error) {
    throw new Error(
      `No fue posible cargar las adhesiones: ${subscriptionsResult.error.message}`,
    );
  }

  if (invitationsResult.error) {
    throw new Error(
      `No fue posible cargar las invitaciones: ${invitationsResult.error.message}`,
    );
  }

  if (relationshipsResult.error) {
    throw new Error(
      `No fue posible cargar las inscripciones: ${relationshipsResult.error.message}`,
    );
  }

  const subscriptions =
    (
      subscriptionsResult.data ??
      []
    ) as Subscription[];

  const invitations =
    (
      invitationsResult.data ??
      []
    ) as Invitation[];

  const relationships =
    (
      relationshipsResult.data ??
      []
    ) as MemberActivity[];

  const pagoTicConfiguration =
    configurationResult.data as
      | PagoTicConfiguration
      | null;

  const pagoTicReady =
    Boolean(
      pagoTicConfiguration?.enabled &&
        pagoTicConfiguration
          .connection_status ===
          "active" &&
        pagoTicConfiguration
          .automatic_debit_enabled &&
        pagoTicConfiguration
          .merchant_account_id,
    );

  const memberIds =
    Array.from(
      new Set([
        ...subscriptions.map(
          (item) => item.member_id,
        ),

        ...invitations.map(
          (item) => item.member_id,
        ),

        ...relationships.map(
          (item) => item.member_id,
        ),
      ]),
    );

  const activityIds =
    Array.from(
      new Set([
        ...subscriptions.map(
          (item) =>
            item.activity_id,
        ),

        ...invitations.map(
          (item) =>
            item.activity_id,
        ),

        ...relationships.map(
          (item) =>
            item.activity_id,
        ),
      ]),
    );

  const [
    membersResult,
    activitiesResult,
  ] = await Promise.all([
    memberIds.length > 0
      ? supabase
          .from("members")
          .select(`
            id,
            first_name,
            last_name,
            dni,
            active
          `)
          .in("id", memberIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),

    activityIds.length > 0
      ? supabase
          .from("activities")
          .select(`
            id,
            name
          `)
          .in("id", activityIds)
      : Promise.resolve({
          data: [],
          error: null,
        }),
  ]);

  if (membersResult.error) {
    throw new Error(
      `No fue posible cargar las personas: ${membersResult.error.message}`,
    );
  }

  if (activitiesResult.error) {
    throw new Error(
      `No fue posible cargar las actividades: ${activitiesResult.error.message}`,
    );
  }

  const members =
    (membersResult.data ??
      []) as Member[];

  const activities =
    (activitiesResult.data ??
      []) as Activity[];

  const memberById =
    new Map(
      members.map((member) => [
        member.id,
        member,
      ]),
    );

  const activityById =
    new Map(
      activities.map(
        (activity) => [
          activity.id,
          activity,
        ],
      ),
    );

  const filteredSubscriptions =
    subscriptions.filter(
      (subscription) => {
        if (
          selectedStatus !==
            "todos" &&
          subscription.status !==
            selectedStatus
        ) {
          return false;
        }

        if (
          selectedActivity &&
          subscription.activity_id !==
            selectedActivity
        ) {
          return false;
        }

        if (!search) {
          return true;
        }

        const member =
          memberById.get(
            subscription.member_id,
          );

        const activity =
          activityById.get(
            subscription.activity_id,
          );

        const searchableText =
          normalizeSearch(
            [
              member?.first_name,
              member?.last_name,
              member?.dni,
              activity?.name,
            ]
              .filter(Boolean)
              .join(" "),
          );

        return searchableText.includes(
          search,
        );
      },
    );

  const activeCount =
    subscriptions.filter(
      (item) =>
        item.status === "active",
    ).length;

  const pendingCount =
    subscriptions.filter(
      (item) =>
        item.status === "pending",
    ).length;

  const pausedCount =
    subscriptions.filter(
      (item) =>
        item.status === "paused",
    ).length;

  const problemCount =
    subscriptions.filter(
      (item) =>
        item.status === "error" ||
        item.status ===
          "cancelled",
    ).length;

  const relationshipOptions =
    relationships
      .map((relationship) => {
        const member =
          memberById.get(
            relationship.member_id,
          );

        const activity =
          activityById.get(
            relationship.activity_id,
          );

        if (
          !member ||
          !member.active ||
          !activity
        ) {
          return null;
        }

        return {
          value:
            `${member.id}|${activity.id}`,

          label:
            `${member.last_name}, ${member.first_name}` +
            ` — DNI ${member.dni}` +
            ` — ${activity.name}`,
        };
      })
      .filter(
        (
          item,
        ): item is {
          value: string;
          label: string;
        } => Boolean(item),
      )
      .sort((first, second) =>
        first.label.localeCompare(
          second.label,
          "es",
        ),
      );

  return (
    <div>
      <Link
        href="/panel"
        className="text-sm font-semibold text-blue-700 hover:text-blue-800"
      >
        ← Volver al panel
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Adhesiones a débito automático
        </h1>

        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          Consultá las adhesiones de Pago TIC y
          generá invitaciones para jugadores,
          participantes o responsables.
        </p>
      </div>

      {parameters.error ? (
        <div className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          {parameters.error}
        </div>
      ) : null}

      {parameters.success ? (
        <div className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800">
          {parameters.success}
        </div>
      ) : null}

      {parameters.link ? (
        <section className="mt-6 rounded-2xl border border-green-300 bg-green-50 p-6">
          <h2 className="font-bold text-green-950">
            Enlace de adhesión generado
          </h2>

          <p className="mt-2 text-sm leading-6 text-green-900">
            Este enlace se muestra una sola vez.
            Copialo y envialo a la persona por
            WhatsApp, correo u otro canal seguro.
          </p>

          <div className="mt-4 rounded-lg border border-green-200 bg-white p-4 font-mono text-sm text-slate-800 break-all">
            {parameters.link}
          </div>

          <div className="mt-4">
            <CopyLinkButton
              link={parameters.link}
            />
          </div>
        </section>
      ) : null}

      {!pagoTicReady ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h2 className="font-semibold text-amber-950">
            Pago TIC todavía no está listo
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            Para generar invitaciones debe estar
            activo, tener Collector ID y estar
            habilitado para débito automático.
          </p>

          <Link
            href="/panel/pagos/configuracion"
            className="mt-4 inline-flex rounded-lg bg-amber-800 px-5 py-3 font-semibold text-white"
          >
            Configurar Pago TIC
          </Link>
        </section>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Activas"
          value={activeCount}
        />

        <SummaryCard
          label="Pendientes"
          value={pendingCount}
        />

        <SummaryCard
          label="Pausadas"
          value={pausedCount}
        />

        <SummaryCard
          label="Con inconvenientes"
          value={problemCount}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Generar invitación
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Seleccioná una inscripción activa. La
          persona recibirá un enlace individual
          y temporal.
        </p>

        <form
          action={createAdhesionInvitation}
          className="mt-6 grid gap-5 lg:grid-cols-[1fr_180px_auto]"
        >
          <div>
            <label
              htmlFor="member_activity"
              className="text-sm font-medium text-slate-700"
            >
              Persona y actividad
            </label>

            <select
              id="member_activity"
              name="member_activity"
              required
              disabled={!pagoTicReady}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 disabled:bg-slate-100"
            >
              <option value="">
                Seleccionar
              </option>

              {relationshipOptions.map(
                (option) => (
                  <option
                    key={option.value}
                    value={option.value}
                  >
                    {option.label}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="expiration_days"
              className="text-sm font-medium text-slate-700"
            >
              Vigencia
            </label>

            <select
              id="expiration_days"
              name="expiration_days"
              defaultValue="7"
              disabled={!pagoTicReady}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 disabled:bg-slate-100"
            >
              <option value="3">
                3 días
              </option>

              <option value="7">
                7 días
              </option>

              <option value="14">
                14 días
              </option>

              <option value="30">
                30 días
              </option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={
                !pagoTicReady ||
                relationshipOptions.length ===
                  0
              }
              className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generar enlace
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Buscar adhesiones
        </h2>

        <form className="mt-6 grid gap-4 md:grid-cols-3">
          <input
            name="buscar"
            defaultValue={
              parameters.buscar ?? ""
            }
            placeholder="Nombre, apellido o DNI"
            className="rounded-lg border border-slate-300 px-4 py-3"
          />

          <select
            name="actividad"
            defaultValue={
              selectedActivity
            }
            className="rounded-lg border border-slate-300 bg-white px-4 py-3"
          >
            <option value="">
              Todas las actividades
            </option>

            {activities
              .slice()
              .sort((first, second) =>
                first.name.localeCompare(
                  second.name,
                  "es",
                ),
              )
              .map((activity) => (
                <option
                  key={activity.id}
                  value={activity.id}
                >
                  {activity.name}
                </option>
              ))}
          </select>

          <select
            name="estado"
            defaultValue={
              selectedStatus
            }
            className="rounded-lg border border-slate-300 bg-white px-4 py-3"
          >
            <option value="todos">
              Todos los estados
            </option>

            <option value="pending">
              Pendientes
            </option>

            <option value="active">
              Activas
            </option>

            <option value="paused">
              Pausadas
            </option>

            <option value="cancelled">
              Canceladas
            </option>

            <option value="error">
              Con error
            </option>
          </select>

          <div className="flex gap-3 md:col-span-3">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
            >
              Filtrar
            </button>

            <Link
              href="/panel/pagos/adhesiones"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-7 py-5">
          <h2 className="text-xl font-bold text-slate-900">
            Adhesiones
          </h2>
        </div>

        {filteredSubscriptions.length ===
        0 ? (
          <div className="p-8 text-center text-slate-600">
            No se encontraron adhesiones con
            estos filtros.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredSubscriptions.map(
              (subscription) => {
                const member =
                  memberById.get(
                    subscription.member_id,
                  );

                const activity =
                  activityById.get(
                    subscription.activity_id,
                  );

                const status =
                  getStatusContent(
                    subscription.status,
                  );

                return (
                  <article
                    key={subscription.id}
                    className="p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {member
                            ? `${member.last_name}, ${member.first_name}`
                            : "Persona no disponible"}
                        </h3>

                        <p className="mt-1 text-sm text-slate-500">
                          DNI{" "}
                          {member?.dni ??
                            "—"}
                        </p>

                        <p className="mt-2 font-medium text-slate-700">
                          {activity?.name ??
                            "Actividad no disponible"}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">
                          ID de Pago TIC
                        </dt>

                        <dd className="mt-1 break-all font-mono text-xs text-slate-800">
                          {subscription
                            .provider_subscription_id ??
                            "Todavía no asignado"}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">
                          Creada
                        </dt>

                        <dd className="mt-1 font-medium text-slate-800">
                          {formatDate(
                            subscription.created_at,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-7 py-5">
          <h2 className="text-xl font-bold text-slate-900">
            Invitaciones recientes
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Por seguridad, el enlace completo no
            puede recuperarse después de salir de
            la pantalla en la que fue generado.
          </p>
        </div>

        {invitations.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            Todavía no se generaron
            invitaciones.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {invitations.map(
              (invitation) => {
                const member =
                  memberById.get(
                    invitation.member_id,
                  );

                const activity =
                  activityById.get(
                    invitation.activity_id,
                  );

                const status =
                  getInvitationStatus(
                    invitation,
                  );

                const revokeAction =
                  revokeAdhesionInvitation.bind(
                    null,
                    invitation.id,
                  );

                return (
                  <article
                    key={invitation.id}
                    className="p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-bold text-slate-900">
                          {member
                            ? `${member.last_name}, ${member.first_name}`
                            : "Persona no disponible"}
                        </h3>

                        <p className="mt-1 text-sm text-slate-600">
                          {activity?.name ??
                            "Actividad no disponible"}
                        </p>

                        <p className="mt-2 font-mono text-xs text-slate-500">
                          Token terminado en{" "}
                          {
                            invitation.token_last_characters
                          }
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </div>

                    <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                      <dl className="grid gap-3 text-sm sm:grid-cols-2">
                        <div>
                          <dt className="text-slate-500">
                            Generada
                          </dt>

                          <dd className="mt-1 font-medium text-slate-800">
                            {formatDate(
                              invitation.created_at,
                            )}
                          </dd>
                        </div>

                        <div>
                          <dt className="text-slate-500">
                            Vence
                          </dt>

                          <dd className="mt-1 font-medium text-slate-800">
                            {formatDate(
                              invitation.expires_at,
                            )}
                          </dd>
                        </div>
                      </dl>

                      {status.value ===
                      "active" ? (
                        <form
                          action={
                            revokeAction
                          }
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                          >
                            Revocar
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </article>
                );
              },
            )}
          </div>
        )}
      </section>
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold text-slate-900">
        {value}
      </p>
    </article>
  );
}