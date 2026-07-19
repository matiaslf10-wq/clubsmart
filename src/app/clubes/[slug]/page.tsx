import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    slug: string;
  }>;
};

type Schedule = {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_name: string | null;
  notes: string | null;
};

type Activity = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  contact_name: string | null;
  category: string | null;
  age_from: number | null;
  age_to: number | null;
  level: string | null;
  price: number | null;
  price_description: string | null;
  enrollment_open: boolean;
  contact_whatsapp: string | null;
  cover_image_url: string | null;
  is_featured: boolean;
  activity_schedules: Schedule[];
};

type Club = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_phone: string | null;
  address: string | null;
  city: string | null;
  province: string | null;
  logo_url: string | null;
  cover_image_url: string | null;
  primary_color: string | null;
  secondary_color: string | null;
  activities: Activity[];
};

const dayNames: Record<number, string> = {
  1: "Lunes",
  2: "Martes",
  3: "Miércoles",
  4: "Jueves",
  5: "Viernes",
  6: "Sábado",
  7: "Domingo",
};

function formatTime(value: string) {
  return value.slice(0, 5);
}

function formatPrice(value: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(value);
}

function formatLevel(level: string) {
  const labels: Record<string, string> = {
    basico: "Básico",
    intermedio: "Intermedio",
    avanzado: "Avanzado",
    recreativo: "Recreativo",
    competitivo: "Competitivo",
  };

  return labels[level] ?? level;
}

function buildWhatsAppUrl(
  phone: string,
  clubName: string,
  activityName?: string,
) {
  const message = activityName
    ? `Hola, quería consultar por la actividad ${activityName} del ${clubName}.`
    : `Hola, quería realizar una consulta sobre ${clubName}.`;

  return `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(
    message,
  )}`;
}

async function getClub(slug: string): Promise<Club | null> {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clubs")
    .select(`
      id,
      name,
      slug,
      short_description,
      description,
      email,
      phone,
      whatsapp_phone,
      address,
      city,
      province,
      logo_url,
      cover_image_url,
      primary_color,
      secondary_color,
      activities (
        id,
        name,
        slug,
        short_description,
        description,
        contact_name,
        category,
        age_from,
        age_to,
        level,
        price,
        price_description,
        enrollment_open,
        contact_whatsapp,
        cover_image_url,
        is_featured,
        display_order,
        activity_schedules (
          id,
          day_of_week,
          start_time,
          end_time,
          location_name,
          notes
        )
      )
    `)
    .eq("slug", slug)
    .eq("is_published", true)
    .eq("active", true)
    .eq("activities.is_published", true)
    .eq("activities.active", true)
    .eq("activities.activity_schedules.active", true)
    .order("display_order", {
      referencedTable: "activities",
      ascending: true,
    })
    .maybeSingle();

  if (error) {
    console.error("Error al cargar el club:", error);

    throw new Error(
      "No fue posible cargar la página del club.",
    );
  }

  return data as Club | null;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const club = await getClub(slug);

  if (!club) {
    return {
      title: "Club no encontrado",
    };
  }

  const description =
    club.short_description ??
    club.description ??
    `Conocé las actividades de ${club.name}.`;

  return {
    title: club.name,
    description,
    openGraph: {
      title: club.name,
      description,
      type: "website",
      images: club.cover_image_url
        ? [
            {
              url: club.cover_image_url,
              alt: club.name,
            },
          ]
        : [],
    },
  };
}

