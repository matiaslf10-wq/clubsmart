import Link from "next/link";

const demoClubSlug = "club-smart";

const features = [
  {
    title: "Página propia del club",
    description:
      "Un sitio configurable con identidad visual, información institucional, actividades, horarios, fotografías y medios de contacto.",
  },
  {
    title: "Gestión de actividades",
    description:
      "La administración puede crear actividades, definir profesores, edades, precios, días, horarios, cupos y estados de inscripción.",
  },
  {
    title: "Consultas por WhatsApp",
    description:
      "Cada actividad puede tener un botón de consulta contextualizado sin mostrar públicamente el número de teléfono.",
  },
  {
    title: "Reservas de espacios",
    description:
      "Cronograma de disponibilidad para canchas, salones y otros espacios, con confirmación manual o automática.",
  },
  {
    title: "Pagos y comprobantes",
    description:
      "Registro de transferencias, carga de comprobantes e integración futura con pagos virtuales y señas.",
  },
  {
    title: "Información centralizada",
    description:
      "Participantes, responsables, consultas, actividades, pagos y reservas organizados desde un único panel.",
  },
];

const plans = [
  {
    name: "Esencial",
    description:
      "Para clubes que necesitan presencia digital y organizar sus actividades.",
    features: [
      "Página pública configurable",
      "Publicación de actividades",
      "Días, horarios y responsables",
      "Fotos e información institucional",
      "Consultas por WhatsApp",
      "Carga manual de pagos",
    ],
  },
  {
    name: "Pro",
    description:
      "Para clubes que además necesitan administrar reservas, participantes y cobranzas.",
    featured: true,
    features: [
      "Todo lo incluido en Esencial",
      "Reservas de canchas y espacios",
      "Cronograma de disponibilidad",
      "Señas y confirmaciones",
      "Registro de participantes",
      "Seguimiento de pagos",
    ],
  },
  {
    name: "Intelligence",
    description:
      "Para organizaciones que requieren gestión societaria y análisis avanzado.",
    features: [
      "Todo lo incluido en Pro",
      "Padrón de socios",
      "Cuota social",
      "Morosidad y cobranzas",
      "Indicadores avanzados",
      "Proyecciones y alertas",
    ],
  },
];

