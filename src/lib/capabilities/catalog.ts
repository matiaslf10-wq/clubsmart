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
