import Link from "next/link";

import {
  requestPasswordReset,
} from "./actions";

type PageProps = {
  searchParams: Promise<{
    sent?: string;
    error?: string;
  }>;
};

export default async function RecoverPasswordPage({
  searchParams,
}: PageProps) {
  const parameters =
    await searchParams;

  const sent =
    parameters.sent ===
    "1";

  const error =
    parameters.error;

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            ClubSmart
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Recuperar contraseña
          </h1>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Ingresá el correo electrónico
            de tu cuenta y te enviaremos
            un enlace para elegir una
            nueva contraseña.
          </p>
        </div>

        {sent ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">
            Si existe una cuenta asociada
            a ese correo, recibirás un
            mensaje con las instrucciones
            para restablecer la contraseña.
          </div>
        ) : (
          <form
            action={
              requestPasswordReset
            }
            className="mt-6"
          >
            <div>
              <label
                htmlFor="email"
                className="text-sm font-medium text-slate-700"
              >
                Correo electrónico
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                placeholder="nombre@correo.com"
              />
            </div>

            {error ? (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
              >
                {error}
              </div>
            ) : null}

            <button
              type="submit"
              className="mt-6 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Enviar enlace
            </button>
          </form>
        )}

        <div className="mt-6 border-t border-slate-200 pt-6">
          <Link
            href="/login"
            className="text-sm font-semibold text-blue-700 hover:text-blue-800"
          >
            ← Volver al inicio de sesión
          </Link>
        </div>
      </div>
    </main>
  );
}