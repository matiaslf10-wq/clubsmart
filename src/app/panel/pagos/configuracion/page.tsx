import Link from "next/link";
import { redirect } from "next/navigation";

import {
  reactivatePagoTic,
  savePagoTicSetup,
  startPagoTicSetup,
  suspendPagoTic,
} from "@/app/panel/pagos/configuracion/actions";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type ConnectionStatus =
  | "not_started"
  | "pending"
  | "active"
  | "suspended"
  | "rejected";

type PagoTicConfiguration = {
  id: string;
  enabled: boolean;
  mode: "sandbox" | "production";
  monthly_fees_enabled: boolean;
  one_time_enabled: boolean;
  automatic_debit_enabled: boolean;
  default_for_monthly_fees: boolean;
  merchant_account_id: string | null;
  external_entity_id: string | null;
  connection_status: ConnectionStatus;
  onboarding_started_at: string | null;
  connected_at: string | null;
  last_connection_error: string | null;
};

export const dynamic = "force-dynamic";

function hasUsableEnvironmentValue(variableName: string) {
  const value = process.env[variableName]?.trim();

  if (!value) {
    return false;
  }

  const normalized = value.toUpperCase();

  return !(
    normalized.startsWith("TU_") ||
    normalized.startsWith("PEGAR_") ||
    normalized.startsWith("YOUR_") ||
    normalized.includes("CHANGE_ME") ||
    normalized.includes("REEMPLAZAR")
  );
}

function hasPagoTicPlatformCredentials() {
  return [
    "PAGOTIC_USERNAME",
    "PAGOTIC_PASSWORD",
    "PAGOTIC_CLIENT_ID",
    "PAGOTIC_CLIENT_SECRET",
  ].every(hasUsableEnvironmentValue);
}

