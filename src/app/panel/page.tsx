import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Membership = {
  organization_id: string;
  role: "owner" | "admin" | "operator" | "viewer";
};

type Organization = {
  id: string;
  name: string;
  slug: string;
};

export default async function PanelPage() {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  if (claimsError) {
    console.error("Error verificando usuario:", claimsError);
    redirect("/login");
  }

  const userId =
    typeof claimsData?.claims.sub === "string"
      ? claimsData.claims.sub
      : null;

  if (!userId) {
    redirect("/login");
  }

  /*
   * Primero obtenemos la pertenencia del usuario.
   * Evitamos por ahora una consulta relacional anidada para
   * poder identificar con claridad cualquier problema de RLS.
   */
  const {
    data: membershipData,
    error: membershipError,
  } = await supabase
    .from("organization_users")
    .select("organization_id, role")
    .eq("user_id", userId)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (membershipError) {
    console.error(
      "Error consultando organization_users:",
      membershipError,
    );

    return (
      <PanelError
        title="No pudimos consultar tu acceso"
        message={membershipError.message}
      />
    );
  }

  const membership = membershipData as Membership | null;

  if (!membership) {
    return (
      <PanelError
        title="Usuario sin organización"
        message="El inicio de sesión funciona, pero este usuario todavía no está vinculado con ninguna organización de ClubSmart."
      />
    );
  }

  const {
    data: organizationData,
    error: organizationError,
  } = await supabase
    .from("organizations")
    .select("id, name, slug")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    console.error(
      "Error consultando organizations:",
      organizationError,
    );

    return (
      <PanelError
        title="No pudimos cargar la organización"
        message={organizationError.message}
      />
    );
  }

  const organization = organizationData as Organization | null;

  if (!organization) {
    return (
      <PanelError
        title="Organización no encontrada"
        message="La vinculación administrativa existe, pero la organización correspondiente no pudo ser leída."
      />
    );
  }

  const [
    activitiesResult,
    instructorsResult,
    contactRequestsResult,
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", organization.id)
      .eq("active", true),

    supabase
      .from("instructors")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", organization.id)
      .eq("active", true),

    supabase
      .from("contact_requests")
      .select("id", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", organization.id)
      .eq("status", "new"),
  ]);

  if (activitiesResult.error) {
    console.error(
      "Error contando actividades:",
      activitiesResult.error,
    );
  }

  if (instructorsResult.error) {
    console.error(
      "Error contando responsables:",
      instructorsResult.error,
    );
  }

  if (contactRequestsResult.error) {
    console.error(
      "Error contando consultas:",
      contactRequestsResult.error,
    );
  }

  const metrics = [
    {
      label: "Actividades activas",
      value: activitiesResult.count ?? 0,
    },
    {
      label: "Profesores y responsables",
      value: instructorsResult.count ?? 0,
    },
    {
      label: "Consultas nuevas",
      value: contactRequestsResult.count ?? 0,
    },
  ];

  return (
    <div className="space-y-8">
      <section>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          Panel administrativo
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          {organization.name}
        </h1>

        <p className="mt-3 text-slate-600">
          Rol administrativo:{" "}
          <span className="font-semibold text-slate-900">
            {translateRole(membership.role)}
          </span>
        </p>
      </section>

      <section className="grid gap-5 md:grid-cols-3">
        {metrics.map((metric) => (
          <article
            key={metric.label}
            className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <p className="text-sm font-medium text-slate-500">
              {metric.label}
            </p>

            <p className="mt-3 text-4xl font-bold text-slate-900">
              {metric.value}
            </p>
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Acceso administrativo funcionando
        </h2>

        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          El usuario está autenticado y vinculado correctamente con
          la organización. Desde aquí se administrarán las
          actividades, los horarios, las consultas y la configuración
          del club.
        </p>
      </section>
    </div>
  );
}

function PanelError({
  title,
  message,
}: {
  title: string;
  message: string;
}) {
  return (
    <div className="rounded-2xl border border-red-200 bg-red-50 p-8">
      <h1 className="text-2xl font-bold text-red-900">
        {title}
      </h1>

      <p className="mt-3 break-words leading-7 text-red-800">
        {message}
      </p>

      <p className="mt-5 text-sm text-red-700">
        Revisá también los Runtime Logs del deployment en Vercel.
      </p>
    </div>
  );
}

function translateRole(
  role: Membership["role"],
) {
  const labels: Record<Membership["role"], string> = {
    owner: "Propietario",
    admin: "Administrador",
    operator: "Operador",
    viewer: "Solo lectura",
  };

  return labels[role];
}