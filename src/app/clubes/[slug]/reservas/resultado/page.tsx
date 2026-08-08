import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;

  searchParams: Promise<{
    codigo?: string;
  }>;
};

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

export default async function ReservationResultPage({
  params,
  searchParams,
}: PageProps) {
  const { slug } =
    await params;

  const query =
    await searchParams;

  if (
    !query.codigo
  ) {
    notFound();
  }

  const supabase =
    createAdminClient();

  const {
    data: club,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      name,
      slug
    `)
    .eq(
      "slug",
      slug,
    )
    .maybeSingle();

  if (!club) {
    notFound();
  }

  const {
    data: reservation,
  } = await supabase
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
      status,
      amount,
      deposit_amount,

      club_spaces (
        name
      )
    `)
    .eq(
      "club_id",
      club.id,
    )
    .eq(
      "reservation_code",
      query.codigo,
    )
    .eq(
      "source",
      "public",
    )
    .maybeSingle();

  if (!reservation) {
    notFound();
  }

  const relation =
    reservation.club_spaces;

  const space =
    Array.isArray(
      relation,
    )
      ? relation[0] ??
        null
      : relation;

  const confirmed =
    reservation.status ===
    "confirmed";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-lg">
        <div
          className={
            confirmed
              ? "rounded-2xl border border-green-200 bg-green-50 p-8 text-green-950"
              : "rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-950"
          }
        >
          <h1 className="text-3xl font-bold">
            {confirmed
              ? "Reserva confirmada"
              : "Solicitud recibida"}
          </h1>

          <p className="mt-4 leading-7">
            {confirmed
              ? "Tu reserva quedó confirmada."
              : "El club recibió tu solicitud y deberá confirmarla."}
          </p>
        </div>

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <dl className="space-y-5">
            <div>
              <dt className="text-sm text-slate-500">
                Código
              </dt>

              <dd className="mt-1 font-mono font-semibold text-slate-900">
                {
                  reservation.reservation_code
                }
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-500">
                Espacio
              </dt>

              <dd className="mt-1 font-semibold text-slate-900">
                {space?.name ??
                  "—"}
              </dd>
            </div>

            <div>
              <dt className="text-sm text-slate-500">
                Horario
              </dt>

              <dd className="mt-1 font-semibold text-slate-900">
                {formatTime(
                  reservation.start_time,
                )}
                {" – "}
                {formatTime(
                  reservation.end_time,
                )}
              </dd>
            </div>

            {Number(
              reservation.amount,
            ) > 0 ? (
              <div>
                <dt className="text-sm text-slate-500">
                  Importe
                </dt>

                <dd className="mt-1 font-semibold text-slate-900">
                  {formatMoney(
                    reservation.amount,
                  )}
                </dd>
              </div>
            ) : null}

            {Number(
              reservation.deposit_amount,
            ) > 0 ? (
              <div>
                <dt className="text-sm text-slate-500">
                  Seña pendiente
                </dt>

                <dd className="mt-1 font-semibold text-slate-900">
                  {formatMoney(
                    reservation.deposit_amount,
                  )}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={`/clubes/${slug}/reservas`}
            className="rounded-lg border border-slate-300 bg-white px-5 py-3 text-center font-semibold text-slate-800"
          >
            Ver espacios
          </Link>

          <Link
            href={`/clubes/${slug}`}
            className="rounded-lg bg-slate-900 px-5 py-3 text-center font-semibold text-white"
          >
            Volver al club
          </Link>
        </div>
      </div>
    </main>
  );
}