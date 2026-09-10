import type { CapabilityKey } from "./catalog";

export function hasCapability(
  capabilities: readonly CapabilityKey[],
  capability: CapabilityKey,
): boolean {
  return capabilities.includes(capability);
}
