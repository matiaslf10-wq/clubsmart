"use server";

import {
  randomBytes,
} from "node:crypto";

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
  createAdminClient,
} from "@/lib/supabase/admin";

import {
  addDays,
  generateReservationSlots,
  parseReservationSlot,
  type AvailabilityRow,
  type ExistingReservation,
} from "@/lib/reservations/availability";

function canManageReservations(
  role: string,
) {
  return (
    role === "owner" ||
    role === "admin"
  );
}

function readText(
  formData: FormData,
  field: string,
) {
  const value =
    formData.get(field);

  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function getTodayBuenosAires() {
  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "America/Argentina/Buenos_Aires",

      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    },
  ).format(new Date());
}

function createReservationCode() {
  return (
    "RES-" +
    randomBytes(5)
      .toString("hex")
      .toUpperCase()
  );
}

function redirectToNewReservation(
  type:
    | "error"
    | "success",
  message: string,
  spaceId?: string,
  date?: string,
): never {
  const parameters =
    new URLSearchParams({
      [type]: message,
    });

  if (spaceId) {
    parameters.set(
      "espacio",
      spaceId,
    );
  }

  if (date) {
    parameters.set(
      "fecha",
      date,
    );
  }

  redirect(
    `/panel/reservas/nueva?${parameters.toString()}`,
  );
}

