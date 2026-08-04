"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getAdminContext } from "@/lib/auth/admin-context";
import { createAdminClient } from "@/lib/supabase/admin";

type AvailabilityInput = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  location: string;
  notes: string;
};

const allowedSpaceTypes = new Set([
  "court",
  "hall",
  "barbecue",
  "stadium",
  "pool",
  "room",
  "other",
]);

const allowedConfirmationModes = new Set([
  "manual",
  "automatic",
]);

const allowedDepositTypes = new Set([
  "none",
  "fixed",
  "percentage",
]);

function canManageSpaces(role: string) {
  return role === "owner" || role === "admin";
}

function readText(formData: FormData, field: string) {
  const value = formData.get(field);

  return typeof value === "string" ? value.trim() : "";
}

function readNumber(
  formData: FormData,
  field: string,
  fallback = 0,
) {
  const rawValue = readText(formData, field);

  if (!rawValue) {
    return fallback;
  }

  const value = Number(rawValue);

  return Number.isFinite(value) ? value : fallback;
}

function readNullableInteger(
  formData: FormData,
  field: string,
) {
  const rawValue = readText(formData, field);

  if (!rawValue) {
    return null;
  }

  const value = Number(rawValue);

  return Number.isInteger(value) ? value : null;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function slugify(value: string) {
  const slug = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return slug || "espacio";
}

function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);

  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);

  if (
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return null;
  }

  return hours * 60 + minutes;
}

function parseAvailability(formData: FormData) {
  const rawValue = readText(
    formData,
    "availability_json",
  );

  if (!rawValue) {
    return [] satisfies AvailabilityInput[];
  }

  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    throw new Error(
      "Los horarios disponibles no tienen un formato válido.",
    );
  }

  if (!Array.isArray(parsedValue)) {
    throw new Error(
      "Los horarios disponibles no tienen un formato válido.",
    );
  }

  if (parsedValue.length > 70) {
    throw new Error(
      "Se cargaron demasiados horarios para un mismo espacio.",
    );
  }

  const result: AvailabilityInput[] = parsedValue.map(
    (item) => {
      if (
        typeof item !== "object" ||
        item === null ||
        Array.isArray(item)
      ) {
        throw new Error(
          "Uno de los horarios no tiene un formato válido.",
        );
      }

      const record = item as Record<string, unknown>;

      const dayOfWeek = Number(record.day_of_week);

      const startTime =
        typeof record.start_time === "string"
          ? record.start_time.trim()
          : "";

      const endTime =
        typeof record.end_time === "string"
          ? record.end_time.trim()
          : "";

      const location =
        typeof record.location === "string"
          ? record.location.trim()
          : "";

      const notes =
        typeof record.notes === "string"
          ? record.notes.trim()
          : "";

      const startMinutes = timeToMinutes(startTime);
      const endMinutes = timeToMinutes(endTime);

      if (
        !Number.isInteger(dayOfWeek) ||
        dayOfWeek < 1 ||
        dayOfWeek > 7
      ) {
        throw new Error(
          "Uno de los días seleccionados no es válido.",
        );
      }

      if (
        startMinutes === null ||
        endMinutes === null ||
        startMinutes >= endMinutes
      ) {
        throw new Error(
          "Todos los horarios deben tener una hora de inicio anterior a la hora de finalización.",
        );
      }

      return {
        day_of_week: dayOfWeek,
        start_time: startTime,
        end_time: endTime,
        location,
        notes,
      };
    },
  );

  const groupedByDay = new Map<
    number,
    AvailabilityInput[]
  >();

  for (const availability of result) {
    const rows =
      groupedByDay.get(availability.day_of_week) ?? [];

    rows.push(availability);

    groupedByDay.set(
      availability.day_of_week,
      rows,
    );
  }

  for (const rows of groupedByDay.values()) {
    const sortedRows = [...rows].sort((first, second) => {
      return (
        (timeToMinutes(first.start_time) ?? 0) -
        (timeToMinutes(second.start_time) ?? 0)
      );
    });

    for (
      let index = 1;
      index < sortedRows.length;
      index += 1
    ) {
      const previousEnd =
        timeToMinutes(sortedRows[index - 1].end_time) ?? 0;

      const currentStart =
        timeToMinutes(sortedRows[index].start_time) ?? 0;

      if (currentStart < previousEnd) {
        throw new Error(
          "Hay horarios superpuestos dentro del mismo día.",
        );
      }
    }
  }

  return result.sort((first, second) => {
    if (first.day_of_week !== second.day_of_week) {
      return first.day_of_week - second.day_of_week;
    }

    return first.start_time.localeCompare(second.start_time);
  });
}

