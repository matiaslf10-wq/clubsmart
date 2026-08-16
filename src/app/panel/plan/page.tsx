import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  PLAN_FEATURE_LABELS,
  PLAN_FEATURES,
  PLAN_LABELS,
} from "@/lib/plans/features";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  requestProUpgrade,
} from "./actions";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams:
    Promise<{
      requested?: string;
      error?: string;
    }>;
};

function formatDate(
  value: string | null,
) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      dateStyle: "short",
      timeStyle: "short",
      timeZone:
        "America/Argentina/Buenos_Aires",
    },
  ).format(
    new Date(value),
  );
}

export default async function PlanPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const context =
    await getAdminContext();

  const supabase =
    await createClient();

  const {
    data: organization,
    error,
  } =
    await supabase
      .from("organizations")
      .select(`
        requested_plan_code,
        plan_change_requested_at
      `)
      .eq(
        "id",
        context.organizationId,
      )
      .maybeSingle();

  if (error) {
    throw new Error(
      `No fue posible consultar el plan: ${error.message}`,
    );
  }

  const upgradeRequested =
    organization
      ?.requested_plan_code ===
    "pro";

  const requestedAt =
    formatDate(
      organization
        ?.plan_change_requested_at ??
        null,
    );

  const canRequestUpgrade =
    context.role === "owner" ||
    context.role === "admin";

  return (
    <div>
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          ClubSmart
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Mi plan
        </h1>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <p className="text-slate-600">
            Plan actual:
          </p>

          <span className="rounded-full bg-blue-100 px-4 py-2 text-sm font-bold text-blue-800">
            {
              PLAN_LABELS[
                context.planCode
              ]
            }
          </span>
        </div>
      </section>

      {params.requested ===
      "1" ? (
        <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-900">
          <p className="font-semibold">
            Solicitud registrada
          </p>

          <p className="mt-2 text-sm leading-6">
            Registramos tu solicitud
            para pasar a ClubSmart Pro.
          </p>
        </div>
      ) : null}

      {params.error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-900">
          No fue posible registrar
          la solicitud de cambio de
          plan.
        </div>
      ) : null}

      <section className="mt-8 grid gap-6 lg:grid-cols-2">
        <article
          className={`rounded-2xl border bg-white p-7 shadow-sm ${
            context.planCode ===
            "essential"
              ? "border-blue-400 ring-2 ring-blue-100"
              : "border-slate-200"
          }`}
        >
          <p className="text-sm font-semibold uppercase tracking-wider text-slate-500">
            Plan
          </p>

          <h2 className="mt-2 text-2xl font-bold text-slate-900">
            Esencial
          </h2>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Para clubes que necesitan
            presencia digital,
            actividades y reservas
            sin gestión administrativa
            avanzada.
          </p>

          <ul className="mt-6 space-y-3">
            {PLAN_FEATURES.essential.map(
              (
                feature,
              ) => (
                <li
                  key={
                    feature
                  }
                  className="flex gap-3 text-sm text-slate-700"
                >
                  <span className="font-bold text-green-600">
                    ✓
                  </span>

                  {
                    PLAN_FEATURE_LABELS[
                      feature
                    ]
                  }
                </li>
              ),
            )}
          </ul>
        </article>

        <article
          className={`rounded-2xl border bg-white p-7 shadow-sm ${
            context.planCode ===
            "pro"
              ? "border-blue-400 ring-2 ring-blue-100"
              : "border-slate-200"
          }`}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
                Plan
              </p>

              <h2 className="mt-2 text-2xl font-bold text-slate-900">
                Pro
              </h2>
            </div>

            {context.planCode ===
            "pro" ? (
              <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                Tu plan
              </span>
            ) : null}
          </div>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Incluye toda la gestión
            administrativa del club,
            además de las funciones
            del plan Esencial.
          </p>

          <ul className="mt-6 space-y-3">
            {PLAN_FEATURES.pro.map(
              (
                feature,
              ) => (
                <li
                  key={
                    feature
                  }
                  className="flex gap-3 text-sm text-slate-700"
                >
                  <span className="font-bold text-green-600">
                    ✓
                  </span>

                  {
                    PLAN_FEATURE_LABELS[
                      feature
                    ]
                  }
                </li>
              ),
            )}
          </ul>

          {context.planCode ===
          "essential" ? (
            <div className="mt-7 border-t border-slate-200 pt-6">
              {upgradeRequested ? (
                <div className="rounded-xl bg-amber-50 p-5">
                  <p className="font-semibold text-amber-900">
                    Upgrade solicitado
                  </p>

                  <p className="mt-2 text-sm leading-6 text-amber-800">
                    Tu solicitud para
                    pasar a Pro está
                    pendiente de
                    confirmación.
                  </p>

                  {requestedAt ? (
                    <p className="mt-2 text-xs text-amber-700">
                      Solicitado el{" "}
                      {
                        requestedAt
                      }
                    </p>
                  ) : null}
                </div>
              ) : canRequestUpgrade ? (
                <form
                  action={
                    requestProUpgrade
                  }
                >
                  <button
                    type="submit"
                    className="w-full rounded-lg bg-blue-700 px-5 py-3 font-semibold text-white transition hover:bg-blue-800"
                  >
                    Solicitar cambio a Pro
                  </button>
                </form>
              ) : (
                <p className="text-sm leading-6 text-slate-600">
                  Un Owner o
                  Administrador del
                  club puede solicitar
                  el cambio a Pro.
                </p>
              )}
            </div>
          ) : null}
        </article>
      </section>

      {context.planCode ===
      "essential" ? (
        <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-7">
          <h2 className="text-lg font-bold text-blue-950">
            ¿Qué pasa cuando
            pasás a Pro?
          </h2>

          <p className="mt-3 max-w-3xl text-sm leading-6 text-blue-900">
            No tenés que crear otro
            club ni volver a cargar
            información. Una vez
            confirmado el cambio,
            las funciones Pro se
            habilitan sobre el mismo
            club y los mismos datos.
          </p>
        </section>
      ) : null}
    </div>
  );
}