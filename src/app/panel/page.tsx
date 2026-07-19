import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type Membership = {
  role: "owner" | "admin" | "operator" | "viewer";
  organizations:
    | {
        id: string;
        name: string;
        slug: string;
      }
    | {
        id: string;
        name: string;
        slug: string;
      }[]
    | null;
};

function normalizeOrganization(
  membership: Membership,
) {
  if (!membership.organizations) {
    return null;
  }

  if (Array.isArray(membership.organizations)) {
    return membership.organizations[0] ?? null;
  }

  return membership.organizations;
}

export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const supabase = await createClient();

  const {
    data: { claims },
  } = await supabase.auth.getClaims();

  const userId =
    typeof claims?.sub === "string" ? claims.sub : null;

  if (!userId) {
    redirect("/login");
  }

  const { data: membershipData, error: membershipError } =
    await supabase
      .from("organization_users")
      .select(`
        role,
        organizations (
          id,
          name,
          slug
        )
      `)
      .eq("user_id", userId)
      .eq("active", true)
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    console.error(
      "Error al cargar la organización:",
      membershipError,
    );
  }

  const membership = membershipData as Membership | null;
  const organization = membership
    ? normalizeOrganization(membership)
    : null;

  if (!membership || !organization) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8">
        <h1 className="text-2xl font-bold text-amber-900">
          Usuario sin organización
        </h1>

        <p className="mt-3 leading-7 text-amber-800">
          El usuario inició sesión correctamente, pero todavía no
          está vinculado con una organización de ClubSmart.
        </p>
      </div>
    );
  }

  const [
    { count: activitiesCount },
    { count: instructorsCount },
    { count: contactRequestsCount },
  ] = await Promise.all([
    supabase
      .from("activities")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", organization.id)
      .eq("active", true),

    supabase
      .from("instructors")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", organization.id)
      .eq("active", true),

    supabase
      .from("contact_requests")
      .select("*", {
        count: "exact",
        head: true,
      })
      .eq("organization_id", organization.id)
      .eq("status", "new"),
  ]);

  const metrics = [
    {
      label: "Actividades activas",
      value: activitiesCount ?? 0,
    },
    {
      label: "Profesores y responsables",
      value: instructorsCount ?? 0,
    },
    {
      label: "Consultas nuevas",
      value: contactRequestsCount ?? 0,
    },
  ];

  return (
    <div>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          Panel administrativo
        </p>

        <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">
          {organization.name}
        </h1>

        <p className="mt-3 text-slate-600">
          Rol actual:{" "}
          <span className="font-medium">{membership.role}</span>
        </p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
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
      </div>

      <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900">
          Primer panel de ClubSmart
        </h2>

        <p className="mt-3 max-w-3xl leading-7 text-slate-600">
          El acceso administrativo ya está funcionando. El próximo
          módulo permitirá crear, editar, publicar y desactivar
          actividades desde este panel.
        </p>
      </div>
    </div>
  );
}