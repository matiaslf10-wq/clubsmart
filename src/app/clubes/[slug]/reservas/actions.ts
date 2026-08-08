"use server";

import { randomBytes } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  addDays,
  generateReservationSlots,
  parseReservationSlot,
  type AvailabilityRow,
  type ExistingReservation,
} from "@/lib/reservations/availability";

import { createAdminClient } from "@/lib/supabase/admin";

function readText(
  formData: FormData,
  field: string,
) {
  const value = formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
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
    randomBytes(8)
      .toString("hex")
      .toUpperCase()
  );
}

function redirectBack(
  slug: string,
  spaceSlug: string,
  selectedDate: string,
  message: string,
): never {
  const parameters =
    new URLSearchParams({
      fecha: selectedDate,
      error: message,
    });

  redirect(
    `/clubes/${slug}/reservas/${spaceSlug}?${parameters.toString()}`,
  );
}

export async function createPublicReservation(
  formData: FormData,
): Promise<void> {
  const slug =
    readText(
      formData,
      "club_slug",
    );

  const spaceSlug =
    readText(
      formData,
      "space_slug",
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

  const customerName =
    readText(
      formData,
      "customer_name",
    );

  const customerPhone =
    readText(
      formData,
      "customer_phone",
    );

  const customerEmail =
    readText(
      formData,
      "customer_email",
    ).toLowerCase();

  const notes =
    readText(
      formData,
      "notes",
    );

  if (
    !slug ||
    !spaceSlug
  ) {
    redirect("/");
  }

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      selectedDate,
    )
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "La fecha seleccionada no es válida.",
    );
  }

  if (
    selectedDate <
    getTodayBuenosAires()
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "No se pueden realizar reservas para una fecha pasada.",
    );
  }

  const selectedSlot =
    parseReservationSlot(
      slotValue,
    );

  if (!selectedSlot) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "Seleccioná un turno disponible.",
    );
  }

  if (
    selectedSlot.startDate !==
    selectedDate
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "El turno seleccionado no corresponde a la fecha elegida.",
    );
  }

  if (
    customerName.length < 2
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "Ingresá tu nombre y apellido.",
    );
  }

  if (
    customerPhone.length < 6
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "Ingresá un teléfono de contacto.",
    );
  }

  if (
    customerEmail &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
      customerEmail,
    )
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "El correo electrónico no tiene un formato válido.",
    );
  }

  const supabase =
    createAdminClient();

  const {
    data: club,
    error: clubError,
  } = await supabase
    .from("clubs")
    .select(`
      id,
      organization_id,
      slug,
      name
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (
    club(`
      id,
      organization_id,
      slug,
      name
    `)
    .eq("slug", slug)
    .maybeSingle();

  if (
    clubError ||
    !club
  ) {
    redirect("/");
  }

  const {
    data: space,
    error: spaceError,
  } = await supabase
    .from("club_spaces")
    .select(`
      id,
      slug,
      name,
      price,
      minimum_reservation_minutes,
      slot_interval_minutes,
      confirmation_mode,
      requires_deposit,
      deposit_type,
      deposit_value,
      active,
      publicly_bookable
    `)
    .eq(
      "organization_id",
      club.organization_id,
    )
    .eq(
      "club_id",
      club.id,
    )
    .eq(
      "slug",
      spaceSlug,
    )
    .eq(
      "active",
      true,
    )
    .eq(
      "publicly_bookable",
      true,
    )
    .maybeSingle();

  if (
    spaceError ||
    !space
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "Este espacio no se encuentra disponible para reservas públicas.",
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
        club.organization_id,
      )
      .eq(
        "club_id",
        club.id,
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
        club.organization_id,
      )
      .eq(
        "club_id",
        club.id,
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
    availabilityResult.error ||
    reservationsResult.error
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "No fue posible verificar la disponibilidad.",
    );
  }

  /*
   * Volvemos a generar los turnos en el servidor.
   * Nunca confiamos solamente en el turno que
   * seleccionó el navegador.
   */
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

  if (
    !slotStillAvailable
  ) {
    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      "Ese turno acaba de dejar de estar disponible. Elegí otro horario.",
    );
  }

  const amount =
    Number(
      space.price,
    );

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
        (
          depositValue /
          100
        );
    }

    depositAmount =
      Math.min(
        depositAmount,
        amount,
      );
  }

  /*
   * Confirmación automática solamente
   * cuando no requiere seña.
   *
   * Cuando conectemos el pago:
   * automática + seña
   * se confirmará después del pago.
   */
  const automaticConfirmation =
    space.confirmation_mode ===
      "automatic" &&
    !space.requires_deposit;

  const reservationCode =
    createReservationCode();

  const now =
    new Date().toISOString();

  const {
    data: reservation,
    error: reservationError,
  } = await supabase
    .from(
      "space_reservations",
    )
    .insert({
      organization_id:
        club.organization_id,

      club_id:
        club.id,

      space_id:
        space.id,

      member_id: null,

      reservation_code:
        reservationCode,

      customer_name:
        customerName,

      customer_email:
        customerEmail ||
        null,

      customer_phone:
        customerPhone,

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
        Number.isFinite(
          amount,
        )
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

      source:
        "public",

      notes:
        notes || null,

      created_by_user_id:
        null,

      confirmed_by_user_id:
        null,

      confirmed_at:
        automaticConfirmation
          ? now
          : null,

      created_at: now,
      updated_at: now,
    })
    .select(`
      id,
      reservation_code
    `)
    .single();

  if (
    reservationError ||
    !reservation
  ) {
    if (
      reservationError
        ?.code ===
      "23P01"
    ) {
      redirectBack(
        slug,
        spaceSlug,
        selectedDate,
        "Ese turno acaba de ser reservado por otra persona. Elegí otro horario.",
      );
    }

    redirectBack(
      slug,
      spaceSlug,
      selectedDate,
      `No fue posible crear la reserva: ${
        reservationError
          ?.message ??
        "Error desconocido."
      }`,
    );
  }

  revalidatePath(
    "/panel/reservas",
  );

  revalidatePath(
    `/clubes/${slug}/reservas`,
  );

  revalidatePath(
    `/clubes/${slug}/reservas/${spaceSlug}`,
  );

  redirect(
    `/clubes/${slug}/reservas/resultado?codigo=${encodeURIComponent(
      reservationCode,
    )}`,
  );
}