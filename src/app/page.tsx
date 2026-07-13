export default function HomePage() {
  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-6xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
          Plataforma para clubes
        </span>

        <h1 className="max-w-4xl text-4xl font-bold tracking-tight text-slate-900 sm:text-6xl">
          ClubSmart
        </h1>

        <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
          Actividades, reservas, pagos y administración para clubes de barrio.
        </p>

        <div className="mt-10 flex flex-wrap justify-center gap-4">
          <button
            type="button"
            className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white transition hover:bg-blue-700"
          >
            Conocer actividades
          </button>

          <button
            type="button"
            className="rounded-lg border border-slate-300 bg-white px-6 py-3 font-medium text-slate-700 transition hover:bg-slate-100"
          >
            Ingresar al panel
          </button>
        </div>

        <p className="mt-16 text-sm text-slate-500">
          Primera versión de ClubSmart
        </p>
      </section>
    </main>
  );
}