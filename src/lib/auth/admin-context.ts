import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import {
  isPlanCode,
  type PlanCode,
} from "@/lib/plans/features";

type OrganizationRole =
  | "owner"
  | "admin"
  | "operator"
  | "viewer";

type ServiceStatus =
  | "pending"
  | "active"
  | "suspended";

export type AdminContext = {
  userId: string;
  userEmail: string | null;

  organizationId: string;
  organizationName: string;

  serviceStatus: ServiceStatus;
  planCode: PlanCode;

  role: OrganizationRole;

  clubId: string;
  clubName: string;
  clubSlug: string;
};

function isServiceStatus(
  value: unknown,
): value is ServiceStatus {
  return (
    value === "pending" ||
    value === "active" ||
    value === "suspended"
  );
}

export async function getAdminContext(): Promise<AdminContext> {
  const supabase =
    await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } =
    await supabase.auth.getClaims();

  const userId =
    typeof claimsData?.claims.sub ===
    "string"
      ? claimsData.claims.sub
      : null;

  const userEmail =
    typeof claimsData?.claims.email ===
    "string"
      ? claimsData.claims.email
      : null;

  if (
    claimsError ||
    !userId
  ) {
    redirect("/login");
  }

  const {
    data: membership,
    error: membershipError,
  } =
    await supabase
      .from("organization_users")
      .select(
        "organization_id, role",
      )
      .eq(
        "user_id",
        userId,
      )
      .eq(
        "active",
        true,
      )
      .limit(1)
      .maybeSingle();

  if (membershipError) {
    throw new Error(
      `No fue posible consultar la organización del usuario: ${membershipError.message}`,
    );
  }

  if (!membership) {
    redirect("/alta-club");
  }

  const {
    data: organization,
    error: organizationError,
  } =
    await supabase
      .from("organizations")
      .select(`
        id,
        name,
        service_status,
        plan_code
      `)
      .eq(
        "id",
        membership.organization_id,
      )
      .maybeSingle();

  if (organizationError) {
    throw new Error(
      `No fue posible cargar la organización: ${organizationError.message}`,
    );
  }

  if (!organization) {
    throw new Error(
      "La organización no existe.",
    );
  }

  if (
    !isServiceStatus(
      organization.service_status,
    )
  ) {
    throw new Error(
      "La organización tiene un estado de servicio inválido.",
    );
  }

  if (
    !isPlanCode(
      organization.plan_code,
    )
  ) {
    throw new Error(
      "La organización tiene un plan inválido.",
    );
  }

  const serviceStatus =
    organization.service_status;

  const planCode =
    organization.plan_code;

  /*
   * El estado comercial y el plan
   * contratado son independientes.
   *
   * Primero controlamos que el
   * servicio esté habilitado.
   */
  if (
    serviceStatus !== "active"
  ) {
    redirect("/activacion");
  }

  const {
    data: club,
    error: clubError,
  } =
    await supabase
      .from("clubs")
      .select(
        "id, name, slug",
      )
      .eq(
        "organization_id",
        organization.id,
      )
      .eq(
        "active",
        true,
      )
      .limit(1)
      .maybeSingle();

  if (clubError) {
    throw new Error(
      `No fue posible cargar el club: ${clubError.message}`,
    );
  }

  if (!club) {
    throw new Error(
      "La organización todavía no tiene un club activo.",
    );
  }

  return {
    userId,
    userEmail,

    organizationId:
      organization.id,

    organizationName:
      organization.name,

    serviceStatus,
    planCode,

    role:
      membership.role as OrganizationRole,

    clubId:
      club.id,

    clubName:
      club.name,

    clubSlug:
      club.slug,
  };
}