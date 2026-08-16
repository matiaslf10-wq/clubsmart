import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  updatePassword,
} from "./actions";

type PageProps = {
  searchParams: Promise<{
    error?: string;
  }>;
};

export default async function NewPasswordPage({
  searchParams,
}: PageProps) {
  const parameters =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data,
    error:
      userError,
  } =
    await supabase.auth.getUser();

  /*
   * Nadie puede entrar directamente
   * escribiendo /auth/nueva-clave.
   *
   * Tiene que venir de un enlace válido
   * de recuperación.
   */
  if (
    userError ||
    !data.user
  ) {
    redirect(
      "/auth/recuperar-clave",
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          ClubSmart
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Elegí una nueva contraseña
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-600">
          Estás restableciendo la
          contraseña de:
        </p>

        <p className="mt-1 font-semibold text-slate-900">
          {data.user.email}
        </p>

        <form
          action={
            updatePassword
          }
          className="mt-7 space-y-5"
        >
          <div>
            <label
              htmlFor="password"
              className="text-sm font-medium text-slate-700"
            >
              Nueva contraseña
            </label>

            <input
              id="password"
              name="password"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label
              htmlFor="password_confirmation"
              className="text-sm font-medium text-slate-700"
            >
              Repetir contraseña
            </label>

            <input
              id="password_confirmation"
              name="password_confirmation"
              type="password"
              required
              minLength={8}
              autoComplete="new-password"
              className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          {parameters.error ? (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {
                parameters.error
              }
            </div>
          ) : null}

          <button
            type="submit"
            className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
          >
            Guardar nueva contraseña
          </button>
        </form>

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