export default async function ClubPage({
  params,
}: PageProps) {
  const { slug } = await params;
  const club = await getClub(slug);

  if (!club) {
    notFound();
  }

  const location = [
    club.address,
    club.city,
    club.province,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="font-semibold text-slate-700"
          >
            ClubSmart
          </Link>

          <nav className="flex items-center gap-5 text-sm font-medium">
            <a
              href="#actividades"
              className="hover:text-blue-700"
            >
              Actividades
            </a>

            <a
              href="#contacto"
              className="hover:text-blue-700"
            >
              Contacto
            </a>
          </nav>
        </div>
      </header>

      <section className="relative overflow-hidden bg-slate-900 text-white">
        {club.cover_image_url ? (
          <div
            className="absolute inset-0 bg-cover bg-center opacity-30"
            style={{
              backgroundImage: `url("${club.cover_image_url}")`,
            }}
          />
        ) : null}

        <div className="relative mx-auto max-w-6xl px-6 py-20 sm:py-28">
          <div className="max-w-3xl">
            <div
              className="flex h-20 w-20 items-center justify-center rounded-2xl bg-white text-3xl font-bold shadow-lg"
              style={{
                color:
                  club.primary_color ?? "#2563EB",
              }}
            >
              {club.logo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={club.logo_url}
                  alt={`Logo de ${club.name}`}
                  className="h-full w-full rounded-2xl object-cover"
                />
              ) : (
                club.name.charAt(0)
              )}
            </div>

            <p className="mt-8 text-sm font-semibold uppercase tracking-[0.25em] text-blue-200">
              Club social y deportivo
            </p>

            <h1 className="mt-4 text-4xl font-bold tracking-tight sm:text-6xl">
              {club.name}
            </h1>

            {club.short_description ? (
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-200">
                {club.short_description}
              </p>
            ) : null}

            <div className="mt-8 flex flex-wrap gap-4">
              <a
                href="#actividades"
                className="rounded-lg bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Ver actividades
              </a>

              {club.whatsapp_phone ? (
                <a
                  href={buildWhatsAppUrl(
                    club.whatsapp_phone,
                    club.name,
                  )}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-white/40 px-5 py-3 font-semibold text-white transition hover:bg-white/10"
                >
                  Consultar por WhatsApp
                </a>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid gap-10 lg:grid-cols-[2fr_1fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Sobre el club
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Un espacio para la comunidad
            </h2>

            <p className="mt-5 max-w-3xl whitespace-pre-line leading-8 text-slate-600">
              {club.description ??
                club.short_description ??
                "Próximamente encontrarás más información institucional del club."}
            </p>
          </div>

          <aside className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="font-semibold">
              Información
            </h2>

            <dl className="mt-5 space-y-4 text-sm">
              {location ? (
                <div>
                  <dt className="font-medium text-slate-900">
                    Ubicación
                  </dt>

                  <dd className="mt-1 text-slate-600">
                    {location}
                  </dd>
                </div>
              ) : null}

              {club.phone ? (
                <div>
                  <dt className="font-medium text-slate-900">
                    Teléfono
                  </dt>

                  <dd className="mt-1 text-slate-600">
                    {club.phone}
                  </dd>
                </div>
              ) : null}

              {club.email ? (
                <div>
                  <dt className="font-medium text-slate-900">
                    Correo electrónico
                  </dt>

                  <dd className="mt-1 break-all text-slate-600">
                    {club.email}
                  </dd>
                </div>
              ) : null}
            </dl>
          </aside>
        </div>
      </section>

      <section
        id="actividades"
        className="border-y border-slate-200 bg-white"
      >
        <div className="mx-auto max-w-6xl px-6 py-16">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Propuestas
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Actividades del club
            </h2>

            <p className="mt-4 text-slate-600">
              Conocé los días, horarios, responsables
              y valores de cada actividad.
            </p>
          </div>

          {club.activities.length === 0 ? (
            <div className="mt-10 rounded-2xl bg-slate-50 p-8">
              Todavía no hay actividades publicadas.
            </div>
          ) : (
            <div className="mt-10 grid gap-6 lg:grid-cols-2">
              {club.activities.map((activity) => {
                const whatsappPhone =
                  activity.contact_whatsapp ??
                  club.whatsapp_phone;

                const sortedSchedules = [
                  ...activity.activity_schedules,
                ].sort(
                  (first, second) =>
                    first.day_of_week -
                      second.day_of_week ||
                    first.start_time.localeCompare(
                      second.start_time,
                    ),
                );

                return (
                  <article
                    key={activity.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
                  >
                    {activity.cover_image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={
                          activity.cover_image_url
                        }
                        alt={activity.name}
                        className="h-56 w-full object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-36 items-end p-6"
                        style={{
                          background: `linear-gradient(135deg, ${
                            club.primary_color ??
                            "#2563EB"
                          }, ${
                            club.secondary_color ??
                            "#0F172A"
                          })`,
                        }}
                      >
                        <p className="text-sm font-semibold uppercase tracking-widest text-white/80">
                          {activity.category ??
                            "Actividad"}
                        </p>
                      </div>
                    )}

                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <h3 className="text-2xl font-semibold">
                          {activity.name}
                        </h3>

                        <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                          Disponible
                        </span>
                      </div>

                      {activity.short_description ? (
                        <p className="mt-4 leading-7 text-slate-600">
                          {
                            activity.short_description
                          }
                        </p>
                      ) : null}

                      {activity.description ? (
                        <p className="mt-4 whitespace-pre-line text-sm leading-7 text-slate-600">
                          {activity.description}
                        </p>
                      ) : null}

                      <div className="mt-6 grid gap-5 border-t border-slate-100 pt-6 sm:grid-cols-2">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Días y horarios
                          </p>

                          {sortedSchedules.length >
                          0 ? (
                            <ul className="mt-2 space-y-2 text-sm text-slate-600">
                              {sortedSchedules.map(
                                (schedule) => (
                                  <li
                                    key={
                                      schedule.id
                                    }
                                  >
                                    <span className="font-medium">
                                      {dayNames[
                                        schedule
                                          .day_of_week
                                      ] ?? "Día"}
                                    </span>{" "}
                                    {formatTime(
                                      schedule.start_time,
                                    )}{" "}
                                    a{" "}
                                    {formatTime(
                                      schedule.end_time,
                                    )}
                                    {schedule.location_name
                                      ? ` · ${schedule.location_name}`
                                      : ""}
                                  </li>
                                ),
                              )}
                            </ul>
                          ) : (
                            <p className="mt-2 text-sm text-slate-500">
                              Horarios a confirmar.
                            </p>
                          )}
                        </div>

                        <div>
                          <p className="text-sm font-semibold text-slate-900">
                            Información
                          </p>

                          <div className="mt-2 space-y-2 text-sm text-slate-600">
                            {activity.contact_name ? (
                              <p>
                                Profesor o
                                responsable:{" "}
                                {
                                  activity.contact_name
                                }
                              </p>
                            ) : null}

                            {activity.level ? (
                              <p>
                                Nivel:{" "}
                                {formatLevel(
                                  activity.level,
                                )}
                              </p>
                            ) : null}

                            {activity.age_from !==
                              null ||
                            activity.age_to !==
                              null ? (
                              <p>
                                Edad:{" "}
                                {activity.age_from !==
                                null
                                  ? `desde ${activity.age_from} años`
                                  : "sin edad mínima"}
                                {activity.age_to !==
                                null
                                  ? ` hasta ${activity.age_to} años`
                                  : " · edad máxima libre"}
                              </p>
                            ) : (
                              <p>Edad: libre</p>
                            )}

                            {activity.price !==
                            null ? (
                              <p>
                                Valor:{" "}
                                <span className="font-medium text-slate-900">
                                  {formatPrice(
                                    activity.price,
                                  )}
                                </span>

                                {activity.price_description
                                  ? ` · ${activity.price_description}`
                                  : ""}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      {whatsappPhone ? (
                        <a
                          href={buildWhatsAppUrl(
                            whatsappPhone,
                            club.name,
                            activity.name,
                          )}
                          target="_blank"
                          rel="noreferrer"
                          className="mt-6 inline-flex rounded-lg bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                        >
                          Consultar esta actividad
                        </a>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      </section>

      <section
        id="contacto"
        className="mx-auto max-w-6xl px-6 py-16"
      >
        <div className="rounded-3xl bg-slate-900 px-6 py-12 text-white sm:px-10">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-300">
              Contacto
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Comunicate con {club.name}
            </h2>

            <p className="mt-4 leading-7 text-slate-300">
              Consultá por actividades, horarios,
              valores e inscripciones.
            </p>

            {club.whatsapp_phone ? (
              <a
                href={buildWhatsAppUrl(
                  club.whatsapp_phone,
                  club.name,
                )}
                target="_blank"
                rel="noreferrer"
                className="mt-7 inline-flex rounded-lg bg-white px-5 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Enviar mensaje por WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-6 py-8 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>{club.name}</p>
          <p>Desarrollado con ClubSmart</p>
        </div>
      </footer>
    </main>
  );
}