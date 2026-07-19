import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { LoginForm } from "@/app/login/login-form";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Ingresar",
  description: "Acceso administrativo a ClubSmart.",
};

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const supabase = await createClient();

  const { data } = await supabase.auth.getClaims();

if (data?.claims.sub) {
  redirect("/panel");
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

            <h1 className="mt-6 text-3xl font-bold tracking-tight text-slate-900">
              Ingresar al panel
            </h1>

            <p className="mt-3 leading-7 text-slate-600">
              Acceso exclusivo para la administración del club.
            </p>
          </div>

          <LoginForm />
        </div>
      </section>

      <section className="hidden bg-slate-950 px-12 py-16 text-white lg:flex lg:items-end">
        <div className="max-w-xl">
          <p className="text-sm font-semibold uppercase tracking-[0.25em] text-blue-300">
            Administración centralizada
          </p>

          <h2 className="mt-5 text-4xl font-bold leading-tight">
            Actividades, horarios, consultas y reservas desde un
            único lugar.
          </h2>

          <p className="mt-5 text-lg leading-8 text-slate-300">
            Los participantes, profesores y familias no necesitan
            crear usuarios. El club conserva el control de la
            información.
          </p>
        </div>
      </section>
    </main>
  );
}