import Link from "next/link";
import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageMembers } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

function relationLabel(value: string) {
  if (value === "self") {
    return "La cuenta corresponde al socio";
  }

  if (value === "guardian") {
    return "Responsable del socio";
  }

  if (value === "authorized") {
    return "Autorizado por el socio";
  }

  return value;
}

function requesterName(
  firstName: string | null,
  lastName: string | null,
) {
  const name = [firstName, lastName]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || "Persona sin nombre informado";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(new Date(value));
}

export default async function MemberLinkRequestsPage() {
  const context = await getAdminContext();

  if (!canManageMembers(context.role)) {
    redirect("/panel/personas");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("member_link_requests")
    .select(`
      id,
      requester_first_name,
      requester_last_name,
      requester_email,
      claimed_dni,
      relation_type,
      status,
      created_at
    `)
    .eq("club_id", context.clubId)
    .eq("status", "pending")
    .order("created_at", { ascending: true });

  if (error) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-900">
          {"No fue posible cargar las solicitudes"}
        </h1>

        <p className="mt-3 text-red-800">
          {error.message}
        </p>
      </div>
    );
  }

  const requests = data ?? [];

  return (
    <div>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
            {context.clubName}
          </p>

          <h1 className="mt-3 text-3xl font-bold">
            {"Solicitudes de v\u00EDnculo"}
          </h1>

          <p className="mt-3 max-w-2xl text-slate-600">
            {
              "Personas con una cuenta ClubSmart que solicitaron vincularse con un socio del club."
            }
          </p>
        </div>

        <Link
          href="/panel/personas"
          className="inline-flex justify-center rounded-lg border border-slate-300 bg-white px-5 py-3 font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          Volver a Personas
        </Link>
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5">
        <p className="text-sm text-slate-500">
          Pendientes
        </p>

        <p className="mt-2 text-3xl font-bold">
          {requests.length}
        </p>
      </div>

      {requests.length === 0 ? (
        <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <h2 className="text-lg font-semibold text-slate-900">
            {"No hay solicitudes pendientes"}
          </h2>

          <p className="mt-2 text-sm text-slate-600">
            {
              "Cuando una persona solicite un v\u00EDnculo desde la app, aparecer\u00E1 ac\u00E1."
            }
          </p>
        </section>
      ) : (
        <section className="mt-6 space-y-4">
          {requests.map((request) => (
            <article
              key={request.id}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">
                    {requesterName(
                      request.requester_first_name,
                      request.requester_last_name,
                    )}
                  </h2>

                  <p className="mt-1 text-sm text-slate-500">
                    {request.requester_email ?? "Sin email informado"}
                  </p>
                </div>

                <span className="inline-flex self-start rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-800">
                  Pendiente
                </span>
              </div>

              <dl className="mt-5 grid gap-4 sm:grid-cols-3">
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    DNI informado
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {request.claimed_dni}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {"Relaci\u00F3n"}
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {relationLabel(request.relation_type)}
                  </dd>
                </div>

                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Recibida
                  </dt>
                  <dd className="mt-1 font-medium text-slate-900">
                    {formatDate(request.created_at)}
                  </dd>
                </div>
              </dl>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
