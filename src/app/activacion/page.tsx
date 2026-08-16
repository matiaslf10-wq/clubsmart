import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/panel/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

type ServiceStatus =
  | "pending"
  | "active"
  | "suspended";

export default async function ActivationPage() {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  const userId =
    typeof claimsData?.claims.sub ===
    "string"
      ? claimsData.claims.sub
      : null;

  const userEmail =
    typeof claimsData?.claims.email ===
    "string"
      ? claimsData.claims.email
      : null;

  if (
    claimsError ||
    !userId
  ) {
    redirect("/login");
  }

  const {
    data: membership,
    error: membershipError,
  } =
    await supabase
      .from("organization_users")
      .select(
        "organization_id",
      )
      .eq(
        "user_id",
        userId,
      )
      .eq(
        "active",
        true,
      )
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    throw new Error(
      `No fue posible consultar la organización: ${membershipError.message}`,
    );
  }

  if (!membership) {
    redirect("/alta-club");
  }

  const {
    data: organization,
    error: organizationError,
  } =
    await supabase
      .from("organizations")
      .select(`
        id,
        name,
        service_status
      `)
      .eq(
        "id",
        membership.organization_id,
      )
      .maybeSingle();

  if (organizationError) {
    throw new Error(
      `No fue posible cargar la organización: ${organizationError.message}`,
    );
  }

  if (!organization) {
    throw new Error(
      "La organización no existe.",
    );
  }

  const serviceStatus =
    organization.service_status as ServiceStatus;

  /*
   * Si nosotros ya aprobamos
   * el club mientras esta página
   * estaba abierta, al recargar
   * entra directamente al panel.
   */
  if (
    serviceStatus === "active"
  ) {
    redirect("/panel");
  }

  const {
    data: club,
  } =
    await supabase
      .from("clubs")
      .select(
        "name",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "active",
        true,
      )
      .limit(1)
      .maybeSingle();

  const clubName =
    club?.name ??
    organization.name;

  const suspended =
    serviceStatus ===
    "suspended";

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-xl font-bold text-slate-900"
          >
            ClubSmart
          </Link>

          <form
            action={logout}
          >
            <button
              type="submit"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              Cerrar sesión
            </button>
          </form>
        </div>

        <section className="mt-16 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 px-8 py-7">
            <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
              {suspended
                ? "Servicio suspendido"
                : "Alta de ClubSmart"}
            </p>

            <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
              {suspended
                ? "Tu servicio está temporalmente suspendido"
                : "Tu club ya está registrado"}
            </h1>

            <p className="mt-4 text-lg leading-8 text-slate-600">
              {clubName}
            </p>
          </div>

          <div className="px-8 py-8">
            {suspended ? (
              <>
                <p className="leading-7 text-slate-700">
                  El acceso al panel está
                  temporalmente suspendido.
                  Cuando regularicemos la
                  situación del servicio,
                  vas a poder volver a
                  ingresar normalmente.
                </p>

                <div className="mt-7 rounded-2xl bg-amber-50 p-5">
                  <p className="text-sm font-semibold text-amber-900">
                    Estado
                  </p>

                  <p className="mt-1 text-sm text-amber-800">
                    Suspendido
                  </p>
                </div>
              </>
            ) : (
              <>
                <p className="leading-7 text-slate-700">
                  La cuenta y el club se
                  crearon correctamente.
                  Falta únicamente que
                  confirmemos la
                  habilitación del servicio.
                </p>

                <p className="mt-4 leading-7 text-slate-700">
                  Una vez confirmado el
                  pago de ClubSmart,
                  habilitaremos el panel
                  completo. No necesitás
                  volver a registrarte ni
                  crear nuevamente el club.
                </p>

                <div className="mt-7 rounded-2xl bg-blue-50 p-5">
                  <div className="flex items-center gap-3">
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />

                    <p className="font-semibold text-slate-900">
                      Pendiente de habilitación
                    </p>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-600">
                    Cuando confirmemos el
                    pago, simplemente
                    recargá esta página o
                    volvé a iniciar sesión.
                  </p>
                </div>
              </>
            )}

            {userEmail ? (
              <div className="mt-7 border-t border-slate-200 pt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Cuenta registrada
                </p>

                <p className="mt-2 text-sm font-medium text-slate-800">
                  {userEmail}
                </p>
              </div>
            ) : null}
          </div>
        </section>

        <p className="mt-6 text-center text-sm text-slate-500">
          Si acabamos de habilitar tu
          cuenta, recargá esta página
          para ingresar.
        </p>
      </div>
    </main>
  );
}