async function getUniqueSlug(
  clubId: string,
  name: string,
) {
  const supabase = createAdminClient();
  const baseSlug = slugify(name);

  for (let index = 0; index < 100; index += 1) {
    const candidate =
      index === 0 ? baseSlug : `${baseSlug}-${index + 1}`;

    const { data, error } = await supabase
      .from("club_spaces")
      .select("id")
      .eq("club_id", clubId)
      .eq("slug", candidate)
      .maybeSingle();

    if (error) {
      throw new Error(
        `No fue posible verificar el identificador del espacio: ${error.message}`,
      );
    }

    if (!data) {
      return candidate;
    }
  }

  throw new Error(
    "No fue posible generar un identificador único para el espacio.",
  );
}

function redirectToSpaces(
  type: "success" | "error",
  message: string,
): never {
  const parameters = new URLSearchParams({
    [type]: message,
  });

  redirect(`/panel/espacios?${parameters.toString()}`);
}

function validateSpaceData(formData: FormData) {
  const name = readText(formData, "name");

  const spaceType = readText(
    formData,
    "space_type",
  );

  const shortDescription = readText(
    formData,
    "short_description",
  );

  const description = readText(
    formData,
    "description",
  );

  const location = readText(formData, "location");

  const capacity = readNullableInteger(
    formData,
    "capacity",
  );

  const minimumReservationMinutes = readNumber(
    formData,
    "minimum_reservation_minutes",
    60,
  );

  const slotIntervalMinutes = readNumber(
    formData,
    "slot_interval_minutes",
    30,
  );

  const price = readNumber(formData, "price", 0);

  const priceDescription = readText(
    formData,
    "price_description",
  );

  const confirmationMode = readText(
    formData,
    "confirmation_mode",
  );

  const requiresDeposit =
    formData.get("requires_deposit") === "on";

  const requestedDepositType = readText(
    formData,
    "deposit_type",
  );

  const depositType = requiresDeposit
    ? requestedDepositType
    : "none";

  const depositValue = requiresDeposit
    ? readNumber(formData, "deposit_value", 0)
    : 0;

  const publiclyBookable =
    formData.get("publicly_bookable") === "on";

  const displayOrder = readNumber(
    formData,
    "display_order",
    0,
  );

  if (name.length < 2) {
    throw new Error(
      "El nombre debe tener al menos dos caracteres.",
    );
  }

  if (!allowedSpaceTypes.has(spaceType)) {
    throw new Error(
      "El tipo de espacio seleccionado no es válido.",
    );
  }

  if (
    capacity !== null &&
    (!Number.isInteger(capacity) || capacity <= 0)
  ) {
    throw new Error(
      "La capacidad debe ser un número entero mayor que cero.",
    );
  }

  if (
    !Number.isInteger(minimumReservationMinutes) ||
    minimumReservationMinutes < 15 ||
    minimumReservationMinutes > 1440
  ) {
    throw new Error(
      "La duración mínima debe estar entre 15 y 1440 minutos.",
    );
  }

  if (
    !Number.isInteger(slotIntervalMinutes) ||
    slotIntervalMinutes < 5 ||
    slotIntervalMinutes > 720
  ) {
    throw new Error(
      "El intervalo entre turnos debe estar entre 5 y 720 minutos.",
    );
  }

  if (price < 0) {
    throw new Error(
      "El precio no puede ser negativo.",
    );
  }

  if (!allowedConfirmationModes.has(confirmationMode)) {
    throw new Error(
      "La modalidad de confirmación no es válida.",
    );
  }

  if (!allowedDepositTypes.has(depositType)) {
    throw new Error(
      "El tipo de seña seleccionado no es válido.",
    );
  }

  if (requiresDeposit) {
    if (depositType === "none") {
      throw new Error(
        "Seleccioná cómo se calculará la seña.",
      );
    }

    if (depositValue <= 0) {
      throw new Error(
        "El valor de la seña debe ser mayor que cero.",
      );
    }

    if (
      depositType === "percentage" &&
      depositValue > 100
    ) {
      throw new Error(
        "El porcentaje de seña no puede superar el 100 %.",
      );
    }
  }

  const availability = parseAvailability(formData);

  return {
    name,
    spaceType,
    shortDescription,
    description,
    location,
    capacity,
    minimumReservationMinutes,
    slotIntervalMinutes,
    price,
    priceDescription,
    confirmationMode,
    requiresDeposit,
    depositType,
    depositValue,
    publiclyBookable,
    displayOrder,
    availability,
  };
}

