import Link from "next/link";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function formatRole(role: string) {
  if (role === "owner") {
    return "Propietario";
  }

  if (role === "admin") {
    return "Administrador";
  }

  return role;
}

type SummaryCardProps = {
  title: string;
  value: number;
  description: string;
  href?: string;
  linkLabel?: string;
};

function SummaryCard({
  title,
  value,
  description,
  href,
  linkLabel,
}: SummaryCardProps) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <p className="text-sm font-medium text-slate-500">
        {title}
      </p>

      <p className="mt-3 text-4xl font-bold text-slate-900">
        {value}
      </p>

      <p className="mt-3 text-sm leading-6 text-slate-600">
        {description}
      </p>

      {href && linkLabel ? (
        <Link
          href={href}
          className="mt-5 inline-flex text-sm font-semibold text-blue-700 transition hover:text-blue-800"
        >
          {linkLabel} →
        </Link>
      ) : null}
    </article>
  );
}

export default async function PanelPage() {
  const context = await getAdminContext();
  const supabase = createAdminClient();

  const [
    activitiesResult,
    membersResult,
    feesResult,
    paymentsResult,
    providersResult,
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq("active", true),

    supabase
      .from("members")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq("active", true),

    supabase
      .from("monthly_fees")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .in("status", [
        "pending",
        "partial",
        "overdue",
      ]),

    supabase
      .from("payments")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq("status", "approved"),

    supabase
      .from("club_payment_providers")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq("club_id", context.clubId)
      .eq("enabled", true),
  ]);

  const summaryErrors = [
    activitiesResult.error,
    membersResult.error,
    feesResult.error,
    paymentsResult.error,
    providersResult.error,
  ].filter(
    (
      error,
    ): error is NonNullable<
      typeof activitiesResult.error
    > => Boolean(error),
  );

  const activeActivities =
    activitiesResult.count ?? 0;

  const activeMembers =
    membersResult.count ?? 0;

  const outstandingFees =
    feesResult.count ?? 0;

  const approvedPayments =
    paymentsResult.count ?? 0;

  const enabledProviders =
    providersResult.count ?? 0;

  const canManagePayments =
    context.role === "owner" ||
    context.role === "admin";

  return (
    <div>
      <section className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          Panel administrativo
        </p>

        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              {context.clubName}
            </h1>

            <p className="mt-3 text-slate-600">
              Administrá la información pública,
              las personas, las cuotas y los
              pagos del club.
            </p>
          </div>

          <span className="inline-flex w-fit rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
            {formatRole(context.role)}
          </span>
        </div>
      </section>

      {summaryErrors.length > 0 ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900"
        >
          <p className="font-semibold">
            Algunos indicadores no pudieron
            actualizarse.
          </p>

          <p className="mt-2 text-sm leading-6">
            Las funciones del panel siguen
            disponibles. Revisá la conexión con
            Supabase si los valores aparecen en
            cero.
          </p>
        </div>
      ) : null}

      <section className="mt-8">
        <div>
          <h2 className="text-xl font-bold text-slate-900">
            Resumen operativo
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            Estado general de la administración
            del club.
          </p>
        </div>

        <div className="mt-5 grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <SummaryCard
            title="Actividades activas"
            value={activeActivities}
            description="Propuestas disponibles en la página pública del club."
            href="/panel/actividades"
            linkLabel="Administrar actividades"
          />

          <SummaryCard
            title="Personas activas"
            value={activeMembers}
            description="Participantes con una relación activa dentro del club."
            href="/panel/personas"
            linkLabel="Administrar personas"
          />

          <SummaryCard
            title="Cuotas pendientes"
            value={outstandingFees}
            description="Incluye cuotas pendientes, parciales y vencidas."
          />

          <SummaryCard
            title="Pagos aprobados"
            value={approvedPayments}
            description="Pagos confirmados y registrados en ClubSmart."
          />
        </div>
      </section>

      <section className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Acciones frecuentes
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Link
              href="/panel/actividades/nueva"
              className="rounded-xl border border-slate-200 p-5 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="font-semibold text-slate-900">
                Crear actividad
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Publicá una nueva propuesta con
                horarios, edades y datos de
                contacto.
              </p>
            </Link>

            <Link
              href="/panel/personas/nueva"
              className="rounded-xl border border-slate-200 p-5 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="font-semibold text-slate-900">
                Cargar persona
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Registrá un participante y
                asignalo a una o varias
                actividades.
              </p>
            </Link>

            <Link
              href="/panel/club"
              className="rounded-xl border border-slate-200 p-5 transition hover:border-blue-300 hover:bg-blue-50"
            >
              <p className="font-semibold text-slate-900">
                Editar datos del club
              </p>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Actualizá la identidad, la
                información institucional y los
                medios de contacto.
              </p>
            </Link>

            {canManagePayments ? (
              <Link
                href="/panel/pagos/configuracion"
                className="rounded-xl border border-slate-200 p-5 transition hover:border-blue-300 hover:bg-blue-50"
              >
                <p className="font-semibold text-slate-900">
                  Configurar pagos
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Habilitá Pago TIC y Mercado
                  Pago para este club.
                </p>
              </Link>
            ) : null}
          </div>
        </article>

        <article className="rounded-2xl border border-blue-200 bg-blue-50 p-7">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            Proveedores de pago
          </p>

          <p className="mt-4 text-4xl font-bold text-blue-950">
            {enabledProviders}
          </p>

          <p className="mt-3 text-sm leading-6 text-blue-900">
            {enabledProviders === 0
              ? "Todavía no hay proveedores habilitados para este club."
              : enabledProviders === 1
                ? "Hay un proveedor de pagos habilitado."
                : `Hay ${enabledProviders} proveedores de pagos habilitados.`}
          </p>

          {canManagePayments ? (
            <Link
              href="/panel/pagos/configuracion"
              className="mt-6 inline-flex rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
            >
              Revisar configuración
            </Link>
          ) : null}
        </article>
      </section>

      <section className="mt-8 rounded-2xl border border-dashed border-slate-300 bg-white p-7">
        <h2 className="text-lg font-bold text-slate-900">
          Próximo módulo: cuotas mensuales
        </h2>

        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
          El próximo paso permitirá generar las
          cuotas de cada período tomando la
          tarifa vigente de cada actividad,
          controlar vencimientos y registrar
          pagos manuales o electrónicos.
        </p>
      </section>
    </div>
  );
}