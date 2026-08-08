import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/panel/actions";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";
import {
  PendingReservationsLink,
} from "@/app/panel/reservas/pending-reservations-link";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const { data, error } =
    await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  const context = await getAdminContext();

  const canManagePayments =
    context.role === "owner" ||
    context.role === "admin";

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link
              href="/panel"
              className="group"
            >
              <p className="font-bold text-slate-900 transition group-hover:text-blue-700">
                ClubSmart
              </p>

              <p className="mt-1 text-xs text-slate-500">
                {context.clubName}
              </p>
            </Link>

            <nav className="flex flex-wrap items-center gap-x-4 gap-y-3">
              <Link
                href="/panel"
                className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
              >
                Resumen
              </Link>

              <Link
                href="/panel/actividades"
                className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
              >
                Actividades
              </Link>

              <Link
  href="/panel/espacios"
  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
>
  Espacios
</Link>

<PendingReservationsLink />

              <Link
                href="/panel/personas"
                className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
              >
                Personas
              </Link>

              <Link
  href="/panel/cuotas"
  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
>
  Cuotas
</Link>

<Link
  href="/panel/morosidad"
  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
>
  Morosidad
</Link>

{canManagePayments ? (
  <Link
    href="/panel/pagos/adhesiones"
    className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
  >
    Adhesiones
  </Link>
) : null}

{canManagePayments ? (
  <Link
    href="/panel/pagos/lotes"
    className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
  >
    Lotes
  </Link>
) : null}

<Link
  href="/panel/pagos"
  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
>
  Pagos
</Link>

              {canManagePayments ? (
                <Link
                  href="/panel/pagos/configuracion"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Configuración de pagos
                </Link>
              ) : null}

              <Link
                href="/panel/club"
                className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
              >
                Datos del club
              </Link>

              <Link
                href={`/clubes/${context.clubSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
              >
                Ver página pública
              </Link>

              <form action={logout}>
                <button
                  type="submit"
                  className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold transition hover:bg-slate-100"
                >
                  Cerrar sesión
                </button>
              </form>
            </nav>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </div>
    </main>
  );
}