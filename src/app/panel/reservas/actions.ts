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
type ReservationReturnView =
  | "dia"
  | "semana"
  | "pendientes";

function normalizeReservationView(
  value: string,
): ReservationReturnView {
  if (value === "semana") {
    return "semana";
  }

  if (value === "pendientes") {
    return "pendientes";
  }

  return "dia";
}

function redirectToReservations(
  returnDate: string,
  view: string,
  type: "success" | "error",
  message: string,
): never {
  const normalizedView =
    normalizeReservationView(view);

  const parameters =
    new URLSearchParams({
      [type]: message,
    });

  if (
    normalizedView ===
    "pendientes"
  ) {
    redirect(
      `/panel/reservas/pendientes?${parameters.toString()}`,
    );
  }

  parameters.set(
    "fecha",
    returnDate,
  );

  parameters.set(
    "vista",
    normalizedView,
  );

  redirect(
    `/panel/reservas?${parameters.toString()}`,
  );
}

async function updateReservationStatus({
  reservationId,
  context,
  allowedStatuses,
  nextStatus,
}: {
  reservationId: string;

  context: Awaited<
    ReturnType<
      typeof getAdminContext
    >
  >;

  allowedStatuses: string[];

  nextStatus:
    | "confirmed"
    | "rejected"
    | "cancelled";
}) {
  const supabase =
    createAdminClient();

  const {
    data: reservation,
    error: reservationError,
  } = await supabase
    .from(
      "space_reservations",
    )
    .select(`
      id,
      status
    `)
    .eq(
      "id",
      reservationId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .maybeSingle();

  if (
    reservationError ||
    !reservation
  ) {
    throw new Error(
      "La reserva no existe o no pertenece a este club.",
    );
  }

  if (
    !allowedStatuses.includes(
      reservation.status,
    )
  ) {
    throw new Error(
      "La reserva cambió de estado y ya no puede realizarse esta acción.",
    );
  }

  const now =
    new Date().toISOString();

  const updateValues: Record<
    string,
    unknown
  > = {
    status: nextStatus,
    updated_at: now,
  };

  if (
    nextStatus ===
    "confirmed"
  ) {
    updateValues.confirmed_at =
      now;

    updateValues.confirmed_by_user_id =
      context.userId;
  }

  if (
    nextStatus ===
    "rejected"
  ) {
    updateValues.rejected_at =
      now;
  }

  if (
    nextStatus ===
    "cancelled"
  ) {
    updateValues.cancelled_at =
      now;
  }

  const {
    data: updatedReservation,
    error: updateError,
  } = await supabase
    .from(
      "space_reservations",
    )
    .update(updateValues)
    .eq(
      "id",
      reservationId,
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
      reservation.status,
    )
    .select("id")
    .maybeSingle();

  if (
    updateError ||
    !updatedReservation
  ) {
    throw new Error(
      "No fue posible modificar la reserva. Es posible que haya cambiado mientras la estabas revisando.",
    );
  }

  revalidatePath(
  "/panel/reservas",
);

revalidatePath(
  "/panel/reservas/nueva",
);

revalidatePath(
  "/panel/reservas/pendientes",
);

revalidatePath(
  "/panel",
  "layout",
);
}

export async function confirmReservation(
  reservationId: string,
  returnDate: string,
  view: string,
  _formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManageReservations(
      context.role,
    )
  ) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      "Tu usuario no tiene permisos para confirmar reservas.",
    );
  }

  if (
    !isUuid(reservationId)
  ) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      "La reserva indicada no es válida.",
    );
  }

  try {
    await updateReservationStatus({
      reservationId,
      context,
      allowedStatuses: [
        "pending",
      ],
      nextStatus:
        "confirmed",
    });
  } catch (error) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      error instanceof Error
        ? error.message
        : "No fue posible confirmar la reserva.",
    );
  }

  redirectToReservations(
    returnDate,
    view,
    "success",
    "La reserva fue confirmada.",
  );
}

