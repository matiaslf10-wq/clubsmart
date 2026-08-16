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
  createInitialClub,
} from "./actions";

export const metadata:
  Metadata = {
    title:
      "Crear club",

    description:
      "Completá el alta inicial de tu club en ClubSmart.",
  };

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams:
    Promise<{
      error?: string;
    }>;
};

export default async function CreateClubPage({
  searchParams,
}: PageProps) {
  const parameters =
    await searchParams;

  const supabase =
    await createClient();

  const {
    data:
      userData,
    error:
      userError,
  } =
    await supabase.auth.getUser();

  if (
    userError ||
    !userData.user
  ) {
    redirect(
      "/login",
    );
  }

  /*
   * Si el usuario ya pertenece
   * a una organización, no debe
   * volver a crear un club.
   */
  const {
    data:
      existingMembership,
  } =
    await supabase
      .from(
        "organization_users",
      )
      .select(
        "id",
      )
      .eq(
        "user_id",
        userData.user.id,
      )
      .eq(
        "active",
        true,
      )
      .limit(
        1,
      )
      .maybeSingle();

  if (
    existingMembership
  ) {
    redirect(
      "/panel",
    );
  }

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

            <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-blue-700">
              Cuenta verificada
            </p>

            <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              Creá tu club
            </h1>

            <p className="mt-3 leading-7 text-slate-600">
              Este es el último paso
              para comenzar a usar
              ClubSmart.
            </p>

            <div className="mt-5 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                Tu cuenta
              </p>

              <p className="mt-1 text-sm font-semibold text-slate-900">
                {userData.user.email}
              </p>
            </div>
          </div>

          <form
            action={
              createInitialClub
            }
            className="mt-8"
          >
            <div>
              <label
                htmlFor="club_name"
                className="text-sm font-medium text-slate-700"
              >
                Nombre del club
              </label>

              <input
                id="club_name"
                name="club_name"
                type="text"
                required
                minLength={2}
                maxLength={120}
                autoFocus
                placeholder="Ej. Club Social y Deportivo Belgrano"
                className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <p className="mt-2 text-sm leading-6 text-slate-500">
                Después vas a poder
                completar logo,
                dirección, WhatsApp,
                colores y toda la
                información institucional.
              </p>
            </div>

            {parameters.error ? (
              <div
                role="alert"
                className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-800"
              >
                {
                  parameters.error
                }
              </div>
            ) : null}

            <button
              type="submit"
              className="mt-7 w-full rounded-lg bg-blue-600 px-5 py-3 font-semibold text-white transition hover:bg-blue-700"
            >
              Crear club
            </button>
          </form>
        </div>
      </section>

      <section className="hidden bg-slate-950 px-12 py-16 text-white lg:flex lg:items-end">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
            Tu espacio en ClubSmart
          </p>

          <h2 className="mt-5 text-4xl font-bold leading-tight">
            Empezá simple.
            Completá el club
            a medida que avanzás.
          </h2>

          <p className="mt-5 text-lg leading-8 text-slate-300">
            Al crear el club vas a
            quedar registrado como
            Owner y tendrás acceso
            completo al panel de
            administración.
          </p>
        </div>
      </section>
    </main>
  );
}