export type ClubRole =
  | "owner"
  | "admin"
  | "operator"
  | "viewer";

export type ClubPermission =
  | "club.settings.manage"
  | "activities.manage"
  | "members.manage"
  | "fees.manage"
  | "payments.record"
  | "payments.configure"
  | "reservations.manage"
  | "spaces.manage"
  | "exports.download"
  | "users.manage"
  | "audit.view";

const permissionsByRole: Record<
  ClubRole,
  ReadonlySet<ClubPermission>
> = {
  owner: new Set([
    "club.settings.manage",
    "activities.manage",
    "members.manage",
    "fees.manage",
    "payments.record",
    "payments.configure",
    "reservations.manage",
    "spaces.manage",
    "exports.download",
    "users.manage",
    "audit.view",
  ]),

  admin: new Set([
    "club.settings.manage",
    "activities.manage",
    "members.manage",
    "fees.manage",
    "payments.record",
    "payments.configure",
    "reservations.manage",
    "spaces.manage",
    "exports.download",
    "users.manage",
    "audit.view",
  ]),

  operator: new Set([
    "activities.manage",
    "members.manage",
    "fees.manage",
    "payments.record",
    "reservations.manage",
  ]),

  viewer: new Set([]),
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

export function canManageReservations(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "reservations.manage",
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

export function canExportData(
  role: string | null | undefined,
) {
  return hasPermission(
    role,
    "exports.download",
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