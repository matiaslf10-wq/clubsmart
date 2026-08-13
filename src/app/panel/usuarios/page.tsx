import {
  redirect,
} from "next/navigation";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  canManageUsers,
} from "@/lib/auth/permissions";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  inviteOrganizationUser,
  removeOrganizationUser,
  updateOrganizationUserRole,
} from "@/app/panel/usuarios/actions";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

type MembershipRow = {
  user_id: string;
  role: string;
};

type TeamUser = {
  userId: string;

  email: string;

  role: string;

  emailConfirmed:
    boolean;

  lastSignInAt:
    string | null;

  createdAt:
    string | null;
};

const roleLabels:
  Record<string, string> = {
    owner:
      "Propietario",

    admin:
      "Administrador",

    operator:
      "Operador/Profesor",

    viewer:
      "Solo lectura",
  };

const roleDescriptions:
  Record<string, string> = {
    owner:
      "Control total del club.",

    admin:
      "Administración completa del club.",

    operator:
      "Gestiona actividades, personas, cobros, reservas y comunicaciones operativas.",

    viewer:
      "Puede consultar información pero no modificarla.",
  };

function roleOrder(
  role: string,
) {
  if (role === "owner") {
    return 0;
  }

  if (role === "admin") {
    return 1;
  }

  if (
    role ===
    "operator"
  ) {
    return 2;
  }

  return 3;
}

function formatDateTime(
  value:
    | string
    | null,
) {
  if (!value) {
    return "Nunca";
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

function roleBadgeClass(
  role: string,
) {
  if (role === "owner") {
    return "bg-violet-100 text-violet-800";
  }

  if (role === "admin") {
    return "bg-blue-100 text-blue-800";
  }

  if (
    role ===
    "operator"
  ) {
    return "bg-green-100 text-green-800";
  }

  return "bg-slate-100 text-slate-700";
}

export default async function UsersPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
    !canManageUsers(
      context.role,
    )
  ) {
    redirect("/panel");
  }

  const query =
    await searchParams;

  const supabase =
    createAdminClient();

  /*
   * Primero leemos únicamente
   * los usuarios asociados con
   * ESTA organización.
   */
  const {
    data:
      membershipsData,
    error:
      membershipsError,
  } = await supabase
    .from(
      "organization_users",
    )
    .select(`
      user_id,
      role
    `)
    .eq(
      "organization_id",
      context.organizationId,
    );

  if (
    membershipsError
  ) {
    throw new Error(
      `No fue posible cargar los usuarios del club: ${membershipsError.message}`,
    );
  }

  const memberships =
    (
      membershipsData ??
      []
    ) as MembershipRow[];

  /*
   * auth.users no se consulta
   * directamente desde el
   * navegador.
   *
   * Como esta página es Server
   * Component usamos Auth Admin
   * para obtener email y estado.
   */
  const users =
    await Promise.all(
      memberships.map(
        async (
          membership,
        ): Promise<TeamUser> => {
          const {
            data,
            error,
          } =
            await supabase.auth.admin.getUserById(
              membership.user_id,
            );

          if (
            error ||
            !data.user
          ) {
            return {
              userId:
                membership.user_id,

              email:
                "Usuario no disponible",

              role:
                membership.role,

              emailConfirmed:
                false,

              lastSignInAt:
                null,

              createdAt:
                null,
            };
          }

          return {
            userId:
              membership.user_id,

            email:
              data.user.email ??
              "Sin email",

            role:
              membership.role,

            emailConfirmed:
              Boolean(
                data.user
                  .email_confirmed_at,
              ),

            lastSignInAt:
              data.user
                .last_sign_in_at ??
              null,

            createdAt:
              data.user
                .created_at ??
              null,
          };
        },
      ),
    );

  users.sort(
    (
      first,
      second,
    ) => {
      const roleDifference =
        roleOrder(
          first.role,
        ) -
        roleOrder(
          second.role,
        );

      if (
        roleDifference !== 0
      ) {
        return roleDifference;
      }

      return first.email.localeCompare(
        second.email,
        "es",
      );
    },
  );

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Usuarios
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Administrá quién puede
            ingresar al panel y qué
            nivel de acceso tiene.
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
          <p className="text-sm text-slate-500">
            Usuarios con acceso
          </p>

          <p className="mt-1 text-3xl font-bold text-slate-900">
            {users.length}
          </p>
        </div>
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

      <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <RoleCard
          title="Propietario"
          description="Control total y propiedad administrativa del club."
        />

        <RoleCard
          title="Administrador"
          description="Gestiona configuración, usuarios y operaciones."
        />

        <RoleCard
  title="Operador/Profesor"
  description="Gestiona actividades, personas, reservas, cobros y comunicaciones operativas."
/>

        <RoleCard
          title="Solo lectura"
          description="Consulta información sin capacidad de modificarla."
        />
      </section>

      <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
  <div>
    <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
      Incorporar al equipo
    </p>

    <h2 className="mt-2 text-xl font-bold text-slate-900">
      Invitar usuario
    </h2>

    <p className="mt-2 text-sm leading-6 text-slate-600">
      La persona recibirá un correo
      para aceptar la invitación y
      crear su contraseña.
    </p>
  </div>

  <form
    action={
      inviteOrganizationUser
    }
    className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr_auto]"
  >
    <label>
      <span className="text-sm font-medium text-slate-700">
        Correo electrónico
      </span>

      <input
        name="email"
        type="email"
        required
        autoComplete="email"
        placeholder="persona@club.com"
        className="input mt-2"
      />
    </label>

    <label>
      <span className="text-sm font-medium text-slate-700">
        Rol
      </span>

      <select
        name="role"
        defaultValue="operator"
        required
        className="input mt-2"
      >
        <option value="admin">
          Administrador
        </option>

        <option value="operator">
  Operador/Profesor
