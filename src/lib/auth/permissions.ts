export type ClubRole =
  | "owner"
  | "admin"
  | "operator"
  | "viewer";

export type ClubPermission =
  | "club.settings.manage"

  | "activities.view"
  | "activities.manage"

  | "members.view"
  | "members.manage"

  | "fees.view"
  | "fees.manage"

  | "payments.view"
  | "payments.record"
  | "payments.configure"

  | "reservations.view"
  | "reservations.manage"

  | "spaces.view"
  | "spaces.manage"

  | "delinquency.view"

  | "exports.download"

  | "users.manage"
  | "audit.view"

  | "notifications.view"
| "notifications.send"
| "notifications.manage";

const permissionsByRole: Record<
  ClubRole,
  ReadonlySet<ClubPermission>
> = {
  owner: new Set([
    "club.settings.manage",

    "activities.view",
    "activities.manage",

    "members.view",
    "members.manage",

    "fees.view",
    "fees.manage",

    "payments.view",
    "payments.record",
    "payments.configure",

    "reservations.view",
    "reservations.manage",

    "spaces.view",
    "spaces.manage",

    "delinquency.view",

    "exports.download",

    "users.manage",
    "audit.view",

    "notifications.view",
"notifications.send",
"notifications.manage",
  ]),

  admin: new Set([
    "club.settings.manage",

    "activities.view",
    "activities.manage",

    "members.view",
    "members.manage",

    "fees.view",
    "fees.manage",

    "payments.view",
    "payments.record",
    "payments.configure",

    "reservations.view",
    "reservations.manage",

    "spaces.view",
    "spaces.manage",

    "delinquency.view",

    "exports.download",

    "users.manage",
    "audit.view",

    "notifications.view",
"notifications.send",
"notifications.manage",
  ]),

  operator: new Set([
    "activities.view",
    "activities.manage",

    "members.view",
    "members.manage",

    "fees.view",
    "fees.manage",

    "payments.view",
    "payments.record",

    "reservations.view",
    "reservations.manage",

    "spaces.view",

    "delinquency.view",

    "notifications.view",
"notifications.send",
  ]),

  viewer: new Set([
    "activities.view",
    "members.view",
    "fees.view",
    "payments.view",
    "reservations.view",
    "spaces.view",
    "delinquency.view",
    "notifications.view",
  ]),
};

export function isClubRole(
  role: string | null | undefined,
): role is ClubRole {
  return (
    role === "owner" ||
    role === "admin" ||
    role === "operator" ||
    role === "viewer"
  );
}

export function hasPermission(
  role: string | null | undefined,
  permission: ClubPermission,
) {
  if (!isClubRole(role)) {
    return false;
  }

  return permissionsByRole[
    role
  ].has(permission);
}

export function canManageClub(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "club.settings.manage",
  );
}

export function canViewReservations(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "reservations.view",
  );
}

export function canManageReservations(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "reservations.manage",
  );
}

export function canViewSpaces(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "spaces.view",
  );
}

export function canManageSpaces(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "spaces.manage",
  );
}

export function canViewPayments(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "payments.view",
  );
}

export function canRecordPayments(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "payments.record",
  );
}

export function canConfigurePayments(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "payments.configure",
  );
}

export function canViewDelinquency(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "delinquency.view",
  );
}

export function canExportData(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "exports.download",
  );
}

export function canManageActivities(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "activities.manage",
  );
}

export function canManageMembers(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "members.manage",
  );
}

export function canManageFees(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "fees.manage",
  );
}

export function canManageUsers(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "users.manage",
  );
}

export function canViewAudit(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "audit.view",
  );
}

export function canViewNotifications(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "notifications.view",
  );
}

export function canSendNotifications(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "notifications.send",
  );
}

export function canManageNotifications(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "notifications.manage",
  );
}