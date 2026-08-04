import Link from "next/link";
import { redirect } from "next/navigation";

import { toggleSpaceActive } from "@/app/panel/espacios/actions";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<{
    success?: string;
    error?: string;
  }>;
};

type Availability = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
};

type ClubSpace = {
  id: string;
  name: string;
  slug: string;
  space_type: string;
  short_description: string | null;
  location: string | null;
  capacity: number | null;
  minimum_reservation_minutes: number;
  price: number | string;
  price_description: string | null;
  confirmation_mode: string;
  requires_deposit: boolean;
  deposit_type: string;
  deposit_value: number | string;
  publicly_bookable: boolean;
  active: boolean;
  display_order: number;
  space_availability: Availability[];
};

const dayNames: Record<number, string> = {
  1: "Lun.",
  2: "Mar.",
  3: "Mié.",
  4: "Jue.",
  5: "Vie.",
  6: "Sáb.",
  7: "Dom.",
};

const spaceTypeNames: Record<string, string> = {
  court: "Cancha",
  hall: "Salón",
  barbecue: "Quincho",
  stadium: "Estadio",
  pool: "Pileta",
  room: "Sala",
  other: "Otro",
};

function formatMoney(value: number | string) {
  const amount = Number(value);

  if (!Number.isFinite(amount) || amount <= 0) {
    return "Sin cargo";
  }

  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatAvailability(
  rows: Availability[],
) {
  if (rows.length === 0) {
    return ["Sin horarios cargados"];
  }

  return [...rows]
    .sort((first, second) => {
      if (first.day_of_week !== second.day_of_week) {
        return first.day_of_week - second.day_of_week;
      }

      return first.start_time.localeCompare(
        second.start_time,
      );
    })
    .map(
      (row) =>
        `${dayNames[row.day_of_week]} ${formatTime(
          row.start_time,
        )}–${formatTime(row.end_time)}`,
    );
}

export default async function SpacesPage({
  searchParams,
}: PageProps) {
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel");
  }

  const parameters = await searchParams;

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("club_spaces")
    .select(`
      id,
      name,
      slug,
      space_type,
      short_description,
      location,
      capacity,
      minimum_reservation_minutes,
      price,
      price_description,
      confirmation_mode,
      requires_deposit,
      deposit_type,
      deposit_value,
      publicly_bookable,
      active,
      display_order,

      space_availability (
        id,
        day_of_week,
        start_time,
        end_time
      )
    `)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .order("display_order", {
      ascending: true,
    })
    .order("name", {
      ascending: true,
    });

  if (error) {
    throw new Error(
      `No fue posible cargar los espacios: ${error.message}`,
    );
  }

  const spaces =
    (data ?? []) as unknown as ClubSpace[];

  const activeSpaces = spaces.filter(
    (space) => space.active,
  );

  const publicSpaces = spaces.filter(
    (space) =>
      space.active && space.publicly_bookable,
  );

  const spacesWithAvailability = spaces.filter(
    (space) =>
      space.space_availability.length > 0,
  );

  return (
    <div>
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Espacios
          </h1>

          <p className="mt-3 max-w-3xl text-slate-600">
            Administrá las canchas, salones y
            demás espacios que podrán reservarse.
          </p>
        </div>

        <Link
          href="/panel/espacios/nuevo"
          className="inline-flex justify-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Nuevo espacio
        </Link>
      </div>

      {parameters.success ? (
        <div
          role="status"
          className="mt-8 rounded-xl border border-green-200 bg-green-50 p-5 text-green-800"
        >
          {parameters.success}
        </div>
      ) : null}

      {parameters.error ? (
        <div
          role="alert"
          className="mt-8 rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {parameters.error}
        </div>
      ) : null}

      <section className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Espacios registrados"
          value={String(spaces.length)}
        />

        <SummaryCard
          label="Activos"
          value={String(activeSpaces.length)}
        />

        <SummaryCard
          label="Reserva pública"
          value={String(publicSpaces.length)}
        />

        <SummaryCard
          label="Con disponibilidad"
          value={String(spacesWithAvailability.length)}
        />
      </section>

      {spaces.length === 0 ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-xl font-bold text-slate-900">
            Todavía no hay espacios
          </h2>

          <p className="mt-3 text-slate-600">
            Creá la primera cancha, salón o espacio
            reservable del club.
          </p>

          <Link
            href="/panel/espacios/nuevo"
            className="mt-6 inline-flex rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white"
          >
            Crear primer espacio
          </Link>
        </section>
      ) : (
        <section className="mt-8 grid gap-5 lg:grid-cols-2">
          {spaces.map((space) => {
            const availability =
              formatAvailability(
                space.space_availability,
              );

            return (
              <article
                key={space.id}
                className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-800">
                        {spaceTypeNames[
                          space.space_type
                        ] ?? "Espacio"}
                      </span>

                      <span
                        className={
                          space.active
                            ? "rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800"
                            : "rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700"
                        }
                      >
                        {space.active
                          ? "Activo"
                          : "Inactivo"}
                      </span>

                      {space.publicly_bookable ? (
                        <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-800">
                          Reserva pública
                        </span>
                      ) : null}
                    </div>

                    <h2 className="mt-4 text-xl font-bold text-slate-900">
                      {space.name}
                    </h2>

                    {space.short_description ? (
                      <p className="mt-2 text-sm leading-6 text-slate-600">
                        {space.short_description}
                      </p>
                    ) : null}
                  </div>

                  <p className="text-right font-bold text-slate-900">
                    {formatMoney(space.price)}
                  </p>
                </div>

                <dl className="mt-6 grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-slate-500">
                      Ubicación
                    </dt>

                    <dd className="mt-1 font-medium text-slate-900">
                      {space.location ?? "—"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-slate-500">
                      Capacidad
                    </dt>

                    <dd className="mt-1 font-medium text-slate-900">
                      {space.capacity
                        ? `${space.capacity} personas`
                        : "Sin especificar"}
                    </dd>
                  </div>

                  <div>
                    <dt className="text-slate-500">
                      Duración mínima
                    </dt>

                    <dd className="mt-1 font-medium text-slate-900">
                      {
                        space.minimum_reservation_minutes
                      }{" "}
                      minutos
                    </dd>
                  </div>

                  <div>
                    <dt className="text-slate-500">
                      Confirmación
                    </dt>

                    <dd className="mt-1 font-medium text-slate-900">
                      {space.confirmation_mode ===
                      "automatic"
                        ? "Automática"
                        : "Manual"}
                    </dd>
                  </div>
                </dl>

                <div className="mt-6">
                  <p className="text-sm font-semibold text-slate-800">
                    Disponibilidad
                  </p>

                  <div className="mt-2 flex flex-wrap gap-2">
                    {availability
                      .slice(0, 6)
                      .map((label) => (
                        <span
                          key={label}
                          className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700"
                        >
                          {label}
                        </span>
                      ))}

                    {availability.length > 6 ? (
                      <span className="rounded-lg bg-slate-100 px-3 py-2 text-xs text-slate-700">
                        +
                        {availability.length - 6}{" "}
                        horarios
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap gap-3 border-t border-slate-200 pt-5">
                  <Link
                    href={`/panel/espacios/${space.id}/editar`}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
                  >
                    Editar
                  </Link>

                  <form
                    action={toggleSpaceActive.bind(
                      null,
                      space.id,
                      !space.active,
                    )}
                  >
                    <button
                      type="submit"
                      className={
                        space.active
                          ? "rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-50"
                          : "rounded-lg border border-green-300 px-4 py-2 text-sm font-semibold text-green-700 transition hover:bg-green-50"
                      }
                    >
                      {space.active
                        ? "Desactivar"
                        : "Activar"}
                    </button>
                  </form>
                </div>
              </article>
            );
          })}
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