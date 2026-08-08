import Link from "next/link";

import {
  notFound,
  redirect,
} from "next/navigation";

import {
  cancelManualReservationPayment,
  recordManualReservationPayment,
} from "@/app/panel/reservas/actions";

import {
  ReservationPaymentForm,
} from "@/app/panel/reservas/[id]/payment-form";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  canRecordPayments,
  canViewReservations,
} from "@/lib/auth/permissions";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;

  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

type Payment = {
  id: string;

  amount:
    | number
    | string;

  status: string;
  source: string;
  payment_method: string;

  provider:
    | string
    | null;

  provider_payment_id:
    | string
    | null;

  external_reference:
    | string
    | null;

  provider_status:
    | string
    | null;

  paid_at:
    | string
    | null;

  notes:
    | string
    | null;

  created_at: string;
};

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getSingleRelation<T>(
  value:
    | T
    | T[]
    | null,
) {
  if (
    Array.isArray(value)
  ) {
    return value[0] ?? null;
  }

  return value;
}

function formatMoney(
  value:
    | number
    | string,
) {
  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency: "ARS",
      maximumFractionDigits: 2,
    },
  ).format(
    Number(value) || 0,
  );
}

function formatTime(
  value: string,
) {
  return value.slice(
    0,
    5,
  );
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

function formatDateTime(
  value: string,
) {
  return new Intl.DateTimeFormat(
    "es-AR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone:
        "America/Argentina/Buenos_Aires",
    },
  ).format(
    new Date(value),
  );
}

const methodNames:
  Record<string, string> = {
    cash: "Efectivo",
    transfer: "Transferencia",
    debit_card:
      "Tarjeta de débito",
    credit_card:
      "Tarjeta de crédito",
    mercado_pago:
      "Mercado Pago",
    pagotic:
      "Pago TIC",
    other: "Otro",
  };

const paymentStatusNames:
  Record<string, string> = {
    pending: "Pendiente",
    approved: "Aprobado",
    rejected: "Rechazado",
    cancelled: "Anulado",
    refunded: "Reintegrado",
  };