export async function createManualReservation(
  formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  const spaceId =
    readText(
      formData,
      "space_id",
    );

  const selectedDate =
    readText(
      formData,
      "selected_date",
    );

  const slotValue =
    readText(
      formData,
      "slot",
    );

  if (
    !canManageReservations(
      context.role,
    )
  ) {
    redirectToNewReservation(
      "error",
      "Tu usuario no tiene permisos para crear reservas.",
      spaceId,
      selectedDate,
    );
  }

  if (!isUuid(spaceId)) {
    redirectToNewReservation(
      "error",
      "El espacio seleccionado no es válido.",
    );
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      selectedDate,
    )
  ) {
    redirectToNewReservation(
      "error",
      "La fecha seleccionada no es válida.",
      spaceId,
    );
  }

  if (
    selectedDate <
    getTodayBuenosAires()
  ) {
    redirectToNewReservation(
      "error",
      "No se pueden crear reservas en una fecha pasada.",
      spaceId,
      selectedDate,
    );
  }

  const selectedSlot =
    parseReservationSlot(
      slotValue,
    );

  if (!selectedSlot) {
    redirectToNewReservation(
      "error",
      "Seleccioná un turno disponible.",
      spaceId,
      selectedDate,
    );
  }

  /*
   * No aceptamos que el navegador
   * envíe un turno de otra fecha.
   */
  if (
    selectedSlot.startDate !==
    selectedDate
  ) {
    redirectToNewReservation(
      "error",
      "El turno seleccionado no corresponde a la fecha indicada.",
      spaceId,
      selectedDate,
    );
  }

  const memberId =
    readText(
      formData,
      "member_id",
    );

  const enteredName =
    readText(
      formData,
      "customer_name",
    );

  const customerEmail =
    readText(
      formData,
      "customer_email",
    );

  const customerPhone =
    readText(
      formData,
      "customer_phone",
    );

  const notes =
    readText(
      formData,
      "notes",
    );

  const supabase =
    createAdminClient();

  const {
    data: space,
    error: spaceError,
  } = await supabase
    .from("club_spaces")
    .select(`
      id,
      name,
      price,
      minimum_reservation_minutes,
      slot_interval_minutes,
      confirmation_mode,
      requires_deposit,
      deposit_type,
      deposit_value,
      active
    `)
    .eq("id", spaceId)
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .eq("active", true)
    .maybeSingle();

  if (
    spaceError ||
    !space
  ) {
    redirectToNewReservation(
      "error",
      "El espacio no existe o está inactivo.",
      spaceId,
      selectedDate,
    );
  }

  const previousDate =
    addDays(
      selectedDate,
      -1,
    );

  const nextDate =
    addDays(
      selectedDate,
      1,
    );

  const [
    availabilityResult,
    reservationsResult,
  ] = await Promise.all([
    supabase
      .from(
        "space_availability",
      )
      .select(`
        day_of_week,
        start_time,
        end_time,
        ends_next_day
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .eq(
        "space_id",
        space.id,
      )
      .eq(
        "active",
        true,
      ),

    supabase
      .from(
        "space_reservations",
      )
      .select(`
        reservation_date,
        reservation_end_date,
        start_time,
        end_time,
        status
      `)
      .eq(
        "organization_id",
        context.organizationId,
      )
      .eq(
        "club_id",
        context.clubId,
      )
      .eq(
        "space_id",
        space.id,
      )
      .gte(
        "reservation_date",
        previousDate,
      )
      .lte(
        "reservation_date",
        nextDate,
      )
      .in(
        "status",
        [
          "pending",
          "confirmed",
        ],
      ),
  ]);

  if (
    availabilityResult.error
  ) {
    redirectToNewReservation(
      "error",
      `No fue posible consultar la disponibilidad: ${availabilityResult.error.message}`,
      spaceId,
      selectedDate,
    );
  }

  if (
    reservationsResult.error
  ) {
    redirectToNewReservation(
      "error",
      `No fue posible verificar las reservas existentes: ${reservationsResult.error.message}`,
      spaceId,
      selectedDate,
    );
  }

  const availableSlots =
    generateReservationSlots({
      selectedDate,

      durationMinutes:
        space.minimum_reservation_minutes,

      intervalMinutes:
        space.slot_interval_minutes,

      availability:
        (
          availabilityResult.data ??
          []
        ) as AvailabilityRow[],

      reservations:
        (
          reservationsResult.data ??
          []
        ) as ExistingReservation[],
    });

  const slotStillAvailable =
    availableSlots.some(
      (slot) =>
        slot.key ===
        slotValue,
    );

  if (!slotStillAvailable) {
    redirectToNewReservation(
      "error",
      "Ese turno ya no está disponible. Elegí otro horario.",
      spaceId,
      selectedDate,
    );
  }

  let finalMemberId:
    | string
    | null = null;

  let customerName =
    enteredName;

  if (memberId) {
    if (!isUuid(memberId)) {
      redirectToNewReservation(
        "error",
        "La persona seleccionada no es válida.",
        spaceId,
        selectedDate,
      );
    }

    const {
      data: member,
      error: memberError,
    } = await supabase
      .from("members")
      .select(`
        id,
        first_name,
        last_name,
        active
      `)
      .eq(
        "id",
        memberId,
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
        "active",
        true,
      )
      .maybeSingle();

    if (
      memberError ||
      !member
    ) {
      redirectToNewReservation(
        "error",
        "La persona seleccionada no existe o está inactiva.",
        spaceId,
        selectedDate,
      );
    }

    finalMemberId =
      member.id;

    customerName =
      `${member.first_name} ${member.last_name}`;
  }

  if (
    customerName.length < 2
  ) {
    redirectToNewReservation(
      "error",
      "Ingresá el nombre de la persona que realiza la reserva.",
      spaceId,
      selectedDate,
    );
  }

  if (
    customerEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      customerEmail,
    )
  ) {
    redirectToNewReservation(
      "error",
      "El correo electrónico no tiene un formato válido.",
      spaceId,
      selectedDate,
    );
  }

  const amount =
    Number(space.price);

  const depositValue =
    Number(
      space.deposit_value,
    );

  let depositAmount = 0;

  if (
    space.requires_deposit
  ) {
    if (
      space.deposit_type ===
      "fixed"
    ) {
      depositAmount =
        depositValue;
    }

    if (
      space.deposit_type ===
      "percentage"
    ) {
      depositAmount =
        amount *
        (depositValue / 100);
    }

    depositAmount =
      Math.min(
        depositAmount,
        amount,
      );
  }

  /*
   * Si el espacio es automático,
   * pero requiere seña, dejamos
   * pendiente hasta incorporar
   * el pago.
   */
  const automaticConfirmation =
    space.confirmation_mode ===
      "automatic" &&
    !space.requires_deposit;

  const now =
    new Date().toISOString();

  const {
    data: reservation,
    error: insertError,
  } = await supabase
    .from(
      "space_reservations",
    )
    .insert({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      space_id:
        space.id,

      member_id:
        finalMemberId,

      reservation_code:
        createReservationCode(),

      customer_name:
        customerName,

      customer_email:
        customerEmail || null,

      customer_phone:
        customerPhone || null,

      reservation_date:
        selectedSlot.startDate,

      reservation_end_date:
        selectedSlot.endDate,

      start_time:
        selectedSlot.startTime,

      end_time:
        selectedSlot.endTime,

      status:
        automaticConfirmation
          ? "confirmed"
          : "pending",

      amount:
        Number.isFinite(amount)
          ? amount
          : 0,

      deposit_amount:
        Number.isFinite(
          depositAmount,
        )
          ? depositAmount
          : 0,

      paid_amount: 0,

      payment_status:
        "unpaid",

      source: "panel",

      notes:
        notes || null,

      created_by_user_id:
        context.userId,

      confirmed_by_user_id:
        automaticConfirmation
          ? context.userId
          : null,

      confirmed_at:
        automaticConfirmation
          ? now
          : null,

      created_at: now,
      updated_at: now,
    })
    .select("id")
    .single();

  if (
    insertError ||
    !reservation
  ) {
    /*
     * PostgreSQL exclusion constraint:
     * dos reservas superpuestas.
     */
    if (
      insertError?.code ===
      "23P01"
    ) {
      redirectToNewReservation(
        "error",
        "Ese turno acaba de ser reservado. Elegí otro horario.",
        spaceId,
        selectedDate,
      );
    }

    redirectToNewReservation(
      "error",
      `No fue posible crear la reserva: ${
        insertError?.message ??
        "Error desconocido."
      }`,
      spaceId,
      selectedDate,
    );
  }

  revalidatePath(
    "/panel/reservas",
  );

  revalidatePath(
    "/panel/reservas/nueva",
  );

  redirect(
    `/panel/reservas?fecha=${selectedDate}&success=${encodeURIComponent(
      "La reserva fue creada correctamente.",
    )}`,
  );
}