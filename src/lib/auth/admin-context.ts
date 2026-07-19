import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

type OrganizationRole =
  | "owner"
  | "admin"
  | "operator"
  | "viewer";

export type AdminContext = {
  userId: string;
  organizationId: string;
  organizationName: string;
  role: OrganizationRole;
  clubId: string;
  clubName: string;
  clubSlug: string;
};

export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId =
    typeof claimsData?.claims.sub === "string"
      ? claimsData.claims.sub
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
    throw new Error(
      "El usuario no está vinculado con ninguna organización.",
    );
  }

  const {
    data: organization,
    error: organizationError,
  } = await supabase
    .from("organizations")
    .select("id, name")
    .eq("id", membership.organization_id)
    .maybeSingle();

  if (organizationError) {
    throw new Error(
      `No fue posible cargar la organización: ${organizationError.message}`,
    );
  }

  if (!organization) {
    throw new Error("La organización no existe.");
  }

  const { data: club, error: clubError } =
    await supabase
      .from("clubs")
      .select("id, name, slug")
      .eq("organization_id", organization.id)
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
    organizationId: organization.id,
    organizationName: organization.name,
    role: membership.role as OrganizationRole,
    clubId: club.id,
    clubName: club.name,
    clubSlug: club.slug,
  };
}