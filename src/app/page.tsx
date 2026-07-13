import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("connection_tests")
    .select("id, message, created_at")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <main className="min-h-screen bg-slate-50">
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col items-center justify-center px-6 text-center">
        <span className="mb-5 rounded-full bg-blue-100 px-4 py-2 text-sm font-medium text-blue-700">
          Plataforma para clubes
        </span>

        <h1 className="text-5xl font-bold tracking-tight text-slate-900">
          ClubSmart
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-slate-600">
          Actividades, reservas, pagos y administración para clubes.
        </p>

        <div className="mt-10 w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-left shadow-sm">
          <h2 className="text-lg font-semibold text-slate-900">
            Estado de Supabase
          </h2>

          {error ? (
            <div className="mt-4 rounded-lg bg-red-50 p-4 text-red-700">
              <p className="font-medium">No fue posible consultar Supabase.</p>
              <p className="mt-2 break-words text-sm">{error.message}</p>
            </div>
          ) : data ? (
            <div className="mt-4 rounded-lg bg-green-50 p-4 text-green-800">
              <p className="font-medium">{data.message}</p>
              <p className="mt-2 text-sm">
                Registro de prueba número {data.id}
              </p>
            </div>
          ) : (
            <div className="mt-4 rounded-lg bg-amber-50 p-4 text-amber-800">
              La conexión funciona, pero la tabla no contiene registros.
            </div>
          )}
        </div>
      </section>
    </main>
  );
}