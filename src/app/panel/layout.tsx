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

  const { data, error } =
    await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/panel" className="font-bold">
            ClubSmart
          </Link>

          <nav className="flex flex-wrap items-center gap-4">
            <Link
              href="/panel"
              className="text-sm font-medium text-slate-600 hover:text-blue-700"
            >
              Resumen
            </Link>

            <Link
              href="/panel/actividades"
              className="text-sm font-medium text-slate-600 hover:text-blue-700"
            >
              Actividades
            </Link>

            <Link
  href="/panel/personas"
  className="text-sm font-medium text-slate-600 hover:text-blue-700"
>
  Personas
</Link>

            <Link
  href="/panel/club"
  className="text-sm font-medium text-slate-600 hover:text-blue-700"
>
  Datos del club
</Link>

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
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold hover:bg-slate-100"
              >
                Cerrar sesión
              </button>
            </form>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </div>
    </main>
  );
}