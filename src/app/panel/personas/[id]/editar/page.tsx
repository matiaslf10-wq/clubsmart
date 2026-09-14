import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
    linkMemberAccount,
    setMemberAccountActive,
    updateMember,
    updateMemberAccountRelation,
} from "@/app/panel/personas/actions";
import { MemberCardActions } from "@/app/panel/personas/member-card-actions";
import { MemberForm } from "@/app/panel/personas/member-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageMembers } from "@/lib/auth/permissions";
import { hasCapability } from "@/lib/capabilities/has-capability";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    status?: string;
    message?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { status, message } = await searchParams;
  const context = await getAdminContext();

  if (!canManageMembers(context.role)) {
    redirect("/panel/personas");
  }
  const supabase = await createClient();

  const { data: member, error: memberError } = await supabase
    .from("members")
    .select(
      `
      id,
      first_name,
      last_name,
      dni,
      guardian_name,
      email,
      phone,
      active,
      member_activities (
        id,
        activity_id,
        active
      )
    `,
    )
    .eq("id", id)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (memberError) {
    throw new Error(`No fue posible cargar la persona: ${memberError.message}`);
  }

  if (!member) {
    notFound();
  }

  const { data: activeCredential, error: credentialError } = await supabase
    .from("member_card_credentials")
    .select("id")
    .eq("member_id", member.id)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .eq("active", true)
    .maybeSingle();

  if (credentialError) {
    throw new Error(
      `No fue posible consultar el estado del carnet: ${credentialError.message}`,
    );
  }

  const canManageCard = context.role === "owner" || context.role === "admin";

  const canManageLinkedPeople =
    canManageCard &&
    hasCapability(context.capabilities, "member.linked_people");

  const linkedPeople = canManageLinkedPeople
    ? await (async () => {
        const admin = createAdminClient();
        const { data: accounts, error } = await admin
          .from("member_accounts")
          .select("id, user_id, relation_type, active")
          .eq("member_id", member.id)
          .order("created_at");

        if (error) {
          throw new Error(
            `No fue posible cargar las cuentas vinculadas: ${error.message}`,
          );
        }

        return Promise.all(
          (accounts ?? []).map(async (account) => {
            const { data: userData } = await admin.auth.admin.getUserById(
              account.user_id,
            );
            return {
              ...account,
              email: userData.user?.email ?? "Email no disponible",
            };
          }),
        );
      })()
    : [];

  const { data: activities, error: activitiesError } = await supabase
    .from("activities")
    .select(
      `
      id,
      name
    `,
    )
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .eq("active", true)
    .order("name");

  if (activitiesError) {
    throw new Error(
      `No fue posible cargar las actividades: ${activitiesError.message}`,
    );
  }

  const activeActivityIds = member.member_activities
    .filter((relation) => relation.active)
    .map((relation) => relation.activity_id);

  const updateAction = updateMember.bind(null, id);
  const linkAction = linkMemberAccount.bind(null, id);

  const relationLabels = {
    self: "Titular",
    guardian: "Responsable",
    authorized: "Autorizado",
  } as const;

  return (
    <div>
      <Link
        href="/panel/personas"
        className="text-sm font-semibold text-blue-700"
      >
        ← Volver a personas
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold">Editar persona</h1>

        <p className="mt-3 text-slate-600">
          {member.first_name} {member.last_name}
        </p>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">Carnet digital</h2>

        <p className="mt-3 text-sm text-slate-600">
          Estado actual de la credencial digital del socio.
        </p>

        <div className="mt-5 flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <span
            className={
              !member.active
                ? "inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600"
                : activeCredential
                  ? "inline-flex w-fit rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-800"
                  : "inline-flex w-fit rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-800"
            }
          >
            {!member.active
              ? "Carnet inactivo"
              : activeCredential
                ? "Carnet activo"
                : "Sin carnet activo"}
          </span>

          {member.active && canManageCard ? (
            <MemberCardActions
              memberId={member.id}
              hasActiveCredential={Boolean(activeCredential)}
            />
          ) : null}
        </div>
      </section>

      {!member.active ? (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-800">
          <p className="font-semibold">Esta persona está dada de baja.</p>

          <p className="mt-1">
            Para modificar sus datos o volver a asignarle actividades, primero
            reactivala desde el listado de personas.
          </p>
        </div>
      ) : (
        <div className="mt-8">
          <MemberForm
            action={updateAction}
            activities={activities ?? []}
            submitLabel="Guardar cambios"
            initialValues={{
              firstName: member.first_name,
              lastName: member.last_name,
              dni: member.dni ?? "",
              guardianName: member.guardian_name ?? "",
              email: member.email ?? "",
              phone: member.phone ?? "",
              activityIds: activeActivityIds,
            }}
          />
        </div>
      )}

      {canManageLinkedPeople ? (
        <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
          <h2 className="text-xl font-semibold">Personas vinculadas</h2>
          <p className="mt-3 text-sm text-slate-600">
            Cuentas que pueden acceder a la información de esta persona.
          </p>

          {status && message ? (
            <p
              className={`mt-4 rounded-lg px-4 py-3 text-sm ${status === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}
            >
              {message}
            </p>
          ) : null}

          <form
            action={linkAction}
            className="mt-6 grid gap-4 sm:grid-cols-[1fr_auto_auto] sm:items-end"
          >
            <label className="text-sm font-medium text-slate-700">
              Email
              <input
                name="email"
                type="email"
                required
                className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
              />
            </label>
            <label className="text-sm font-medium text-slate-700">
              Relación
              <select
                name="relation_type"
                defaultValue="authorized"
                className="mt-2 block w-full rounded-lg border border-slate-300 px-3 py-2"
              >
                <option value="self">Titular</option>
                <option value="guardian">Responsable</option>
                <option value="authorized">Autorizado</option>
              </select>
            </label>
            <button
              type="submit"
              className="rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white hover:bg-blue-800"
            >
              Vincular / Invitar
            </button>
          </form>

          <div className="mt-8 divide-y divide-slate-200 border-t border-slate-200">
            {linkedPeople.length === 0 ? (
              <p className="py-5 text-sm text-slate-600">
                No hay cuentas vinculadas.
              </p>
            ) : (
              linkedPeople.map((account) => {
                const updateRelationAction = updateMemberAccountRelation.bind(
                  null,
                  account.id,
                  id,
                );
                const activateAction = setMemberAccountActive.bind(
                  null,
                  account.id,
                  id,
                  true,
                );
                const deactivateAction = setMemberAccountActive.bind(
                  null,
                  account.id,
                  id,
                  false,
                );

                return (
                  <div
                    key={account.id}
                    className="flex flex-col gap-4 py-5 lg:flex-row lg:items-center lg:justify-between"
                  >
                    <div>
                      <p className="font-medium text-slate-900">
                        {account.email}
                      </p>
                      <p className="mt-1 text-sm text-slate-600">
                        {relationLabels[
                          account.relation_type as keyof typeof relationLabels
                        ] ?? account.relation_type}
                        {" · "}
                        {account.active ? "Activo" : "Inactivo"}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <form action={updateRelationAction}>
                        <label className="text-xs font-medium text-slate-600">
                          Relación
                          <select
                            name="relation_type"
                            defaultValue={account.relation_type}
                            className="mt-1 block rounded-lg border border-slate-300 px-3 py-2 text-sm"
                          >
                            <option value="self">Titular</option>
                            <option value="guardian">Responsable</option>
                            <option value="authorized">Autorizado</option>
                          </select>
                        </label>
                        <button
                          type="submit"
                          className="mt-2 text-sm font-semibold text-blue-700"
                        >
                          Guardar relación
                        </button>
                      </form>
                      <form
                        action={
                          account.active ? deactivateAction : activateAction
                        }
                      >
                        <button
                          type="submit"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700"
                        >
                          {account.active ? "Desactivar" : "Reactivar"}
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      ) : null}
    </div>
  );
}
