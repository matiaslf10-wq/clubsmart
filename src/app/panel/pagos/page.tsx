import Link from "next/link";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  searchParams: Promise<{
    anio?: string;
    mes?: string;
    proveedor?: string;
    estado?: string;
    buscar?: string;
  }>;
};

type MemberRelation = {
  id: string;
  first_name: string;
  last_name: string;
  dni: string | null;
};

type ActivityRelation = {
  id: string;
  name: string;
};

type MonthlyFeeRelation = {
  id: string;
  year: number;
  month: number;
  amount: number | string;
  paid_amount: number | string;
  status: string;
  due_date: string | null;
};

type SubscriptionRelation = {
  id: string;
  provider_subscription_id: string | null;
  status: string;
};

type PaymentRow = {
  id: string;
  member_id: string | null;
  activity_id: string | null;
  monthly_fee_id: string | null;
  payment_subscription_id: string | null;

  provider: string;
  provider_payment_id: string | null;
  provider_reference: string | null;
  provider_preference_id: string | null;
  external_reference: string | null;

  amount: number | string;
  currency: string | null;

  status: string;
  provider_status: string | null;
  payment_kind: string;
  payment_method: string | null;

  paid_at: string | null;
  notes: string | null;

  failure_code: string | null;
  failure_message: string | null;

  created_at: string;
  updated_at: string;

  members:
    | MemberRelation
    | MemberRelation[]
    | null;

  activities:
    | ActivityRelation
    | ActivityRelation[]
    | null;

  monthly_fees:
    | MonthlyFeeRelation
    | MonthlyFeeRelation[]
    | null;

  payment_subscriptions:
    | SubscriptionRelation
    | SubscriptionRelation[]
    | null;
};

type PaymentStatus =
  | "created"
  | "pending"
  | "in_process"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded"
  | "charged_back"
  | "error";

type KnownProvider =
  | "manual"
  | "mercado_pago"
  | "pagotic";

export const dynamic = "force-dynamic";

const monthNames = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

const validStatuses =
  new Set<PaymentStatus>([
    "created",
    "pending",
    "in_process",
    "approved",
    "rejected",
    "cancelled",
    "refunded",
    "charged_back",
    "error",
  ]);

const validProviders =
  new Set<KnownProvider>([
    "manual",
    "mercado_pago",
    "pagotic",
  ]);

function getTodayArgentina() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone:
      "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function getCurrentPeriod() {
  const [year, month] =
    getTodayArgentina()
      .split("-")
      .map(Number);

  return {
    year,
    month,
  };
}

function padNumber(value: number) {
  return String(value).padStart(2, "0");
}

function buildPeriodRange(
  year: number,
  month: number,
) {
  const nextMonth =
    month === 12 ? 1 : month + 1;

  const nextYear =
    month === 12 ? year + 1 : year;

  return {
    start:
      `${year}-${padNumber(month)}-01T00:00:00-03:00`,

    end:
      `${nextYear}-${padNumber(nextMonth)}-01T00:00:00-03:00`,
  };
}

