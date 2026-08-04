import Link from "next/link";
import { redirect } from "next/navigation";

import {
  cancelPaymentBatch,
  createPaymentBatch,
  markPaymentBatchReady,
  refreshPaymentBatch,
} from "@/app/panel/pagos/lotes/actions";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    anio?: string;
    mes?: string;
    lote?: string;
    error?: string;
    success?: string;
  }>;
};

type RelatedMember = {
  id: string;
  first_name: string;
  last_name: string;
  dni: string | null;
};

type RelatedActivity = {
  id: string;
  name: string;
};

type MonthlyFee = {
  id: string;
  member_id: string;
  activity_id: string;
  year: number;
  month: number;
  amount: number | string;
  paid_amount: number | string;
  status: string;
  due_date: string | null;

  members: RelatedMember | RelatedMember[] | null;

  activities: RelatedActivity | RelatedActivity[] | null;
};

type Subscription = {
  id: string;
  member_id: string;
  activity_id: string;
  status: string;
};

type PaymentBatch = {
  id: string;
  name: string;
  year: number;
  month: number;
  status: string;

  total_items: number;
  ready_items: number;
  blocked_items: number;

  total_amount: number | string;

  ready_amount: number | string;

  prepared_at: string | null;
  sent_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;

  created_at: string;
};

type PaymentBatchItem = {
  id: string;
  monthly_fee_id: string;
  payment_subscription_id: string | null;

  member_name: string;
  member_dni: string | null;
  activity_name: string;

  fee_year: number;
  fee_month: number;
  due_date: string | null;

  fee_amount: number | string;

  paid_amount: number | string;

  amount: number | string;

  status: string;
  block_reason: string | null;

  provider_status: string | null;

  error_message: string | null;
};

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

const openBatchStatuses = [
  "draft",
  "ready",
  "processing",
  "sent",
  "partially_processed",
];

function getCurrentPeriod() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",

    year: "numeric",
    month: "2-digit",
  })
    .format(new Date())
    .split("-");

  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
  };
}

function getSingleRelation<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function formatMoney(value: number | string) {
  const amount = Number(value);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(Number.isFinite(amount) ? amount : 0);
}

function formatDate(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value.includes("T") ? value : `${value}T12:00:00.000Z`));
}

function formatDni(value: string | null) {
  if (!value) {
    return "Sin DNI";
  }

  const numericValue = Number(value);

  return Number.isFinite(numericValue)
    ? new Intl.NumberFormat("es-AR").format(numericValue)
    : value;
}

function getBatchStatus(status: string) {
  const contents: Record<
    string,
    {
      label: string;
      className: string;
    }
  > = {
    draft: {
      label: "Borrador",
      className: "bg-slate-100 text-slate-700",
    },

    ready: {
      label: "Preparado",
      className: "bg-blue-100 text-blue-800",
    },

    processing: {
      label: "Procesando",
      className: "bg-amber-100 text-amber-800",
    },

    sent: {
      label: "Enviado",
      className: "bg-violet-100 text-violet-800",
    },

    partially_processed: {
      label: "Procesado parcialmente",
      className: "bg-amber-100 text-amber-800",
    },

    completed: {
      label: "Completado",
      className: "bg-green-100 text-green-800",
    },

    cancelled: {
      label: "Cancelado",
      className: "bg-red-100 text-red-800",
    },

    error: {
      label: "Con error",
      className: "bg-red-100 text-red-800",
    },
  };

  return (
    contents[status] ?? {
      label: status,
      className: "bg-slate-100 text-slate-700",
    }
  );
}

function getItemStatus(status: string) {
  if (status === "ready") {
    return {
      label: "Preparada",
      className: "bg-green-100 text-green-800",
    };
  }

  if (status === "blocked") {
    return {
      label: "Bloqueada",
      className: "bg-red-100 text-red-800",
    };
  }

  return {
    label: status,
    className: "bg-slate-100 text-slate-700",
  };
}

