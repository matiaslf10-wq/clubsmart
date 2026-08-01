import Link from "next/link";
import { redirect } from "next/navigation";

import {
  updateDefaultProviders,
  updatePaymentProvider,
} from "@/app/panel/pagos/configuracion/actions";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  searchParams: Promise<{
    error?: string;
    success?: string;
  }>;
};

type PaymentProvider =
  | "pagotic"
  | "mercado_pago";

type ProviderConfiguration = {
  id: string;
  provider: PaymentProvider;
  enabled: boolean;
  mode: "sandbox" | "production";
  monthly_fees_enabled: boolean;
  one_time_enabled: boolean;
  automatic_debit_enabled: boolean;
  default_for_monthly_fees: boolean;
  default_for_one_time: boolean;
  merchant_account_id: string | null;
};

type PlatformStatus = {
  configured: boolean;
  title: string;
  description: string;
};

export const dynamic = "force-dynamic";

const providerOrder: PaymentProvider[] = [
  "pagotic",
  "mercado_pago",
];

function providerName(
  provider: PaymentProvider,
) {
  return provider === "pagotic"
    ? "Pago TIC"
    : "Mercado Pago";
}

function providerDescription(
  provider: PaymentProvider,
) {
  return provider === "pagotic"
    ? "Proveedor principal para cuotas mensuales, adhesiones y débito automático."
    : "Proveedor auxiliar para eventos, reservas, señas y otros cobros de una sola vez.";
}

function hasUsableEnvironmentValue(
  variableName: string,
) {
  const value =
    process.env[variableName]?.trim();

  if (!value) {
    return false;
  }

  const normalized =
    value.toUpperCase();

  return !(
    normalized.startsWith("TU_") ||
    normalized.startsWith("PEGAR_") ||
    normalized.startsWith("YOUR_") ||
    normalized.includes("CHANGE_ME") ||
    normalized.includes("REEMPLAZAR")
  );
}

function getPlatformStatus(
  provider: PaymentProvider,
): PlatformStatus {
  if (provider === "pagotic") {
    const configured = [
      "PAGOTIC_USERNAME",
      "PAGOTIC_PASSWORD",
      "PAGOTIC_CLIENT_ID",
      "PAGOTIC_CLIENT_SECRET",
    ].every(
      hasUsableEnvironmentValue,
    );

    return {
      configured,

      title: configured
        ? "Integración general disponible"
        : "Integración general pendiente",

      description: configured
        ? "ClubSmart dispone de las credenciales generales para comunicarse con Pago TIC."
        : "Todavía deben cargarse en el servidor las credenciales generales entregadas por Pago TIC.",
    };
  }

  return {
    configured: false,

    title:
      "Conexión individual pendiente",

    description:
      "Mercado Pago se habilitará más adelante mediante una conexión propia para cada club. No se utilizará un access token global.",
  };
}

