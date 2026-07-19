import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError || !claimsData?.claims.sub) {
    redirect("/login");
  }

  const userId = claimsData.claims.sub;

  const {
    data: membership,
    error: membershipError,
  } = await supabase
    .from("organization_users")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-900">
          Error al consultar el acceso
        </h1>

        <p className="mt-3 text-red-800">
          {membershipError.message}
        </p>
      </div>
    );
  }

  if (!membership) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
        <h1 className="text-2xl font-bold text-amber-900">
          Usuario sin organización
        </h1>

        <p className="mt-3 text-amber-800">
          El usuario inició sesión, pero no está vinculado con una
          organización.
        </p>
      </div>
    );
  }

  const {
    data: organization,
    error: organizationError,
  } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
        <h1 className="text-2xl font-bold text-red-900">
          Error al cargar la organización
        </h1>

        <p className="mt-3 text-red-800">
          {organizationError.message}
        </p>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
        <h1 className="text-2xl font-bold text-amber-900">
          Organización no encontrada
        </h1>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
        Panel administrativo
      </p>

      <h1 className="mt-3 text-3xl font-bold text-slate-900">
        {organization.name}
      </h1>

      <p className="mt-4 text-slate-600">
        Rol:{" "}
        <span className="font-semibold">
          {membership.role}
        </span>
      </p>

      <p className="mt-6 text-green-700">
        El usuario y la organización se cargaron correctamente.
      </p>
    </div>
  );
}