function getSingleRelation<T>(
  value: T | T[] | null,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function sanitizeSearch(value: string) {
  return value
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
}

function formatMoney(
  value: number | string,
  currency = "ARS",
) {
  const amount = Number(value);

  if (!Number.isFinite(amount)) {
    return "Importe inválido";
  }

  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString(
      "es-AR",
    )} ${currency}`;
  }
}

function formatDateTime(
  value: string | null,
) {
  if (!value) {
    return "Sin fecha";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      dateStyle: "short",
      timeStyle: "short",
      timeZone:
        "America/Argentina/Buenos_Aires",
    },
  ).format(new Date(value));
}

function formatDate(value: string | null) {
  if (!value) {
    return "Sin vencimiento";
  }

  return new Intl.DateTimeFormat(
    "es-AR",
  ).format(
    new Date(
      `${value}T12:00:00.000Z`,
    ),
  );
}

function formatDni(value: string | null) {
  if (!value) {
    return "Sin DNI";
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    return value;
  }

  return new Intl.NumberFormat(
    "es-AR",
  ).format(numericValue);
}

function providerLabel(provider: string) {
  if (provider === "manual") {
    return "Manual";
  }

  if (provider === "mercado_pago") {
    return "Mercado Pago";
  }

  if (provider === "pagotic") {
    return "Pago TIC";
  }

  return provider;
}

function providerClassName(provider: string) {
  if (provider === "manual") {
    return "bg-slate-100 text-slate-700";
  }

  if (provider === "mercado_pago") {
    return "bg-sky-100 text-sky-800";
  }

  if (provider === "pagotic") {
    return "bg-indigo-100 text-indigo-800";
  }

  return "bg-slate-100 text-slate-700";
}

function normalizeStatus(
  status: string,
): PaymentStatus {
  if (
    validStatuses.has(
      status as PaymentStatus,
    )
  ) {
    return status as PaymentStatus;
  }

  return "error";
}

function statusLabel(
  status: PaymentStatus,
) {
  const labels: Record<
    PaymentStatus,
    string
  > = {
    created: "Creado",
    pending: "Pendiente",
    in_process: "En proceso",
    approved: "Aprobado",
    rejected: "Rechazado",
    cancelled: "Cancelado",
    refunded: "Reintegrado",
    charged_back: "Contracargo",
    error: "Error",
  };

  return labels[status];
}

function statusClassName(
  status: PaymentStatus,
) {
  const classes: Record<
    PaymentStatus,
    string
  > = {
    created:
      "bg-slate-100 text-slate-700",

    pending:
      "bg-amber-100 text-amber-800",

    in_process:
      "bg-blue-100 text-blue-800",

    approved:
      "bg-green-100 text-green-800",

    rejected:
      "bg-red-100 text-red-800",

    cancelled:
      "bg-slate-100 text-slate-600",

    refunded:
      "bg-violet-100 text-violet-800",

    charged_back:
      "bg-orange-100 text-orange-800",

    error:
      "bg-red-100 text-red-800",
  };

  return classes[status];
}

function paymentKindLabel(value: string) {
  const labels: Record<string, string> = {
    monthly_fee: "Cuota mensual",
    one_time: "Pago puntual",
    reservation: "Reserva",
    event: "Evento",
    other: "Otro concepto",
  };

  return labels[value] ?? value;
}

function monthlyFeeStatusLabel(
  value: string,
) {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    partial: "Parcial",
    paid: "Pagada",
    overdue: "Vencida",
    cancelled: "Anulada",
    exempt: "Exenta",
  };

  return labels[value] ?? value;
}

export default async function PaymentsPage({
  searchParams,
}: PageProps) {
  const context = await getAdminContext();
  const params = await searchParams;

  const currentPeriod =
    getCurrentPeriod();

  const parsedYear =
    Number(params.anio);

  const parsedMonth =
    Number(params.mes);

  const selectedYear =
    Number.isInteger(parsedYear) &&
    parsedYear >= 2020 &&
    parsedYear <= 2200
      ? parsedYear
      : currentPeriod.year;

  const selectedMonth =
    Number.isInteger(parsedMonth) &&
    parsedMonth >= 1 &&
    parsedMonth <= 12
      ? parsedMonth
      : currentPeriod.month;

  const selectedProvider =
    params.proveedor &&
    validProviders.has(
      params.proveedor as KnownProvider,
    )
      ? params.proveedor
      : "todos";

  const selectedStatus =
    params.estado &&
    validStatuses.has(
      params.estado as PaymentStatus,
    )
      ? params.estado
      : "todos";

  const search = sanitizeSearch(
    params.buscar ?? "",
  );

  const periodRange =
    buildPeriodRange(
      selectedYear,
      selectedMonth,
    );

  const supabase =
    createAdminClient();

  let query = supabase
    .from("payments")
    .select(`
      id,
      member_id,
      activity_id,
      monthly_fee_id,
      payment_subscription_id,

      provider,
      provider_payment_id,
      provider_reference,
      provider_preference_id,
      external_reference,

      amount,
      currency,

      status,
      provider_status,
      payment_kind,
      payment_method,

      paid_at,
      notes,

      failure_code,
      failure_message,

      created_at,
      updated_at,

      members (
        id,
        first_name,
        last_name,
        dni
      ),

      activities (
        id,
        name
      ),

      monthly_fees (
        id,
        year,
        month,
        amount,
        paid_amount,
        status,
        due_date
      ),

      payment_subscriptions (
        id,
        provider_subscription_id,
        status
      )
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .gte(
      "created_at",
      periodRange.start,
    )
    .lt(
      "created_at",
      periodRange.end,
    )
    .order("created_at", {
      ascending: false,
    })
    .limit(500);

  if (selectedProvider !== "todos") {
    query = query.eq(
      "provider",
      selectedProvider,
    );
  }

  if (selectedStatus !== "todos") {
    query = query.eq(
      "status",
      selectedStatus,
    );
  }

  const {
    data: paymentsData,
    error,
  } = await query;

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-900">
          No fue posible cargar los pagos
        </h1>

        <p className="mt-3 text-red-800">
          {error.message}
        </p>
      </div>
    );
  }

  const payments =
    (paymentsData ??
      []) as unknown as PaymentRow[];

  const preparedPayments =
    payments.map((payment) => {
      const member =
        getSingleRelation(
          payment.members,
        );

      const activity =
        getSingleRelation(
          payment.activities,
        );

      const monthlyFee =
        getSingleRelation(
          payment.monthly_fees,
        );

      const subscription =
        getSingleRelation(
          payment
            .payment_subscriptions,
        );

      const normalizedStatus =
        normalizeStatus(
          payment.status,
        );

      const searchableText = [
        member?.first_name,
        member?.last_name,
        member?.dni,
        activity?.name,
        payment.provider,
        providerLabel(
          payment.provider,
        ),
        payment.provider_payment_id,
        payment.provider_reference,
        payment.provider_preference_id,
        payment.external_reference,
        payment.payment_method,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");

      return {
        payment,
        member,
        activity,
        monthlyFee,
        subscription,
        normalizedStatus,
        searchableText,
      };
    });

  const filteredPayments =
    preparedPayments.filter(
      (item) =>
        !search ||
        item.searchableText.includes(
          search,
        ),
    );

  const approvedPayments =
    filteredPayments.filter(
      (item) =>
        item.normalizedStatus ===
        "approved",
    );

  const approvedAmount =
    approvedPayments.reduce(
      (total, item) =>
        total +
        Number(item.payment.amount),
      0,
    );

  const inProgressCount =
    filteredPayments.filter(
      (item) =>
        item.normalizedStatus ===
          "created" ||
        item.normalizedStatus ===
          "pending" ||
        item.normalizedStatus ===
          "in_process",
    ).length;

  const failedCount =
    filteredPayments.filter(
      (item) =>
        item.normalizedStatus ===
          "rejected" ||
        item.normalizedStatus ===
          "error" ||
        item.normalizedStatus ===
          "charged_back",
    ).length;

  const hasActiveFilters =
    selectedProvider !== "todos" ||
    selectedStatus !== "todos" ||
    Boolean(search);

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Pagos
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Consultá en un único lugar los pagos
            manuales, Mercado Pago y Pago TIC.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/panel/cuotas"
            className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Ver cuotas
          </Link>

          <Link
            href="/panel/pagos/configuracion"
            className="inline-flex justify-center rounded-lg border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
          >
            Configurar proveedores
          </Link>
        </div>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Operaciones
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {filteredPayments.length}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Total aprobado
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700">
            {formatMoney(
              approvedAmount,
              "ARS",
            )}
          </p>

          <p className="mt-2 text-xs text-slate-500">
            {approvedPayments.length === 1
              ? "1 operación aprobada"
              : `${approvedPayments.length} operaciones aprobadas`}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Pendientes o en proceso
          </p>

          <p className="mt-2 text-3xl font-bold text-amber-700">
            {inProgressCount}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Con inconvenientes
          </p>

          <p className="mt-2 text-3xl font-bold text-red-700">
            {failedCount}
          </p>
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <form
          method="get"
          className="grid gap-4 md:grid-cols-2 xl:grid-cols-[0.7fr_1fr_1fr_1fr_1.5fr_auto]"
        >
          <div>
            <label
              htmlFor="anio"
              className="text-sm font-medium text-slate-700"
            >
              Año
            </label>

            <input
              id="anio"
              name="anio"
              type="number"
              min="2020"
              max="2200"
              defaultValue={selectedYear}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label
              htmlFor="mes"
              className="text-sm font-medium text-slate-700"
            >
              Mes
            </label>

            <select
              id="mes"
              name="mes"
              defaultValue={selectedMonth}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              {monthNames.map(
                (monthName, index) => (
                  <option
                    key={monthName}
                    value={index + 1}
                  >
                    {monthName}
                  </option>
                ),
              )}
            </select>
          </div>

          <div>
            <label
              htmlFor="proveedor"
              className="text-sm font-medium text-slate-700"
            >
              Proveedor
            </label>

            <select
              id="proveedor"
              name="proveedor"
              defaultValue={
                selectedProvider
              }
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              <option value="todos">
                Todos
              </option>

              <option value="manual">
                Manual
              </option>

              <option value="mercado_pago">
                Mercado Pago
              </option>

              <option value="pagotic">
                Pago TIC
              </option>
            </select>
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
              defaultValue={selectedStatus}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              <option value="todos">
                Todos
              </option>

              <option value="created">
                Creados
              </option>

              <option value="pending">
                Pendientes
              </option>

              <option value="in_process">
                En proceso
              </option>

              <option value="approved">
                Aprobados
              </option>

              <option value="rejected">
                Rechazados
              </option>

              <option value="cancelled">
                Cancelados
              </option>

              <option value="refunded">
                Reintegrados
              </option>

              <option value="charged_back">
                Contracargos
              </option>

              <option value="error">
                Con error
              </option>
            </select>
          </div>

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
              placeholder="Persona, DNI, actividad o referencia"
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Aplicar
            </button>
          </div>
        </form>

        {hasActiveFilters ? (
          <div className="mt-4">
            <Link
              href={`/panel/pagos?anio=${selectedYear}&mes=${selectedMonth}`}
              className="text-sm font-semibold text-blue-700 hover:text-blue-800"
            >
              Limpiar proveedor, estado y búsqueda
            </Link>
          </div>
        ) : null}
      </section>

      {filteredPayments.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-xl font-semibold text-slate-900">
            No hay pagos para mostrar
          </h2>

          <p className="mt-3 text-slate-600">
            Todavía no se registraron operaciones
            durante este período o los filtros no
            encontraron resultados.
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {filteredPayments.map(
            ({
              payment,
              member,
              activity,
              monthlyFee,
              subscription,
              normalizedStatus,
            }) => {
              const memberName = member
                ? `${member.first_name} ${member.last_name}`
                : "Sin persona vinculada";

              return (
                <article
                  key={payment.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${providerClassName(
                            payment.provider,
                          )}`}
                        >
                          {providerLabel(
                            payment.provider,
                          )}
                        </span>

                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(
                            normalizedStatus,
                          )}`}
                        >
                          {statusLabel(
                            normalizedStatus,
                          )}
                        </span>
                      </div>

                      <h2 className="mt-4 text-lg font-bold text-slate-900">
                        {memberName}
                      </h2>

                      <p className="mt-2 text-sm text-slate-600">
                        {activity?.name ??
                          "Sin actividad vinculada"}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        DNI:{" "}
                        {formatDni(
                          member?.dni ?? null,
                        )}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        Concepto:{" "}
                        {paymentKindLabel(
                          payment.payment_kind,
                        )}
                      </p>
                    </div>

                    <div className="lg:text-right">
                      <p className="text-3xl font-bold text-slate-900">
                        {formatMoney(
                          payment.amount,
                          payment.currency ??
                            "ARS",
                        )}
                      </p>

                      <p className="mt-2 text-sm text-slate-500">
                        {payment.paid_at
                          ? `Pagado: ${formatDateTime(
                              payment.paid_at,
                            )}`
                          : `Creado: ${formatDateTime(
                              payment.created_at,
                            )}`}
                      </p>

                      {payment.payment_method ? (
                        <p className="mt-1 text-sm text-slate-500">
                          Medio:{" "}
                          {payment.payment_method}
                        </p>
                      ) : null}
                    </div>
                  </div>

                  {monthlyFee ? (
                    <div className="mt-6 grid gap-4 rounded-xl border border-blue-100 bg-blue-50 p-5 sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Cuota
                        </p>

                        <p className="mt-1 font-semibold text-blue-950">
                          {
                            monthNames[
                              monthlyFee.month -
                                1
                            ]
                          }{" "}
                          {monthlyFee.year}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Importe
                        </p>

                        <p className="mt-1 font-semibold text-blue-950">
                          {formatMoney(
                            monthlyFee.amount,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Estado de cuota
                        </p>

                        <p className="mt-1 font-semibold text-blue-950">
                          {monthlyFeeStatusLabel(
                            monthlyFee.status,
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                          Vencimiento
                        </p>

                        <p className="mt-1 font-semibold text-blue-950">
                          {formatDate(
                            monthlyFee.due_date,
                          )}
                        </p>
                      </div>
                    </div>
                  ) : null}

                  {payment.notes ||
                  payment.failure_message ? (
                    <div className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-700">
                      {payment.notes ? (
                        <p>
                          <span className="font-semibold">
                            Observación:
                          </span>{" "}
                          {payment.notes}
                        </p>
                      ) : null}

                      {payment.failure_message ? (
                        <p
                          className={
                            payment.notes
                              ? "mt-2 text-red-700"
                              : "text-red-700"
                          }
                        >
                          <span className="font-semibold">
                            Error:
                          </span>{" "}
                          {payment.failure_message}
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <details className="mt-5 rounded-xl border border-slate-200 bg-slate-50">
                    <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-slate-700">
                      Referencias técnicas
                    </summary>

                    <div className="space-y-3 border-t border-slate-200 px-4 py-4 text-sm">
                      <div>
                        <p className="text-xs font-semibold uppercase text-slate-400">
                          ID interno
                        </p>

                        <code className="mt-1 block break-all text-slate-700">
                          {payment.id}
                        </code>
                      </div>

                      {payment.external_reference ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            Referencia externa
                          </p>

                          <code className="mt-1 block break-all text-slate-700">
                            {
                              payment.external_reference
                            }
                          </code>
                        </div>
                      ) : null}

                      {payment.provider_payment_id ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            ID del proveedor
                          </p>

                          <code className="mt-1 block break-all text-slate-700">
                            {
                              payment.provider_payment_id
                            }
                          </code>
                        </div>
                      ) : null}

                      {payment.provider_preference_id ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            Preferencia
                          </p>

                          <code className="mt-1 block break-all text-slate-700">
                            {
                              payment.provider_preference_id
                            }
                          </code>
                        </div>
                      ) : null}

                      {payment.provider_status ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            Estado original
                          </p>

                          <code className="mt-1 block break-all text-slate-700">
                            {
                              payment.provider_status
                            }
                          </code>
                        </div>
                      ) : null}

                      {subscription
                        ?.provider_subscription_id ? (
                        <div>
                          <p className="text-xs font-semibold uppercase text-slate-400">
                            Adhesión
                          </p>

                          <code className="mt-1 block break-all text-slate-700">
                            {
                              subscription.provider_subscription_id
                            }
                          </code>
                        </div>
                      ) : null}
                    </div>
                  </details>
                </article>
              );
            },
          )}
        </section>
      )}

      {payments.length >= 500 ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Se muestran como máximo 500 operaciones.
          Aplicá filtros más específicos para
          reducir los resultados.
        </div>
      ) : null}
    </div>
  );
}