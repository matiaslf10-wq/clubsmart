import Link from "next/link";

import {
  registerClubOwner,
} from "./actions";

export const dynamic =
  "force-dynamic";

type PageProps = {
  searchParams:
    Promise<{
      sent?: string;
      error?: string;
      plan?: string;
    }>;
};

export default async function RegisterPage({
  searchParams,
}: PageProps) {
  const params =
    await searchParams;

  const selectedPlan =
    params.plan === "essential"
      ? "essential"
      : "pro";

  if (
    params.sent === "1"
  ) {
    return (
      <main className="min-h-screen bg-slate-50 px-6 py-12">
        <div className="mx-auto max-w-xl">
          <Link
            href="/"
            className="text-xl font-bold text-slate-900"
          >
            ClubSmart
          </Link>

          <section className="mt-12 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 text-xl font-bold text-green-700">
              ✓
            </div>

            <h1 className="mt-6 text-3xl font-bold text-slate-900">
              Revisá tu correo
            </h1>

            <p className="mt-4 leading-7 text-slate-600">
              Te enviamos un enlace
              para confirmar tu cuenta
              de ClubSmart.
            </p>

            <div className="mt-6 rounded-xl bg-blue-50 p-5">
              <p className="text-sm text-slate-600">
                Plan elegido
              </p>

              <p className="mt-1 font-bold text-blue-800">
                {selectedPlan ===
                "essential"
                  ? "Esencial"
                  : "Pro"}
              </p>
            </div>

            <p className="mt-6 text-sm leading-6 text-slate-500">
              Después de confirmar el
              correo vas a poder crear
              tu club. La habilitación
              del servicio se realizará
              una vez confirmado el
              pago.
            </p>

            <Link
              href="/login"
              className="mt-7 inline-flex font-semibold text-blue-700 hover:text-blue-800"
            >
              Ir al inicio de sesión
            </Link>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-xl font-bold text-slate-900"
        >
          ClubSmart
        </Link>

        <section className="mt-10 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            Crear mi club
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Empezá con ClubSmart
          </h1>

          <p className="mt-3 max-w-2xl leading-7 text-slate-600">
            Creá tu cuenta, elegí el
            plan que mejor se adapte al
            club y después completá los
            datos básicos.
          </p>

          {params.error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {params.error}
            </div>
          ) : null}

          <form
            action={
              registerClubOwner
            }
            className="mt-8"
          >
            <fieldset>
              <legend className="text-base font-bold text-slate-900">
                Elegí tu plan
              </legend>

              <p className="mt-2 text-sm text-slate-600">
                Más adelante podés
                pasar de Esencial a Pro
                sin volver a crear el
                club.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <label className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="plan_code"
                    value="essential"
                    defaultChecked={
                      selectedPlan ===
                      "essential"
                    }
                    className="peer sr-only"
                  />

                  <div className="h-full rounded-2xl border-2 border-slate-200 p-6 transition peer-checked:border-blue-600 peer-checked:bg-blue-50">
                    <p className="text-xl font-bold text-slate-900">
                      Esencial
                    </p>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Para tener la
                      página del club,
                      actividades,
                      espacios y
                      reservas.
                    </p>

                    <ul className="mt-5 space-y-2 text-sm text-slate-700">
                      <li>
                        ✓ Página pública
                      </li>

                      <li>
                        ✓ Actividades y
                        horarios
                      </li>

                      <li>
                        ✓ Espacios
                      </li>

                      <li>
                        ✓ Reservas
                      </li>

                      <li>
                        ✓ Enlace simple
                        de pago
                      </li>
                    </ul>
                  </div>
                </label>

                <label className="relative cursor-pointer">
                  <input
                    type="radio"
                    name="plan_code"
                    value="pro"
                    defaultChecked={
                      selectedPlan ===
                      "pro"
                    }
                    className="peer sr-only"
                  />

                  <div className="h-full rounded-2xl border-2 border-slate-200 p-6 transition peer-checked:border-blue-600 peer-checked:bg-blue-50">
                    <div className="flex flex-wrap items-center gap-3">
                      <p className="text-xl font-bold text-slate-900">
                        Pro
                      </p>

                      <span className="rounded-full bg-blue-100 px-2.5 py-1 text-xs font-semibold text-blue-800">
                        Gestión completa
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-6 text-slate-600">
                      Todo Esencial más
                      la administración
                      integral del club.
                    </p>

                    <ul className="mt-5 space-y-2 text-sm text-slate-700">
                      <li>
                        ✓ Todo Esencial
                      </li>

                      <li>
                        ✓ Personas
                      </li>

                      <li>
                        ✓ Cuotas y
                        morosidad
                      </li>

                      <li>
                        ✓ Gestión de
                        pagos
                      </li>

                      <li>
                        ✓ Usuarios y
                        roles
                      </li>

                      <li>
                        ✓ Notificaciones,
                        auditoría y
                        exportaciones
                      </li>
                    </ul>
                  </div>
                </label>
              </div>
            </fieldset>

            <div className="mt-8">
              <label
                htmlFor="email"
                className="text-sm font-semibold text-slate-800"
              >
                Correo electrónico
              </label>

              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="password"
                  className="text-sm font-semibold text-slate-800"
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
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div>
                <label
                  htmlFor="password_confirmation"
                  className="text-sm font-semibold text-slate-800"
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
                  className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            </div>

            <button
              type="submit"
              className="mt-8 w-full rounded-xl bg-blue-700 px-5 py-3.5 font-semibold text-white transition hover:bg-blue-800"
            >
              Crear mi cuenta
            </button>
          </form>

          <p className="mt-7 text-center text-sm text-slate-600">
            ¿Ya tenés una cuenta?{" "}
            <Link
              href="/login"
              className="font-semibold text-blue-700 hover:text-blue-800"
            >
              Iniciar sesión
            </Link>
          </p>
        </section>
      </div>
    </main>
  );
}