const integrations = [
  {
    name: "TiendaSmart",
    description:
      "Una tienda independiente para indumentaria, merchandising, rifas, entradas y productos del club.",
  },
  {
    name: "RestoSmart",
    description:
      "Gestión del buffet, restaurante o cantina, con menú digital, pedidos y delivery.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">
              C
            </div>

            <div>
              <p className="font-bold leading-none">ClubSmart</p>
              <p className="mt-1 text-xs text-slate-500">
                Tecnología para clubes
              </p>
            </div>
          </Link>

          <nav className="hidden items-center gap-7 text-sm font-medium md:flex">
            <a href="#funcionalidades" className="hover:text-blue-700">
              Funcionalidades
            </a>

            <a href="#planes" className="hover:text-blue-700">
              Planes
            </a>

            <a href="#integraciones" className="hover:text-blue-700">
              Integraciones
            </a>

            <a href="#contacto" className="hover:text-blue-700">
              Contacto
            </a>
          </nav>

          <div className="flex items-center gap-3">
            <Link
              href={`/clubes/${demoClubSlug}`}
              className="hidden rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100 sm:inline-flex"
            >
              Ver demo
            </Link>

            <Link
  href="/login"
  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
>
  Ingresar
</Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b border-slate-200 bg-gradient-to-br from-white via-blue-50/60 to-white">
        <div className="absolute -right-40 -top-40 h-[520px] w-[520px] rounded-full bg-blue-200/40 blur-3xl" />
        <div className="absolute -left-48 bottom-0 h-96 w-96 rounded-full bg-cyan-100/60 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-6 py-16 lg:grid-cols-[0.8fr_1.2fr] lg:py-24">
          <div className="relative z-10">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
              La plataforma digital para clubes de barrio
            </p>

            <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl lg:text-6xl">
              Todo tu club,
              <span className="block text-blue-600">
                en un solo lugar
              </span>
            </h1>

            <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
              {"Public\u00e1 actividades, gestion\u00e1 reservas, organiz\u00e1 pagos y conect\u00e1 al club con sus socios y sus familias desde una plataforma simple y completa."}
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href={`/clubes/${demoClubSlug}`}
                className="rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg shadow-blue-600/20 transition hover:bg-blue-700"
              >
                {"Ver club de demostraci\u00f3n"}
              </Link>

              <a
                href="#contacto"
                className="rounded-xl border border-blue-200 bg-white px-6 py-3 font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-50"
              >
                Solicitar una prueba
              </a>
            </div>

            <div className="mt-10 grid max-w-xl grid-cols-2 gap-3 sm:grid-cols-4">
              {[
                ["P\u00e1gina propia", "Identidad y actividades"],
                ["Actividades", "Horarios y socios"],
                ["Reservas", "Canchas y espacios"],
                ["Pagos", "Cuotas y seguimiento"],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm backdrop-blur"
                >
                  <p className="text-sm font-bold text-slate-900">
                    {title}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    {description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="relative">
            <div className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-2xl">
              <img
                src="/demo/hero-general.png"
                alt="Vista general de ClubSmart"
                className="block h-auto w-full"
              />
            </div>

            <div className="absolute -bottom-4 right-6 rounded-full border border-blue-100 bg-white px-4 py-2 text-xs font-bold text-blue-700 shadow-lg">
              Demo visual de ClubSmart
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-20">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-bold uppercase tracking-[0.18em] text-blue-600">
              Producto real
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl">
              Así funciona ClubSmart
            </h2>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              Desde la página pública hasta la gestión de actividades, reservas y pagos,
              ClubSmart conecta al club con sus socios desde una misma plataforma.
            </p>
          </div>

          <div className="mt-14 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <img
              src="/demo/asi-funciona-web.png"
              alt="Ejemplo de pagina publica y panel administrativo de ClubSmart"
              className="block h-auto w-full"
            />
          </div>

          <div className="mt-10 grid gap-6 sm:grid-cols-3">
            {[
              {
                image: "/demo/demo-app-actividades.jpg",
                title: "Actividades",
                description: "El socio consulta sus actividades y descubre nuevas propuestas.",
                position: "50% 34%",
              },
              {
                image: "/demo/demo-app-reservas.jpg",
                title: "Reservas",
                description: "Disponibilidad de espacios, horarios y reservas desde el celular.",
                position: "50% 38%",
              },
              {
                image: "/demo/demo-app-pagos.jpg",
                title: "Pagos",
                description: "Cuotas, vencimientos y seguimiento de pagos en un solo lugar.",
                position: "50% 38%",
              },
            ].map((item) => (
              <article
                key={item.title}
                className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="h-[410px] overflow-hidden bg-slate-100">
                  <img
                    src={item.image}
                    alt={item.title}
                    className="h-[125%] w-full object-cover"
                    style={{ objectPosition: item.position }}
                  />
                </div>

                <div className="p-5">
                  <h3 className="text-lg font-bold text-slate-950">
                    {item.title}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="funcionalidades" className="bg-slate-50 py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Funcionalidades
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
              Todo lo necesario para ordenar la gestión del club
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-600">
              Sin exigir que profesores, familias o participantes creen
              cuentas. La administración mantiene el control de la
              información.
            </p>
          </div>

          <div className="mt-14 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => (
              <article
                key={feature.title}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100 font-bold text-blue-700">
                  {index + 1}
                </div>

                <h3 className="mt-6 text-xl font-semibold">
                  {feature.title}
                </h3>

                <p className="mt-3 leading-7 text-slate-600">
                  {feature.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="planes" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Planes
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
              ClubSmart crece con cada institución
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-600">
              Cada club puede comenzar con una página institucional y
              sumar gestión operativa, cobranzas y análisis cuando lo
              necesite.
            </p>
          </div>

          <div className="mt-14 grid gap-7 lg:grid-cols-3">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`relative rounded-3xl border p-8 ${
                  plan.featured
                    ? "border-blue-600 bg-slate-950 text-white shadow-xl"
                    : "border-slate-200 bg-white text-slate-900 shadow-sm"
                }`}
              >
                {plan.featured ? (
                  <span className="absolute right-6 top-6 rounded-full bg-blue-500 px-3 py-1 text-xs font-semibold text-white">
                    Recomendado
                  </span>
                ) : null}

                <h3 className="text-2xl font-bold">{plan.name}</h3>

                <p
                  className={`mt-4 leading-7 ${
                    plan.featured ? "text-slate-300" : "text-slate-600"
                  }`}
                >
                  {plan.description}
                </p>

                <ul className="mt-8 space-y-4">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className={`flex gap-3 text-sm ${
                        plan.featured
                          ? "text-slate-200"
                          : "text-slate-700"
                      }`}
                    >
                      <span
                        className={
                          plan.featured
                            ? "text-blue-300"
                            : "text-blue-600"
                        }
                      >
                        ✓
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>

                <a
                  href="#contacto"
                  className={`mt-9 inline-flex w-full justify-center rounded-lg px-5 py-3 font-semibold transition ${
                    plan.featured
                      ? "bg-white text-slate-900 hover:bg-slate-100"
                      : "bg-slate-900 text-white hover:bg-slate-700"
                  }`}
                >
                  Consultar
                </a>
              </article>
            ))}
          </div>
        </div>
      </section>

<footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-9 text-sm text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-semibold text-slate-800">ClubSmart</p>
            <p className="mt-1">Tecnología para clubes.</p>
          </div>

          <div className="flex flex-wrap gap-5">
            <a href="#funcionalidades" className="hover:text-slate-900">
              Funcionalidades
            </a>
            <a href="#planes" className="hover:text-slate-900">
              Planes
            </a>
            <a href="#integraciones" className="hover:text-slate-900">
              Integraciones
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}