export async function createSpace(
  formData: FormData,
): Promise<void> {
  const context = await getAdminContext();

  if (!canManageSpaces(context.role)) {
    redirectToSpaces(
      "error",
      "Tu usuario no tiene permisos para administrar espacios.",
    );
  }

  let values: ReturnType<typeof validateSpaceData>;

  try {
    values = validateSpaceData(formData);
  } catch (error) {
    redirectToSpaces(
      "error",
      error instanceof Error
        ? error.message
        : "Los datos del espacio no son válidos.",
    );
  }

  const supabase = createAdminClient();

  let slug: string;

  try {
    slug = await getUniqueSlug(
      context.clubId,
      values.name,
    );
  } catch (error) {
    redirectToSpaces(
      "error",
      error instanceof Error
        ? error.message
        : "No fue posible generar el identificador del espacio.",
    );
  }

  const now = new Date().toISOString();

  const { data: space, error: spaceError } =
    await supabase
      .from("club_spaces")
      .insert({
        organization_id: context.organizationId,
        club_id: context.clubId,

        name: values.name,
        slug,

        space_type: values.spaceType,

        short_description:
          values.shortDescription || null,

        description: values.description || null,
        location: values.location || null,

        capacity: values.capacity,

        minimum_reservation_minutes:
          values.minimumReservationMinutes,

        slot_interval_minutes:
          values.slotIntervalMinutes,

        price: values.price,

        price_description:
          values.priceDescription || null,

        confirmation_mode:
          values.confirmationMode,

        requires_deposit:
          values.requiresDeposit,

        deposit_type: values.depositType,
        deposit_value: values.depositValue,

        publicly_bookable:
          values.publiclyBookable,

        active: true,

        display_order: values.displayOrder,

        created_by_user_id: context.userId,

        created_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

  if (spaceError || !space) {
    redirectToSpaces(
      "error",
      `No fue posible crear el espacio: ${
        spaceError?.message ?? "Error desconocido."
      }`,
    );
  }

  if (values.availability.length > 0) {
    const { error: availabilityError } = await supabase
      .from("space_availability")
      .insert(
        values.availability.map((availability) => ({
          organization_id: context.organizationId,
          club_id: context.clubId,
          space_id: space.id,

          day_of_week: availability.day_of_week,
          start_time: availability.start_time,
          end_time: availability.end_time,

          location: availability.location || null,
          notes: availability.notes || null,

          active: true,

          created_at: now,
          updated_at: now,
        })),
      );

    if (availabilityError) {
      await supabase
        .from("club_spaces")
        .delete()
        .eq("id", space.id)
        .eq("club_id", context.clubId);

      redirectToSpaces(
        "error",
        `No fue posible guardar los horarios: ${availabilityError.message}`,
      );
    }
  }

  revalidatePath("/panel/espacios");

  redirectToSpaces(
    "success",
    "El espacio fue creado correctamente.",
  );
}

export async function updateSpace(
  spaceId: string,
  formData: FormData,
): Promise<void> {
  const context = await getAdminContext();

  if (!canManageSpaces(context.role)) {
    redirectToSpaces(
      "error",
      "Tu usuario no tiene permisos para administrar espacios.",
    );
  }

  if (!isUuid(spaceId)) {
    redirectToSpaces(
      "error",
      "El espacio indicado no es válido.",
    );
  }

  let values: ReturnType<typeof validateSpaceData>;

  try {
    values = validateSpaceData(formData);
  } catch (error) {
    redirectToSpaces(
      "error",
      error instanceof Error
        ? error.message
        : "Los datos del espacio no son válidos.",
    );
  }

  const supabase = createAdminClient();

  const { data: existingSpace, error: existingSpaceError } =
    await supabase
      .from("club_spaces")
      .select("id, slug")
      .eq("id", spaceId)
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId)
      .maybeSingle();

  if (existingSpaceError || !existingSpace) {
    redirectToSpaces(
      "error",
      "El espacio no existe o no pertenece a este club.",
    );
  }

  const { data: previousAvailability } = await supabase
    .from("space_availability")
    .select(`
      day_of_week,
      start_time,
      end_time,
      location,
      notes,
      active
    `)
    .eq("space_id", spaceId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId);

  const now = new Date().toISOString();

  const { error: updateError } = await supabase
    .from("club_spaces")
    .update({
      name: values.name,

      space_type: values.spaceType,

      short_description:
        values.shortDescription || null,

      description: values.description || null,
      location: values.location || null,

      capacity: values.capacity,

      minimum_reservation_minutes:
        values.minimumReservationMinutes,

      slot_interval_minutes:
        values.slotIntervalMinutes,

      price: values.price,

      price_description:
        values.priceDescription || null,

      confirmation_mode:
        values.confirmationMode,

      requires_deposit:
        values.requiresDeposit,

      deposit_type: values.depositType,
      deposit_value: values.depositValue,

      publicly_bookable:
        values.publiclyBookable,

      display_order: values.displayOrder,

      updated_at: now,
    })
    .eq("id", spaceId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId);

  if (updateError) {
    redirectToSpaces(
      "error",
      `No fue posible actualizar el espacio: ${updateError.message}`,
    );
  }

  const { error: deleteAvailabilityError } =
    await supabase
      .from("space_availability")
      .delete()
      .eq("space_id", spaceId)
      .eq("organization_id", context.organizationId)
      .eq("club_id", context.clubId);

  if (deleteAvailabilityError) {
    redirectToSpaces(
      "error",
      `El espacio se actualizó, pero no fue posible reemplazar sus horarios: ${deleteAvailabilityError.message}`,
    );
  }

  if (values.availability.length > 0) {
    const { error: insertAvailabilityError } =
      await supabase
        .from("space_availability")
        .insert(
          values.availability.map((availability) => ({
            organization_id: context.organizationId,
            club_id: context.clubId,
            space_id: spaceId,

            day_of_week: availability.day_of_week,
            start_time: availability.start_time,
            end_time: availability.end_time,

            location: availability.location || null,
            notes: availability.notes || null,

            active: true,

            created_at: now,
            updated_at: now,
          })),
        );

    if (insertAvailabilityError) {
      if (
        previousAvailability &&
        previousAvailability.length > 0
      ) {
        await supabase
          .from("space_availability")
          .insert(
            previousAvailability.map((availability) => ({
              organization_id: context.organizationId,
              club_id: context.clubId,
              space_id: spaceId,

              day_of_week: availability.day_of_week,
              start_time: availability.start_time,
              end_time: availability.end_time,

              location: availability.location,
              notes: availability.notes,
              active: availability.active,

              created_at: now,
              updated_at: now,
            })),
          );
      }

      redirectToSpaces(
        "error",
        `El espacio se actualizó, pero los nuevos horarios no pudieron guardarse: ${insertAvailabilityError.message}`,
      );
    }
  }

  revalidatePath("/panel/espacios");
  revalidatePath(`/panel/espacios/${spaceId}/editar`);

  redirectToSpaces(
    "success",
    "El espacio fue actualizado correctamente.",
  );
}

export async function toggleSpaceActive(
  spaceId: string,
  nextActive: boolean,
): Promise<void> {
  const context = await getAdminContext();

  if (!canManageSpaces(context.role)) {
    redirectToSpaces(
      "error",
      "Tu usuario no tiene permisos para administrar espacios.",
    );
  }

  if (!isUuid(spaceId)) {
    redirectToSpaces(
      "error",
      "El espacio indicado no es válido.",
    );
  }

  const supabase = createAdminClient();

  const { data, error } = await supabase
    .from("club_spaces")
    .update({
      active: nextActive,
      updated_at: new Date().toISOString(),
    })
    .eq("id", spaceId)
    .eq("organization_id", context.organizationId)
    .eq("club_id", context.clubId)
    .select("id")
    .maybeSingle();

  if (error || !data) {
    redirectToSpaces(
      "error",
      "No fue posible cambiar el estado del espacio.",
    );
  }

  revalidatePath("/panel/espacios");

  redirectToSpaces(
    "success",
    nextActive
      ? "El espacio fue activado."
      : "El espacio fue desactivado.",
  );
}