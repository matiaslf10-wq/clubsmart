"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  createInviteClient,
} from "@/lib/supabase/invite-client";

export default function CreatePasswordPage() {
  const router =
    useRouter();

  const [
    password,
    setPassword,
  ] = useState("");

  const [
    confirmation,
    setConfirmation,
  ] = useState("");

  const [
    ready,
    setReady,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const prepareSession =
      async () => {
        const supabase =
          createInviteClient();

        /*
         * El email estándar de
         * Supabase redirige con
         * access_token y refresh_token
         * en el hash de la URL.
         *
         * El hash solamente puede
         * leerlo el navegador.
         */
        const hash =
          new URLSearchParams(
            window.location.hash.replace(
              /^#/,
              "",
            ),
          );

        const accessToken =
          hash.get(
            "access_token",
          );

        const refreshToken =
          hash.get(
            "refresh_token",
          );

        if (
          accessToken &&
          refreshToken
        ) {
          const {
            error:
              sessionError,
          } =
            await supabase.auth.setSession(
              {
                access_token:
                  accessToken,

                refresh_token:
                  refreshToken,
              },
            );

          if (
            sessionError
          ) {
            setError(
              "La invitación no pudo validarse. Puede haber vencido.",
            );

            return;
          }

          /*
           * Quitamos los tokens
           * visibles de la URL.
           */
          window.history.replaceState(
            {},
            "",
            "/auth/crear-clave",
          );
        }

        const {
          data,
          error:
            userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !data.user
        ) {
          setError(
            "La invitación no es válida o ya venció.",
          );

          return;
        }

        setReady(true);
      };

    void prepareSession();
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError(null);

    if (
      password.length < 8
    ) {
      setError(
        "La contraseña debe tener al menos 8 caracteres.",
      );

      return;
    }

    if (
      password !==
      confirmation
    ) {
      setError(
        "Las contraseñas no coinciden.",
      );

      return;
    }

    setSubmitting(true);

    const supabase =
      createInviteClient();

    const {
      error:
        updateError,
    } =
      await supabase.auth.updateUser(
        {
          password,
        },
      );

    if (updateError) {
      setSubmitting(false);

      setError(
        `No fue posible crear la contraseña: ${updateError.message}`,
      );

      return;
    }

    /*
     * Para esta primera versión
     * hacemos que ingrese normalmente
     * con la contraseña recién creada.
     *
     * Así usamos exactamente el mismo
     * mecanismo de login que ya tiene
     * ClubSmart.
     */
    await supabase.auth.signOut();

    router.replace(
      "/login?success=Cuenta creada correctamente. Ya podés ingresar.",
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-16">
      <div className="mx-auto max-w-md">
        <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            ClubSmart
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Crear contraseña
          </h1>

          <p className="mt-3 leading-7 text-slate-600">
            Completá la invitación
            creando tu contraseña para
            ingresar al panel del club.
          </p>

          {error ? (
            <div
              role="alert"
              className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
            >
              {error}
            </div>
          ) : null}

          {!ready &&
          !error ? (
            <div className="mt-8 rounded-xl bg-slate-50 p-5 text-sm text-slate-600">
              Validando invitación...
            </div>
          ) : null}

          {ready ? (
            <form
              onSubmit={
                handleSubmit
              }
              className="mt-8 space-y-5"
            >
              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Contraseña
                </span>

                <input
                  type="password"
                  value={password}
                  onChange={(
                    event,
                  ) =>
                    setPassword(
                      event.target
                        .value,
                    )
                  }
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="input mt-2"
                />
              </label>

              <label className="block">
                <span className="text-sm font-medium text-slate-700">
                  Repetir contraseña
                </span>

                <input
                  type="password"
                  value={
                    confirmation
                  }
                  onChange={(
                    event,
                  ) =>
                    setConfirmation(
                      event.target
                        .value,
                    )
                  }
                  minLength={8}
                  required
                  autoComplete="new-password"
                  className="input mt-2"
                />
              </label>

              <button
                type="submit"
                disabled={
                  submitting
                }
                className="w-full rounded-xl bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting
                  ? "Creando cuenta..."
                  : "Crear contraseña"}
              </button>
            </form>
          ) : null}
        </section>
      </div>
    </main>
  );
}