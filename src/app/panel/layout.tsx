import Link from "next/link";
import { redirect } from "next/navigation";

import { logout } from "@/app/panel/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PanelLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();

  const {
    data: { claims },
  } = await supabase.auth.getClaims();

  if (!claims?.sub) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/panel" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white">
              C
            </div>

            <div>
              <p className="font-bold leading-none">ClubSmart</p>
              <p className="mt-1 text-xs text-slate-500">
                Panel administrativo
              </p>
            </div>
          </Link>

          <div className="flex items-center gap-4">
            <Link
              href="/clubes/club-estrella"
              target="_blank"
              className="text-sm font-medium text-slate-600 hover:text-blue-700"
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
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-6 py-8 lg:grid-cols-[240px_1fr]">
        <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <nav className="space-y-1">
            <Link
              href="/panel"
              className="block rounded-lg bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700"
            >
              Resumen
            </Link>

            <span className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-500">
              Actividades
            </span>

            <span className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-500">
              Consultas
            </span>

            <span className="block rounded-lg px-4 py-3 text-sm font-medium text-slate-500">
              Configuración
            </span>
          </nav>
        </aside>

        <section>{children}</section>
      </div>
    </div>
  );
}