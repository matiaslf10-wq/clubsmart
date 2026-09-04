import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateMember } from "@/app/panel/personas/actions";
import { MemberCardActions } from "@/app/panel/personas/member-card-actions";
import { MemberForm } from "@/app/panel/personas/member-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { canManageMembers } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function EditMemberPage({ params }: PageProps) {
  const { id } = await params;
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
    </div>
  );
}
