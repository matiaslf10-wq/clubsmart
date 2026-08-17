import { redirect } from "next/navigation";

import {
  getAdminContext,
  type AdminContext,
} from "@/lib/auth/admin-context";

import {
  hasPlanFeature,
  type PlanFeature,
} from "@/lib/plans/features";

export async function requirePlanFeature(
  feature: PlanFeature,
): Promise<AdminContext> {
  const context =
    await getAdminContext();

  if (
    !hasPlanFeature(
      context.planCode,
      feature,
    )
  ) {
    redirect(
      `/panel/plan?required=${feature}`,
    );
  }

  return context;
}