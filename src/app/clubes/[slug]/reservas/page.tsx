import Link from "next/link";
import { notFound } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic =
  "force-dynamic";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type Availability = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  ends_next_day: boolean;
};

type Space = {
  id: string;
  name: string;
  slug: string;
  space_type: string;

  short_description:
    | string
    | null;

  description:
    | string
    | null;

  location:
    | string
    | null;

  capacity:
    | number
    | null;

  minimum_reservation_minutes:
    number;

  price:
    | number
    | string;

  price_description:
    | string
    | null;

  confirmation_mode:
    string;

  requires_deposit:
    boolean;

  deposit_type:
    string;

  deposit_value:
    | number
    | string;

  space_availability:
    Availability[];
};

const spaceNames:
  Record<string, string> = {
    court: "Cancha",
    hall: "Salón",
    barbecue: "Quincho",
    stadium: "Estadio",
    pool: "Pileta",
    room: "Sala",
    other: "Espacio",
  };

const dayNames:
  Record<number, string> = {
    1: "Lun",
    2: "Mar",
    3: "Mié",
    4: "Jue",
    5: "Vie",
    6: "Sáb",
    7: "Dom",
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

function formatDeposit(
  space: Space,
) {
  if (
    !space.requires_deposit
  ) {
    return null;
  }

  const value =
    Number(
      space.deposit_value,
    );

  if (
    space.deposit_type ===
    "percentage"
  ) {
    return `${value} %`;
  }

  if (
    space.deposit_type ===
    "fixed"
  ) {
    return formatMoney(
      value,
    );
  }

  return null;
}

export default async function PublicReservationsPage({
  params,
}: PageProps) {
  const { slug } =
    await params;

  const supabase =
    createAdminClient();

  const {
    data: club,
    error: clubError,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      organization_id,
      name,
      slug,
      short_description
    `)
    .eq(
      "slug",
      slug,
    )
    .maybeSingle();

  if (
    clubError ||
    !club
  ) {
    notFound();
  }

  const {
    data,
    error,
  } = await supabase
    .from("club_spaces")
    .select(`
      id,
      name,
      slug,
      space_type,
      short_description,
      description,
      location,
      capacity,
      minimum_reservation_minutes,
      price,
      price_description,
      confirmation_mode,
      requires_deposit,
      deposit_type,
      deposit_value,

      space_availability (
        day_of_week,
        start_time,
        end_time,
        ends_next_day
      )
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
      "active",
      true,
    )
    .eq(
      "publicly_bookable",
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

  if (error) {
    throw new Error(
      `No fue posible cargar los espacios: ${error.message}`,
    );
  }

  const spaces =
    (data ??
      []) as unknown as Space[];

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-6 py-5">
          <Link
            href={`/clubes/${slug}`}
            className="text-sm font-semibold text-blue-700"
          >
            ← Volver al club
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-6 py-10">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {club.name}
        </p>

        <h1 className="mt-3 text-4xl font-bold text-slate-900">
          Reservar un espacio
        </h1>

        <p className="mt-4 max-w-2xl leading-7 text-slate-600">
          Elegí el espacio que necesitás y
          consultá los turnos disponibles.
        </p>

        {spaces.length === 0 ? (
          <div className="mt-10 rounded-2xl border border-slate-200 bg-white p-10 text-center">
            <h2 className="text-xl font-bold text-slate-900">
              No hay espacios disponibles
            </h2>

            <p className="mt-3 text-slate-600">
              El club todavía no habilitó
              espacios para reserva pública.
            </p>
          </div>
        ) : (
          <section className="mt-10 grid gap-6 md:grid-cols-2">
            {spaces.map(
              (space) => {
                const deposit =
                  formatDeposit(
                    space,
                  );

                const price =
                  Number(
                    space.price,
                  );

                return (
                  <article
                    key={
                      space.id
                    }
                    className="flex flex-col rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                  >
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        {spaceNames[
                          space.space_type
                        ] ??
                          "Espacio"}
                      </span>

                      <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                        {
                          space.minimum_reservation_minutes
                        }{" "}
                        min.
                      </span>
                    </div>

                    <h2 className="mt-5 text-2xl font-bold text-slate-900">
                      {
                        space.name
                      }
                    </h2>

                    {space.short_description ? (
                      <p className="mt-3 leading-6 text-slate-600">
                        {
                          space.short_description
                        }
                      </p>
                    ) : null}

                    <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                      {space.location ? (
                        <div>
                          <dt className="text-slate-500">
                            Ubicación
                          </dt>

                          <dd className="mt-1 font-semibold text-slate-900">
                            {
                              space.location
                            }
                          </dd>
                        </div>
                      ) : null}

                      {space.capacity ? (
                        <div>
                          <dt className="text-slate-500">
                            Capacidad
                          </dt>

                          <dd className="mt-1 font-semibold text-slate-900">
                            {
                              space.capacity
                            }{" "}
                            personas
                          </dd>
                        </div>
                      ) : null}

                      {price > 0 ? (
                        <div>
                          <dt className="text-slate-500">
                            Precio
                          </dt>

                          <dd className="mt-1 font-semibold text-slate-900">
                            {formatMoney(
                              price,
                            )}
                          </dd>
                        </div>
                      ) : null}

                      {deposit ? (
                        <div>
                          <dt className="text-slate-500">
                            Seña
                          </dt>

                          <dd className="mt-1 font-semibold text-slate-900">
                            {
                              deposit
                            }
                          </dd>
                        </div>
                      ) : null}
                    </dl>

                    {space.space_availability.length >
                    0 ? (
                      <div className="mt-6">
                        <p className="text-sm font-semibold text-slate-800">
                          Días disponibles
                        </p>

                        <div className="mt-2 flex flex-wrap gap-2">
                          {Array.from(
                            new Set(
                              space.space_availability.map(
                                (
                                  availability,
                                ) =>
                                  availability.day_of_week,
                              ),
                            ),
                          )
                            .sort(
                              (
                                first,
                                second,
                              ) =>
                                first -
                                second,
                            )
                            .map(
                              (
                                day,
                              ) => (
                                <span
                                  key={
                                    day
                                  }
                                  className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-medium text-slate-700"
                                >
                                  {
                                    dayNames[
                                      day
                                    ]
                                  }
                                </span>
                              ),
                            )}
                        </div>
                      </div>
                    ) : null}

                    <div className="mt-auto pt-7">
                      <Link
                        href={`/clubes/${slug}/reservas/${space.slug}`}
                        className="inline-flex w-full justify-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
                      >
                        Ver turnos
                      </Link>
                    </div>
                  </article>
                );
              },
            )}
          </section>
        )}
      </div>
    </main>
  );
}