export async function rejectReservation(
  reservationId: string,
  returnDate: string,
  view: string,
  _formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManageReservations(
      context.role,
    )
  ) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      "Tu usuario no tiene permisos para rechazar reservas.",
    );
  }

  if (
    !isUuid(reservationId)
  ) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      "La reserva indicada no es válida.",
    );
  }

  try {
    await updateReservationStatus({
      reservationId,
      context,
      allowedStatuses: [
        "pending",
      ],
      nextStatus:
        "rejected",
    });
  } catch (error) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      error instanceof Error
        ? error.message
        : "No fue posible rechazar la reserva.",
    );
  }

  redirectToReservations(
    returnDate,
    view,
    "success",
    "La reserva fue rechazada y el turno volvió a quedar disponible.",
  );
}

export async function cancelReservation(
  reservationId: string,
  returnDate: string,
  view: string,
  _formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManageReservations(
      context.role,
    )
  ) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      "Tu usuario no tiene permisos para cancelar reservas.",
    );
  }

  if (
    !isUuid(reservationId)
  ) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      "La reserva indicada no es válida.",
    );
  }

  try {
    await updateReservationStatus({
      reservationId,
      context,
      allowedStatuses: [
        "pending",
        "confirmed",
      ],
      nextStatus:
        "cancelled",
    });
  } catch (error) {
    redirectToReservations(
      returnDate,
      view,
      "error",
      error instanceof Error
        ? error.message
        : "No fue posible cancelar la reserva.",
    );
  }

  redirectToReservations(
    returnDate,
    view,
    "success",
    "La reserva fue cancelada y el turno volvió a quedar disponible.",
  );
}
const allowedManualPaymentMethods =
  new Set([
    "cash",
    "transfer",
    "debit_card",
    "credit_card",
    "mercado_pago",
    "pagotic",
    "other",
  ]);

function parseMoney(
  value: string,
) {
  const normalized =
    value
      .trim()
      .replace(/\s/g, "")
      .replace(
        /\.(?=\d{3}(?:[,.]|$))/g,
        "",
      )
      .replace(",", ".");

  const amount =
    Number(normalized);

  return Number.isFinite(
    amount,
  )
    ? amount
    : null;
}

function moneyToCents(
  value: number,
) {
  return Math.round(
    value * 100,
  );
}

function redirectToReservation(
  reservationId: string,
  type:
    | "success"
    | "error",
  message: string,
): never {
  const parameters =
    new URLSearchParams({
      [type]: message,
    });

  redirect(
    `/panel/reservas/${reservationId}?${parameters.toString()}`,
  );
}

