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

  const { data, error } = await supabase.auth.getClaims();

  if (error || !data?.claims?.sub) {
    redirect("/login");
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
          <Link href="/panel" className="font-bold">
            ClubSmart
          </Link>

          <form action={logout}>
            <button
              type="submit"
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold"
            >
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {children}
      </div>
    </main>
  );
}