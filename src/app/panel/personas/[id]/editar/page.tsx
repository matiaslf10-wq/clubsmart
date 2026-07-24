import Link from "next/link";
import {
  notFound,
  redirect,
} from "next/navigation";

import { updateMember } from "@/app/panel/personas/actions";
import { MemberForm } from "@/app/panel/personas/member-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function EditMemberPage({
  params,
}: PageProps) {
  const { id } = await params;
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel/personas");
  }

  const supabase = await createClient();

  const {
    data: member,
    error: memberError,
  } = await supabase
    .from("members")
    .select(`
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
    `)
    .eq("id", id)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .maybeSingle();

  if (memberError) {
    throw new Error(
      `No fue posible cargar la persona: ${memberError.message}`,
    );
  }

  if (!member) {
    notFound();
  }

  const {
    data: activities,
    error: activitiesError,
  } = await supabase
    .from("activities")
    .select("id, name")
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("active", true)
    .order("name");

  if (activitiesError) {
    throw new Error(
      `No fue posible cargar las actividades: ${activitiesError.message}`,
    );
  }

  const activeRelation =
    member.member_activities.find(
      (relation) => relation.active,
    );

  const updateAction =
    updateMember.bind(null, id);

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

        <h1 className="mt-3 text-3xl font-bold">
          Editar persona
        </h1>

        <p className="mt-3 text-slate-600">
          {member.first_name}{" "}
          {member.last_name}
        </p>

        {!member.active ? (
          <p className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Esta persona está dada de baja. Para
            asignarle nuevamente una actividad,
            primero reactivala desde el listado.
          </p>
        ) : null}
      </div>

      <div className="mt-8">
        <MemberForm
          action={updateAction}
          activities={activities ?? []}
          submitLabel="Guardar cambios"
          initialValues={{
            firstName:
              member.first_name,
            lastName:
              member.last_name,
            dni: member.dni ?? "",
            guardianName:
              member.guardian_name ?? "",
            email: member.email ?? "",
            phone: member.phone ?? "",
            activityId:
              activeRelation?.activity_id ??
              "",
          }}
        />
      </div>
    </div>
  );
}