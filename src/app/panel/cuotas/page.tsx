import Link from "next/link";

import {
  generateMonthlyFees,
  markMonthlyFeeExempt,
  registerManualPayment,
} from "@/app/panel/cuotas/actions";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

type PageProps = {
  searchParams: Promise<{
    anio?: string;
    mes?: string;
    estado?: string;
    buscar?: string;
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

type MonthlyFeeRow = {
  id: string;
  member_id: string;
  activity_id: string;
  year: number;
  month: number;
  amount: number | string;
  paid_amount: number | string;
  status: string;
  due_date: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  members:
    | RelatedMember
    | RelatedMember[]
    | null;
  activities:
    | RelatedActivity
    | RelatedActivity[]
    | null;
};

type OperationalStatus =
  | "pending"
  | "partial"
  | "paid"
  | "overdue"
  | "exempt"
  | "cancelled";

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
  new Set<OperationalStatus>([
    "pending",
    "partial",
    "paid",
    "overdue",
    "exempt",
    "cancelled",
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
  const parts =
    getTodayArgentina().split("-");

  return {
    year: Number(parts[0]),
    month: Number(parts[1]),
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

function formatMoney(
  value: number | string,
) {
  const amount = Number(value);

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(
    Number.isFinite(amount)
      ? amount
      : 0,
  );
}

function formatDate(
  value: string | null,
) {
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

function formatDni(
  value: string | null,
) {
  if (!value) {
    return "Sin DNI";
  }

  const numericValue =
    Number(value);

  if (
    !Number.isFinite(numericValue)
  ) {
    return value;
  }

  return new Intl.NumberFormat(
    "es-AR",
  ).format(numericValue);
}

function sanitizeSearch(
  value: string,
) {
  return value
    .replace(/[%_,()]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("es");
}

function getOperationalStatus(
  fee: MonthlyFeeRow,
  today: string,
): OperationalStatus {
  if (
    fee.status === "paid" ||
    fee.status === "exempt" ||
    fee.status === "cancelled"
  ) {
    return fee.status;
  }

  if (
    fee.status === "overdue" ||
    (
      fee.due_date !== null &&
      fee.due_date < today
    )
  ) {
    return "overdue";
  }

  const paidAmount =
    Number(fee.paid_amount);

  if (paidAmount > 0) {
    return "partial";
  }

  return "pending";
}

function statusLabel(
  status: OperationalStatus,
  hasPartialPayment: boolean,
) {
  if (
    status === "overdue" &&
    hasPartialPayment
  ) {
    return "Vencida · parcial";
  }

  const labels: Record<
    OperationalStatus,
    string
  > = {
    pending: "Pendiente",
    partial: "Parcial",
    paid: "Pagada",
    overdue: "Vencida",
    exempt: "Exenta",
    cancelled: "Anulada",
  };

  return labels[status];
}

function statusClassName(
  status: OperationalStatus,
) {
  const classes: Record<
    OperationalStatus,
    string
  > = {
    pending:
      "bg-amber-100 text-amber-800",

    partial:
      "bg-blue-100 text-blue-800",

    paid:
      "bg-green-100 text-green-800",

    overdue:
      "bg-red-100 text-red-800",

    exempt:
      "bg-violet-100 text-violet-800",

    cancelled:
      "bg-slate-100 text-slate-600",
  };

  return classes[status];
}

export default async function MonthlyFeesPage({
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

  const selectedStatus =
    params.estado &&
    validStatuses.has(
      params.estado as OperationalStatus,
    )
      ? (
          params.estado as OperationalStatus
        )
      : "todos";

  const search = sanitizeSearch(
    params.buscar ?? "",
  );

  const today = getTodayArgentina();
  const supabase =
    createAdminClient();

  const {
    data: feesData,
    error,
  } = await supabase
    .from("monthly_fees")
    .select(`
      id,
      member_id,
      activity_id,
      year,
      month,
      amount,
      paid_amount,
      status,
      due_date,
      paid_at,
      notes,
      created_at,
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
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("year", selectedYear)
    .eq("month", selectedMonth)
    .order("due_date", {
      ascending: true,
    })
    .order("created_at", {
      ascending: true,
    });

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-900">
          No fue posible cargar las cuotas
        </h1>

        <p className="mt-3 text-red-800">
          {error.message}
        </p>
      </div>
    );
  }

  const allFees =
    (feesData ?? []) as unknown as MonthlyFeeRow[];

  const preparedFees = allFees.map(
    (fee) => {
      const member =
        getSingleRelation(
          fee.members,
        );

      const activity =
        getSingleRelation(
          fee.activities,
        );

      const operationalStatus =
        getOperationalStatus(
          fee,
          today,
        );

      const amount =
        Number(fee.amount);

      const paidAmount =
        Number(fee.paid_amount);

      const remainingAmount =
        Math.max(
          amount - paidAmount,
          0,
        );

      const searchableText = [
        member?.first_name,
        member?.last_name,
        member?.dni,
        activity?.name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("es");

      return {
        fee,
        member,
        activity,
        operationalStatus,
        amount,
        paidAmount,
        remainingAmount,
        searchableText,
      };
    },
  );

  const filteredFees =
    preparedFees.filter((item) => {
      if (
        selectedStatus !== "todos" &&
        item.operationalStatus !==
          selectedStatus
      ) {
        return false;
      }

      if (
        search &&
        !item.searchableText.includes(
          search,
        )
      ) {
        return false;
      }

      return true;
    });

  const totalAmount =
    preparedFees.reduce(
      (total, item) =>
        total + item.amount,
      0,
    );

  const totalPaid =
    preparedFees.reduce(
      (total, item) =>
        total + item.paidAmount,
      0,
    );

  const outstandingAmount =
    preparedFees.reduce(
      (total, item) => {
        if (
          item.operationalStatus ===
            "paid" ||
          item.operationalStatus ===
            "exempt" ||
          item.operationalStatus ===
            "cancelled"
        ) {
          return total;
        }

        return (
          total +
          item.remainingAmount
        );
      },
      0,
    );

  const overdueCount =
    preparedFees.filter(
      (item) =>
        item.operationalStatus ===
        "overdue",
    ).length;

  const canManage =
    context.role === "owner" ||
    context.role === "admin";

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Cuotas mensuales
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Generá las cuotas de cada período,
            registrá pagos y controlá saldos
            pendientes.
          </p>
        </div>

        <Link
          href="/panel/pagos/configuracion"
          className="inline-flex justify-center rounded-lg border border-blue-200 bg-white px-5 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
        >
          Configurar proveedores
        </Link>
      </div>

      {params.error ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {params.error}
        </div>
      ) : null}

      {params.success ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {params.success}
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-bold text-slate-900">
          Generar cuotas
        </h2>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Se creará una cuota por cada
          inscripción activa. El importe será el
          de la tarifa vigente en la fecha de
          vencimiento.
        </p>

        <form
          action={generateMonthlyFees}
          className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-[1fr_1fr_1fr_auto]"
        >
          <div>
            <label
              htmlFor="year"
              className="text-sm font-medium text-slate-700"
            >
              Año
            </label>

            <input
              id="year"
              name="year"
              type="number"
              required
              min="2020"
              max="2200"
              defaultValue={selectedYear}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div>
            <label
              htmlFor="month"
              className="text-sm font-medium text-slate-700"
            >
              Mes
            </label>

            <select
              id="month"
              name="month"
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
              htmlFor="due_day"
              className="text-sm font-medium text-slate-700"
            >
              Día de vencimiento
            </label>

            <input
              id="due_day"
              name="due_day"
              type="number"
              required
              min="1"
              max="28"
              defaultValue={10}
              className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
            />
          </div>

          <div className="flex items-end">
            <button
              type="submit"
              disabled={!canManage}
              className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Generar cuotas
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Cuotas del período
          </p>

          <p className="mt-2 text-3xl font-bold text-slate-900">
            {preparedFees.length}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Total facturado
          </p>

          <p className="mt-2 text-2xl font-bold text-slate-900">
            {formatMoney(totalAmount)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Total cobrado
          </p>

          <p className="mt-2 text-2xl font-bold text-green-700">
            {formatMoney(totalPaid)}
          </p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">
            Saldo pendiente
          </p>

          <p className="mt-2 text-2xl font-bold text-red-700">
            {formatMoney(
              outstandingAmount,
            )}
          </p>

          {overdueCount > 0 ? (
            <p className="mt-2 text-xs font-semibold text-red-600">
              {overdueCount === 1
                ? "1 cuota vencida"
                : `${overdueCount} cuotas vencidas`}
            </p>
          ) : null}
        </article>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5">
        <form
          method="get"
          className="grid gap-4 md:grid-cols-[0.7fr_1fr_1fr_1.5fr_auto]"
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

              <option value="pending">
                Pendientes
              </option>

              <option value="partial">
                Parciales
              </option>

              <option value="overdue">
                Vencidas
              </option>

              <option value="paid">
                Pagadas
              </option>

              <option value="exempt">
                Exentas
              </option>

              <option value="cancelled">
                Anuladas
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
              placeholder="Persona, DNI o actividad"
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
      </section>

      {filteredFees.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h2 className="text-xl font-semibold text-slate-900">
            No hay cuotas para mostrar
          </h2>

          <p className="mt-3 text-slate-600">
            Generá las cuotas del período o
            modificá los filtros.
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {filteredFees.map((item) => {
            const {
              fee,
              member,
              activity,
              operationalStatus,
              amount,
              paidAmount,
              remainingAmount,
            } = item;

            const memberName = member
              ? `${member.first_name} ${member.last_name}`
              : "Persona no disponible";

            const hasPartialPayment =
              paidAmount > 0 &&
              remainingAmount > 0;

            const paymentAction =
              registerManualPayment.bind(
                null,
                fee.id,
                selectedYear,
                selectedMonth,
              );

            const exemptAction =
              markMonthlyFeeExempt.bind(
                null,
                fee.id,
                selectedYear,
                selectedMonth,
              );

            const canReceivePayment =
              operationalStatus !==
                "paid" &&
              operationalStatus !==
                "exempt" &&
              operationalStatus !==
                "cancelled" &&
              remainingAmount > 0;

            return (
              <article
                key={fee.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-bold text-slate-900">
                        {memberName}
                      </h2>

                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClassName(
                          operationalStatus,
                        )}`}
                      >
                        {statusLabel(
                          operationalStatus,
                          hasPartialPayment,
                        )}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-600">
                      {activity?.name ??
                        "Actividad no disponible"}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      DNI:{" "}
                      {formatDni(
                        member?.dni ?? null,
                      )}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      Vencimiento:{" "}
                      {formatDate(
                        fee.due_date,
                      )}
                    </p>
                  </div>

                  <div className="grid min-w-full gap-3 text-sm sm:grid-cols-3 lg:min-w-[420px]">
                    <div className="rounded-xl bg-slate-50 p-4">
                      <p className="text-slate-500">
                        Importe
                      </p>

                      <p className="mt-1 font-bold text-slate-900">
                        {formatMoney(amount)}
                      </p>
                    </div>

                    <div className="rounded-xl bg-green-50 p-4">
                      <p className="text-green-700">
                        Pagado
                      </p>

                      <p className="mt-1 font-bold text-green-800">
                        {formatMoney(
                          paidAmount,
                        )}
                      </p>
                    </div>

                    <div className="rounded-xl bg-red-50 p-4">
                      <p className="text-red-700">
                        Saldo
                      </p>

                      <p className="mt-1 font-bold text-red-800">
                        {operationalStatus ===
                          "exempt"
                          ? formatMoney(0)
                          : formatMoney(
                              remainingAmount,
                            )}
                      </p>
                    </div>
                  </div>
                </div>

                {canReceivePayment &&
                canManage ? (
                  <div className="mt-6 grid gap-4 border-t border-slate-200 pt-6 xl:grid-cols-[1fr_auto]">
                    <form
                      action={paymentAction}
                      className="grid gap-4 sm:grid-cols-[1fr_1.5fr_auto]"
                    >
                      <div>
                        <label
                          htmlFor={`amount-${fee.id}`}
                          className="text-sm font-medium text-slate-700"
                        >
                          Pago manual
                        </label>

                        <input
                          id={`amount-${fee.id}`}
                          name="amount"
                          type="number"
                          required
                          min="0.01"
                          max={remainingAmount}
                          step="0.01"
                          defaultValue={
                            remainingAmount
                          }
                          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
                        />
                      </div>

                      <div>
                        <label
                          htmlFor={`notes-${fee.id}`}
                          className="text-sm font-medium text-slate-700"
                        >
                          Observación
                        </label>

                        <input
                          id={`notes-${fee.id}`}
                          name="notes"
                          placeholder="Transferencia, efectivo, comprobante..."
                          className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3"
                        />
                      </div>

                      <div className="flex items-end">
                        <button
                          type="submit"
                          className="w-full rounded-lg bg-green-700 px-5 py-3 font-semibold text-white transition hover:bg-green-800"
                        >
                          Registrar pago
                        </button>
                      </div>
                    </form>

                    <form
                      action={exemptAction}
                      className="flex items-end"
                    >
                      <button
                        type="submit"
                        className="w-full rounded-lg border border-violet-200 px-5 py-3 text-sm font-semibold text-violet-700 transition hover:bg-violet-50"
                      >
                        Marcar exenta
                      </button>
                    </form>
                  </div>
                ) : null}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}