export async function recordManualReservationPayment(
  reservationId: string,
  formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManageReservations(
      context.role,
    )
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "Tu usuario no tiene permisos para registrar pagos.",
    );
  }

  if (
    !isUuid(
      reservationId,
    )
  ) {
    redirect(
      "/panel/reservas",
    );
  }

  const amountText =
    readText(
      formData,
      "amount",
    );

  const paymentMethod =
    readText(
      formData,
      "payment_method",
    );

  const externalReference =
    readText(
      formData,
      "external_reference",
    );

  const notes =
    readText(
      formData,
      "notes",
    );

  const amount =
    parseMoney(
      amountText,
    );

  if (
    amount === null ||
    amount <= 0
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "El importe debe ser mayor que cero.",
    );
  }

  if (
    !allowedManualPaymentMethods.has(
      paymentMethod,
    )
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "El medio de pago seleccionado no es válido.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: reservation,
    error: reservationError,
  } = await supabase
    .from(
      "space_reservations",
    )
    .select(`
      id,
      status,
      amount,
      paid_amount
    `)
    .eq(
      "id",
      reservationId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .maybeSingle();

  if (
    reservationError ||
    !reservation
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "La reserva no existe o no pertenece a este club.",
    );
  }

  if (
    [
      "rejected",
      "cancelled",
    ].includes(
      reservation.status,
    )
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "No se pueden registrar pagos sobre una reserva rechazada o cancelada.",
    );
  }

  const reservationAmount =
    Number(
      reservation.amount,
    );

  const paidAmount =
    Number(
      reservation.paid_amount,
    );

  const remainingAmount =
    Math.max(
      reservationAmount -
        paidAmount,
      0,
    );

  if (
    moneyToCents(
      amount,
    ) >
    moneyToCents(
      remainingAmount,
    )
  ) {
    redirectToReservation(
      reservationId,
      "error",
      `El pago supera el saldo pendiente de la reserva.`,
    );
  }

  const now =
    new Date().toISOString();

  const {
    error: paymentError,
  } = await supabase
    .from(
      "reservation_payments",
    )
    .insert({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      reservation_id:
        reservationId,

      amount,

      status:
        "approved",

      source:
        "manual",

      payment_method:
        paymentMethod,

      /*
       * Aunque el administrador
       * seleccione Mercado Pago o
       * Pago TIC como medio, sigue
       * siendo una carga manual.
       *
       * provider se usará cuando
       * el pago provenga realmente
       * de la API/webhook.
       */
      provider: null,

      provider_payment_id:
        null,

      external_reference:
        externalReference ||
        null,

      provider_status:
        null,

      paid_at: now,

      notes:
        notes || null,

      metadata: {
        registered_manually:
          true,
      },

      created_by_user_id:
        context.userId,

      created_at: now,
      updated_at: now,
    });

  if (paymentError) {
    redirectToReservation(
      reservationId,
      "error",
      `No fue posible registrar el pago: ${paymentError.message}`,
    );
  }

  revalidatePath(
    `/panel/reservas/${reservationId}`,
  );

  revalidatePath(
    "/panel/reservas",
  );

  revalidatePath(
    "/panel/reservas/pendientes",
  );

  revalidatePath(
    "/panel",
    "layout",
  );

  redirectToReservation(
    reservationId,
    "success",
    "El pago fue registrado correctamente.",
  );
}

export async function cancelManualReservationPayment(
  paymentId: string,
  reservationId: string,
  _formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canManageReservations(
      context.role,
    )
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "Tu usuario no tiene permisos para anular pagos.",
    );
  }

  if (
    !isUuid(
      paymentId,
    ) ||
    !isUuid(
      reservationId,
    )
  ) {
    redirect(
      "/panel/reservas",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: payment,
    error: paymentError,
  } = await supabase
    .from(
      "reservation_payments",
    )
    .select(`
      id,
      reservation_id,
      source,
      status
    `)
    .eq(
      "id",
      paymentId,
    )
    .eq(
      "reservation_id",
      reservationId,
    )
    .eq(
      "organization_id",
      context.organizationId,
    )
    .eq(
      "club_id",
      context.clubId,
    )
    .maybeSingle();

  if (
    paymentError ||
    !payment
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "El pago no existe.",
    );
  }

  if (
    payment.source !==
      "manual" ||
    payment.status !==
      "approved"
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "Solamente pueden anularse pagos manuales aprobados.",
    );
  }

  const now =
    new Date().toISOString();

  const {
    data: updatedPayment,
    error: updateError,
  } = await supabase
    .from(
      "reservation_payments",
    )
    .update({
      status:
        "cancelled",

      cancelled_at:
        now,

      updated_at:
        now,
    })
    .eq(
      "id",
      paymentId,
    )
    .eq(
      "status",
      "approved",
    )
    .select("id")
    .maybeSingle();

  if (
    updateError ||
    !updatedPayment
  ) {
    redirectToReservation(
      reservationId,
      "error",
      "No fue posible anular el pago.",
    );
  }

  revalidatePath(
    `/panel/reservas/${reservationId}`,
  );

  revalidatePath(
    "/panel/reservas",
  );

  revalidatePath(
    "/panel/reservas/pendientes",
  );

  redirectToReservation(
    reservationId,
    "success",
    "El pago fue anulado y el saldo de la reserva fue recalculado.",
  );
}