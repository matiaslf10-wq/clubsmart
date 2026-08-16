"use server";

import {
  revalidatePath,
} from "next/cache";

import {
  redirect,
} from "next/navigation";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  createClient,
} from "@/lib/supabase/server";

export async function requestProUpgrade(): Promise<void> {
  const context =
    await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect(
      "/panel/plan?error=permission",
    );
  }

  if (
    context.planCode === "pro"
  ) {
    redirect(
      "/panel/plan",
    );
  }

  const supabase =
    await createClient();

  const {
    error,
  } =
    await supabase
      .from("organizations")
      .update({
        requested_plan_code:
          "pro",

        plan_change_requested_at:
          new Date().toISOString(),
      })
      .eq(
        "id",
        context.organizationId,
      );

  if (error) {
    console.error(
      "No fue posible solicitar el cambio de plan:",
      error,
    );

    redirect(
      "/panel/plan?error=request",
    );
  }

  revalidatePath(
    "/panel/plan",
  );

  redirect(
    "/panel/plan?requested=1",
  );
}