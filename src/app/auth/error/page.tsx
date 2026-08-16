import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          ClubSmart
        </p>

        <h1 className="mt-3 text-2xl font-bold text-slate-900">
          El enlace no es válido
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          El enlace puede haber vencido,
          haber sido utilizado anteriormente
          o no ser válido.
        </p>

        <Link
          href="/auth/recuperar-clave"
          className="mt-6 inline-flex rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
        >
          Solicitar un nuevo enlace
        </Link>

        <div className="mt-6">
          <Link
            href="/login"
            className="text-sm font-semibold text-blue-700"
          >
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </main>
  );
}