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

type CredentialStatus = {
  configured: boolean;
  missingVariables: string[];
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
    ? "Cuotas mensuales, adhesiones y débito automático."
    : "Pagos puntuales, cuotas manuales, eventos, señas y reservas.";
}

function getCredentialStatus(
  provider: PaymentProvider,
): CredentialStatus {
  const variableNames =
    provider === "pagotic"
      ? [
          "PAGOTIC_USERNAME",
          "PAGOTIC_PASSWORD",
          "PAGOTIC_CLIENT_ID",
          "PAGOTIC_CLIENT_SECRET",
          "PAGOTIC_COLLECTOR_ID",
        ]
      : [
          "MERCADO_PAGO_ACCESS_TOKEN",
          "MERCADO_PAGO_WEBHOOK_SECRET",
        ];

  const missingVariables =
    variableNames.filter(
      (variableName) =>
        !process.env[
          variableName
        ]?.trim(),
    );

  return {
    configured:
      missingVariables.length === 0,

    missingVariables,
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
    .eq("club_id", context.clubId);

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
        No fue posible cargar la configuración
        de pagos
      </h1>

      <p className="mt-3 text-red-800">
        Revisá la conexión administrativa con
        Supabase y las variables de entorno del
        servidor.
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

  const monthlyOptions =
    orderedConfigurations.filter(
      (configuration) =>
        configuration.enabled &&
        configuration
          .monthly_fees_enabled,
    );

  const oneTimeOptions =
    orderedConfigurations.filter(
      (configuration) =>
        configuration.enabled &&
        configuration.one_time_enabled,
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
          Habilitá los proveedores disponibles
          y definí cuál se utilizará para las
          mensualidades y los pagos puntuales.
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

      <section className="mt-8 grid gap-6 xl:grid-cols-2">
        {orderedConfigurations.map(
          (configuration) => {
            const credentials =
              getCredentialStatus(
                configuration.provider,
              );

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
                      configuration.enabled
                        ? "inline-flex rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                        : "inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600"
                    }
                  >
                    {configuration.enabled
                      ? "Habilitado"
                      : "Deshabilitado"}
                  </span>
                </div>

                <div
                  className={
                    credentials.configured
                      ? "mt-6 rounded-xl border border-green-200 bg-green-50 p-4"
                      : "mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4"
                  }
                >
                  <p
                    className={
                      credentials.configured
                        ? "font-semibold text-green-900"
                        : "font-semibold text-amber-900"
                    }
                  >
                    {credentials.configured
                      ? "Credenciales configuradas"
                      : "Credenciales incompletas"}
                  </p>

                  <p
                    className={
                      credentials.configured
                        ? "mt-1 text-sm text-green-800"
                        : "mt-1 text-sm text-amber-800"
                    }
                  >
                    {credentials.configured
                      ? "Las variables necesarias están disponibles en el servidor."
                      : `Faltan ${credentials.missingVariables.length} variables de entorno.`}
                  </p>

                  {!credentials.configured ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {credentials
                        .missingVariables
                        .map(
                          (
                            variableName,
                          ) => (
                            <code
                              key={
                                variableName
                              }
                              className="rounded bg-white/70 px-2 py-1 text-xs text-amber-900"
                            >
                              {variableName}
                            </code>
                          ),
                        )}
                    </div>
                  ) : null}
                </div>

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
                        Habilitar proveedor
                      </span>

                      <span className="mt-1 block text-sm text-slate-500">
                        Permite que este club
                        utilice el proveedor.
                      </span>
                    </span>
                  </label>

                  <div>
                    <label
                      htmlFor={`mode-${configuration.provider}`}
                      className="text-sm font-medium text-slate-700"
                    >
                      Modo
                    </label>

                    <select
                      id={`mode-${configuration.provider}`}
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
                      htmlFor={`merchant-${configuration.provider}`}
                      className="text-sm font-medium text-slate-700"
                    >
                      Identificador de cuenta
                    </label>

                    <input
                      id={`merchant-${configuration.provider}`}
                      name="merchant_account_id"
                      type="text"
                      defaultValue={
                        configuration
                          .merchant_account_id ??
                        ""
                      }
                      placeholder={
                        configuration.provider ===
                        "pagotic"
                          ? "Collector ID"
                          : "User ID o cuenta vendedora"
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
                    />

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Este campo no debe contener
                      contraseñas, tokens ni
                      secretos.
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
                          name="one_time_enabled"
                          type="checkbox"
                          defaultChecked={
                            configuration
                              .one_time_enabled
                          }
                          className="h-4 w-4 rounded border-slate-300"
                        />

                        <span className="text-sm text-slate-700">
                          Pagos puntuales
                        </span>
                      </label>

                      {configuration.provider ===
                      "pagotic" ? (
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
                      ) : null}
                    </div>
                  </fieldset>

                  <button
                    type="submit"
                    className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
                  >
                    Guardar configuración
                  </button>
                </form>
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
          ClubSmart utilizará estas opciones por
          defecto. Una operación particular podrá
          ofrecer más de un medio de pago.
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
              Guardar proveedores predeterminados
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-6">
        <h2 className="font-semibold text-blue-950">
          Seguridad de las credenciales
        </h2>

        <p className="mt-2 text-sm leading-6 text-blue-900">
          Los tokens, contraseñas y secretos no
          se guardan en esta pantalla ni se
          envían al navegador. Se configuran como
          variables privadas del servidor en
          Vercel.
        </p>
      </section>
    </div>
  );
}