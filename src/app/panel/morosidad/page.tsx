import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  canViewDelinquency,
} from "@/lib/auth/permissions";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    q?: string;
    actividad?: string;
    antiguedad?: string;
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

type FeeRow = {
  id: string;

  member_id: string;
  activity_id: string;

  year: number;
  month: number;

  amount: number | string;
  paid_amount: number | string;

  due_date: string | null;
  status: string;

  members:
    | MemberRelation
    | MemberRelation[]
    | null;

  activities:
    | ActivityRelation
    | ActivityRelation[]
    | null;
};

type DebtItem = {
  feeId: string;

  memberId: string;
  memberName: string;
  memberDni: string | null;

  activityId: string;
  activityName: string;

  year: number;
  month: number;

  dueDate: string;

  amount: number;
  paidAmount: number;
  balance: number;

  daysLate: number;
};

type Debtor = {
  memberId: string;
  memberName: string;
  memberDni: string | null;

  totalDebt: number;
  oldestDaysLate: number;
  oldestDueDate: string;

  fees: DebtItem[];
};

const monthNames = [
  "",
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

function getSingleRelation<T>(
  value: T | T[] | null,
) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function getTodayBuenosAires() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "America/Argentina/Buenos_Aires",

      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date());
}

function dateToUtcMilliseconds(
  value: string,
) {
  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  return Date.UTC(
    year,
    month - 1,
    day,
  );
}

function differenceInDays(
  laterDate: string,
  earlierDate: string,
) {
  const difference =
    dateToUtcMilliseconds(
      laterDate,
    ) -
    dateToUtcMilliseconds(
      earlierDate,
    );

  return Math.max(
    Math.floor(
      difference /
        86_400_000,
    ),
    0,
  );
}

function formatMoney(
  value: number,
) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    },
  ).format(value);
}

function formatDate(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      `${value}T12:00:00Z`,
    ),
  );
}

function getAgeLabel(
  days: number,
) {
  if (days <= 30) {
    return "1–30 días";
  }

  if (days <= 60) {
    return "31–60 días";
  }

  if (days <= 90) {
    return "61–90 días";
  }

  return "Más de 90 días";
}

function getAgeClassName(
  days: number,
) {
  if (days <= 30) {
    return "bg-amber-100 text-amber-800";
  }

  if (days <= 60) {
    return "bg-orange-100 text-orange-800";
  }

  if (days <= 90) {
    return "bg-red-100 text-red-800";
  }

  return "bg-red-600 text-white";
}

function matchesAgeFilter(
  days: number,
  filter: string,
) {
  if (!filter) {
    return true;
  }

  if (filter === "30") {
    return days <= 30;
  }

  if (filter === "60") {
    return (
      days >= 31 &&
      days <= 60
    );
  }

  if (filter === "90") {
    return (
      days >= 61 &&
      days <= 90
    );
  }

  if (filter === "90plus") {
    return days > 90;
  }

  return true;
}

