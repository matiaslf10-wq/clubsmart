import Link from "next/link";

import { DeleteActivityButton } from "@/app/panel/actividades/delete-activity-button";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type FeeRate = {
  id: string;
  amount: number | string;
  valid_from: string;
  valid_to: string | null;
};

type MemberActivity = {
  id: string;
  active: boolean;
};

type Activity = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  active: boolean;
  created_at: string;
  activity_fee_rates: FeeRate[];
  member_activities: MemberActivity[];
};

function formatPrice(value: number | string) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Importe inválido";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(amount);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR").format(
    new Date(`${value}T00:00:00`),
  );
}

function getCurrentRate(
  rates: FeeRate[],
  today: string,
) {
  return (
    rates
      .filter(
        (rate) =>
          rate.valid_from <= today &&
          (
            rate.valid_to === null ||
            rate.valid_to >= today
          ),
      )
      .sort((first, second) =>
        second.valid_from.localeCompare(
          first.valid_from,
        ),
      )[0] ?? null
  );
}

export default async function ActivitiesPage() {
  const context = await getAdminContext();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select(`
      id,
      name,
      slug,
      category,
      active,
      created_at,
      activity_fee_rates (
        id,
        amount,
        valid_from,
        valid_to
      ),
      member_activities (
        id,
        active
      )
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .order("active", {
      ascending: false,
    })
    .order("name", {
      ascending: true,
    });

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-900">
          No fue posible cargar las actividades
        </h1>

        <p className="mt-3 text-red-800">
          {error.message}
        </p>
      </div>
    );
  }

  const activities =
    (data ?? []) as Activity[];

  const canManage =
    context.role === "owner" ||
    context.role === "admin";

  const today = new Date()
    .toISOString()
    .slice(0, 10);

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            Actividades
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            Administrá las actividades, sus
            participantes y las tarifas vigentes.
          </p>
        </div>

        {canManage ? (
          <Link
            href="/panel/actividades/nueva"
            className="inline-flex justify-center rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Nueva actividad
          </Link>
        ) : null}
      </div>

      {activities.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-xl font-semibold">
            Todavía no hay actividades
          </h2>

          <p className="mt-3 text-slate-600">
            Creá la primera actividad para
            comenzar a completar la página
            pública.
          </p>
        </section>
      ) : (
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[1.7fr_1.2fr_0.8fr_0.7fr_auto] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-600 lg:grid">
            <span>Actividad</span>
            <span>Tarifa vigente</span>
            <span>Inscripciones</span>
            <span>Estado</span>
            <span />
          </div>

          <div className="divide-y divide-slate-200">
            {activities.map((activity) => {
              const currentRate =
                getCurrentRate(
                  activity.activity_fee_rates,
                  today,
                );

              const activeMembersCount =
                activity.member_activities.filter(
                  (relation) =>
                    relation.active,
                ).length;

              return (
                <article
                  key={activity.id}
                  className="grid gap-4 px-6 py-5 lg:grid-cols-[1.7fr_1.2fr_0.8fr_0.7fr_auto] lg:items-center"
                >
                  <div>
                    <p className="font-semibold text-slate-900">
                      {activity.name}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {activity.category ||
                        "Sin categoría"}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 lg:hidden">
                      Tarifa vigente
                    </p>

                    {currentRate ? (
                      <div className="mt-1 lg:mt-0">
                        <p className="font-semibold text-slate-900">
                          {formatPrice(
                            currentRate.amount,
                          )}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          Desde el{" "}
                          {formatDate(
                            currentRate.valid_from,
                          )}
                        </p>
                      </div>
                    ) : (
                      <p className="mt-1 text-sm text-amber-700 lg:mt-0">
                        Sin tarifa vigente
                      </p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 lg:hidden">
                      Inscripciones
                    </p>

                    <p className="mt-1 text-sm text-slate-700 lg:mt-0">
                      {activeMembersCount === 1
                        ? "1 persona"
                        : `${activeMembersCount} personas`}
                    </p>
                  </div>

                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-400 lg:hidden">
                      Estado
                    </p>

                    <span
                      className={
                        activity.active
                          ? "mt-1 inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800 lg:mt-0"
                          : "mt-1 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600 lg:mt-0"
                      }
                    >
                      {activity.active
                        ? "Activa"
                        : "Inactiva"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/panel/actividades/${activity.id}/editar`}
                      className="inline-flex justify-center rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                    >
                      Editar
                    </Link>

                    <DeleteActivityButton
                      activityId={activity.id}
                      activityName={
                        activity.name
                      }
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