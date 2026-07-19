import Link from "next/link";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Activity = {
  id: string;
  name: string;
  slug: string;
  category: string | null;
  target_audience: string | null;
  price: number | null;
  price_description: string | null;
  enrollment_open: boolean;
  is_published: boolean;
  active: boolean;
  created_at: string;
};

function formatPrice(price: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(price);
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
      target_audience,
      price,
      price_description,
      enrollment_open,
      is_published,
      active,
      created_at
    `)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .order("active", { ascending: false })
    .order("name", { ascending: true });

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

  const activities = (data ?? []) as Activity[];
  const canCreate =
    context.role === "owner" ||
    context.role === "admin";

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

          <p className="mt-3 text-slate-600">
            Administrá las propuestas que aparecen en la página
            pública del club.
          </p>
        </div>

        {canCreate ? (
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
            Creá la primera actividad para comenzar a completar la
            página pública.
          </p>
        </section>
      ) : (
        <section className="mt-8 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="hidden grid-cols-[2fr_1fr_1fr_1fr] gap-4 border-b border-slate-200 bg-slate-50 px-6 py-4 text-sm font-semibold text-slate-600 md:grid">
            <span>Actividad</span>
            <span>Precio</span>
            <span>Inscripción</span>
            <span>Publicación</span>
          </div>

          <div className="divide-y divide-slate-200">
            {activities.map((activity) => (
              <article
                key={activity.id}
                className="grid gap-4 px-6 py-5 md:grid-cols-[2fr_1fr_1fr_1fr] md:items-center"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {activity.name}
                  </p>

                  <p className="mt-1 text-sm text-slate-500">
                    {[
                      activity.category,
                      activity.target_audience,
                    ]
                      .filter(Boolean)
                      .join(" · ") || "Sin categoría"}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400 md:hidden">
                    Precio
                  </p>

                  <p className="mt-1 text-sm text-slate-700 md:mt-0">
                    {activity.price !== null
                      ? formatPrice(activity.price)
                      : "Sin precio"}

                    {activity.price_description
                      ? ` · ${activity.price_description}`
                      : ""}
                  </p>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400 md:hidden">
                    Inscripción
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold md:mt-0 ${
                      activity.enrollment_open
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-600"
                    }`}
                  >
                    {activity.enrollment_open
                      ? "Abierta"
                      : "Cerrada"}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase text-slate-400 md:hidden">
                    Publicación
                  </p>

                  <span
                    className={`mt-1 inline-flex rounded-full px-3 py-1 text-xs font-semibold md:mt-0 ${
                      activity.is_published &&
                      activity.active
                        ? "bg-blue-100 text-blue-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {activity.is_published &&
                    activity.active
                      ? "Publicada"
                      : "Borrador"}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}