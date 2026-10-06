export type InternalPagoTicPaymentStatus =
  | "pending"
  | "in_process"
  | "approved"
  | "rejected"
  | "cancelled"
  | "refunded";

export function mapPagoTicPaymentStatus(
  providerStatus: string,
): InternalPagoTicPaymentStatus | null {
  switch (
    providerStatus
      .trim()
      .toLowerCase()
  ) {
    case "pending":
    case "issued":
    case "review":
    case "validate":
    case "deferred":
    case "overdue":
      return "pending";

    case "in_process":
    case "objected":
      return "in_process";

    case "approved":
      return "approved";

    case "rejected":
      return "rejected";

    case "cancelled":
    case "canceled":
      return "cancelled";

    case "refunded":
      return "refunded";

    default:
      return null;
  }
}

export function isPagoTicFinalPaymentStatus(
  status: InternalPagoTicPaymentStatus,
) {
  return (
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled" ||
    status === "refunded"
  );
}