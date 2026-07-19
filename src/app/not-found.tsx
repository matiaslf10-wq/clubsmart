import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <div className="max-w-lg text-center">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          ClubSmart
        </p>

        <h1 className="mt-4 text-4xl font-bold text-slate-900">
          No encontramos esta página
        </h1>

        <p className="mt-4 leading-7 text-slate-600">
          El club puede no existir, estar desactivado o todavía no
          haber publicado su página.
        </p>

        <Link
          href="/"
          className="mt-8 inline-flex rounded-lg bg-slate-900 px-5 py-3 font-semibold text-white"
        >
          Volver al inicio
        </Link>
      </div>
    </main>
  );
}