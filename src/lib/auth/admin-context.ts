import { redirect } from "next/navigation";

import {
    isCapabilityPlanCode,
    normalizeCapabilities,
    type CapabilityKey,
    type CapabilityPlanCode,
} from "@/lib/capabilities/catalog";
import { isPlanCode, type PlanCode } from "@/lib/plans/features";
import { createClient } from "@/lib/supabase/server";

type OrganizationRole = "owner" | "admin" | "operator" | "viewer";

type ServiceStatus = "pending" | "active" | "suspended";

type SubscriptionStatus =
  | "trial"
  | "active"
  | "past_due"
  | "paused"
  | "cancelled";

type PlanSource = "legacy_fallback" | "subscription" | "legacy_conflict";

type OrganizationCapabilitiesRpcRow = {
  organization_id: unknown;
  effective_plan: unknown;
  subscription_status: unknown;
  service_status: unknown;
  plan_source: unknown;
  has_plan_conflict: unknown;
  commercial_access_enabled: unknown;
  organization_role: unknown;
  is_linked_member: unknown;
  capabilities: unknown;
};

export type AdminContext = {
  userId: string;
  userEmail: string | null;

  organizationId: string;
  organizationName: string;

  serviceStatus: ServiceStatus;
  planCode: PlanCode;

  effectivePlan: CapabilityPlanCode;
  capabilities: CapabilityKey[];
  commercialAccessEnabled: boolean;
  subscriptionStatus: SubscriptionStatus | null;
  planSource: PlanSource;
  hasPlanConflict: boolean;

  role: OrganizationRole;

  clubId: string;
  clubName: string;
  clubSlug: string;
};

function isServiceStatus(value: unknown): value is ServiceStatus {
  return value === "pending" || value === "active" || value === "suspended";
}

function isSubscriptionStatus(value: unknown): value is SubscriptionStatus {
  return (
    value === "trial" ||
    value === "active" ||
    value === "past_due" ||
    value === "paused" ||
    value === "cancelled"
  );
}

function isPlanSource(value: unknown): value is PlanSource {
  return (
    value === "legacy_fallback" ||
    value === "subscription" ||
    value === "legacy_conflict"
  );
}

export async function getAdminContext(): Promise<AdminContext> {
  const supabase = await createClient();

  const { data: claimsData, error: claimsError } =
    await supabase.auth.getClaims();

  const userId =
    typeof claimsData?.claims.sub === "string" ? claimsData.claims.sub : null;

  const userEmail =
    typeof claimsData?.claims.email === "string"
      ? claimsData.claims.email
      : null;

  if (claimsError || !userId) {
    redirect("/login");
  }

  const { data: membership, error: membershipError } = await supabase
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

  const { data: organization, error: organizationError } = await supabase
    .from("organizations")
    .select(
      `
        id,
        name,
        service_status,
        plan_code
      `,
    )
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

  if (!isServiceStatus(organization.service_status)) {
    throw new Error("La organización tiene un estado de servicio inválido.");
  }

  if (!isPlanCode(organization.plan_code)) {
    throw new Error("La organización tiene un plan inválido.");
  }

  const { data: capabilitiesData, error: capabilitiesError } =
    await supabase.rpc("get_my_organization_capabilities", {
      requested_organization_id: membership.organization_id,
    });

  if (capabilitiesError) {
    throw new Error(
      `No fue posible resolver las capabilities de la organización: ${capabilitiesError.message}`,
    );
  }

  const capabilitiesContext = readCapabilitiesRpcRow(
    capabilitiesData,
    organization.id,
  );

  if (capabilitiesContext.organizationRole !== membership.role) {
    throw new Error(
      "El contrato de capabilities devolvió un rol organizacional inconsistente.",
    );
  }

  const serviceStatus = capabilitiesContext.serviceStatus;

  const planCode = organization.plan_code;

  /*
   * El estado comercial y el plan
   * contratado son independientes.
   *
   * Primero controlamos que el
   * servicio esté habilitado.
   */
  if (serviceStatus !== "active") {
    redirect("/activacion");
  }

  const { data: club, error: clubError } = await supabase
    .from("clubs")
    .select("id, name, slug")
    .eq("organization_id", organization.id)
    .eq("active", true)
    .limit(1)
    .maybeSingle();

  if (clubError) {
    throw new Error(`No fue posible cargar el club: ${clubError.message}`);
  }

  if (!club) {
    throw new Error("La organización todavía no tiene un club activo.");
  }

  return {
    userId,
    userEmail,

    organizationId: organization.id,

    organizationName: organization.name,

    serviceStatus,
    planCode,

    effectivePlan: capabilitiesContext.effectivePlan,

    capabilities: capabilitiesContext.capabilities,

    commercialAccessEnabled: capabilitiesContext.commercialAccessEnabled,

    subscriptionStatus: capabilitiesContext.subscriptionStatus,

    planSource: capabilitiesContext.planSource,

    hasPlanConflict: capabilitiesContext.hasPlanConflict,

    role: membership.role as OrganizationRole,

    clubId: club.id,

    clubName: club.name,

    clubSlug: club.slug,
  };
}

function isOrganizationRole(value: unknown): value is OrganizationRole {
  return (
    value === "owner" ||
    value === "admin" ||
    value === "operator" ||
    value === "viewer"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readCapabilitiesRpcRow(value: unknown, organizationId: string) {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    throw new Error(
      "El contrato de capabilities no devolvió exactamente una fila autorizada.",
    );
  }

  const row = value[0] as OrganizationCapabilitiesRpcRow;

  if (
    row.organization_id !== organizationId ||
    !isCapabilityPlanCode(row.effective_plan) ||
    !isServiceStatus(row.service_status) ||
    !isPlanSource(row.plan_source) ||
    typeof row.has_plan_conflict !== "boolean" ||
    typeof row.commercial_access_enabled !== "boolean" ||
    !isOrganizationRole(row.organization_role) ||
    typeof row.is_linked_member !== "boolean" ||
    (row.subscription_status !== null &&
      !isSubscriptionStatus(row.subscription_status))
  ) {
    throw new Error("El contrato de capabilities devolvió una fila inválida.");
  }

  return {
    organizationId: row.organization_id,
    effectivePlan: row.effective_plan,
    subscriptionStatus: row.subscription_status,
    serviceStatus: row.service_status,
    planSource: row.plan_source,
    hasPlanConflict: row.has_plan_conflict,
    commercialAccessEnabled: row.commercial_access_enabled,
    organizationRole: row.organization_role,
    isLinkedMember: row.is_linked_member,
    capabilities: normalizeCapabilities(row.capabilities),
  };
}