export default async function DelinquencyPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
  !canViewDelinquency(
    context.role,
  )
) {
  redirect("/panel");
}

  const parameters =
    await searchParams;

  const search =
    (
      parameters.q ??
      ""
    )
      .trim()
      .toLowerCase();

  const selectedActivity =
    parameters.actividad ??
    "";

  const selectedAge =
    parameters.antiguedad ??
    "";

  const today =
    getTodayBuenosAires();

  const supabase =
    createAdminClient();

  const [
    activitiesResult,
    feesResult,
  ] = await Promise.all([
    supabase
      .from("activities")
      .select(`
        id,
        name
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .order(
        "name",
        {
          ascending: true,
        },
      ),

    supabase
      .from("monthly_fees")
      .select(`
        id,
        member_id,
        activity_id,
        year,
        month,
        amount,
        paid_amount,
        due_date,
        status,

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
      .eq(
        "club_id",
        context.clubId,
      )
      .lt(
        "due_date",
        today,
      )
      .order(
        "due_date",
        {
          ascending: true,
        },
      ),
  ]);

  if (
    activitiesResult.error
  ) {
    throw new Error(
      `No fue posible cargar las actividades: ${activitiesResult.error.message}`,
    );
  }

  if (feesResult.error) {
    throw new Error(
      `No fue posible cargar la morosidad: ${feesResult.error.message}`,
    );
  }

  const rawFees =
    (
      feesResult.data ??
      []
    ) as unknown as FeeRow[];

  const debtItems: DebtItem[] =
    rawFees
      .map((fee) => {
        const member =
          getSingleRelation(
            fee.members,
          );

        const activity =
          getSingleRelation(
            fee.activities,
          );

        if (
          !member ||
          !activity ||
          !fee.due_date
        ) {
          return null;
        }

        if (
          [
            "paid",
            "cancelled",
            "void",
          ].includes(
            fee.status,
          )
        ) {
          return null;
        }

        const amount =
          Number(
            fee.amount,
          );

        const paidAmount =
          Number(
            fee.paid_amount,
          );

        if (
          !Number.isFinite(
            amount,
          ) ||
          !Number.isFinite(
            paidAmount,
          )
        ) {
          return null;
        }

        const balance =
          Math.max(
            amount -
              paidAmount,
            0,
          );

        if (
          balance <= 0
        ) {
          return null;
        }

        return {
          feeId:
            fee.id,

          memberId:
            member.id,

          memberName:
            `${member.last_name}, ${member.first_name}`,

          memberDni:
            member.dni,

          activityId:
            activity.id,

          activityName:
            activity.name,

          year:
            fee.year,

          month:
            fee.month,

          dueDate:
            fee.due_date,

          amount,
          paidAmount,
          balance,

          daysLate:
            differenceInDays(
              today,
              fee.due_date,
            ),
        };
      })
      .filter(
        (
          item,
        ): item is DebtItem =>
          item !== null,
      );

  const filteredDebtItems =
    debtItems.filter(
      (item) => {
        if (
          selectedActivity &&
          item.activityId !==
            selectedActivity
        ) {
          return false;
        }

        if (
          !matchesAgeFilter(
            item.daysLate,
            selectedAge,
          )
        ) {
          return false;
        }

        if (search) {
          const searchable =
            [
              item.memberName,
              item.memberDni ??
                "",
              item.activityName,
            ]
              .join(" ")
              .toLowerCase();

          if (
            !searchable.includes(
              search,
            )
          ) {
            return false;
          }
        }

        return true;
      },
    );

  const debtorMap =
    new Map<
      string,
      Debtor
    >();

  for (
    const debt of
      filteredDebtItems
  ) {
    const existing =
      debtorMap.get(
        debt.memberId,
      );

    if (!existing) {
      debtorMap.set(
        debt.memberId,
        {
          memberId:
            debt.memberId,

          memberName:
            debt.memberName,

          memberDni:
            debt.memberDni,

          totalDebt:
            debt.balance,

          oldestDaysLate:
            debt.daysLate,

          oldestDueDate:
            debt.dueDate,

          fees: [debt],
        },
      );

      continue;
    }

    existing.totalDebt +=
      debt.balance;

    existing.fees.push(
      debt,
    );

    if (
      debt.daysLate >
      existing.oldestDaysLate
    ) {
      existing.oldestDaysLate =
        debt.daysLate;

      existing.oldestDueDate =
        debt.dueDate;
    }
  }

  const debtors =
    Array.from(
      debtorMap.values(),
    ).sort(
      (
        first,
        second,
      ) => {
        if (
          second.oldestDaysLate !==
          first.oldestDaysLate
        ) {
          return (
            second.oldestDaysLate -
            first.oldestDaysLate
          );
        }

        return (
          second.totalDebt -
          first.totalDebt
        );
      },
    );

  const totalDebt =
    filteredDebtItems.reduce(
      (
        total,
        item,
      ) =>
        total +
        item.balance,
      0,
    );

  const debtOver90 =
    filteredDebtItems
      .filter(
        (item) =>
          item.daysLate >
          90,
      )
      .reduce(
        (
          total,
          item,
        ) =>
          total +
          item.balance,
        0,
      );

  return (
    <div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Morosidad
        </h1>

        <p className="mt-3 max-w-3xl text-slate-600">
          Seguimiento de cuotas vencidas
          que todavía mantienen saldo
          pendiente.
        </p>
      </div>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Personas con deuda"
          value={String(
            debtors.length,
          )}
        />

        <SummaryCard
          label="Cuotas vencidas"
          value={String(
            filteredDebtItems.length,
          )}
        />

        <SummaryCard
          label="Deuda total"
          value={formatMoney(
            totalDebt,
          )}
        />

        <SummaryCard
          label="Deuda +90 días"
          value={formatMoney(
            debtOver90,
          )}
        />
      </section>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="grid gap-5 lg:grid-cols-[1.4fr_1fr_1fr_auto]">
          <label>
            <span className="text-sm font-medium text-slate-700">
              Persona, DNI o actividad
            </span>

            <input
              type="search"
              name="q"
              defaultValue={
                parameters.q ??
                ""
              }
              placeholder="Buscar..."
              className="input mt-2"
            />
          </label>

          <label>
            <span className="text-sm font-medium text-slate-700">
              Actividad
            </span>

            <select
              name="actividad"
              defaultValue={
                selectedActivity
              }
              className="input mt-2"
            >
              <option value="">
                Todas
              </option>

              {(
                activitiesResult.data ??
                []
              ).map(
                (
                  activity,
                ) => (
                  <option
                    key={
                      activity.id
                    }
                    value={
                      activity.id
                    }
                  >
                    {
                      activity.name
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label>
            <span className="text-sm font-medium text-slate-700">
              Antigüedad
            </span>

            <select
              name="antiguedad"
              defaultValue={
                selectedAge
              }
              className="input mt-2"
            >
              <option value="">
                Todas
              </option>

              <option value="30">
                1–30 días
              </option>

              <option value="60">
                31–60 días
              </option>

              <option value="90">
                61–90 días
              </option>

              <option value="90plus">
                Más de 90 días
              </option>
            </select>
          </label>

          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white"
            >
              Filtrar
            </button>

            <Link
              href="/panel/morosidad"
              className="rounded-lg border border-slate-300 px-5 py-3 font-semibold text-slate-700"
            >
              Limpiar
            </Link>
          </div>
        </form>
      </section>

      {debtors.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-green-200 bg-green-50 p-10 text-center">
          <div className="text-4xl">
            ✓
          </div>

          <h2 className="mt-4 text-xl font-bold text-green-950">
            No hay morosidad para estos filtros
          </h2>

          <p className="mt-2 text-green-800">
            No encontramos cuotas vencidas
            con saldo pendiente.
          </p>
        </section>
      ) : (
        <section className="mt-8 space-y-5">
          {debtors.map(
            (debtor) => (
              <article
                key={
                  debtor.memberId
                }
                className="rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${getAgeClassName(
                          debtor.oldestDaysLate,
                        )}`}
                      >
                        {getAgeLabel(
                          debtor.oldestDaysLate,
                        )}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {
                          debtor.fees
                            .length
                        }{" "}
                        {debtor.fees
                          .length ===
                        1
                          ? "cuota"
                          : "cuotas"}
                      </span>
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-slate-900">
                      {
                        debtor.memberName
                      }
                    </h2>

                    {debtor.memberDni ? (
                      <p className="mt-1 text-sm text-slate-600">
                        DNI{" "}
                        {
                          debtor.memberDni
                        }
                      </p>
                    ) : null}

                    <p className="mt-3 text-sm text-slate-500">
                      Deuda más antigua:
                      {" "}
                      {formatDate(
                        debtor.oldestDueDate,
                      )}
                      {" · "}
                      {
                        debtor.oldestDaysLate
                      }{" "}
                      días
                    </p>
                  </div>

                  <div className="lg:text-right">
                    <p className="text-sm text-slate-500">
                      Deuda total
                    </p>

                    <p className="mt-1 text-3xl font-bold text-red-700">
                      {formatMoney(
                        debtor.totalDebt,
                      )}
                    </p>
                  </div>
                </div>

                <div className="border-t border-slate-200">
                  {debtor.fees
                    .sort(
                      (
                        first,
                        second,
                      ) =>
                        first.dueDate.localeCompare(
                          second.dueDate,
                        ),
                    )
                    .map(
                      (
                        fee,
                      ) => (
                        <div
                          key={
                            fee.feeId
                          }
                          className="grid gap-4 border-b border-slate-100 px-6 py-4 last:border-b-0 md:grid-cols-[1.5fr_1fr_1fr_1fr]"
                        >
                          <div>
                            <p className="font-semibold text-slate-900">
                              {
                                fee.activityName
                              }
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {
                                monthNames[
                                  fee.month
                                ]
                              }{" "}
                              {
                                fee.year
                              }
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Vencimiento
                            </p>

                            <p className="mt-1 text-sm font-medium">
                              {formatDate(
                                fee.dueDate,
                              )}
                            </p>
                          </div>

                          <div>
                            <p className="text-xs text-slate-500">
                              Mora
                            </p>

                            <p className="mt-1 text-sm font-medium text-red-700">
                              {
                                fee.daysLate
                              }{" "}
                              días
                            </p>
                          </div>

                          <div className="md:text-right">
                            <p className="text-xs text-slate-500">
                              Saldo
                            </p>

                            <p className="mt-1 font-bold text-slate-900">
                              {formatMoney(
                                fee.balance,
                              )}
                            </p>

                            {fee.paidAmount >
                            0 ? (
                              <p className="mt-1 text-xs text-slate-500">
                                Pagado{" "}
                                {formatMoney(
                                  fee.paidAmount,
                                )}{" "}
                                de{" "}
                                {formatMoney(
                                  fee.amount,
                                )}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ),
                    )}
                </div>

                <div className="flex flex-wrap gap-3 border-t border-slate-200 p-6">
                  {debtor.memberDni ? (
                    <Link
                      href={`/panel/cuotas?dni=${encodeURIComponent(
                        debtor.memberDni,
                      )}`}
                      className="rounded-lg border border-blue-300 bg-white px-5 py-2.5 text-sm font-semibold text-blue-700 transition hover:bg-blue-50"
                    >
                      Ver cuotas
                    </Link>
                  ) : null}
                </div>
              </article>
            ),
          )}
        </section>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-2xl font-bold text-slate-900">
        {value}
      </p>
    </article>
  );
}