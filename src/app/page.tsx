import Link from "next/link";

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
              href="/clubes/club-estrella"
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

      <section className="relative overflow-hidden bg-slate-950 text-white">
        <div className="absolute inset-0 opacity-30">
          <div className="absolute -left-32 top-10 h-96 w-96 rounded-full bg-blue-600 blur-3xl" />
          <div className="absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-cyan-500 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-6 py-24 lg:grid-cols-[1.15fr_0.85fr] lg:py-32">
          <div>
            <span className="inline-flex rounded-full border border-blue-400/30 bg-blue-400/10 px-4 py-2 text-sm font-medium text-blue-200">
              Página, actividades, reservas y administración
            </span>

            <h1 className="mt-7 max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl">
              La plataforma digital para clubes de barrio
            </h1>

            <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-300">
              ClubSmart permite publicar actividades, recibir consultas,
              organizar reservas, registrar pagos y centralizar la
              información administrativa del club.
            </p>

            <div className="mt-10 flex flex-wrap gap-4">
              <Link
                href="/clubes/club-estrella"
                className="rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-100"
              >
                Ver club de demostración
              </Link>

              <a
                href="#planes"
                className="rounded-lg border border-white/30 px-6 py-3 font-semibold text-white transition hover:bg-white/10"
              >
                Conocer los planes
              </a>
            </div>

            <div className="mt-12 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-8">
              <div>
                <p className="text-2xl font-bold">1</p>
                <p className="mt-1 text-sm text-slate-400">
                  panel administrativo
                </p>
              </div>

              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="mt-1 text-sm text-slate-400">
                  usuarios obligatorios para familias
                </p>
              </div>

              <div>
                <p className="text-2xl font-bold">3</p>
                <p className="mt-1 text-sm text-slate-400">
                  planes escalables
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-2xl backdrop-blur">
            <div className="rounded-2xl bg-white p-6 text-slate-900">
              <div className="flex items-center justify-between border-b border-slate-200 pb-5">
                <div>
                  <p className="font-semibold">
                    Club Social y Deportivo Estrella
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Página pública del club
                  </p>
                </div>

                <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-800">
                  Publicado
                </span>
              </div>

              <div className="mt-6 space-y-4">
                {[
                  ["Fútbol infantil", "Martes y jueves · 17:30"],
                  ["Danza", "Miércoles y viernes · 18:00"],
                  ["Gimnasia", "Lunes y miércoles · 09:00"],
                ].map(([name, schedule]) => (
                  <div
                    key={name}
                    className="rounded-xl border border-slate-200 p-4"
                  >
                    <p className="font-semibold">{name}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {schedule}
                    </p>
                  </div>
                ))}
              </div>

              <Link
                href="/clubes/club-estrella"
                className="mt-6 inline-flex font-semibold text-blue-700 hover:text-blue-800"
              >
                Abrir página del club →
              </Link>
            </div>
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

      <section
        id="integraciones"
        className="border-y border-slate-200 bg-slate-50 py-24"
      >
        <div className="mx-auto grid max-w-7xl gap-14 px-6 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              Ecosistema Smart
            </p>

            <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-5xl">
              Productos independientes, una experiencia integrada
            </h2>

            <p className="mt-5 text-lg leading-8 text-slate-600">
              ClubSmart puede vincularse con otras soluciones sin
              convertir la plataforma en un sistema difícil de usar.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {integrations.map((integration) => (
              <article
                key={integration.name}
                className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"
              >
                <h3 className="text-2xl font-semibold">
                  {integration.name}
                </h3>

                <p className="mt-4 leading-7 text-slate-600">
                  {integration.description}
                </p>

                <p className="mt-6 text-sm font-semibold text-blue-700">
                  Contratación independiente o en paquete
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="contacto" className="py-24">
        <div className="mx-auto max-w-7xl px-6">
          <div className="overflow-hidden rounded-3xl bg-slate-950 px-7 py-14 text-white sm:px-12 lg:flex lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-wider text-blue-300">
                Próximamente
              </p>

              <h2 className="mt-4 text-3xl font-bold sm:text-5xl">
                Una plataforma simple para administrar mejor el club
              </h2>

              <p className="mt-5 text-lg leading-8 text-slate-300">
                Estamos desarrollando ClubSmart para clubes sociales,
                deportivos y culturales que necesitan ordenar su
                presencia digital y su administración.
              </p>
            </div>

            <Link
              href="/clubes/club-estrella"
              className="mt-8 inline-flex shrink-0 rounded-lg bg-white px-6 py-3 font-semibold text-slate-900 transition hover:bg-slate-100 lg:mt-0"
            >
              Explorar la demostración
            </Link>
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