import type {
  Metadata,
} from "next";

import Link from "next/link";

import {
  redirect,
} from "next/navigation";

import {
  createClient,
} from "@/lib/supabase/server";

import {
  signUp,
} from "./actions";

export const metadata:
  Metadata = {
    title:
      "Crear cuenta",

    description:
      "Creá una cuenta y comenzá a administrar tu club con ClubSmart.",
  };

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams:
    Promise<{
      sent?: string;
      error?: string;
    }>;
};

export default async function RegisterPage({
  searchParams,
}: PageProps) {
  const parameters =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data,
  } =
    await supabase.auth.getClaims();

  /*
   * Una persona que ya tiene
   * una sesión no necesita
   * registrarse nuevamente.
   */
  if (
    data?.claims.sub
  ) {
    redirect(
      "/panel",
    );
  }

  const sent =
    parameters.sent ===
    "1";

  const error =
    parameters.error;

  return (
    <main className="grid min-h-screen bg-slate-50 lg:grid-cols-2">
      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link
            href="/"
            className="text-sm font-semibold text-blue-700"
          >
            ← Volver a ClubSmart
          </Link>

          <div className="mt-10">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 text-xl font-bold text-white">
              C
            </div>

            <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
              Crear mi club
            </h1>

            <p className="mt-3 leading-7 text-slate-600">
              Creá tu cuenta de
              administración. Después
              de verificar tu correo
              vas a poder configurar
              el club.
            </p>
          </div>

          {sent ? (
            <div className="mt-8">
              <div className="rounded-2xl border border-green-200 bg-green-50 p-5">
                <h2 className="font-semibold text-green-900">
                  Revisá tu correo
                </h2>

                <p className="mt-2 text-sm leading-6 text-green-800">
                  Te enviamos un mensaje
                  para confirmar tu
                  dirección de correo
                  electrónico.
                </p>

                <p className="mt-2 text-sm leading-6 text-green-800">
                  Hacé clic en el enlace
                  del email para continuar
                  con la creación de tu
                  club.
                </p>
              </div>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="text-sm font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                >
                  Ir al inicio de sesión
                </Link>
              </div>
            </div>
          ) : (
            <>
              <form
                action={signUp}
                className="mt-8 space-y-5"
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
                    placeholder="nombre@correo.com"
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-700"
                  >
                    Contraseña
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

                  <p className="mt-2 text-xs text-slate-500">
                    Debe tener al menos
                    8 caracteres.
                  </p>
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

                {error ? (
                  <div
                    role="alert"
                    className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
                  >
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  className="w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
                >
                  Crear cuenta
                </button>
              </form>

              <div className="mt-7 border-t border-slate-200 pt-6 text-center">
                <p className="text-sm text-slate-600">
                  ¿Ya tenés una cuenta?{" "}
                  <Link
                    href="/login"
                    className="font-semibold text-blue-700 hover:text-blue-800 hover:underline"
                  >
                    Ingresar
                  </Link>
                </p>
              </div>
            </>
          )}
        </div>
      </section>

      <section className="hidden bg-slate-950 px-12 py-16 text-white lg:flex lg:items-end">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
            Empezá con ClubSmart
          </p>

          <h2 className="mt-5 text-4xl font-bold leading-tight">
            Toda la gestión de tu club
            desde un único lugar.
          </h2>

          <p className="mt-5 text-lg leading-8 text-slate-300">
            Configurá actividades,
            personas, cuotas, espacios
            y reservas manteniendo el
            control de la información
            del club.
          </p>
        </div>
      </section>
    </main>
  );
}