import { redirect } from "next/navigation";

import { getAdminContext, type AdminContext } from "@/lib/auth/admin-context";
import type { CapabilityKey } from "./catalog";
import { hasCapability } from "./has-capability";

export async function requireCapability(
  capability: CapabilityKey,
): Promise<AdminContext> {
  const context = await getAdminContext();

  if (
    !context.commercialAccessEnabled ||
    !hasCapability(context.capabilities, capability)
  ) {
    redirect(`/panel/plan?required=${capability}`);
  }

  return context;
}
