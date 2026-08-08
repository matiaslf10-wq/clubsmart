import Link from "next/link";

import {
  getAdminContext,
} from "@/lib/auth/admin-context";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

export async function PendingReservationsLink() {
  const context =
    await getAdminContext();

  const supabase =
    createAdminClient();

  const {
    count,
    error,
  } = await supabase
    .from(
      "space_reservations",
    )
    .select(
      "id",
      {
        count: "exact",
        head: true,
      },
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .eq(
      "status",
      "pending",
    );

  const pendingCount =
    error
      ? 0
      : count ?? 0;

  return (
    <Link
      href={
        pendingCount > 0
          ? "/panel/reservas/pendientes"
          : "/panel/reservas"
      }
      className="flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-blue-700"
    >
      <span>
        Reservas
      </span>

      {pendingCount > 0 ? (
        <span
          title={`${pendingCount} reservas pendientes`}
          className="inline-flex min-w-5 items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold text-white"
        >
          {pendingCount > 99
            ? "99+"
            : pendingCount}
        </span>
      ) : null}
    </Link>
  );
}