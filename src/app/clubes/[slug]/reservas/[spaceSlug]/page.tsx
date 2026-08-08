import Link from "next/link";
import {
  notFound,
} from "next/navigation";

import {
  createPublicReservation,
} from "@/app/clubes/[slug]/reservas/actions";

import {
  PublicReservationForm,
} from "@/app/clubes/[slug]/reservas/[spaceSlug]/reservation-form";

import {
  addDays,
  generateReservationSlots,
  type AvailabilityRow,
  type ExistingReservation,
} from "@/lib/reservations/availability";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
    spaceSlug: string;
  }>;

  searchParams: Promise<{
    fecha?: string;
    error?: string;
  }>;
};

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
  ).format(
    new Date(),
  );
}

function isDate(
  value: string,
) {
  return /^\d{4}-\d{2}-\d{2}$/.test(
    value,
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

export default async function PublicSpaceReservationPage({
  params,
  searchParams,
}: PageProps) {
  const {
    slug,
    spaceSlug,
  } = await params;

  const query =
    await searchParams;

  const today =
    getToday();

  const selectedDate =
    query.fecha &&
    isDate(
      query.fecha,
    ) &&
    query.fecha >= today
      ? query.fecha
      : today;

  const supabase =
    createAdminClient();

  const {
    data: club,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      organization_id,
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
    data: space,
  } = await supabase
    .from("club_spaces")
    .select(`
      id,
      name,
      slug,
      short_description,
      description,
      location,
      capacity,
      minimum_reservation_minutes,
      slot_interval_minutes,
      price,
      price_description,
      confirmation_mode,
      requires_deposit,
      deposit_type,
      deposit_value
    `)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq(
      "club_id",
      club.id,
    )
    .eq(
      "slug",
      spaceSlug,
    )
    .eq(
      "active",
      true,
    )
    .eq(
      "publicly_bookable",
      true,
    )
    .maybeSingle();

  if (!space) {
    notFound();
  }

  const previousDate =
    addDays(
      selectedDate,
      -1,
    );

  const nextDate =
    addDays(
      selectedDate,
      1,
    );

  const [
    availabilityResult,
    reservationsResult,
  ] = await Promise.all([
    supabase
      .from(
        "space_availability",
      )
      .select(`
        day_of_week,
        start_time,
        end_time,
        ends_next_day
      `)
      .eq(
        "organization_id",
        club.organization_id,
      )
      .eq(
        "club_id",
        club.id,
      )
      .eq(
        "space_id",
        space.id,
      )
      .eq(
        "active",
        true,
      ),

    supabase
      .from(
        "space_reservations",
      )
      .select(`
        reservation_date,
        reservation_end_date,
        start_time,
        end_time,
        status
      `)
      .eq(
        "organization_id",
        club.organization_id,
      )
      .eq(
        "club_id",
        club.id,
      )
      .eq(
        "space_id",
        space.id,
      )
      .gte(
        "reservation_date",
        previousDate,
      )
      .lte(
        "reservation_date",
        nextDate,
      )
      .in(
        "status",
        [
          "pending",
          "confirmed",
        ],
      ),
  ]);

  if (
    availabilityResult.error ||
    reservationsResult.error
  ) {
    throw new Error(
      "No fue posible consultar los turnos disponibles.",
    );
  }

  const slots =
    generateReservationSlots({
      selectedDate,

      durationMinutes:
        space.minimum_reservation_minutes,

      intervalMinutes:
        space.slot_interval_minutes,

      availability:
        (
          availabilityResult.data ??
          []
        ) as AvailabilityRow[],

      reservations:
        (
          reservationsResult.data ??
          []
        ) as ExistingReservation[],
    });

  const price =
    Number(
      space.price,
    );

  const depositValue =
    Number(
      space.deposit_value,
    );

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-3xl px-6 py-10">
        <Link
          href={`/clubes/${slug}/reservas`}
          className="text-sm font-semibold text-blue-700"
        >
          ← Ver todos los espacios
        </Link>

        <div className="mt-8">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {club.name}
          </p>

          <h1 className="mt-3 text-4xl font-bold text-slate-900">
            {space.name}
          </h1>

          {space.short_description ? (
            <p className="mt-4 text-lg leading-7 text-slate-600">
              {
                space.short_description
              }
            </p>
          ) : null}
        </div>

        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-5 sm:grid-cols-2">
            {space.location ? (
              <div>
                <p className="text-sm text-slate-500">
                  Ubicación
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {
                    space.location
                  }
                </p>
              </div>
            ) : null}

            {price > 0 ? (
              <div>
                <p className="text-sm text-slate-500">
                  Precio
                </p>

                <p className="mt-1 font-semibold text-slate-900">
                  {formatMoney(
                    price,
                  )}
                </p>
              </div>
            ) : null}

            <div>
              <p className="text-sm text-slate-500">
                Duración
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {
                  space.minimum_reservation_minutes
                }{" "}
                minutos
              </p>
            </div>

            <div>
              <p className="text-sm text-slate-500">
                Confirmación
              </p>

              <p className="mt-1 font-semibold text-slate-900">
                {space.confirmation_mode ===
                "automatic"
                  ? "Automática"
                  : "Por el club"}
              </p>
            </div>
          </div>
        </section>

        {query.error ? (
          <div
            role="alert"
            className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
          >
            {query.error}
          </div>
        ) : null}

        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <form className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="flex-1">
              <span className="text-sm font-medium text-slate-700">
                Fecha
              </span>

              <input
                type="date"
                name="fecha"
                min={today}
                defaultValue={
                  selectedDate
                }
                className="input mt-2"
              />
            </label>

            <button
              type="submit"
              className="rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white"
            >
              Ver disponibilidad
            </button>
          </form>
        </section>

        <div className="mt-6">
          <PublicReservationForm
            action={
              createPublicReservation
            }
            clubSlug={
              slug
            }
            spaceSlug={
              spaceSlug
            }
            selectedDate={
              selectedDate
            }
            slots={
              slots
            }
            price={
              Number.isFinite(
                price,
              )
                ? price
                : 0
            }
            requiresDeposit={
              space.requires_deposit
            }
            depositType={
              space.deposit_type
            }
            depositValue={
              Number.isFinite(
                depositValue,
              )
                ? depositValue
                : 0
            }
          />
        </div>
      </div>
    </main>
  );
}