import Link from "next/link";
import { notFound } from "next/navigation";

import {
  deactivateEnrollment,
  reactivateEnrollment,
} from "@/app/panel/actividades/[id]/inscriptos/actions";

import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageActivities } from "@/lib/auth/permissions";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type Relation = {
  id: string;
  member_id: string;
  active: boolean;
  start_date: string | null;
  end_date: string | null;
};

type Member = {
  id: string;
  first_name: string;
  last_name: string;
  dni: string | null;
  active: boolean;
};

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-AR").format(
    new Date(`${value}T00:00:00`),
  );
}

export default async function ActivityEnrollmentsPage({
  params,
}: PageProps) {
  const { id } = await params;

  const context = await getAdminContext();
  const supabase = createAdminClient();

  const { data: activity, error: activityError } =
    await supabase
      .from("activities")
      .select("id, name, active")
      .eq("id", id)
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .maybeSingle();

  if (activityError) {
    throw new Error(
      `No fue posible cargar la actividad: ${activityError.message}`,
    );
  }

  if (!activity) {
    notFound();
  }

  const { data: relationData, error: relationError } =
    await supabase
      .from("member_activities")
      .select(`
        id,
        member_id,
        active,
        start_date,
        end_date
      `)
      .eq("activity_id", id)
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .order("active", {
        ascending: false,
      })
      .order("start_date", {
        ascending: false,
      });

  if (relationError) {
    throw new Error(
      `No fue posible cargar las inscripciones: ${relationError.message}`,
    );
  }

  const relations =
    (relationData ?? []) as Relation[];

  const memberIds = Array.from(
    new Set(
      relations.map(
        (relation) => relation.member_id,
      ),
    ),
  );

  let members: Member[] = [];

  if (memberIds.length > 0) {
    const { data: memberData, error: memberError } =
      await supabase
        .from("members")
        .select(`
          id,
          first_name,
          last_name,
          dni,
          active
        `)
        .in("id", memberIds)
        .eq("organization_id", context.organizationId)
        .eq("club_id", context.clubId);

    if (memberError) {
      throw new Error(
        `No fue posible cargar las personas: ${memberError.message}`,
      );
    }

    members = (memberData ?? []) as Member[];
  }

  const memberById = new Map(
    members.map(
      (member) => [
        member.id,
        member,
      ],
    ),
  );

  const rows = relations
    .map((relation) => ({
      relation,
      member:
        memberById.get(
          relation.member_id,
        ) ?? null,
    }))
    .filter(
      (
        row,
      ): row is {
        relation: Relation;
        member: Member;
      } => Boolean(row.member),
    );

  const activeRows = rows.filter(
    ({ relation }) => relation.active,
  );

  const historicalRows = rows.filter(
    ({ relation }) => !relation.active,
  );

  const canManage =
    canManageActivities(context.role);

  return (
    <div>
      <Link
        href="/panel/actividades"
        className="text-sm font-semibold text-blue-700"
      >
        ← Volver a actividades
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Inscriptos
        </h1>

        <p className="mt-2 text-lg font-semibold text-slate-700">
          {activity.name}
        </p>

        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">
          Administrá las personas inscriptas sin perder el historial de altas y bajas.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-2 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold text-slate-900">
              Inscriptos activos
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {activeRows.length === 1
                ? "1 persona"
                : `${activeRows.length} personas`}
            </p>
          </div>
        </div>

        {activeRows.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            No hay personas inscriptas actualmente.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {activeRows.map(
              ({ relation, member }) => {
                const action =
                  deactivateEnrollment.bind(
                    null,
                    relation.id,
                    id,
                  );

                return (
                  <article
                    key={relation.id}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-semibold text-slate-900">
                        {member.first_name}{" "}
                        {member.last_name}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        DNI: {member.dni || "Sin DNI"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Desde {formatDate(relation.start_date)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/panel/personas/${member.id}/editar`}
                        className="inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Ver persona
                      </Link>

                      {canManage ? (
                        <form action={action}>
                          <button
                            type="submit"
                            className="inline-flex justify-center rounded-lg border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                          >
                            Dar de baja
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

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="text-xl font-semibold text-slate-900">
            Historial
          </h2>

          <p className="mt-1 text-sm text-slate-500">
            Bajas anteriores de esta actividad.
          </p>
        </div>

        {historicalRows.length === 0 ? (
          <div className="px-6 py-8 text-sm text-slate-500">
            Todavía no hay bajas registradas.
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {historicalRows.map(
              ({ relation, member }) => {
                const action =
                  reactivateEnrollment.bind(
                    null,
                    relation.id,
                    id,
                  );

                return (
                  <article
                    key={relation.id}
                    className="flex flex-col gap-4 px-6 py-5 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-slate-900">
                          {member.first_name}{" "}
                          {member.last_name}
                        </p>

                        {!member.active ? (
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
                            Persona inactiva
                          </span>
                        ) : null}
                      </div>

                      <p className="mt-1 text-sm text-slate-500">
                        DNI: {member.dni || "Sin DNI"}
                      </p>

                      <p className="mt-1 text-xs text-slate-400">
                        Alta: {formatDate(relation.start_date)}
                        {" · "}
                        Baja: {formatDate(relation.end_date)}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Link
                        href={`/panel/personas/${member.id}/editar`}
                        className="inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Ver persona
                      </Link>

                      {canManage && member.active ? (
                        <form action={action}>
                          <button
                            type="submit"
                            className="inline-flex justify-center rounded-lg border border-green-200 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                          >
                            Reactivar
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
