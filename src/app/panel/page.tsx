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

  if (role === "operator") {
    return "Operador/Profesor";
  }

  if (role === "viewer") {
    return "Consulta";
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

type OnboardingStepProps = {
  number: number;
  title: string;
  description: string;
  completed: boolean;
  href: string;
  linkLabel: string;
};

function OnboardingStep({
  number,
  title,
  description,
  completed,
  href,
  linkLabel,
}: OnboardingStepProps) {
  return (
    <article
      className={`rounded-xl border p-5 ${
        completed
          ? "border-green-200 bg-green-50"
          : "border-slate-200 bg-white"
      }`}
    >
      <div className="flex items-start gap-4">
        <div
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            completed
              ? "bg-green-600 text-white"
              : "bg-blue-100 text-blue-700"
          }`}
        >
          {completed ? "✓" : number}
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-semibold text-slate-900">
              {title}
            </h3>

            {completed ? (
              <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-semibold text-green-800">
                Listo
              </span>
            ) : null}
          </div>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            {description}
          </p>

          {!completed ? (
            <Link
              href={href}
              className="mt-4 inline-flex text-sm font-semibold text-blue-700 transition hover:text-blue-800"
            >
              {linkLabel} →
            </Link>
          ) : null}
        </div>
      </div>
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
    clubResult,
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

    supabase
      .from("clubs")
      .select(`
        id,
        short_description,
        description,
        email,
        phone,
        whatsapp_phone,
        address,
        city,
        province,
        logo_url,
        cover_image_url,
        is_published
      `)
      .eq("id", context.clubId)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .maybeSingle(),
  ]);

  const summaryErrors = [
    activitiesResult.error,
    membersResult.error,
    feesResult.error,
    paymentsResult.error,
    providersResult.error,
    clubResult.error,
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

  const club =
    clubResult.data;

  /*
   * Consideramos que el club ya comenzó
   * a personalizar su página cuando
   * completó al menos uno de estos datos
   * adicionales.
   *
   * No exigimos completar todo para
   * evitar fricción.
   */
  const hasCustomizedClub =
    Boolean(
      club?.short_description ||
        club?.description ||
        club?.email ||
        club?.phone ||
        club?.whatsapp_phone ||
        club?.address ||
        club?.city ||
        club?.province ||
        club?.logo_url ||
        club?.cover_image_url,
    );

  const hasActivity =
    activeActivities > 0;

  const isPublished =
    club?.is_published === true;

  const onboardingSteps = [
    hasCustomizedClub,
    hasActivity,
    isPublished,
  ];

  const completedOnboardingSteps =
    onboardingSteps.filter(Boolean).length;

  const onboardingCompleted =
    completedOnboardingSteps ===
    onboardingSteps.length;

  const onboardingProgress =
    Math.round(
      (completedOnboardingSteps /
        onboardingSteps.length) *
        100,
    );

  const nextOnboardingHref =
    !hasCustomizedClub
      ? "/panel/club"
      : !hasActivity
        ? "/panel/actividades/nueva"
        : "/panel/club";

  const nextOnboardingLabel =
    !hasCustomizedClub
      ? "Completar datos del club"
      : !hasActivity
        ? "Crear primera actividad"
        : "Publicar página";

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

      {!onboardingCompleted ? (
        <section className="mt-6 overflow-hidden rounded-2xl border border-blue-200 bg-blue-50 shadow-sm">
          <div className="p-7">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
                  Primeros pasos
                </p>

                <h2 className="mt-2 text-2xl font-bold text-slate-900">
                  Prepará tu club para empezar
                </h2>

                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-700">
                  No necesitás configurar todo
                  ahora. Con estos tres pasos
                  básicos ya podés empezar a
                  mostrar y administrar tu club.
                </p>
              </div>

              <div className="shrink-0 rounded-xl bg-white px-5 py-4 text-center shadow-sm">
                <p className="text-2xl font-bold text-blue-700">
                  {completedOnboardingSteps}/3
                </p>

                <p className="mt-1 text-xs font-medium text-slate-500">
                  completados
                </p>
              </div>
            </div>

            <div className="mt-6 h-2 overflow-hidden rounded-full bg-blue-100">
              <div
                className="h-full rounded-full bg-blue-600 transition-all"
                style={{
                  width: `${onboardingProgress}%`,
                }}
              />
            </div>

            <div className="mt-6 grid gap-4 lg:grid-cols-3">
              <OnboardingStep
                number={1}
                title="Prepará la página del club"
                description="Agregá los datos que quieras mostrar: descripción, contacto, logo, portada o ubicación."
                completed={hasCustomizedClub}
                href="/panel/club"
                linkLabel="Editar datos del club"
              />

              <OnboardingStep
                number={2}
                title="Creá tu primera actividad"
                description="Cargá al menos una actividad con su información, horarios y condiciones."
                completed={hasActivity}
                href="/panel/actividades/nueva"
                linkLabel="Crear actividad"
              />

              <OnboardingStep
                number={3}
                title="Publicá la página"
                description="Cuando estés listo, hacé visible la página pública del club con un solo clic."
                completed={isPublished}
                href="/panel/club"
                linkLabel="Publicar página"
              />
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-blue-200 pt-5 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Podés seguir usando el resto del
                panel mientras completás estos
                pasos.
              </p>

              <Link
                href={nextOnboardingHref}
                className="inline-flex justify-center rounded-lg bg-blue-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-800"
              >
                {nextOnboardingLabel}
              </Link>
            </div>
          </div>
        </section>
      ) : null}

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
            href="/panel/cuotas"
            linkLabel="Ver cuotas"
          />

          <SummaryCard
            title="Pagos aprobados"
            value={approvedPayments}
            description="Pagos confirmados y registrados en ClubSmart."
            href="/panel/pagos"
            linkLabel="Ver pagos"
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
                  Configurá los medios de cobro
                  disponibles para este club.
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
    </div>
  );
}