export default async function PaymentBatchesPage({ searchParams }: PageProps) {
  const context = await getAdminContext();

  if (context.role !== "owner" && context.role !== "admin") {
    redirect("/panel");
  }

  const parameters = await searchParams;

  const currentPeriod = getCurrentPeriod();

  const parsedYear = Number(parameters.anio);

  const parsedMonth = Number(parameters.mes);

  const selectedYear =
    Number.isInteger(parsedYear) && parsedYear >= 2020 && parsedYear <= 2200
      ? parsedYear
      : currentPeriod.year;

  const selectedMonth =
    Number.isInteger(parsedMonth) && parsedMonth >= 1 && parsedMonth <= 12
      ? parsedMonth
      : currentPeriod.month;

  const selectedBatchId = parameters.lote ?? "";

  const supabase = createAdminClient();

  const [feesResult, batchesResult, configurationResult] = await Promise.all([
    supabase
      .from("monthly_fees")
      .select(
        `
        id,
        member_id,
        activity_id,
        year,
        month,
        amount,
        paid_amount,
        status,
        due_date,

        members (
          id,
          first_name,
          last_name,
          dni
        ),

        activities (
          id,
          name
        )
      `,
      )
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .in("status", ["pending", "partial", "overdue"])
      .order("due_date", {
        ascending: true,
      }),

    supabase
      .from("payment_batches")
      .select(
        `
        id,
        name,
        year,
        month,
        status,
        total_items,
        ready_items,
        blocked_items,
        total_amount,
        ready_amount,
        prepared_at,
        sent_at,
        completed_at,
        cancelled_at,
        created_at
      `,
      )
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .eq("year", selectedYear)
      .eq("month", selectedMonth)
      .order("created_at", {
        ascending: false,
      }),

    supabase
      .from("club_payment_providers")
      .select(
        `
        id,
        enabled,
        connection_status,
        automatic_debit_enabled,
        merchant_account_id
      `,
      )
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .eq("provider", "pagotic")
      .maybeSingle(),
  ]);

  if (feesResult.error) {
    throw new Error(
      `No fue posible cargar las cuotas: ${feesResult.error.message}`,
    );
  }

  if (batchesResult.error) {
    throw new Error(
      `No fue posible cargar los lotes: ${batchesResult.error.message}`,
    );
  }

  if (configurationResult.error) {
    throw new Error(
      `No fue posible cargar la configuración de Pago TIC: ${configurationResult.error.message}`,
    );
  }

  const fees = (feesResult.data ?? []) as unknown as MonthlyFee[];

  const batches = (batchesResult.data ?? []) as PaymentBatch[];

  const configuration = configurationResult.data;

  const memberIds = Array.from(new Set(fees.map((fee) => fee.member_id)));

  const activityIds = Array.from(new Set(fees.map((fee) => fee.activity_id)));

  let subscriptions: Subscription[] = [];

  if (configuration && memberIds.length > 0 && activityIds.length > 0) {
    const { data, error } = await supabase
      .from("payment_subscriptions")
      .select(
        `
        id,
        member_id,
        activity_id,
        status
      `,
      )
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .eq("provider", "pagotic")
      .eq("provider_configuration_id", configuration.id)
      .eq("status", "active")
      .in("member_id", memberIds)
      .in("activity_id", activityIds);

    if (error) {
      throw new Error(`No fue posible cargar las adhesiones: ${error.message}`);
    }

    subscriptions = (data ?? []) as Subscription[];
  }

  const activeSubscriptionKeys = new Set(
    subscriptions.map(
      (subscription) => `${subscription.member_id}:${subscription.activity_id}`,
    ),
  );

  const feeIds = fees.map((fee) => fee.id);

  const feeIdsInOpenBatch = new Set<string>();

  if (feeIds.length > 0) {
    const { data: existingItems, error: existingItemsError } = await supabase
      .from("payment_batch_items")
      .select(
        `
        monthly_fee_id,
        batch_id
      `,
      )
      .in("monthly_fee_id", feeIds);

    if (existingItemsError) {
      throw new Error(
        `No fue posible verificar los lotes existentes: ${existingItemsError.message}`,
      );
    }

    const relatedBatchIds = Array.from(
      new Set((existingItems ?? []).map((item) => item.batch_id)),
    );

    if (relatedBatchIds.length > 0) {
      const { data: openBatches, error: openBatchesError } = await supabase
        .from("payment_batches")
        .select("id")
        .in("id", relatedBatchIds)
        .eq("organization_id", context.organizationId)
        .eq("club_id", context.clubId)
        .in("status", openBatchStatuses);

      if (openBatchesError) {
        throw new Error(
          `No fue posible verificar los lotes abiertos: ${openBatchesError.message}`,
        );
      }

      const openBatchIds = new Set(
        (openBatches ?? []).map((batch) => batch.id),
      );

      for (const item of existingItems ?? []) {
        if (openBatchIds.has(item.batch_id)) {
          feeIdsInOpenBatch.add(item.monthly_fee_id);
        }
      }
    }
  }

  const preparedFees = fees
    .map((fee) => {
      const member = getSingleRelation(fee.members);

      const activity = getSingleRelation(fee.activities);

      const feeAmount = Number(fee.amount);

      const paidAmount = Number(fee.paid_amount);

      const remainingAmount = Math.max(feeAmount - paidAmount, 0);

      const relationKey = `${fee.member_id}:${fee.activity_id}`;

      return {
        fee,
        member,
        activity,
        remainingAmount,

        hasActiveSubscription: activeSubscriptionKeys.has(relationKey),

        isInOpenBatch: feeIdsInOpenBatch.has(fee.id),
      };
    })
    .filter(
      (item) =>
        Number.isFinite(item.remainingAmount) && item.remainingAmount > 0,
    );

  const outstandingAmount = preparedFees.reduce(
    (total, item) => total + item.remainingAmount,
    0,
  );

  const withSubscriptionCount = preparedFees.filter(
    (item) => item.hasActiveSubscription,
  ).length;

  const configurationReady = Boolean(
    configuration?.enabled &&
    configuration.connection_status === "active" &&
    configuration.automatic_debit_enabled &&
    configuration.merchant_account_id,
  );

  const selectedBatch =
    batches.find((batch) => batch.id === selectedBatchId) ?? null;

  let selectedBatchItems: PaymentBatchItem[] = [];

  if (selectedBatch) {
    const { data, error } = await supabase
      .from("payment_batch_items")
      .select(
        `
        id,
        monthly_fee_id,
        payment_subscription_id,
        member_name,
        member_dni,
        activity_name,
        fee_year,
        fee_month,
        due_date,
        fee_amount,
        paid_amount,
        amount,
        status,
        block_reason,
        provider_status,
        error_message
      `,
      )
      .eq("batch_id", selectedBatch.id)
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .order("member_name", {
        ascending: true,
      });

    if (error) {
      throw new Error(
        `No fue posible cargar el detalle del lote: ${error.message}`,
      );
    }

    selectedBatchItems = (data ?? []) as PaymentBatchItem[];
  }

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Lotes de cobro
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Agrupá cuotas pendientes, verificá adhesiones y prepará el cobro
            antes de enviarlo al proveedor.
          </p>
        </div>

        <Link
          href="/panel/pagos/adhesiones"
          className="inline-flex justify-center rounded-lg border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          Revisar adhesiones
        </Link>
      </div>

      {parameters.error ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {parameters.error}
        </div>
      ) : null}

      {parameters.success ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {parameters.success}
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="grid gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]">
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
            <label htmlFor="mes" className="text-sm font-medium text-slate-700">
              Mes
            </label>

            <select
              id="mes"
              name="mes"
              defaultValue={selectedMonth}
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3"
            >
              {monthNames.map((monthName, index) => (
                <option key={monthName} value={index + 1}>
                  {monthName}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Ver período
            </button>
          </div>
        </form>
      </section>

      {!configurationReady ? (
        <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-5 text-amber-900">
          <p className="font-semibold">Pago TIC todavía no está conectado</p>

          <p className="mt-2 text-sm leading-6">
            Podés crear y revisar lotes, pero sus cuotas no quedarán habilitadas
            para envío hasta completar la integración.
          </p>
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Cuotas pendientes"
          value={String(preparedFees.length)}
        />

        <SummaryCard
          label="Saldo pendiente"
          value={formatMoney(outstandingAmount)}
        />

        <SummaryCard
          label="Con adhesión activa"
          value={String(withSubscriptionCount)}
        />

        <SummaryCard
          label="Ya incluidas en lote"
          value={String(
            preparedFees.filter((item) => item.isInOpenBatch).length,
          )}
        />
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 p-6">
          <h2 className="text-xl font-bold text-slate-900">
            Preparar lote de {monthNames[selectedMonth - 1]} {selectedYear}
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Las cuotas sin adhesión o con problemas también pueden incluirse
            para identificarlas como bloqueadas durante la revisión.
          </p>
        </div>

        {preparedFees.length === 0 ? (
          <div className="p-8 text-center text-slate-600">
            No hay cuotas pendientes para este período.
          </div>
        ) : (
          <form action={createPaymentBatch}>
            <input type="hidden" name="year" value={selectedYear} />

            <input type="hidden" name="month" value={selectedMonth} />

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Incluir
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Persona
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Actividad
                    </th>

                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Adhesión
                    </th>

                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Saldo
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {preparedFees.map((item) => {
                    const { fee, member, activity } = item;

                    return (
                      <tr key={fee.id} className="align-top">
                        <td className="px-5 py-4">
                          <input
                            type="checkbox"
                            name="fee_id"
                            value={fee.id}
                            defaultChecked={!item.isInOpenBatch}
                            disabled={item.isInOpenBatch}
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        </td>

                        <td className="px-5 py-4">
                          <p className="font-semibold text-slate-900">
                            {member
                              ? `${member.first_name} ${member.last_name}`
                              : "Persona no disponible"}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            {formatDni(member?.dni ?? null)}
                          </p>

                          {item.isInOpenBatch ? (
                            <p className="mt-2 text-xs font-medium text-red-700">
                              Ya está en otro lote abierto
                            </p>
                          ) : null}
                        </td>

                        <td className="px-5 py-4 text-sm text-slate-700">
                          {activity?.name ?? "Actividad no disponible"}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            className={
                              item.hasActiveSubscription
                                ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                                : "rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-800"
                            }
                          >
                            {item.hasActiveSubscription
                              ? "Activa"
                              : "Sin adhesión"}
                          </span>
                        </td>

                        <td className="px-5 py-4 text-right font-semibold text-slate-900">
                          {formatMoney(item.remainingAmount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-200 p-6 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600">
                Crear el lote no realiza ningún cobro.
              </p>

              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
              >
                Crear lote borrador
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-bold text-slate-900">Lotes del período</h2>

        {batches.length === 0 ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            Todavía no se crearon lotes para este período.
          </div>
        ) : (
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {batches.map((batch) => {
              const status = getBatchStatus(batch.status);

              return (
                <article
                  key={batch.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="font-bold text-slate-900">{batch.name}</h3>

                      <p className="mt-1 text-xs text-slate-500">
                        Creado {formatDate(batch.created_at)}
                      </p>
                    </div>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <dt className="text-slate-500">Cuotas</dt>

                      <dd className="mt-1 font-semibold text-slate-900">
                        {batch.total_items}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">Total</dt>

                      <dd className="mt-1 font-semibold text-slate-900">
                        {formatMoney(batch.total_amount)}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">Preparadas</dt>

                      <dd className="mt-1 font-semibold text-green-700">
                        {batch.ready_items}
                      </dd>
                    </div>

                    <div>
                      <dt className="text-slate-500">Bloqueadas</dt>

                      <dd className="mt-1 font-semibold text-red-700">
                        {batch.blocked_items}
                      </dd>
                    </div>
                  </dl>

                  <Link
                    href={`/panel/pagos/lotes?anio=${selectedYear}&mes=${selectedMonth}&lote=${batch.id}`}
                    className="mt-5 inline-flex rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                  >
                    Revisar lote
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </section>

      {selectedBatch ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900">
                  Detalle de {selectedBatch.name}
                </h2>

                <p className="mt-2 text-sm text-slate-600">
                  Importe habilitado:{" "}
                  <strong>{formatMoney(selectedBatch.ready_amount)}</strong>
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                {selectedBatch.status === "draft" ? (
                  <form
                    action={refreshPaymentBatch.bind(
                      null,
                      selectedBatch.id,
                      selectedYear,
                      selectedMonth,
                    )}
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-blue-300 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                    >
                      Actualizar lote
                    </button>
                  </form>
                ) : null}
                {selectedBatch.status === "draft" &&
                selectedBatch.ready_items > 0 ? (
                  <form
                    action={markPaymentBatchReady.bind(
                      null,
                      selectedBatch.id,
                      selectedYear,
                      selectedMonth,
                    )}
                  >
                    <button
                      type="submit"
                      className="rounded-lg bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-700"
                    >
                      Marcar preparado
                    </button>
                  </form>
                ) : null}

                {["draft", "ready"].includes(selectedBatch.status) ? (
                  <form
                    action={cancelPaymentBatch.bind(
                      null,
                      selectedBatch.id,
                      selectedYear,
                      selectedMonth,
                    )}
                  >
                    <button
                      type="submit"
                      className="rounded-lg border border-red-300 bg-white px-5 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                    >
                      Cancelar lote
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Persona
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Actividad
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Estado
                  </th>

                  <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Observación
                  </th>

                  <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Importe
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-slate-100">
                {selectedBatchItems.map((item) => {
                  const status = getItemStatus(item.status);

                  return (
                    <tr key={item.id} className="align-top">
                      <td className="px-5 py-4">
                        <p className="font-semibold text-slate-900">
                          {item.member_name}
                        </p>

                        <p className="mt-1 text-xs text-slate-500">
                          {formatDni(item.member_dni)}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-slate-700">
                        {item.activity_name}
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${status.className}`}
                        >
                          {status.label}
                        </span>
                      </td>

                      <td className="max-w-md px-5 py-4 text-sm text-slate-600">
                        {item.block_reason ??
                          item.error_message ??
                          "Lista para el cobro"}
                      </td>

                      <td className="px-5 py-4 text-right font-semibold text-slate-900">
                        {formatMoney(item.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>

      <p className="mt-2 text-2xl font-bold text-slate-900">{value}</p>
    </article>
  );
}