</option>

        <option value="viewer">
          Solo lectura
        </option>
      </select>
    </label>

    <div className="flex items-end">
      <button
        type="submit"
        className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 lg:w-auto"
      >
        Enviar invitación
      </button>
    </div>
  </form>
</section>

      <section className="mt-8 space-y-4">
        {users.map(
          (user) => {
            const isCurrentUser =
              user.userId ===
              context.userId;

            const isOwner =
              user.role ===
              "owner";

            return (
              <article
                key={
                  user.userId
                }
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${roleBadgeClass(
                          user.role,
                        )}`}
                      >
                        {roleLabels[
                          user.role
                        ] ??
                          user.role}
                      </span>

                      {isCurrentUser ? (
                        <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-bold text-white">
                          Vos
                        </span>
                      ) : null}

                      {!user.emailConfirmed ? (
                        <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                          Email pendiente
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-4 text-lg font-bold text-slate-900">
                      {user.email}
                    </h2>

                    <p className="mt-2 text-sm text-slate-600">
                      {roleDescriptions[
                        user.role
                      ] ??
                        ""}
                    </p>

                    <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">
                          Último ingreso
                        </dt>

                        <dd className="mt-1 font-medium text-slate-900">
                          {formatDateTime(
                            user.lastSignInAt,
                          )}
                        </dd>
                      </div>

                      <div>
                        <dt className="text-slate-500">
                          Cuenta creada
                        </dt>

                        <dd className="mt-1 font-medium text-slate-900">
                          {formatDateTime(
                            user.createdAt,
                          )}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  {!isOwner &&
                  !isCurrentUser ? (
                    <div className="w-full xl:max-w-md">
                      <form
                        action={updateOrganizationUserRole.bind(
                          null,
                          user.userId,
                        )}
                        className="flex flex-col gap-3 sm:flex-row"
                      >
                        <label className="flex-1">
                          <span className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                            Rol
                          </span>

                          <select
                            name="role"
                            defaultValue={
                              user.role
                            }
                            className="input mt-2"
                          >
                            <option value="admin">
                              Administrador
                            </option>

                            <option value="operator">
                              Operador
                            </option>

                            <option value="viewer">
                              Solo lectura
                            </option>
                          </select>
                        </label>

                        <div className="flex items-end">
                          <button
                            type="submit"
                            className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                          >
                            Guardar rol
                          </button>
                        </div>
                      </form>

                      <div className="mt-4 border-t border-slate-200 pt-4">
                        <form
                          action={removeOrganizationUser.bind(
                            null,
                            user.userId,
                          )}
                        >
                          <button
                            type="submit"
                            className="text-sm font-semibold text-red-700 transition hover:text-red-900"
                          >
                            Quitar acceso al club
                          </button>
                        </form>
                      </div>
                    </div>
                  ) : null}

                  {isOwner ? (
                    <div className="rounded-xl bg-violet-50 p-4 text-sm text-violet-900 xl:max-w-sm">
                      La propiedad no puede
                      modificarse desde esta
                      pantalla.
                    </div>
                  ) : null}

                  {isCurrentUser &&
                  !isOwner ? (
                    <div className="rounded-xl bg-slate-50 p-4 text-sm text-slate-700 xl:max-w-sm">
                      Tu propio rol no puede
                      modificarse desde esta
                      pantalla.
                    </div>
                  ) : null}
                </div>
              </article>
            );
          },
        )}
      </section>
    </div>
  );
}

function RoleCard({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="font-bold text-slate-900">
        {title}
      </h2>

      <p className="mt-2 text-sm leading-6 text-slate-600">
        {description}
      </p>
    </article>
  );
}