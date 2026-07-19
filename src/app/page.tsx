import { createClient } from "@/lib/supabase/server";

type Club = {
  id: string;
  name: string;
  slug: string;
  short_description: string | null;
  city: string | null;
  province: string | null;
};

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("clubs")
    .select(
      `
        id,
        name,
        slug,
        short_description,
        city,
        province
      `,
    )
    .eq("is_published", true)
    .eq("active", true)
    .order("name")
    .limit(6);

  const clubs = (data ?? []) as Club[];

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <div>
            <p className="text-xl font-bold tracking-tight">ClubSmart</p>
            <p className="text-sm text-slate-500">Plataforma para clubes</p>
          </div>

          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium transition hover:bg-slate-100"
          >
            Ingresar al panel
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <div className="max-w-3xl">
          <span className="inline-flex rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
            Actividades, reservas y administración
          </span>

          <h1 className="mt-6 text-4xl font-bold tracking-tight sm:text-6xl">
            La plataforma digital para clubes de barrio
          </h1>

          <p className="mt-6 text-lg leading-8 text-slate-600">
            ClubSmart permite publicar actividades, organizar reservas,
            registrar pagos y centralizar la información administrativa del
            club.
          </p>
        </div>

        <div className="mt-16">
          <div className="mb-6">
            <h2 className="text-2xl font-semibold">Clubes publicados</h2>
            <p className="mt-2 text-slate-600">
              Primeros clubes disponibles en ClubSmart.
            </p>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-6">
              <p className="font-semibold text-red-800">
                No fue posible cargar los clubes.
              </p>

              <p className="mt-2 text-sm text-red-700">{error.message}</p>
            </div>
          ) : clubs.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white p-8">
              <p className="font-medium">Todavía no hay clubes publicados.</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {clubs.map((club) => (
                <article
                  key={club.id}
                  className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-lg font-bold text-blue-700">
                    {club.name.charAt(0)}
                  </div>

                  <h3 className="mt-5 text-xl font-semibold">{club.name}</h3>

                  {club.short_description ? (
                    <p className="mt-3 leading-7 text-slate-600">
                      {club.short_description}
                    </p>
                  ) : null}

                  {club.city || club.province ? (
                    <p className="mt-5 text-sm text-slate-500">
                      {[club.city, club.province].filter(Boolean).join(", ")}
                    </p>
                  ) : null}

                  <a
                    href={`/clubes/${club.slug}`}
                    className="mt-6 inline-flex font-medium text-blue-700 hover:text-blue-800"
                  >
                    Ver club
                  </a>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