export default async function ReservationDetailPage({
  params,
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
  !canViewReservations(
    context.role,
  )
) {
  redirect("/panel");
}

  const { id } =
    await params;

  const query =
    await searchParams;

  if (!isUuid(id)) {
    notFound();
  }

  const supabase =
    createAdminClient();

  const [
    reservationResult,
    paymentsResult,
  ] = await Promise.all([
    supabase
      .from(
        "space_reservations",
      )
      .select(`
        id,
        reservation_code,
        reservation_date,
        reservation_end_date,
        start_time,
        end_time,

        customer_name,
        customer_email,
        customer_phone,

        status,

        amount,
        deposit_amount,
        paid_amount,
        payment_status,

        source,
        notes,

        club_spaces (
          id,
          name
        )
      `)
      .eq(
        "id",
        id,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .maybeSingle(),

    supabase
      .from(
        "reservation_payments",
      )
      .select(`
        id,
        amount,
        status,
        source,
        payment_method,
        provider,
        provider_payment_id,
        external_reference,
        provider_status,
        paid_at,
        notes,
        created_at
      `)
      .eq(
        "reservation_id",
        id,
      )
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .order(
        "created_at",
        {
          ascending: false,
        },
      ),
  ]);

  if (
    reservationResult.error ||
    !reservationResult.data
  ) {
    notFound();
  }

  if (
    paymentsResult.error
  ) {
    throw new Error(
      `No fue posible cargar los pagos: ${paymentsResult.error.message}`,
    );
  }

  const reservation =
    reservationResult.data;

  const payments =
    (
      paymentsResult.data ??
      []
    ) as Payment[];

  const space =
    getSingleRelation(
      reservation.club_spaces,
    );

  const amount =
    Number(
      reservation.amount,
    );

  const depositAmount =
    Number(
      reservation.deposit_amount,
    );

  const paidAmount =
    Number(
      reservation.paid_amount,
    );

  const remainingAmount =
    Math.max(
      amount -
        paidAmount,
      0,
    );

  const canRegisterPayment =
  canRecordPayments(
    context.role,
  ) &&
  remainingAmount > 0 &&
  ![
    "rejected",
    "cancelled",
  ].includes(
    reservation.status,
  );

  return (
    <div>
      <Link
        href={`/panel/reservas?fecha=${reservation.reservation_date}&vista=dia`}
        className="text-sm font-semibold text-blue-700"
      >
        ← Volver a reservas
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <div className="mt-3 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Reserva{" "}
              {
                reservation.reservation_code
              }
            </h1>

            <p className="mt-2 text-slate-600">
              {space?.name ??
                "Espacio"}{" "}
              ·{" "}
              {
                reservation.customer_name
              }
            </p>
          </div>

          <div className="text-left lg:text-right">
            <p className="font-semibold text-slate-900">
              {formatDate(
                reservation.reservation_date,
              )}
            </p>

            <p className="mt-1 text-xl font-bold text-slate-900">
              {formatTime(
                reservation.start_time,
              )}
              {" – "}
              {formatTime(
                reservation.end_time,
              )}
            </p>
          </div>
        </div>
      </div>

      {query.success ? (
        <div
          role="status"
          className="mt-6 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {query.success}
        </div>
      ) : null}

      {query.error ? (
        <div
          role="alert"
          className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {query.error}
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Importe"
          value={
            formatMoney(
              amount,
            )
          }
        />

        <SummaryCard
          label="Seña requerida"
          value={
            depositAmount >
            0
              ? formatMoney(
                  depositAmount,
                )
              : "No requiere"
          }
        />

        <SummaryCard
          label="Pagado"
          value={
            formatMoney(
              paidAmount,
            )
          }
        />

        <SummaryCard
          label="Saldo"
          value={
            formatMoney(
              remainingAmount,
            )
          }
        />
      </section>

      <div className="mt-8 grid gap-8 xl:grid-cols-[1.5fr_1fr]">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 p-6">
            <h2 className="text-xl font-bold text-slate-900">
              Movimientos
            </h2>

            <p className="mt-2 text-sm text-slate-600">
              Historial de pagos asociados
              a esta reserva.
            </p>
          </div>

          {payments.length ===
          0 ? (
            <div className="p-8 text-center text-slate-600">
              Todavía no se registraron
              pagos.
            </div>
          ) : (
            <div className="divide-y divide-slate-200">
              {payments.map(
                (
                  payment,
                ) => (
                  <article
                    key={
                      payment.id
                    }
                    className="p-6"
                  >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <span
                            className={
                              payment.status ===
                              "approved"
                                ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                                : "rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700"
                            }
                          >
                            {paymentStatusNames[
                              payment.status
                            ] ??
                              payment.status}
                          </span>

                          <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">
                            {payment.source ===
                            "provider"
                              ? payment.provider ??
                                "Proveedor"
                              : "Manual"}
                          </span>
                        </div>

                        <p className="mt-3 font-semibold text-slate-900">
                          {methodNames[
                            payment.payment_method
                          ] ??
                            payment.payment_method}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {formatDateTime(
                            payment.paid_at ??
                              payment.created_at,
                          )}
                        </p>
                      </div>

                      <p className="text-xl font-bold text-slate-900">
                        {formatMoney(
                          payment.amount,
                        )}
                      </p>
                    </div>

                    {payment.external_reference ? (
                      <p className="mt-4 text-sm text-slate-600">
                        Referencia:{" "}
                        <span className="font-medium text-slate-900">
                          {
                            payment.external_reference
                          }
                        </span>
                      </p>
                    ) : null}

                    {payment.notes ? (
                      <p className="mt-2 text-sm text-slate-600">
                        {
                          payment.notes
                        }
                      </p>
                    ) : null}

                    {canRecordPayments(
  context.role,
) &&
payment.source ===
  "manual" &&
payment.status ===
  "approved" ? (
                      <form
                        action={cancelManualReservationPayment.bind(
                          null,
                          payment.id,
                          reservation.id,
                        )}
                        className="mt-4"
                      >
                        <button
                          type="submit"
                          className="text-sm font-semibold text-red-700 transition hover:text-red-900"
                        >
                          Anular este pago
                        </button>
                      </form>
                    ) : null}
                  </article>
                ),
              )}
            </div>
          )}
        </section>

        <div>
          {canRegisterPayment ? (
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="text-xl font-bold text-slate-900">
                Registrar pago
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-600">
                Registrá un cobro realizado
                fuera de ClubSmart.
              </p>

              <div className="mt-6">
                <ReservationPaymentForm
                  action={recordManualReservationPayment.bind(
                    null,
                    reservation.id,
                  )}
                  remainingAmount={
                    remainingAmount
                  }
                />
              </div>
            </section>
          ) : (
            <section className="rounded-2xl border border-green-200 bg-green-50 p-6">
              <h2 className="text-xl font-bold text-green-950">
                {remainingAmount <=
                0
                  ? "Reserva pagada"
                  : "No admite pagos"}
              </h2>

              <p className="mt-2 text-sm text-green-800">
                {remainingAmount <=
                0
                  ? "No queda saldo pendiente."
                  : "La reserva se encuentra cancelada o rechazada."}
              </p>
            </section>
          )}

          <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-bold text-slate-900">
              Datos de la reserva
            </h2>

            <dl className="mt-5 space-y-4 text-sm">
              <DetailRow
                label="Persona"
                value={
                  reservation.customer_name
                }
              />

              {reservation.customer_phone ? (
                <DetailRow
                  label="Teléfono"
                  value={
                    reservation.customer_phone
                  }
                />
              ) : null}

              {reservation.customer_email ? (
                <DetailRow
                  label="Correo"
                  value={
                    reservation.customer_email
                  }
                />
              ) : null}

              <DetailRow
                label="Estado de pago"
                value={
                  reservation.payment_status ===
                  "paid"
                    ? "Pagada"
                    : reservation.payment_status ===
                        "partial"
                      ? "Pago parcial"
                      : "Sin pagar"
                }
              />
            </dl>
          </section>
        </div>
      </div>
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

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-slate-500">
        {label}
      </dt>

      <dd className="text-right font-medium text-slate-900">
        {value}
      </dd>
    </div>
  );
}