import { NextRequest } from "next/server";

import { getAdminContext } from "@/lib/auth/admin-context";
import {
  csvResponse,
  type CsvRow,
} from "@/lib/exports/csv";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{
    type: string;
  }>;
};

function getSingleRelation<T>(
  value: T | T[] | null,
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value;
}

function getToday() {
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

function formatNumber(
  value:
    | number
    | string
    | null
    | undefined,
) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return "";
  }

  return number.toLocaleString(
    "es-AR",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
      useGrouping: false,
    },
  );
}

function formatDateTime(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "";
  }

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

function statusLabel(
  value: string,
) {
  const labels: Record<
    string,
    string
  > = {
    pending: "Pendiente",
    partial: "Pago parcial",
    overdue: "Vencida",
    paid: "Pagada",

    confirmed: "Confirmada",
    rejected: "Rechazada",
    cancelled: "Cancelada",
    completed: "Completada",
    no_show: "No asistió",

    unpaid: "Sin pagar",
    refunded: "Reintegrada",
    approved: "Aprobado",
  };

  return (
    labels[value] ??
    value
  );
}

function paymentMethodLabel(
  value: string,
) {
  const labels: Record<
    string,
    string
  > = {
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

  return (
    labels[value] ??
    value
  );
}

function validDate(
  value: string | null,
) {
  return Boolean(
    value &&
      /^\d{4}-\d{2}-\d{2}$/.test(
        value,
      ),
  );
}

function calculateDaysLate(
  today: string,
  dueDate: string | null,
) {
  if (!dueDate) {
    return 0;
  }

  const todayMs =
    Date.parse(
      `${today}T00:00:00Z`,
    );

  const dueMs =
    Date.parse(
      `${dueDate}T00:00:00Z`,
    );

  return Math.max(
    Math.floor(
      (todayMs - dueMs) /
        86_400_000,
    ),
    0,
  );
}

export async function GET(
  request: NextRequest,
  routeContext: RouteContext,
) {
  const context =
    await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    return new Response(
      "Sin permisos",
      {
        status: 403,
      },
    );
  }

  const { type } =
    await routeContext.params;

  const supabase =
    createAdminClient();

  const url =
    new URL(request.url);

  const from =
    url.searchParams.get(
      "desde",
    );

  const to =
    url.searchParams.get(
      "hasta",
    );

  const today =
    getToday();

  /*
   * PERSONAS
   */
  if (type === "personas") {
    const {
      data,
      error,
    } = await supabase
      .from("members")
      .select(`
        id,
        first_name,
        last_name,
        dni,
        active,
        created_at
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
        "last_name",
        {
          ascending: true,
        },
      )
      .order(
        "first_name",
        {
          ascending: true,
        },
      );

    if (error) {
      return new Response(
        `Error: ${error.message}`,
        {
          status: 500,
        },
      );
    }

    const rows: CsvRow[] =
      (data ?? []).map(
        (member) => ({
          Apellido:
            member.last_name,

          Nombre:
            member.first_name,

          DNI:
            member.dni ?? "",

          Estado:
            member.active
              ? "Activo"
              : "Inactivo",

          "Fecha de alta":
            formatDateTime(
              member.created_at,
            ),
        }),
      );

    return csvResponse(
      `clubsmart-personas-${today}.csv`,
      rows,
    );
  }

  /*
   * CUOTAS
   */
  if (type === "cuotas") {
    let query =
      supabase
        .from(
          "monthly_fees",
        )
        .select(`
          id,
          year,
          month,
          amount,
          paid_amount,
          due_date,
          status,

          members (
            first_name,
            last_name,
            dni
          ),

          activities (
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
        );

    if (validDate(from)) {
      query =
        query.gte(
          "due_date",
          from!,
        );
    }

    if (validDate(to)) {
      query =
        query.lte(
          "due_date",
          to!,
        );
    }

    const {
      data,
      error,
    } = await query.order(
      "due_date",
      {
        ascending: false,
      },
    );

    if (error) {
      return new Response(
        `Error: ${error.message}`,
        {
          status: 500,
        },
      );
    }

    const rows: CsvRow[] =
      (data ?? []).map(
        (fee) => {
          const member =
            getSingleRelation(
              fee.members,
            );

          const activity =
            getSingleRelation(
              fee.activities,
            );

          const amount =
            Number(
              fee.amount,
            );

          const paid =
            Number(
              fee.paid_amount,
            );

          const balance =
            Math.max(
              amount - paid,
              0,
            );

          return {
            Apellido:
              member?.last_name ??
              "",

            Nombre:
              member?.first_name ??
              "",

            DNI:
              member?.dni ??
              "",

            Actividad:
              activity?.name ??
              "",

            Año:
              fee.year,

            Mes:
              fee.month,

            Vencimiento:
              fee.due_date ??
              "",

            Importe:
              formatNumber(
                amount,
              ),

            Pagado:
              formatNumber(
                paid,
              ),

            Saldo:
              formatNumber(
                balance,
              ),

            Estado:
              statusLabel(
                fee.status,
              ),
          };
        },
      );

    return csvResponse(
      `clubsmart-cuotas-${today}.csv`,
      rows,
    );
  }

  /*
   * MOROSIDAD
   */
  if (type === "morosidad") {
    const {
      data,
      error,
    } = await supabase
      .from(
        "monthly_fees",
      )
      .select(`
        id,
        year,
        month,
        amount,
        paid_amount,
        due_date,
        status,

        members (
          first_name,
          last_name,
          dni
        ),

        activities (
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
      );

    if (error) {
      return new Response(
        `Error: ${error.message}`,
        {
          status: 500,
        },
      );
    }

    /*
     * flatMap evita generar:
     *
     * CsvRow | null
     *
     * Si una cuota no tiene deuda,
     * devuelve [].
     *
     * Si tiene deuda,
     * devuelve [CsvRow].
     */
    const rows: CsvRow[] =
      (data ?? []).flatMap(
        (fee): CsvRow[] => {
          const member =
            getSingleRelation(
              fee.members,
            );

          const activity =
            getSingleRelation(
              fee.activities,
            );

          const amount =
            Number(
              fee.amount,
            );

          const paid =
            Number(
              fee.paid_amount,
            );

          const balance =
            Math.max(
              amount - paid,
              0,
            );

          if (
            balance <= 0 ||
            [
              "paid",
              "cancelled",
              "void",
            ].includes(
              fee.status,
            )
          ) {
            return [];
          }

          const dueDate =
            fee.due_date;

          const daysLate =
            calculateDaysLate(
              today,
              dueDate,
            );

          return [
            {
              Apellido:
                member?.last_name ??
                "",

              Nombre:
                member?.first_name ??
                "",

              DNI:
                member?.dni ??
                "",

              Actividad:
                activity?.name ??
                "",

              Año:
                fee.year,

              Mes:
                fee.month,

              Vencimiento:
                dueDate ?? "",

              "Días de mora":
                daysLate,

              "Importe original":
                formatNumber(
                  amount,
                ),

              Pagado:
                formatNumber(
                  paid,
                ),

              "Saldo adeudado":
                formatNumber(
                  balance,
                ),
            },
          ];
        },
      );

    return csvResponse(
      `clubsmart-morosidad-${today}.csv`,
      rows,
    );
  }

  /*
   * RESERVAS
   */
  if (type === "reservas") {
    let query =
      supabase
        .from(
          "space_reservations",
        )
        .select(`
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
        );

    if (validDate(from)) {
      query =
        query.gte(
          "reservation_date",
          from!,
        );
    }

    if (validDate(to)) {
      query =
        query.lte(
          "reservation_date",
          to!,
        );
    }

    const {
      data,
      error,
    } = await query
      .order(
        "reservation_date",
        {
          ascending: false,
        },
      )
      .order(
        "start_time",
        {
          ascending: true,
        },
      );

    if (error) {
      return new Response(
        `Error: ${error.message}`,
        {
          status: 500,
        },
      );
    }

    const rows: CsvRow[] =
      (data ?? []).map(
        (
          reservation,
        ) => {
          const space =
            getSingleRelation(
              reservation.club_spaces,
            );

          return {
            Código:
              reservation.reservation_code,

            Fecha:
              reservation.reservation_date,

            "Fecha fin":
              reservation.reservation_end_date,

            Desde:
              reservation.start_time.slice(
                0,
                5,
              ),

            Hasta:
              reservation.end_time.slice(
                0,
                5,
              ),

            Espacio:
              space?.name ??
              "",

            Persona:
              reservation.customer_name,

            Teléfono:
              reservation.customer_phone ??
              "",

            Correo:
              reservation.customer_email ??
              "",

            Estado:
              statusLabel(
                reservation.status,
              ),

            Importe:
              formatNumber(
                reservation.amount,
              ),

            Seña:
              formatNumber(
                reservation.deposit_amount,
              ),

            Pagado:
              formatNumber(
                reservation.paid_amount,
              ),

            "Estado de pago":
              statusLabel(
                reservation.payment_status,
              ),

            Origen:
              reservation.source ===
              "public"
                ? "Web"
                : "Panel",

            Observaciones:
              reservation.notes ??
              "",
          };
        },
      );

    return csvResponse(
      `clubsmart-reservas-${today}.csv`,
      rows,
    );
  }

  /*
   * PAGOS DE RESERVAS
   */
  if (
    type ===
    "pagos-reservas"
  ) {
    let query =
      supabase
        .from(
          "reservation_payments",
        )
        .select(`
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

          space_reservations (
            reservation_code,
            customer_name
          )
        `)
        .eq(
          "organization_id",
          context.organizationId,
        )
        .eq(
          "club_id",
          context.clubId,
        );

    if (validDate(from)) {
      query =
        query.gte(
          "paid_at",
          `${from}T00:00:00`,
        );
    }

    if (validDate(to)) {
      query =
        query.lte(
          "paid_at",
          `${to}T23:59:59.999`,
        );
    }

    const {
      data,
      error,
    } = await query.order(
      "paid_at",
      {
        ascending: false,
      },
    );

    if (error) {
      return new Response(
        `Error: ${error.message}`,
        {
          status: 500,
        },
      );
    }

    const rows: CsvRow[] =
      (data ?? []).map(
        (payment) => {
          const reservation =
            getSingleRelation(
              payment.space_reservations,
            );

          return {
            Fecha:
              formatDateTime(
                payment.paid_at,
              ),

            "Código reserva":
              reservation?.reservation_code ??
              "",

            Persona:
              reservation?.customer_name ??
              "",

            Importe:
              formatNumber(
                payment.amount,
              ),

            Estado:
              statusLabel(
                payment.status,
              ),

            "Medio de pago":
              paymentMethodLabel(
                payment.payment_method,
              ),

            Origen:
              payment.source ===
              "provider"
                ? "Proveedor"
                : "Manual",

            Proveedor:
              payment.provider ??
              "",

            "ID proveedor":
              payment.provider_payment_id ??
              "",

            Referencia:
              payment.external_reference ??
              "",

            "Estado proveedor":
              payment.provider_status ??
              "",

            Observaciones:
              payment.notes ??
              "",
          };
        },
      );

    return csvResponse(
      `clubsmart-pagos-reservas-${today}.csv`,
      rows,
    );
  }

  return new Response(
    "Tipo de exportación no válido.",
    {
      status: 404,
    },
  );
}