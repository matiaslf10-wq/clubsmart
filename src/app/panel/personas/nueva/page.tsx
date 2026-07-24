import Link from "next/link";
import { redirect } from "next/navigation";

import { createMember } from "@/app/panel/personas/actions";
import { MemberForm } from "@/app/panel/personas/member-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function NewMemberPage() {
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel/personas");
  }

  const supabase = await createClient();

  const { data, error } = await supabase
    .from("activities")
    .select("id, name, price")
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq("club_id", context.clubId)
    .eq("active", true)
    .order("name");

  if (error) {
    throw new Error(
      `No fue posible cargar las actividades: ${error.message}`,
    );
  }

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
          Nueva persona
        </h1>

        <p className="mt-3 text-slate-600">
          Cargá sus datos, la actividad y el
          importe mensual correspondiente.
        </p>
      </div>

      <div className="mt-8">
        <MemberForm
          action={createMember}
          activities={data ?? []}
          submitLabel="Crear persona"
        />
      </div>
    </div>
  );
}