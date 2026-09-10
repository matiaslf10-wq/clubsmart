export const CAPABILITY_KEYS = [
  "club.profile",
  "club.public_page",
  "club.activities",
  "club.schedules",
  "club.contact",
  "club.payment_link",
  "member.directory",
  "member.card",
  "member.activities",
  "member.fees",
  "member.payments",
  "member.reservations",
  "member.linked_people",
  "member.notifications",
  "club.spaces",
  "club.delinquency",
  "operation.card_verification",
  "organization.exports",
  "organization.audit",
  "intelligence.analytics",
  "intelligence.recommendations",
  "intelligence.communications",
] as const;

export type CapabilityKey = (typeof CAPABILITY_KEYS)[number];

export const CAPABILITY_PLAN_CODES = [
  "essential",
  "pro",
  "intelligence",
] as const;

export type CapabilityPlanCode = (typeof CAPABILITY_PLAN_CODES)[number];

export function isCapabilityKey(value: unknown): value is CapabilityKey {
  return (
    typeof value === "string" &&
    (CAPABILITY_KEYS as readonly string[]).includes(value)
  );
}
export function normalizeCapabilities(value: unknown): CapabilityKey[] {
  if (!Array.isArray(value)) {
    throw new Error("El contrato de capabilities devolvió un valor inválido.");
  }

  if (value.some((item) => typeof item !== "string")) {
    throw new Error(
      "El contrato de capabilities contiene un valor no textual.",
    );
  }

  return value.filter(isCapabilityKey);
}

export function isCapabilityPlanCode(
  value: unknown,
): value is CapabilityPlanCode {
  return (
    typeof value === "string" &&
    (CAPABILITY_PLAN_CODES as readonly string[]).includes(value)
  );
}