export default async function PaymentConfigurationPage({
  searchParams,
}: PageProps) {
  const context = await getAdminContext();
  const messages = await searchParams;

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel");
  }

  let configurationsData:
    | ProviderConfiguration[]
    | null = null;

  let configurationLoadError:
    | string
    | null = null;

  try {
    const supabase =
      createAdminClient();

    const {
      data,
      error,
    } = await supabase
      .from("club_payment_providers")
      .select(`
        id,
        provider,
        enabled,
        mode,
        monthly_fees_enabled,
        one_time_enabled,
        automatic_debit_enabled,
        default_for_monthly_fees,
        default_for_one_time,
        merchant_account_id
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      );

    if (error) {
      configurationLoadError =
        error.message;
    } else {
      configurationsData =
        data as ProviderConfiguration[];
    }
  } catch (error) {
    console.error(
      "Error cargando la configuración de pagos:",
      error,
    );

    configurationLoadError =
      error instanceof Error
        ? error.message
        : "Ocurrió un error inesperado al conectar con la base de datos.";
  }

  if (configurationLoadError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-900">
          No fue posible cargar la
          configuración de pagos
        </h1>

        <p className="mt-3 text-red-800">
          Revisá la conexión administrativa
          con Supabase y las variables de
          entorno del servidor.
        </p>

        {process.env.NODE_ENV ===
        "development" ? (
          <pre className="mt-4 overflow-auto rounded-lg bg-red-100 p-4 text-sm text-red-900">
            {configurationLoadError}
          </pre>
        ) : null}

        <Link
          href="/panel"
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Volver al panel
        </Link>
      </div>
    );
  }

  const configurations =
    configurationsData ?? [];

  const configurationByProvider =
    new Map(
      configurations.map(
        (configuration) => [
          configuration.provider,
          configuration,
        ],
      ),
    );

  const orderedConfigurations =
    providerOrder
      .map((provider) =>
        configurationByProvider.get(
          provider,
        ),
      )
      .filter(
        (
          configuration,
        ): configuration is ProviderConfiguration =>
          Boolean(configuration),
      );

  const currentMonthlyProvider =
    configurations.find(
      (configuration) =>
        configuration
          .default_for_monthly_fees,
    )?.provider ?? "";

  const currentOneTimeProvider =
    configurations.find(
      (configuration) =>
        configuration
          .default_for_one_time,
    )?.provider ?? "";

  const pagoTicStatus =
    getPlatformStatus("pagotic");

  const monthlyOptions =
    orderedConfigurations.filter(
      (configuration) =>
        configuration.provider ===
          "pagotic" &&
        pagoTicStatus.configured &&
        configuration.enabled &&
        configuration
          .monthly_fees_enabled &&
        configuration
          .automatic_debit_enabled &&
        Boolean(
          configuration
            .merchant_account_id,
        ),
    );

  const oneTimeOptions =
    orderedConfigurations.filter(
      (configuration) =>
        configuration.provider ===
          "pagotic" &&
        pagoTicStatus.configured &&
        configuration.enabled &&
        configuration
          .one_time_enabled &&
        Boolean(
          configuration
            .merchant_account_id,
        ),
    );

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
          Configuración de pagos
        </h1>

        <p className="mt-3 max-w-3xl text-slate-600">
          Pago TIC administra las cuotas,
          adhesiones y débitos automáticos.
          Mercado Pago quedará reservado para
          operaciones puntuales.
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="font-semibold text-blue-950">
          Acreditación directa al club
        </h2>

        <p className="mt-2 text-sm leading-6 text-blue-900">
          Cada club debe estar identificado
          como una entidad recaudadora propia.
          ClubSmart registra y concilia las
          operaciones, pero no recibe ni
          redistribuye el dinero cobrado.
        </p>
      </section>

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

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        {orderedConfigurations.map(
          (configuration) => {
            const platformStatus =
              getPlatformStatus(
                configuration.provider,
              );

            const collectorConfigured =
              configuration.provider ===
              "pagotic"
                ? Boolean(
                    configuration
                      .merchant_account_id,
                  )
                : false;

            const operational =
              configuration.provider ===
                "pagotic" &&
              platformStatus.configured &&
              collectorConfigured &&
              configuration.enabled;

            const saveAction =
              updatePaymentProvider.bind(
                null,
                configuration.provider,
              );

            return (
              <article
                key={configuration.id}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">
                      {providerName(
                        configuration.provider,
                      )}
                    </h2>

                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {providerDescription(
                        configuration.provider,
                      )}
                    </p>
                  </div>

                  <span
                    className={
                      operational
                        ? "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                        : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                    }
                  >
                    {operational
                      ? "Operativo"
                      : "No operativo"}
                  </span>
                </div>

                <div
                  className={
                    platformStatus.configured
                      ? "mt-6 rounded-xl border border-green-200 bg-green-50 p-4"
                      : "mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
                  }
                >
                  <p
                    className={
                      platformStatus.configured
                        ? "font-semibold text-green-900"
                        : "font-semibold text-amber-900"
                    }
                  >
                    {platformStatus.title}
                  </p>

                  <p
                    className={
                      platformStatus.configured
                        ? "mt-1 text-sm leading-6 text-green-800"
                        : "mt-1 text-sm leading-6 text-amber-800"
                    }
                  >
                    {
                      platformStatus.description
                    }
                  </p>
                </div>

                {configuration.provider ===
                "pagotic" ? (
                  <form
                    action={saveAction}
                    className="mt-7 space-y-6"
                  >
                    <label className="flex items-start gap-3">
                      <input
                        name="enabled"
                        type="checkbox"
                        defaultChecked={
                          configuration.enabled
                        }
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />

                      <span>
                        <span className="block font-medium text-slate-900">
                          Habilitar Pago TIC
                        </span>

                        <span className="mt-1 block text-sm text-slate-500">
                          Solo puede habilitarse
                          cuando el club tenga
                          Collector ID.
                        </span>
                      </span>
                    </label>

                    <div>
                      <label
                        htmlFor="mode-pagotic"
                        className="text-sm font-medium text-slate-700"
                      >
                        Modo
                      </label>

                      <select
                        id="mode-pagotic"
                        name="mode"
                        defaultValue={
                          configuration.mode
                        }
                        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
                      >
                        <option value="sandbox">
                          Pruebas / sandbox
                        </option>

                        <option value="production">
                          Producción
                        </option>
                      </select>
                    </div>

                    <div>
                      <label
                        htmlFor="merchant-pagotic"
                        className="text-sm font-medium text-slate-700"
                      >
                        Collector ID del club
                      </label>

                      <input
                        id="merchant-pagotic"
                        name="merchant_account_id"
                        type="text"
                        defaultValue={
                          configuration
                            .merchant_account_id ??
                          ""
                        }
                        placeholder="Identificador entregado por Pago TIC"
                        className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
                      />

                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        Identifica a la entidad
                        que debe recibir la
                        recaudación. No es una
                        contraseña ni un token.
                      </p>
                    </div>

                    <fieldset>
                      <legend className="text-sm font-medium text-slate-700">
                        Operaciones permitidas
                      </legend>

                      <div className="mt-3 space-y-3">
                        <label className="flex items-center gap-3">
                          <input
                            name="monthly_fees_enabled"
                            type="checkbox"
                            defaultChecked={
                              configuration
                                .monthly_fees_enabled
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />

                          <span className="text-sm text-slate-700">
                            Cuotas mensuales
                          </span>
                        </label>

                        <label className="flex items-center gap-3">
                          <input
                            name="automatic_debit_enabled"
                            type="checkbox"
                            defaultChecked={
                              configuration
                                .automatic_debit_enabled
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />

                          <span className="text-sm text-slate-700">
                            Adhesión y débito
                            automático
                          </span>
                        </label>

                        <label className="flex items-center gap-3">
                          <input
                            name="one_time_enabled"
                            type="checkbox"
                            defaultChecked={
                              configuration
                                .one_time_enabled
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />

                          <span className="text-sm text-slate-700">
                            Permitir también
                            pagos puntuales
                          </span>
                        </label>
                      </div>
                    </fieldset>

                    <button
                      type="submit"
                      className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
                    >
                      Guardar Pago TIC
                    </button>
                  </form>
                ) : (
                  <div className="mt-7">
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-5">
                      <p className="font-semibold text-slate-900">
                        Segunda etapa
                      </p>

                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        Mercado Pago se
                        incorporará mediante
                        OAuth para que cada club
                        conecte su propia cuenta.
                        Hasta entonces permanecerá
                        deshabilitado.
                      </p>
                    </div>

                    <form
                      action={saveAction}
                      className="mt-4"
                    >
                      <input
                        type="hidden"
                        name="mode"
                        value={
                          configuration.mode
                        }
                      />

                      <input
                        type="hidden"
                        name="merchant_account_id"
                        value=""
                      />

                      <button
                        type="submit"
                        className="w-full rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
                      >
                        Mantener deshabilitado
                      </button>
                    </form>
                  </div>
                )}
              </article>
            );
          },
        )}
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Proveedores predeterminados
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Pago TIC debe ser la opción
          predeterminada para mensualidades.
          Los pagos puntuales pueden quedar sin
          proveedor hasta incorporar Mercado
          Pago por club.
        </p>

        <form
          action={updateDefaultProviders}
          className="mt-6 grid gap-6 md:grid-cols-2"
        >
          <div>
            <label
              htmlFor="monthly_provider"
              className="text-sm font-medium text-slate-700"
            >
              Mensualidades
            </label>

            <select
              id="monthly_provider"
              name="monthly_provider"
              defaultValue={
                currentMonthlyProvider
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              <option value="">
                Sin proveedor predeterminado
              </option>

              {monthlyOptions.map(
                (configuration) => (
                  <option
                    key={
                      configuration.provider
                    }
                    value={
                      configuration.provider
                    }
                  >
                    {providerName(
                      configuration.provider,
                    )}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="one_time_provider"
              className="text-sm font-medium text-slate-700"
            >
              Pagos puntuales
            </label>

            <select
              id="one_time_provider"
              name="one_time_provider"
              defaultValue={
                currentOneTimeProvider
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              <option value="">
                Sin proveedor predeterminado
              </option>

              {oneTimeOptions.map(
                (configuration) => (
                  <option
                    key={
                      configuration.provider
                    }
                    value={
                      configuration.provider
                    }
                  >
                    {providerName(
                      configuration.provider,
                    )}
                  </option>
                ),
              )}
            </select>
          </div>

          <div className="md:col-span-2">
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Guardar proveedores
              predeterminados
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="font-semibold text-slate-900">
          Separación de credenciales
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Las credenciales técnicas generales
          se administran únicamente en el
          servidor de ClubSmart. En esta pantalla
          se guarda solamente el identificador
          público de la entidad recaudadora
          correspondiente al club.
        </p>
      </section>
    </div>
  );
}