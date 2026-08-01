import Link from "next/link";

import { reconcileMercadoPagoPayment } from "@/lib/payments/mercado-pago";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    pago?: string;
    estado?: string;
    payment_id?: string;
    status?: string;
    external_reference?: string;
  }>;
};

type Payment = {
  id: string;
  activity_id: string | null;
  monthly_fee_id: string | null;
  amount: number | string;
  currency: string;
  status: string;
  provider: string;
  provider_status: string | null;
  provider_payment_id: string | null;
  created_at: string;
  paid_at: string | null;
};

type Activity = {
  name: string;
};

type MonthlyFee = {
  year: number;
  month: number;
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

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function formatMoney(
  value: number | string,
  currency = "ARS",
) {
  const amount = Number(value);

  return new Intl.NumberFormat(
    "es-AR",
    {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    },
  ).format(amount);
}

function getProviderName(
  provider: string,
) {
  if (
    provider === "mercado_pago"
  ) {
    return "Mercado Pago";
  }

  if (provider === "pagotic") {
    return "Pago TIC";
  }

  if (provider === "manual") {
    return "Pago manual";
  }

  return provider;
}

function getContent(
  status: string,
) {
  if (status === "approved") {
    return {
      title: "Pago confirmado",

      description:
        "El pago fue aprobado y la cuota se actualizó correctamente.",

      className:
        "border-green-200 bg-green-50 text-green-900",

      badgeClassName:
        "bg-green-100 text-green-800",

      label: "Aprobado",
    };
  }

  if (
    status === "created" ||
    status === "pending" ||
    status === "in_process"
  ) {
    return {
      title:
        "Estamos verificando el pago",

      description:
        "La operación todavía no fue confirmada. Podés actualizar esta página dentro de unos instantes.",

      className:
        "border-amber-200 bg-amber-50 text-amber-900",

      badgeClassName:
        "bg-amber-100 text-amber-800",

      label: "Pendiente",
    };
  }

  if (
    status === "refunded"
  ) {
    return {
      title: "Pago reintegrado",

      description:
        "El importe de esta operación fue reintegrado. La cuota fue recalculada según los pagos vigentes.",

      className:
        "border-slate-300 bg-slate-100 text-slate-900",

      badgeClassName:
        "bg-slate-200 text-slate-800",

      label: "Reintegrado",
    };
  }

  if (
    status === "charged_back"
  ) {
    return {
      title: "Pago contracargado",

      description:
        "Mercado Pago informó un contracargo. La cuota fue recalculada y el club podrá revisar la operación.",

      className:
        "border-red-300 bg-red-50 text-red-900",

      badgeClassName:
        "bg-red-100 text-red-800",

      label: "Contracargo",
    };
  }

  return {
    title:
      "No se completó el pago",

    description:
      "La operación fue rechazada, cancelada o no pudo procesarse. Podés volver a intentarlo.",

    className:
      "border-red-200 bg-red-50 text-red-900",

    badgeClassName:
      "bg-red-100 text-red-800",

    label: "No aprobado",
  };
}

export default async function PaymentResultPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } = await params;

  const resultParams =
    await searchParams;

  const paymentId =
    resultParams.pago ??
    resultParams.external_reference ??
    "";

  const supabase =
    createAdminClient();

  const {
    data: club,
    error: clubError,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      name,
      slug
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (
    clubError ||
    !club ||
    !paymentId ||
    !isUuid(paymentId)
  ) {
    return (
      <InvalidPaymentResult
        slug={slug}
      />
    );
  }

  const loadPayment =
    async () => {
      const {
        data,
        error,
      } = await supabase
        .from("payments")
        .select(`
          id,
          activity_id,
          monthly_fee_id,
          amount,
          currency,
          status,
          provider,
          provider_status,
          provider_payment_id,
          created_at,
          paid_at
        `)
        .eq("id", paymentId)
        .eq("club_id", club.id)
        .maybeSingle();

      if (error) {
        console.error(
          "Error consultando resultado de pago:",
          error,
        );

        return null;
      }

      return data as Payment | null;
    };

  let payment =
    await loadPayment();

  /*
   * Al regresar desde Mercado Pago puede
   * ocurrir que el webhook todavía no haya
   * sido procesado. Consultamos la API
   * inmediatamente y conciliamos el pago.
   */
  if (
    payment?.provider ===
      "mercado_pago" &&
    resultParams.payment_id
  ) {
    try {
      const reconciliation =
        await reconcileMercadoPagoPayment(
          resultParams.payment_id,
        );

      if (
        reconciliation.internalPaymentId !==
        payment.id
      ) {
        console.error(
          "El pago devuelto no coincide con el pago solicitado.",
          {
            expected:
              payment.id,
            received:
              reconciliation.internalPaymentId,
          },
        );
      }

      payment =
        await loadPayment();
    } catch (error) {
      console.error(
        "No se pudo conciliar el pago desde la página de resultado:",
        error,
      );
    }
  }

  if (!payment) {
    return (
      <InvalidPaymentResult
        slug={slug}
      />
    );
  }

  let activity:
    | Activity
    | null = null;

  let monthlyFee:
    | MonthlyFee
    | null = null;

  if (payment.activity_id) {
    const { data } =
      await supabase
        .from("activities")
        .select("name")
        .eq(
          "id",
          payment.activity_id,
        )
        .maybeSingle();

    activity =
      data as Activity | null;
  }

  if (
    payment.monthly_fee_id
  ) {
    const { data } =
      await supabase
        .from("monthly_fees")
        .select(`
          year,
          month
        `)
        .eq(
          "id",
          payment.monthly_fee_id,
        )
        .maybeSingle();

    monthlyFee =
      data as MonthlyFee | null;
  }

  const content = getContent(
    payment.status,
  );

  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div
          className={`rounded-2xl border p-8 ${content.className}`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold">
                {content.title}
              </h1>

              <p className="mt-3 leading-6">
                {content.description}
              </p>
            </div>

            <span
              className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${content.badgeClassName}`}
            >
              {content.label}
            </span>
          </div>
        </div>

        <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-semibold text-slate-900">
            Detalle de la operación
          </h2>

          <dl className="mt-5 space-y-4 text-sm">
            {activity ? (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">
                  Actividad
                </dt>

                <dd className="text-right font-medium text-slate-900">
                  {activity.name}
                </dd>
              </div>
            ) : null}

            {monthlyFee ? (
              <div className="flex items-start justify-between gap-4">
                <dt className="text-slate-500">
                  Cuota
                </dt>

                <dd className="text-right font-medium text-slate-900">
                  {
                    monthNames[
                      monthlyFee.month -
                        1
                    ]
                  }{" "}
                  {monthlyFee.year}
                </dd>
              </div>
            ) : null}

            <div className="flex items-start justify-between gap-4">
              <dt className="text-slate-500">
                Importe
              </dt>

              <dd className="text-right font-semibold text-slate-900">
                {formatMoney(
                  payment.amount,
                  payment.currency,
                )}
              </dd>
            </div>

            <div className="flex items-start justify-between gap-4">
              <dt className="text-slate-500">
                Medio
              </dt>

              <dd className="text-right font-medium text-slate-900">
                {getProviderName(
                  payment.provider,
                )}
              </dd>
            </div>

            <div className="flex items-start justify-between gap-4">
              <dt className="text-slate-500">
                Referencia
              </dt>

              <dd className="max-w-[65%] break-all text-right font-mono text-xs text-slate-700">
                {payment.id}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          {payment.status ===
            "created" ||
          payment.status ===
            "pending" ||
          payment.status ===
            "in_process" ? (
            <Link
              href={`/clubes/${slug}/pago/resultado?pago=${payment.id}`}
              className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-800 transition hover:bg-slate-100"
            >
              Actualizar estado
            </Link>
          ) : null}

          <Link
            href={`/clubes/${slug}`}
            className="inline-flex justify-center rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
          >
            Volver al club
          </Link>
        </div>
      </div>
    </main>
  );
}

function InvalidPaymentResult({
  slug,
}: {
  slug: string;
}) {
  return (
    <main className="min-h-screen bg-slate-50 px-5 py-12">
      <div className="mx-auto max-w-lg">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-red-900">
          <h1 className="text-2xl font-bold">
            No pudimos encontrar el pago
          </h1>

          <p className="mt-3 leading-6">
            La referencia de la operación no
            existe o no pertenece a este club.
          </p>
        </div>

        <Link
          href={`/clubes/${slug}`}
          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white transition hover:bg-slate-700"
        >
          Volver al club
        </Link>
      </div>
    </main>
  );
}