import type {
  AdminContext,
} from "@/lib/auth/admin-context";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export type AuditActorType =
  | "user"
  | "system"
  | "public"
  | "provider";

export type AuditSource =
  | "panel"
  | "public"
  | "system"
  | "webhook";

type AuditLogInput = {
  action: string;

  entityType: string;

  entityId?:
    | string
    | null;

  entityLabel?:
    | string
    | null;

  summary: string;

  source?: AuditSource;

  actorType?: AuditActorType;

  metadata?: Record<
    string,
    unknown
  >;
};

export async function writeAuditLog(
  context: AdminContext,
  input: AuditLogInput,
) {
  const supabase =
    createAdminClient();

  const {
    error,
  } = await supabase
    .from("audit_logs")
    .insert({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      actor_type:
        input.actorType ??
        "user",

      actor_user_id:
        context.userId,

      actor_email:
        context.userEmail,

      actor_role:
        context.role,

      action:
        input.action,

      entity_type:
        input.entityType,

      entity_id:
        input.entityId ??
        null,

      entity_label:
        input.entityLabel ??
        null,

      summary:
        input.summary,

      source:
        input.source ??
        "panel",

      metadata:
        input.metadata ??
        {},
    });

  if (error) {
    console.error(
      "No fue posible registrar auditoría:",
      {
        action:
          input.action,

        entityType:
          input.entityType,

        entityId:
          input.entityId,

        error:
          error.message,
      },
    );

    return {
      ok: false as const,
      error:
        error.message,
    };
  }

  return {
    ok: true as const,
    error: null,
  };
}