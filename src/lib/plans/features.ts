export type PlanCode =
  | "essential"
  | "pro";

export type PlanFeature =
  | "club_profile"
  | "public_page"
  | "activities"
  | "spaces"
  | "reservations"
  | "payment_link"
  | "members"
  | "fees"
  | "delinquency"
  | "payments"
  | "users"
  | "notifications"
  | "exports"
  | "audit";

export const PLAN_LABELS: Record<
  PlanCode,
  string
> = {
  essential: "Esencial",
  pro: "Pro",
};

export const PLAN_FEATURE_LABELS: Record<
  PlanFeature,
  string
> = {
  club_profile:
    "Datos e identidad del club",

  public_page:
    "Página pública",

  activities:
    "Actividades y horarios",

  spaces:
    "Espacios",

  reservations:
    "Reservas",

  payment_link:
    "Enlace simple de pago",

  members:
    "Personas",

  fees:
    "Cuotas y aranceles",

  delinquency:
    "Morosidad",

  payments:
    "Gestión de pagos",

  users:
    "Usuarios y roles",

  notifications:
    "Notificaciones",

  exports:
    "Exportaciones",

  audit:
    "Auditoría",
};

const essentialFeatures: PlanFeature[] = [
  "club_profile",
  "public_page",
  "activities",
  "spaces",
  "reservations",
  "payment_link",
];

const proOnlyFeatures: PlanFeature[] = [
  "members",
  "fees",
  "delinquency",
  "payments",
  "users",
  "notifications",
  "exports",
  "audit",
];

export const PLAN_FEATURES: Record<
  PlanCode,
  readonly PlanFeature[]
> = {
  essential:
    essentialFeatures,

  pro: [
    ...essentialFeatures,
    ...proOnlyFeatures,
  ],
};

export function isPlanCode(
  value: unknown,
): value is PlanCode {
  return (
    value === "essential" ||
    value === "pro"
  );
}

export function hasPlanFeature(
  plan: PlanCode,
  feature: PlanFeature,
) {
  return PLAN_FEATURES[
    plan
  ].includes(feature);
}