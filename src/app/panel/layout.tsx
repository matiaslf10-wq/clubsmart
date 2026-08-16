import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/panel/actions";
import {
  PendingReservationsLink,
} from "@/app/panel/reservas/pending-reservations-link";
import { getAdminContext } from "@/lib/auth/admin-context";
import {
  canManageUsers,
  canViewAudit,
  canViewNotifications,
} from "@/lib/auth/permissions";
import {
  hasPlanFeature,
  PLAN_LABELS,
} from "@/lib/plans/features";
import { createClient } from "@/lib/supabase/server";

export const dynamic =
  "force-dynamic";

export default async function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase =
    await createClient();

  const {
    data,
    error,
  } =
    await supabase.auth.getClaims();

  if (
    error ||
    !data?.claims?.sub
  ) {
    redirect("/login");
  }

  const context =
    await getAdminContext();

  const canManagePayments =
    hasPlanFeature(
      context.planCode,
      "payments",
    ) &&
    (
      context.role === "owner" ||
      context.role === "admin"
    );

  const showUsers =
    hasPlanFeature(
      context.planCode,
      "users",
    ) &&
    canManageUsers(
      context.role,
    );

  const showAudit =
    hasPlanFeature(
      context.planCode,
      "audit",
    ) &&
    canViewAudit(
      context.role,
    );

  const showNotifications =
    hasPlanFeature(
      context.planCode,
      "notifications",
    ) &&
    canViewNotifications(
      context.role,
    );

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <Link
              href="/panel"
              className="group"
            >
              <div className="flex items-center gap-3">
                <p className="font-bold text-slate-900 transition group-hover:text-blue-700">
                  ClubSmart
                </p>

                <span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700">
                  {
                    PLAN_LABELS[
                      context.planCode
                    ]
                  }
                </span>
              </div>

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

              {hasPlanFeature(
                context.planCode,
                "activities",
              ) ? (
                <Link
                  href="/panel/actividades"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Actividades
                </Link>
              ) : null}

              {hasPlanFeature(
                context.planCode,
                "spaces",
              ) ? (
                <Link
                  href="/panel/espacios"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Espacios
                </Link>
              ) : null}

              {hasPlanFeature(
                context.planCode,
                "reservations",
              ) ? (
                <PendingReservationsLink />
              ) : null}

              {hasPlanFeature(
                context.planCode,
                "members",
              ) ? (
                <Link
                  href="/panel/personas"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Personas
                </Link>
              ) : null}

              {showUsers ? (
                <Link
                  href="/panel/usuarios"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Usuarios
                </Link>
              ) : null}

              {showAudit ? (
                <Link
                  href="/panel/auditoria"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Auditoría
                </Link>
              ) : null}

              {showNotifications ? (
                <Link
                  href="/panel/notificaciones"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Notificaciones
                </Link>
              ) : null}

              {hasPlanFeature(
                context.planCode,
                "fees",
              ) ? (
                <Link
                  href="/panel/cuotas"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Cuotas
                </Link>
              ) : null}

              {hasPlanFeature(
                context.planCode,
                "delinquency",
              ) ? (
                <Link
                  href="/panel/morosidad"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Morosidad
                </Link>
              ) : null}

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

              {hasPlanFeature(
                context.planCode,
                "payments",
              ) ? (
                <Link
                  href="/panel/pagos"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Pagos
                </Link>
              ) : null}

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

              {hasPlanFeature(
                context.planCode,
                "exports",
              ) ? (
                <Link
                  href="/panel/exportaciones"
                  className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
                >
                  Exportaciones
                </Link>
              ) : null}

              <Link
                href="/panel/plan"
                className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
              >
                Mi plan
              </Link>

              <Link
                href={`/clubes/${context.clubSlug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-slate-600 transition hover:text-blue-700"
              >
                Ver página pública
              </Link>

              <form
                action={logout}
              >
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