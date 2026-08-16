import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

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
  role: OrganizationRole;
  clubId: string;
  clubName: string;
  clubSlug: string;
};

export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();

  const {
    data: claimsData,
    error: claimsError,
  } = await supabase.auth.getClaims();

  const userId =
    typeof claimsData?.claims.sub === "string"
      ? claimsData.claims.sub
      : null;

  const userEmail =
    typeof claimsData?.claims.email === "string"
      ? claimsData.claims.email
      : null;

  if (claimsError || !userId) {
    redirect("/login");
  }

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
  } = await supabase
    .from("organizations")
    .select(`
      id,
      name,
      service_status
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

  const serviceStatus =
    organization.service_status as ServiceStatus;

  /*
   * Este es el único candado comercial
   * del panel.
   *
   * Todos los clubes pendientes o
   * suspendidos son enviados a la
   * pantalla de activación.
   */
  if (serviceStatus !== "active") {
    redirect("/activacion");
  }

  const {
    data: club,
    error: clubError,
  } = await supabase
    .from("clubs")
    .select("id, name, slug")
    .eq(
      "organization_id",
      organization.id,
    )
    .eq("active", true)
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