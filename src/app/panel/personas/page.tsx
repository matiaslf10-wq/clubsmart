import Link from "next/link";

import { MemberStatusButton } from "@/app/panel/personas/member-status-button";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  estado?: string;
  buscar?: string;
}>;

type PageProps = {
  searchParams: SearchParams;
};

export const dynamic = "force-dynamic";

function formatDni(value: string | null) {
  if (!value) {
    return "Sin DNI";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat("es-AR").format(
    numericValue,
  );
}

function sanitizeSearch(value: string) {
  return value
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export default async function MembersPage({
  searchParams,
}: PageProps) {
  const context = await getAdminContext();
  const params = await searchParams;

  const status =
    params.estado === "inactivos"
      ? "inactivos"
      : params.estado === "todos"
        ? "todos"
        : "activos";

  const search = sanitizeSearch(
    params.buscar ?? "",
  );

  const supabase = await createClient();

  let query = supabase
    .from("members")
    .select(`
      id,
      first_name,
      last_name,
      dni,
      guardian_name,
      email,
      phone,
      active,
      member_activities (
        id,
        activity_id,
        active,
        activities (
          id,
          name
        )
      )
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .order("last_name")
    .order("first_name");

  if (status === "activos") {
    query = query.eq("active", true);
  }

  if (status === "inactivos") {
    query = query.eq("active", false);
  }

  if (search) {
    query = query.or(
      `first_name.ilike.%${search}%,last_name.ilike.%${search}%,dni.ilike.%${search}%`,
    );
  }

  const { data, error } = await query;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-900">
          No fue posible cargar las personas
        </h1>

        <p className="mt-3 text-red-800">
          {error.message}
        </p>
      </div>
    );
  }

  const members = data ?? [];

  const activeCount = members.filter(
    (member) => member.active,
  ).length;

  const inactiveCount = members.filter(
    (member) => !member.active,
  ).length;

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Personas
          </h1>

          <p className="mt-3 text-slate-600">
            Administrá jugadores, participantes
            y sus actividades.
          </p>
        </div>

        <Link
          href="/panel/personas/nueva"
          className="inline-flex justify-center rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Nueva persona
        </Link>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Mostradas
          </p>

          <p className="mt-2 text-3xl font-bold">
            {members.length}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Activas
          </p>

          <p className="mt-2 text-3xl font-bold text-green-700">
            {activeCount}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Inactivas
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-500">
            {inactiveCount}
          </p>
        </div>
      </div>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <form
          method="get"
          className="grid gap-4 md:grid-cols-[1fr_auto_auto]"
        >
          <div>
            <label
              htmlFor="buscar"
              className="text-sm font-medium text-slate-700"
            >
              Buscar
            </label>

            <input
              id="buscar"
              name="buscar"
              defaultValue={search}
              placeholder="Nombre, apellido o DNI"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="estado"
              className="text-sm font-medium text-slate-700"
            >
              Estado
            </label>

            <select
              id="estado"
              name="estado"
              defaultValue={status}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              <option value="activos">
                Activas
              </option>

              <option value="inactivos">
                Inactivas
              </option>

              <option value="todos">
                Todas
              </option>
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Aplicar filtros
            </button>
          </div>
        </form>
      </section>

      {members.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-xl font-semibold">
            No hay personas para mostrar
          </h2>

          <p className="mt-3 text-slate-600">
            Cambiá los filtros o cargá una nueva
            persona.
          </p>
        </section>
      ) : (
        <section className="mt-6 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.5fr_1fr_1.2fr_0.8fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-600 lg:grid">
            <span>Persona</span>
            <span>DNI</span>
            <span>Actividad</span>
            <span>Estado</span>
            <span />
          </div>

          <div className="divide-y divide-slate-200">
            {members.map((member) => {
              const activeRelation =
                member.member_activities.find(
                  (relation) =>
                    relation.active,
                );

              const activityValue =
                activeRelation?.activities;

              const activity = Array.isArray(
                activityValue,
              )
                ? activityValue[0]
                : activityValue;

              const memberName =
                `${member.first_name} ${member.last_name}`;

              return (
                <article
                  key={member.id}
                  className="grid gap-4 px-6 py-5 lg:grid-cols-[1.5fr_1fr_1.2fr_0.8fr_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {memberName}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {member.guardian_name
                        ? `Responsable: ${member.guardian_name}`
                        : member.email ||
                          member.phone ||
                          "Sin contacto cargado"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 lg:hidden">
                      DNI
                    </p>

                    <p className="mt-1 text-sm lg:mt-0">
                      {formatDni(member.dni)}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 lg:hidden">
                      Actividad
                    </p>

                    <p className="mt-1 text-sm lg:mt-0">
                      {activity?.name ??
                        (member.active
                          ? "Sin actividad"
                          : "Actividad finalizada")}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 lg:hidden">
                      Estado
                    </p>

                    <span
                      className={
                        member.active
                          ? "mt-1 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 lg:mt-0"
                          : "mt-1 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 lg:mt-0"
                      }
                    >
                      {member.active
                        ? "Activa"
                        : "Inactiva"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/panel/personas/${member.id}/editar`}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Editar
                    </Link>

                    <MemberStatusButton
                      memberId={member.id}
                      memberName={memberName}
                      active={member.active}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}