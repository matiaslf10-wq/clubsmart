import Link from "next/link";
import {
  redirect,
} from "next/navigation";

import {
  createManualReservation,
} from "@/app/panel/reservas/actions";

import {
  ReservationForm,
} from "@/app/panel/reservas/reservation-form";

import {
  SpaceSearchSelect,
} from "@/app/panel/reservas/nueva/space-search-select";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  addDays,
  generateReservationSlots,
  type AvailabilityRow,
  type ExistingReservation,
} from "@/lib/reservations/availability";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  canManageReservations,
} from "@/lib/auth/permissions";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    espacio?: string;
    fecha?: string;
    error?: string;
    success?: string;
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
  ).format(new Date());
}

function isValidDate(
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

function formatAvailabilityDate(
  value: string,
) {
  const [
    year,
    month,
    day,
  ] = value
    .split("-")
    .map(Number);

  return new Intl.DateTimeFormat(
    "es-AR",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    },
  ).format(
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12,
      ),
    ),
  );
}

export default async function NewReservationPage({
  searchParams,
}: PageProps) {
  const context =
    await getAdminContext();

  if (
  !canManageReservations(
    context.role,
  )
) {
  redirect("/panel");
}

  const parameters =
    await searchParams;

  const today =
    getToday();

  const selectedDate =
    parameters.fecha &&
    isValidDate(
      parameters.fecha,
    )
      ? parameters.fecha
      : today;

  const supabase =
    createAdminClient();

  const {
    data: spacesData,
    error: spacesError,
  } = await supabase
    .from("club_spaces")
    .select(`
      id,
      name,
      location,
      price,
      minimum_reservation_minutes,
      slot_interval_minutes,
      requires_deposit,
      deposit_type,
      deposit_value,
      confirmation_mode
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .eq(
      "active",
      true,
    )
    .order(
      "display_order",
      {
        ascending: true,
      },
    )
    .order(
      "name",
      {
        ascending: true,
      },
    );

  if (spacesError) {
    throw new Error(
      `No fue posible cargar los espacios: ${spacesError.message}`,
    );
  }

  const spaces =
    spacesData ?? [];

  const requestedSpaceId =
    parameters.espacio ?? "";

  const selectedSpace =
    spaces.find(
      (space) =>
        space.id ===
        requestedSpaceId,
    ) ??
    spaces[0] ??
    null;

  if (!selectedSpace) {
    return (
      <div>
        <Link
          href="/panel/reservas"
          className="text-sm font-semibold text-blue-700"
        >
          ← Volver a reservas
        </Link>

        <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-8 text-amber-900">
          <h1 className="text-2xl font-bold">
            No hay espacios disponibles
          </h1>

          <p className="mt-3">
            Primero creá y activá al menos un
            espacio.
          </p>

          <Link
            href="/panel/espacios/nuevo"
            className="mt-5 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
          >
            Crear espacio
          </Link>
        </div>
      </div>
    );
  }

  const previousDate =
    addDays(
      selectedDate,
      -1,
    );

  const availabilityPreviewEndDate =
    addDays(
      selectedDate,
      60,
    );

  const [
    availabilityResult,
    reservationsResult,
    membersResult,
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
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .eq(
        "space_id",
        selectedSpace.id,
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
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .eq(
        "space_id",
        selectedSpace.id,
      )
      .gte(
        "reservation_date",
        previousDate,
      )
      .lte(
        "reservation_date",
        availabilityPreviewEndDate,
      )
      .in(
        "status",
        [
          "pending",
          "confirmed",
        ],
      ),

    supabase
      .from("members")
      .select(`
        id,
        first_name,
        last_name,
        dni
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .eq(
        "active",
        true,
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
      ),
  ]);

  if (
    availabilityResult.error
  ) {
    throw new Error(
      `No fue posible cargar la disponibilidad: ${availabilityResult.error.message}`,
    );
  }

  if (
    reservationsResult.error
  ) {
    throw new Error(
      `No fue posible cargar las reservas: ${reservationsResult.error.message}`,
    );
  }

  if (membersResult.error) {
    throw new Error(
      `No fue posible cargar las personas: ${membersResult.error.message}`,
    );
  }

  const availabilityRows =
    (
      availabilityResult.data ??
      []
    ) as AvailabilityRow[];

  const reservationRows =
    (
      reservationsResult.data ??
      []
    ) as ExistingReservation[];

  const slots =
    generateReservationSlots({
      selectedDate,

      durationMinutes:
        selectedSpace.minimum_reservation_minutes,

      intervalMinutes:
        selectedSpace.slot_interval_minutes,

      availability:
        availabilityRows,

      reservations:
        reservationRows,
    });

  const nextAvailableDays: Array<{
    date: string;
    slots: ReturnType<
      typeof generateReservationSlots
    >;
  }> = [];

  for (
    let offset = 0;
    offset <= 60 &&
    nextAvailableDays.length < 7;
    offset += 1
  ) {
    const date =
      addDays(
        selectedDate,
        offset,
      );

    const dateSlots =
      generateReservationSlots({
        selectedDate:
          date,

        durationMinutes:
          selectedSpace.minimum_reservation_minutes,

        intervalMinutes:
          selectedSpace.slot_interval_minutes,

        availability:
          availabilityRows,

        reservations:
          reservationRows,
      });

    if (
      dateSlots.length > 0
    ) {
      nextAvailableDays.push({
        date,
        slots:
          dateSlots,
      });
    }
  }

  const price =
    Number(
      selectedSpace.price,
    );

  return (
    <div>
      <Link
        href="/panel/reservas"
        className="text-sm font-semibold text-blue-700 transition hover:text-blue-800"
      >
        ← Volver a reservas
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Nueva reserva
        </h1>

        <p className="mt-3 text-slate-600">
          Elegí el espacio y la fecha para ver
          únicamente los turnos disponibles.
        </p>
      </div>

      {parameters.error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800">
          {parameters.error}
        </div>
      ) : null}

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <form className="grid gap-5 md:grid-cols-[1fr_1fr_auto]">
          <label>
            <span className="text-sm font-medium text-slate-700">
              Espacio
            </span>

            <SpaceSearchSelect
              spaces={spaces.map(
                (space) => ({
                  id: space.id,
                  name: space.name,
                }),
              )}
              initialSpaceId={
                selectedSpace.id
              }
            />
          </label>

          <label>
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

          <div className="flex items-end">
            <button
              type="submit"
              className="w-full rounded-lg bg-slate-900 px-6 py-3 font-semibold text-white transition hover:bg-slate-700"
            >
              Ver turnos
            </button>
          </div>
        </form>
      </section>

      <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-bold text-blue-950">
              {
                selectedSpace.name
              }
            </h2>

            {selectedSpace.location ? (
              <p className="mt-1 text-sm text-blue-900">
                {
                  selectedSpace.location
                }
              </p>
            ) : null}
          </div>

          <div className="text-right">
            <p className="font-bold text-blue-950">
              {price > 0
                ? formatMoney(
                    price,
                  )
                : "Sin cargo"}
            </p>

            <p className="mt-1 text-xs text-blue-800">
              Turnos de{" "}
              {
                selectedSpace.minimum_reservation_minutes
              }{" "}
              minutos
            </p>
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-slate-900">
            {"Pr\u00F3ximos turnos disponibles"}
          </h2>

          <p className="mt-1 text-sm text-slate-600">
            {"Se muestran los pr\u00F3ximos d\u00EDas que tienen turnos libres."}
          </p>
        </div>

        {nextAvailableDays.length === 0 ? (
          <p className="mt-5 rounded-xl bg-slate-50 p-4 text-sm text-slate-600">
            {"No encontramos pr\u00F3ximos turnos disponibles."}
          </p>
        ) : (
          <div className="mt-5 space-y-5">
            {nextAvailableDays.map(
              (day) => (
                <div
                  key={day.date}
                  className="border-b border-slate-100 pb-5 last:border-b-0 last:pb-0"
                >
                  <h3 className="font-semibold text-slate-900">
                    {formatAvailabilityDate(
                      day.date,
                    )}
                  </h3>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {day.slots.map(
                      (slot) => (
                        <Link
                          key={
                            slot.key
                          }
                          href={{
                            pathname:
                              "/panel/reservas/nueva",
                            query: {
                              espacio:
                                selectedSpace.id,
                              fecha:
                                day.date,
                            },
                          }}
                          className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800 transition hover:border-blue-300 hover:bg-blue-100"
                        >
                          {
                            slot.label
                          }
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      <div className="mt-6">
        <ReservationForm
          action={
            createManualReservation
          }
          spaceId={
            selectedSpace.id
          }
          selectedDate={
            selectedDate
          }
          slots={slots}
          members={
            membersResult.data ??
            []
          }
          price={
            Number.isFinite(
              price,
            )
              ? price
              : 0
          }
          requiresDeposit={
            selectedSpace.requires_deposit
          }
          depositType={
            selectedSpace.deposit_type
          }
          depositValue={
            Number(
              selectedSpace.deposit_value,
            )
          }
        />
      </div>
    </div>
  );
}