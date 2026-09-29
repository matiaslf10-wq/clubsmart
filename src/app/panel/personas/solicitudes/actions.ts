"use server";

import { revalidatePath } from "next/cache";

import { requireCapability } from "@/lib/capabilities/require-capability";
import { createClient } from "@/lib/supabase/server";

export type LinkRequestActionState = {
  error: string | null;
};

async function getReviewerContext() {
  const context = await requireCapability("member.linked_people");

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    return {
      context,
      error:
        "Tu usuario no tiene permisos para revisar solicitudes de v\u00EDnculo.",
    };
  }

  return {
    context,
    error: null,
  };
}

function revalidateLinkRequestPages() {
  revalidatePath("/panel/personas");
  revalidatePath("/panel/personas/solicitudes");
}

function approvalErrorMessage(message: string) {
  if (message.includes("DNI_ALREADY_HAS_ACCOUNT")) {
    return "Este DNI ya tiene una cuenta personal vinculada.";
  }

  if (message.includes("MEMBER_INACTIVE")) {
    return "La persona encontrada est\u00E1 inactiva. Revis\u00E1 su ficha antes de aprobar.";
  }

  if (message.includes("REQUESTER_PROFILE_INCOMPLETE")) {
    return "La cuenta solicitante no tiene nombre y apellido completos.";
  }

  if (message.includes("MEMBER_NOT_FOUND_OR_INACTIVE")) {
    return "Para este tipo de v\u00EDnculo debe existir una persona activa con ese DNI.";
  }

  if (message.includes("LINK_REQUEST_ALREADY_REVIEWED")) {
    return "La solicitud ya fue revisada.";
  }

  if (message.includes("LINK_REQUEST_NOT_FOUND")) {
    return "La solicitud ya no existe.";
  }

  if (message.includes("NOT_AUTHORIZED")) {
    return "Tu usuario no tiene permisos para aprobar esta solicitud.";
  }

  return `No fue posible aprobar el v\u00EDnculo: ${message}`;
}

export async function approveMemberLinkRequest(
  requestId: string,
): Promise<LinkRequestActionState> {
  const reviewer = await getReviewerContext();

  if (reviewer.error) {
    return { error: reviewer.error };
  }

  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("member_link_requests")
    .select("id, club_id, status")
    .eq("id", requestId)
    .eq("club_id", reviewer.context.clubId)
    .eq("status", "pending")
    .maybeSingle();

  if (requestError) {
    return {
      error: `No fue posible consultar la solicitud: ${requestError.message}`,
    };
  }

  if (!request) {
    return {
      error:
        "La solicitud ya no est\u00E1 pendiente o no pertenece a este club.",
    };
  }

  const { error } = await supabase.rpc(
    "approve_member_link_request",
    {
      requested_request_id: requestId,
      requested_review_note: null,
    },
  );

  if (error) {
    return {
      error: approvalErrorMessage(error.message),
    };
  }

  revalidateLinkRequestPages();

  return { error: null };
}

export async function rejectMemberLinkRequest(
  requestId: string,
): Promise<LinkRequestActionState> {
  const reviewer = await getReviewerContext();

  if (reviewer.error) {
    return { error: reviewer.error };
  }

  const supabase = await createClient();

  const { data: request, error: requestError } = await supabase
    .from("member_link_requests")
    .select("id, club_id, status")
    .eq("id", requestId)
    .eq("club_id", reviewer.context.clubId)
    .eq("status", "pending")
    .maybeSingle();

  if (requestError) {
    return {
      error: `No fue posible consultar la solicitud: ${requestError.message}`,
    };
  }

  if (!request) {
    return {
      error:
        "La solicitud ya no est\u00E1 pendiente o no pertenece a este club.",
    };
  }

  const { error } = await supabase.rpc(
    "reject_member_link_request",
    {
      requested_request_id: requestId,
      requested_review_note: null,
    },
  );

  if (error) {
    return {
      error: `No fue posible rechazar la solicitud: ${error.message}`,
    };
  }

  revalidateLinkRequestPages();

  return { error: null };
}