function getStatusContent(status: ConnectionStatus) {
  if (status === "active") {
    return {
      label: "Activo",

      className: "border-green-200 bg-green-50 text-green-900",

      description: "El club está habilitado para operar con Pago TIC.",
    };
  }

  if (status === "pending") {
    return {
      label: "Configuración pendiente",

      className: "border-amber-200 bg-amber-50 text-amber-900",

      description:
        "El administrador inició el alta, pero todavía falta completar o confirmar la conexión.",
    };
  }

  if (status === "suspended") {
    return {
      label: "Suspendido",

      className: "border-slate-300 bg-slate-100 text-slate-900",

      description:
        "No se generarán nuevas operaciones hasta que el administrador reactive Pago TIC.",
    };
  }

  if (status === "rejected") {
    return {
      label: "Rechazado",

      className: "border-red-200 bg-red-50 text-red-900",

      description: "Pago TIC rechazó o no pudo completar el alta de este club.",
    };
  }

  return {
    label: "No configurado",

    className: "border-slate-200 bg-white text-slate-900",

    description:
      "El administrador todavía no inició la configuración de Pago TIC.",
  };
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

export default async function PaymentConfigurationPage({
  searchParams,
}: PageProps) {
  const context = await getAdminContext();

  const messages = await searchParams;

  if (context.role !== "owner" && context.role !== "admin") {
    redirect("/panel");
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("club_payment_providers")
    .select(
      `
      id,
      enabled,
      mode,
      monthly_fees_enabled,
      one_time_enabled,
      automatic_debit_enabled,
      default_for_monthly_fees,
      merchant_account_id,
      external_entity_id,
      connection_status,
      onboarding_started_at,
      connected_at,
      last_connection_error
    `,
    )
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .eq("provider", "pagotic")
    .maybeSingle();

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-900">
        <h1 className="text-2xl font-bold">No fue posible cargar Pago TIC</h1>

        <p className="mt-3">{error.message}</p>

        <Link
          href="/panel"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Volver al panel
        </Link>
      </div>
    );
  }

  const configuration = data as PagoTicConfiguration | null;

  const connectionStatus = configuration?.connection_status ?? "not_started";

  const statusContent = getStatusContent(connectionStatus);

  const platformConfigured = hasPagoTicPlatformCredentials();

  const collectorConfigured = Boolean(configuration?.merchant_account_id);

  const monthlyConfigured = Boolean(configuration?.monthly_fees_enabled);

  const debitConfigured = Boolean(configuration?.automatic_debit_enabled);

  const ready =
    connectionStatus === "active" &&
    platformConfigured &&
    collectorConfigured &&
    monthlyConfigured &&
    debitConfigured;

  const onboardingUrl = process.env.PAGOTIC_ONBOARDING_URL?.trim();

  const checklist = [
    {
      label: "Alta iniciada por el administrador",

      completed: connectionStatus !== "not_started",
    },

    {
      label: "Collector ID del club cargado",

      completed: collectorConfigured,
    },

    {
      label: "Conector técnico disponible",

      completed: platformConfigured,
    },

    {
      label: "Cuotas mensuales habilitadas",

      completed: monthlyConfigured,
    },

    {
      label: "Adhesión y débito automático habilitados",

      completed: debitConfigured,
    },

    {
      label: "Alta confirmada por Pago TIC",

      completed: connectionStatus === "active",
    },
  ];

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
          Alta y configuración de Pago TIC
        </h1>

        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          El administrador del club gestiona desde aquí la vinculación, las
          cuotas mensuales y el débito automático. ClubSmart no recibe ni
          redistribuye los fondos cobrados.
        </p>
      </div>

      {messages.error ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {messages.error}
        </div>
      ) : null}

      {messages.success ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {messages.success}
        </div>
      ) : null}

      <section
        className={`mt-8 rounded-2xl border p-7 ${statusContent.className}`}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider">
              Estado de conexión
            </p>

            <h2 className="mt-2 text-2xl font-bold">{statusContent.label}</h2>

            <p className="mt-2 max-w-2xl leading-6">
              {statusContent.description}
            </p>
          </div>

          {ready ? (
            <span className="w-fit rounded-full bg-green-600 px-4 py-2 text-sm font-semibold text-white">
              Listo para operar
            </span>
          ) : (
            <span className="w-fit rounded-full bg-white/70 px-4 py-2 text-sm font-semibold">
              Configuración incompleta
            </span>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Progreso de configuración
          </h2>

          <div className="mt-6 space-y-4">
            {checklist.map((item) => (
              <div key={item.label} className="flex items-start gap-3">
                <span
                  className={
                    item.completed
                      ? "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-sm font-bold text-green-700"
                      : "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500"
                  }
                >
                  {item.completed ? "✓" : "–"}
                </span>

                <span
                  className={
                    item.completed
                      ? "text-sm font-medium text-slate-900"
                      : "text-sm text-slate-600"
                  }
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-7 border-t border-slate-200 pt-6">
            <dl className="space-y-4 text-sm">
              <div>
                <dt className="text-slate-500">Alta iniciada</dt>

                <dd className="mt-1 font-medium text-slate-900">
                  {formatDate(configuration?.onboarding_started_at ?? null)}
                </dd>
              </div>

              <div>
                <dt className="text-slate-500">Conexión activa desde</dt>

                <dd className="mt-1 font-medium text-slate-900">
                  {formatDate(configuration?.connected_at ?? null)}
                </dd>
              </div>
            </dl>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          {connectionStatus === "not_started" ? (
            <>
              <h2 className="text-xl font-bold text-slate-900">
                Paso 1: iniciar el alta
              </h2>

              <p className="mt-3 leading-6 text-slate-600">
                El administrador debe iniciar el proceso y obtener de Pago TIC
                el identificador correspondiente al club.
              </p>

              {onboardingUrl ? (
                <a
                  href={onboardingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-6 inline-flex rounded-lg border border-blue-300 bg-blue-50 px-5 py-3 font-semibold text-blue-800 transition hover:bg-blue-100"
                >
                  Abrir alta en Pago TIC
                </a>
              ) : null}

              <form action={startPagoTicSetup} className="mt-4">
                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700"
                >
                  Comenzar configuración
                </button>
              </form>
            </>
          ) : (
            <>
              <h2 className="text-xl font-bold text-slate-900">
                Datos de la cuenta del club
              </h2>

              <p className="mt-3 leading-6 text-slate-600">
                Estos datos deben ser cargados por el administrador con la
                información entregada por Pago TIC.
              </p>

              <form action={savePagoTicSetup} className="mt-7 space-y-6">
                <div>
                  <label
                    htmlFor="merchant_account_id"
                    className="text-sm font-medium text-slate-700"
                  >
                    Collector ID
                  </label>

                  <input
                    id="merchant_account_id"
                    name="merchant_account_id"
                    type="text"
                    required
                    defaultValue={configuration?.merchant_account_id ?? ""}
                    placeholder="Identificador entregado por Pago TIC"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Identifica a la entidad que debe recibir la recaudación.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="external_entity_id"
                    className="text-sm font-medium text-slate-700"
                  >
                    Identificador adicional
                  </label>

                  <input
                    id="external_entity_id"
                    name="external_entity_id"
                    type="text"
                    defaultValue={configuration?.external_entity_id ?? ""}
                    placeholder="Opcional"
                    className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
                  />

                  <p className="mt-2 text-xs leading-5 text-slate-500">
                    Se utiliza únicamente si Pago TIC entrega otro código de
                    entidad además del Collector ID.
                  </p>
                </div>

                <div>
                  <label
                    htmlFor="mode"
                    className="text-sm font-medium text-slate-700"
                  >
                    Entorno
                  </label>

                  <select
                    id="mode"
                    name="mode"
                    defaultValue={configuration?.mode ?? "sandbox"}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
                  >
                    <option value="sandbox">Pruebas / sandbox</option>

                    <option value="production">Producción</option>
                  </select>
                </div>

                <fieldset>
                  <legend className="text-sm font-medium text-slate-700">
                    Servicios del club
                  </legend>

                  <div className="mt-3 space-y-4">
                    <label className="flex items-start gap-3">
                      <input
                        name="monthly_fees_enabled"
                        type="checkbox"
                        defaultChecked={
                          configuration?.monthly_fees_enabled ?? true
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />

                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Cuotas mensuales
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          Permite generar y cobrar las obligaciones mensuales
                          del club.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3">
                      <input
                        name="automatic_debit_enabled"
                        type="checkbox"
                        defaultChecked={
                          configuration?.automatic_debit_enabled ?? true
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />

                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Adhesión y débito automático
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          El administrador deberá confirmar cada generación
                          mensual de débitos.
                        </span>
                      </span>
                    </label>

                    <label className="flex items-start gap-3">
                      <input
                        name="one_time_enabled"
                        type="checkbox"
                        defaultChecked={
                          configuration?.one_time_enabled ?? false
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />

                      <span>
                        <span className="block text-sm font-medium text-slate-900">
                          Pagos puntuales mediante Pago TIC
                        </span>

                        <span className="mt-1 block text-xs leading-5 text-slate-500">
                          Puede utilizarse además para pagos extraordinarios.
                        </span>
                      </span>
                    </label>
                  </div>
                </fieldset>

                <label className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <input
                    name="provider_approved"
                    type="checkbox"
                    defaultChecked={connectionStatus === "active"}
                    className="mt-1 h-4 w-4 rounded border-blue-300"
                  />

                  <span>
                    <span className="block text-sm font-semibold text-blue-950">
                      Pago TIC confirmó el alta del club
                    </span>

                    <span className="mt-1 block text-xs leading-5 text-blue-900">
                      Debe marcarse solamente después de recibir la confirmación
                      y el Collector ID correspondiente.
                    </span>
                  </span>
                </label>

                {!platformConfigured ? (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                    El conector técnico de Pago TIC todavía no tiene
                    credenciales válidas en el servidor. El administrador puede
                    guardar los datos, pero la conexión no podrá activarse.
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-slate-900 px-6 py-4 font-semibold text-white transition hover:bg-slate-700"
                >
                  Guardar configuración
                </button>
              </form>
            </>
          )}
        </article>
      </section>

      {connectionStatus === "active" ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Administración de la conexión
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Suspender la conexión impide generar nuevas operaciones, pero
                conserva las adhesiones, pagos e historial existentes.
              </p>
            </div>

            <form action={suspendPagoTic}>
              <button
                type="submit"
                className="rounded-lg border border-red-300 px-5 py-3 font-semibold text-red-700 transition hover:bg-red-50"
              >
                Suspender Pago TIC
              </button>
            </form>
          </div>
        </section>
      ) : null}

      {connectionStatus === "suspended" ? (
        <section className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 p-7">
          <h2 className="text-xl font-bold text-amber-950">
            Pago TIC está suspendido
          </h2>

          <p className="mt-2 text-sm leading-6 text-amber-900">
            El administrador puede reactivar la conexión sin perder el
            historial.
          </p>

          <form action={reactivatePagoTic} className="mt-5">
            <button
              type="submit"
              className="rounded-lg bg-amber-700 px-6 py-3 font-semibold text-white transition hover:bg-amber-800"
            >
              Reactivar Pago TIC
            </button>
          </form>
        </section>
      ) : null}

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">Mercado Pago</h2>

        <p className="mt-3 max-w-3xl leading-6 text-slate-600">
          Se incorporará en una segunda etapa para eventos, reservas, señas y
          otros cobros puntuales. Cada club conectará su propia cuenta; no se
          utilizará una cuenta central de ClubSmart.
        </p>

        <span className="mt-4 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Próximamente
        </span>
      </section>
    </div>
  );
}
