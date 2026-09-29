import Link from "next/link";
import { redirect } from "next/navigation";

import { RequestActions } from "@/app/panel/personas/solicitudes/request-actions";
import { getAdminContext } from "@/lib/auth/admin-context";
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

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
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

  const requestedDnis = Array.from(
    new Set(
      requests.map((request) =>
        request.claimed_dni.replace(/\D/g, ""),
      ),
    ),
  );

  const matchingMembers =
    requestedDnis.length > 0
      ? await supabase
          .from("members")
          .select(`
            id,
            first_name,
            last_name,
            dni,
            active
          `)
          .eq(
            "organization_id",
            context.organizationId,
          )
          .eq("club_id", context.clubId)
          .eq("active", true)
          .in("dni", requestedDnis)
      : { data: [], error: null };

  type MatchingMember = {
    id: string;
    first_name: string;
    last_name: string;
    dni: string | null;
    active: boolean;
  };

  const membersByDni = new Map<
    string,
    MatchingMember[]
  >();

  for (const member of matchingMembers.data ?? []) {
    const normalizedDni =
      member.dni?.replace(/\D/g, "") ?? "";

    const current =
      membersByDni.get(normalizedDni) ?? [];

    current.push(member);

    membersByDni.set(
      normalizedDni,
      current,
    );
  }

  type ActiveSelfAccount = {
    member_id: string;
  };

  const matchingMemberIds = (
    matchingMembers.data ?? []
  ).map((member) => member.id);

  let activeSelfAccounts: ActiveSelfAccount[] = [];

  if (matchingMemberIds.length > 0) {
    const { data } = await supabase
      .from("member_accounts")
      .select("member_id")
      .in("member_id", matchingMemberIds)
      .eq("active", true)
      .eq("relation_type", "self");

    activeSelfAccounts =
      (data ?? []) as ActiveSelfAccount[];
  }

  const membersWithActiveSelf = new Set(
    activeSelfAccounts.map(
      (account) => account.member_id,
    ),
  );

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
          {requests.map((request) => {
            const matches =
              membersByDni.get(
                request.claimed_dni.replace(/\D/g, ""),
              ) ?? [];

            const matchingMember =
              matches.length === 1
                ? matches[0]
                : null;

            const matchingMemberName =
              matchingMember
                ? `${matchingMember.first_name} ${matchingMember.last_name}`
                : null;

            const isSelfRequest =
              request.relation_type === "self";

            const hasActiveSelfAccount =
              matchingMember
                ? membersWithActiveSelf.has(
                    matchingMember.id,
                  )
                : false;

            const isNewSelfRequest =
              matches.length === 0 &&
              isSelfRequest;

            const canApprove =
              matches.length === 1
                ? !(
                    isSelfRequest &&
                    hasActiveSelfAccount
                  )
                : isNewSelfRequest;

            const requestDisplayName =
              requesterName(
                request.requester_first_name,
                request.requester_last_name,
              );

            const approveLabel =
              isNewSelfRequest
                ? "Aprobar y crear socio"
                : "Aprobar v\u00EDnculo";

            const confirmMessage =
              isNewSelfRequest
                ? `\u00BFConfirm\u00E1s aprobar la solicitud y crear a ${requestDisplayName} como socio del club?`
                : matchingMemberName
                  ? `\u00BFConfirm\u00E1s vincular esta cuenta con ${matchingMemberName}?`
                  : "\u00BFConfirm\u00E1s aprobar esta solicitud?";

            return (
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

              {matches.length > 1 ? (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">
                    {"Hay m\u00E1s de una persona con este DNI."}
                  </p>

                  <p className="mt-1 text-sm text-amber-800">
                    {"Revis\u00E1 el padr\u00F3n antes de continuar."}
                  </p>
                </div>
              ) : matchingMember &&
                isSelfRequest &&
                hasActiveSelfAccount ? (
                <div className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                    DNI ya vinculado
                  </p>

                  <p className="mt-1 font-semibold text-red-950">
                    {matchingMemberName}
                  </p>

                  <p className="mt-1 text-sm text-red-800">
                    {"Esta persona ya tiene una cuenta personal vinculada. No se puede aprobar otra relaci\u00F3n \"Yo soy el socio\"."}
                  </p>
                </div>
              ) : matchingMember ? (
                <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-700">
                    {isSelfRequest
                      ? "Socio existente sin cuenta vinculada"
                      : "Socio existente encontrado"}
                  </p>

                  <p className="mt-1 font-semibold text-green-950">
                    {matchingMemberName}
                  </p>

                  <p className="mt-1 text-sm text-green-800">
                    {isSelfRequest
                      ? "Al aprobar no se crear\u00E1 otra persona: esta cuenta quedar\u00E1 vinculada al socio existente."
                      : "El DNI coincide con una persona activa del club."}
                  </p>
                </div>
              ) : isSelfRequest ? (
                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                    Nuevo socio
                  </p>

                  <p className="mt-1 font-semibold text-blue-950">
                    {requestDisplayName}
                  </p>

                  <p className="mt-1 text-sm text-blue-800">
                    {"No existe una persona con este DNI. Al aprobar se crear\u00E1 el socio y esta cuenta quedar\u00E1 vinculada como titular."}
                  </p>
                </div>
              ) : (
                <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="font-semibold text-amber-900">
                    {"No se encontr\u00F3 una persona activa con este DNI."}
                  </p>

                  <p className="mt-1 text-sm text-amber-800">
                    {"Para un responsable o autorizado, el socio debe existir previamente en el padr\u00F3n."}
                  </p>

                  <Link
                    href={`/panel/personas?buscar=${encodeURIComponent(request.claimed_dni)}&estado=todos`}
                    className="mt-2 inline-flex text-sm font-semibold text-blue-700 hover:text-blue-800"
                  >
                    Buscar DNI en Personas
                  </Link>
                </div>
              )}

              <RequestActions
                requestId={request.id}
                canApprove={canApprove}
                approveLabel={approveLabel}
                confirmMessage={confirmMessage}
              />
            </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
