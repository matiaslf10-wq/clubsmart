import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  canViewAudit,
} from "@/lib/auth/permissions";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    tipo?: string;
    buscar?: string;
  }>;
};

const entityTypes = [
  "all",
  "notification",
  "member",
  "reservation",
  "payment",
  "fee",
  "user",
  "activity",
  "space",
  "club",
] as const;

function sanitizeSearch(
  value: string,
) {
  return value
    .replace(
      /[%_,()]/g,
      " ",
    )
    .replace(
      /\s+/g,
      " ",
    )
    .trim()
    .slice(
      0,
      100,
    );
}

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",

      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",

      timeZone:
        "America/Argentina/Buenos_Aires",
    },
  ).format(
    new Date(value),
  );
}

function roleLabel(
  role:
    | string
    | null,
) {
  switch (role) {
    case "owner":
      return "Propietario";

    case "admin":
      return "Administrador";

    case "operator":
      return "Operador/Profesor";

    case "viewer":
      return "Solo lectura";

    default:
      return role ??
        "Sistema";
  }
}

function entityLabel(
  type: string,
) {
  switch (type) {
    case "notification":
      return "Notificación";

    case "member":
      return "Persona";

    case "reservation":
      return "Reserva";

    case "payment":
      return "Pago";

    case "fee":
      return "Cuota";

    case "user":
      return "Usuario";

    case "activity":
      return "Actividad";

    case "space":
      return "Espacio";

    case "club":
      return "Club";

    default:
      return type;
  }
}

export default async function AuditPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
    !canViewAudit(
      context.role,
    )
  ) {
    redirect(
      "/panel",
    );
  }

  const params =
    await searchParams;

  const requestedType =
    params.tipo ??
    "all";

  const type =
    entityTypes.includes(
      requestedType as
        (typeof entityTypes)[number],
    )
      ? requestedType
      : "all";

  const search =
    sanitizeSearch(
      params.buscar ??
        "",
    );

  const supabase =
    createAdminClient();

  let query =
    supabase
      .from(
        "audit_logs",
      )
      .select(`
        id,
        actor_type,
        actor_user_id,
        actor_email,
        actor_role,

        action,

        entity_type,
        entity_id,
        entity_label,

        summary,
        source,
        metadata,

        created_at
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
      )
      .limit(300);

  if (
    type !== "all"
  ) {
    query =
      query.eq(
        "entity_type",
        type,
      );
  }

  if (search) {
    query =
      query.or(
        [
          `summary.ilike.%${search}%`,
          `actor_email.ilike.%${search}%`,
          `entity_label.ilike.%${search}%`,
          `action.ilike.%${search}%`,
        ].join(","),
      );
  }

  const {
    data,
    error,
  } = await query;

  if (error) {
    throw new Error(
      `No fue posible cargar la auditoría: ${error.message}`,
    );
  }

  const logs =
    data ?? [];

  return (
    <div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Auditoría
        </h1>

        <p className="mt-3 max-w-3xl text-slate-600">
          Historial de acciones
          administrativas realizadas
          dentro del club.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          method="get"
          className="grid gap-4 lg:grid-cols-[1fr_240px_auto]"
        >
          <label>
            <span className="text-sm font-medium text-slate-700">
              Buscar
            </span>

            <input
              name="buscar"
              defaultValue={
                search
              }
              placeholder="Usuario, acción, persona, reserva..."
              className="input mt-2"
            />
          </label>

          <label>
            <span className="text-sm font-medium text-slate-700">
              Tipo
            </span>

            <select
              name="tipo"
              defaultValue={
                type
              }
              className="input mt-2"
            >
              <option value="all">
                Todos
              </option>

              <option value="notification">
                Notificaciones
              </option>

              <option value="member">
                Personas
              </option>

              <option value="reservation">
                Reservas
              </option>

              <option value="payment">
                Pagos
              </option>

              <option value="fee">
                Cuotas
              </option>

              <option value="user">
                Usuarios
              </option>

              <option value="activity">
                Actividades
              </option>

              <option value="space">
                Espacios
              </option>

              <option value="club">
                Club
              </option>
            </select>
          </label>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Aplicar
            </button>
          </div>
        </form>

        {search ||
        type !== "all" ? (
          <div className="mt-4">
            <Link
              href="/panel/auditoria"
              className="text-sm font-semibold text-blue-700"
            >
              Limpiar filtros
            </Link>
          </div>
        ) : null}
      </section>

      <div className="mt-6 flex items-center justify-between">
        <p className="text-sm text-slate-500">
          Mostrando hasta los
          últimos 300 registros.
        </p>

        <p className="text-sm font-semibold text-slate-700">
          {logs.length}{" "}
          {logs.length ===
          1
            ? "registro"
            : "registros"}
        </p>
      </div>

      {logs.length ===
      0 ? (
        <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <div className="text-4xl">
            📋
          </div>

          <h2 className="mt-4 text-xl font-bold">
            Todavía no hay registros
          </h2>

          <p className="mt-2 text-slate-600">
            Las acciones auditadas
            aparecerán acá.
          </p>
        </section>
      ) : (
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="divide-y divide-slate-200">
            {logs.map(
              (log) => (
                <article
                  key={
                    log.id
                  }
                  className="p-6"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:justify-between">
                    <div className="max-w-4xl">
                      <div className="flex flex-wrap gap-2">
                        <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                          {entityLabel(
                            log.entity_type,
                          )}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
                          {roleLabel(
                            log.actor_role,
                          )}
                        </span>

                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-mono text-slate-500">
                          {
                            log.action
                          }
                        </span>
                      </div>

                      <p className="mt-4 text-base font-semibold leading-7 text-slate-900">
                        {
                          log.summary
                        }
                      </p>

                      {log.entity_label ? (
                        <p className="mt-2 text-sm text-slate-600">
                          Objeto:{" "}
                          <strong>
                            {
                              log.entity_label
                            }
                          </strong>
                        </p>
                      ) : null}

                      <p className="mt-3 text-sm text-slate-500">
                        Usuario:{" "}
                        {log.actor_email ??
                          log.actor_user_id ??
                          "Sistema"}
                      </p>

                      {log.metadata &&
                      Object.keys(
                        log.metadata,
                      ).length >
                        0 ? (
                        <details className="mt-4">
                          <summary className="cursor-pointer text-sm font-semibold text-blue-700">
                            Ver detalle técnico
                          </summary>

                          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
                            {JSON.stringify(
                              log.metadata,
                              null,
                              2,
                            )}
                          </pre>
                        </details>
                      ) : null}
                    </div>

                    <div className="shrink-0 lg:text-right">
                      <p className="text-xs uppercase tracking-wide text-slate-400">
                        Fecha
                      </p>

                      <p className="mt-1 text-sm font-medium text-slate-700">
                        {formatDateTime(
                          log.created_at,
                        )}
                      </p>
                    </div>
                  </div>
                </article>
              ),
            )}
          </div>
        </section>
      )}
    </div>
  );
}