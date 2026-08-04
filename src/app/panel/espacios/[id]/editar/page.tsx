import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { updateSpace } from "@/app/panel/espacios/actions";
import {
  SpaceForm,
  type SpaceFormInitialData,
} from "@/app/panel/espacios/space-form";
import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

export default async function EditSpacePage({
  params,
}: PageProps) {
  const context = await getAdminContext();

  if (
    context.role !== "owner" &&
    context.role !== "admin"
  ) {
    redirect("/panel");
  }

  const { id } = await params;

  if (!isUuid(id)) {
    notFound();
  }

  const supabase = createAdminClient();

  const [spaceResult, availabilityResult] =
    await Promise.all([
      supabase
        .from("club_spaces")
        .select(`
          id,
          name,
          space_type,
          short_description,
          description,
          location,
          capacity,
          minimum_reservation_minutes,
          slot_interval_minutes,
          price,
          price_description,
          confirmation_mode,
          requires_deposit,
          deposit_type,
          deposit_value,
          publicly_bookable,
          display_order
        `)
        .eq("id", id)
        .eq(
          "organization_id",
          context.organizationId,
        )
        .eq("club_id", context.clubId)
        .maybeSingle(),

      supabase
        .from("space_availability")
        .select(`
          day_of_week,
          start_time,
          end_time,
          location,
          notes
        `)
        .eq("space_id", id)
        .eq(
          "organization_id",
          context.organizationId,
        )
        .eq("club_id", context.clubId)
        .eq("active", true)
        .order("day_of_week", {
          ascending: true,
        })
        .order("start_time", {
          ascending: true,
        }),
    ]);

  if (
    spaceResult.error ||
    !spaceResult.data
  ) {
    notFound();
  }

  if (availabilityResult.error) {
    throw new Error(
      `No fue posible cargar los horarios: ${availabilityResult.error.message}`,
    );
  }

  const space = spaceResult.data;

  const initialData: SpaceFormInitialData = {
    name: space.name,
    space_type: space.space_type,

    short_description:
      space.short_description ?? "",

    description: space.description ?? "",
    location: space.location ?? "",

    capacity: space.capacity,

    minimum_reservation_minutes:
      space.minimum_reservation_minutes,

    slot_interval_minutes:
      space.slot_interval_minutes,

    price: Number(space.price),

    price_description:
      space.price_description ?? "",

    confirmation_mode:
      space.confirmation_mode,

    requires_deposit:
      space.requires_deposit,

    deposit_type:
      space.deposit_type,

    deposit_value:
      Number(space.deposit_value),

    publicly_bookable:
      space.publicly_bookable,

    display_order:
      space.display_order,

    availability: (
      availabilityResult.data ?? []
    ).map((availability) => ({
      day_of_week:
        availability.day_of_week,

      start_time:
        availability.start_time.slice(0, 5),

      end_time:
        availability.end_time.slice(0, 5),

      location:
        availability.location ?? "",

      notes:
        availability.notes ?? "",
    })),
  };

  const updateAction = updateSpace.bind(null, id);

  return (
    <div>
      <Link
        href="/panel/espacios"
        className="text-sm font-semibold text-blue-700 transition hover:text-blue-800"
      >
        ← Volver a espacios
      </Link>

      <div className="mt-6">
        <p className="text-sm font-semibold uppercase tracking-wider text-blue-700">
          {context.clubName}
        </p>

        <h1 className="mt-3 text-3xl font-bold text-slate-900">
          Editar {space.name}
        </h1>
      </div>

      <div className="mt-8">
        <SpaceForm
          action={updateAction}
          initialData={initialData}
          submitLabel="Guardar cambios"
        />
      </div>
    </div>
  );
}