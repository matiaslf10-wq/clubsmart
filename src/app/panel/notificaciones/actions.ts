"use server";

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
  canSendNotifications,
} from "@/lib/auth/permissions";

import {
  createAdminClient,
} from "@/lib/supabase/admin";

type AudienceType =
  | "all_members"
  | "activity"
  | "reservation";

  type DeliveryChannel =
  | "email"
  | "whatsapp";

type RecipientRow = {
  member_id: string | null;
  reservation_id: string | null;

  recipient_name: string;

  recipient_email: string | null;
  recipient_phone: string | null;
};

function readText(
  formData: FormData,
  name: string,
) {
  const value =
    formData.get(name);

  return typeof value ===
    "string"
    ? value.trim()
    : "";
}

function readDeliveryChannels(
  formData: FormData,
): DeliveryChannel[] {
  const values =
    formData.getAll(
      "channels",
    );

  const channels =
    values.filter(
      (
        value,
      ): value is DeliveryChannel =>
        value === "email" ||
        value === "whatsapp",
    );

  return [
    ...new Set(
      channels,
    ),
  ];
}

function isUuid(
  value: string,
) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value,
  );
}

function isAudienceType(
  value: string,
): value is AudienceType {
  return (
    value ===
      "all_members" ||
    value ===
      "activity" ||
    value ===
      "reservation"
  );
}

function redirectToNewNotification(
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
    `/panel/notificaciones/nueva?${parameters.toString()}`,
  );
}

function getSingleRelation<T>(
  value:
    | T
    | T[]
    | null,
): T | null {
  if (
    Array.isArray(value)
  ) {
    return value[0] ?? null;
  }

  return value;
}

export async function createNotification(
  formData: FormData,
): Promise<void> {
  const context =
    await getAdminContext();

  if (
    !canSendNotifications(
      context.role,
    )
  ) {
    redirect("/panel");
  }

  const audienceType =
    readText(
      formData,
      "audience_type",
    );

  const activityId =
    readText(
      formData,
      "activity_id",
    );

  const reservationId =
    readText(
      formData,
      "reservation_id",
    );

  const title =
    readText(
      formData,
      "title",
    );

  const body =
    readText(
      formData,
      "body",
    );

    const deliveryChannels =
  readDeliveryChannels(
    formData,
  );

  if (
    !isAudienceType(
      audienceType,
    )
  ) {
    redirectToNewNotification(
      "error",
      "Seleccioná un tipo de destinatario válido.",
    );
  }

  if (
    title.length < 3
  ) {
    redirectToNewNotification(
      "error",
      "El título debe tener al menos 3 caracteres.",
    );
  }

  if (
    title.length > 120
  ) {
    redirectToNewNotification(
      "error",
      "El título no puede superar los 120 caracteres.",
    );
  }

  if (
    body.length < 3
  ) {
    redirectToNewNotification(
      "error",
      "El mensaje debe tener al menos 3 caracteres.",
    );
  }

  if (
    body.length > 3000
  ) {
    redirectToNewNotification(
      "error",
      "El mensaje no puede superar los 3000 caracteres.",
    );
  }

if (
  deliveryChannels.length ===
  0
) {
  redirectToNewNotification(
    "error",
    "Seleccioná al menos un canal de comunicación.",
  );
}

  const supabase =
    createAdminClient();

  let recipients:
    RecipientRow[] = [];

  let notificationActivityId:
    string | null = null;

  let notificationReservationId:
    string | null = null;

  /*
   * ======================================
   * ACTIVIDAD
   * ======================================
   */
  if (
    audienceType ===
    "activity"
  ) {
    if (
      !isUuid(activityId)
    ) {
      redirectToNewNotification(
        "error",
        "Seleccioná una actividad.",
      );
    }

    /*
     * Primero verificamos que la actividad
     * realmente pertenezca al club.
     */
    const {
      data: activity,
      error: activityError,
    } = await supabase
      .from("activities")
      .select(
        "id, name",
      )
      .eq(
        "id",
        activityId,
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
      activityError ||
      !activity
    ) {
      redirectToNewNotification(
        "error",
        "La actividad seleccionada no existe.",
      );
    }

    const {
      data:
        enrollments,
      error:
        enrollmentsError,
    } = await supabase
      .from(
        "member_activities",
      )
      .select(`
        member_id,

        members (
          id,
          first_name,
          last_name,
          email,
          phone,
          active
        )
      `)
      .eq(
        "activity_id",
        activityId,
      );

    if (
      enrollmentsError
    ) {
      redirectToNewNotification(
        "error",
        `No fue posible obtener los inscriptos: ${enrollmentsError.message}`,
      );
    }

    /*
     * Map evita duplicados por miembro.
     */
    const recipientMap =
      new Map<
        string,
        RecipientRow
      >();

    for (
      const enrollment of
        enrollments ?? []
    ) {
      const member =
        getSingleRelation(
          enrollment.members,
        );

      if (
        !member ||
        !member.active
      ) {
        continue;
      }

      recipientMap.set(
        member.id,
        {
          member_id:
            member.id,

          reservation_id:
            null,

          recipient_name:
            `${member.first_name} ${member.last_name}`.trim(),

          /*
           * Por ahora no asumimos
           * que members tenga email
           * o teléfono.
           *
           * Más adelante los canales
           * de entrega se resolverán
           * desde el perfil/contacto.
           */
          recipient_email:
  member.email ??
  null,

recipient_phone:
  member.phone ??
  null,
        },
      );
    }

    recipients =
      Array.from(
        recipientMap.values(),
      );

    notificationActivityId =
      activityId;
  }

  /*
   * ======================================
   * RESERVA
   * ======================================
   */
  if (
    audienceType ===
    "reservation"
  ) {
    if (
      !isUuid(
        reservationId,
      )
    ) {
      redirectToNewNotification(
        "error",
        "Seleccioná una reserva.",
      );
    }

    const {
      data: reservation,
      error: reservationError,
    } = await supabase
      .from(
        "space_reservations",
      )
      .select(`
        id,
        customer_name,
        customer_email,
        customer_phone,
        member_id
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
      redirectToNewNotification(
        "error",
        "La reserva seleccionada no existe.",
      );
    }

    recipients = [
      {
        member_id:
          reservation.member_id ??
          null,

        reservation_id:
          reservation.id,

        recipient_name:
          reservation.customer_name,

        recipient_email:
          reservation.customer_email ??
          null,

        recipient_phone:
          reservation.customer_phone ??
          null,
      },
    ];

    notificationReservationId =
      reservation.id;
  }

  /*
   * ======================================
   * TODO EL CLUB
   * ======================================
   */
  if (
    audienceType ===
    "all_members"
  ) {
    const {
      data: members,
      error: membersError,
    } = await supabase
      .from("members")
      .select(`
        id,
        first_name,
        last_name,
        email,
        phone,
        active
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
        "active",
        true,
      )
      .order(
        "last_name",
        {
          ascending: true,
        },
      );

    if (
      membersError
    ) {
      redirectToNewNotification(
        "error",
        `No fue posible obtener las personas del club: ${membersError.message}`,
      );
    }

    recipients =
      (members ?? []).map(
        (member) => ({
          member_id:
            member.id,

          reservation_id:
            null,

          recipient_name:
            `${member.first_name} ${member.last_name}`.trim(),

          recipient_email:
  member.email ??
  null,

recipient_phone:
  member.phone ??
  null,
        }),
      );
  }

  if (
    recipients.length === 0
  ) {
    redirectToNewNotification(
      "error",
      "No encontramos destinatarios activos para esta notificación.",
    );
  }

  const emailRecipientCount =
  recipients.filter(
    (recipient) =>
      Boolean(
        recipient.recipient_email,
      ),
  ).length;

const whatsappRecipientCount =
  recipients.filter(
    (recipient) =>
      Boolean(
        recipient.recipient_phone,
      ),
  ).length;

const plannedDeliveryCount =
  (
    deliveryChannels.includes(
      "email",
    )
      ? emailRecipientCount
      : 0
  ) +
  (
    deliveryChannels.includes(
      "whatsapp",
    )
      ? whatsappRecipientCount
      : 0
  );

if (
  plannedDeliveryCount === 0
) {
  redirectToNewNotification(
    "error",
    "Ninguno de los destinatarios tiene datos de contacto para los canales seleccionados.",
  );
}

  const now =
    new Date().toISOString();

  /*
   * Primero creamos la notificación.
   */
  const {
    data:
      notification,
    error:
      notificationError,
  } = await supabase
    .from(
      "club_notifications",
    )
    .insert({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      created_by_user_id:
        context.userId,

      audience_type:
        audienceType,

      activity_id:
        notificationActivityId,

      reservation_id:
        notificationReservationId,

      title,

      body,

      status:
        "published",

      published_at:
        now,

      metadata: {
  recipient_count:
    recipients.length,

  delivery_channels:
    deliveryChannels,

  email_recipient_count:
    emailRecipientCount,

  whatsapp_recipient_count:
    whatsappRecipientCount,
},

      created_at:
        now,

      updated_at:
        now,
    })
    .select("id")
    .single();

  if (
    notificationError ||
    !notification
  ) {
    redirectToNewNotification(
      "error",
      `No fue posible publicar la notificación: ${notificationError?.message ?? "Error desconocido"}`,
    );
  }

  /*
   * Después congelamos quiénes eran
   * los destinatarios en ese momento.
   */
  const recipientRows =
    recipients.map(
      (recipient) => ({
        notification_id:
          notification.id,

        organization_id:
          context.organizationId,

        club_id:
          context.clubId,

        member_id:
          recipient.member_id,

        reservation_id:
          recipient.reservation_id,

        recipient_name:
          recipient.recipient_name,

        recipient_email:
          recipient.recipient_email,

        recipient_phone:
          recipient.recipient_phone,
      }),
    );

  const {
  data:
    savedRecipients,
  error:
    recipientsError,
} = await supabase
  .from(
    "club_notification_recipients",
  )
  .insert(
    recipientRows,
  )
  .select(`
    id,
    recipient_email,
    recipient_phone
  `);

  if (
    recipientsError
  ) {
    /*
     * Si falló la creación de destinatarios,
     * eliminamos la notificación para evitar
     * que quede publicada sin audiencia.
     */
    await supabase
      .from(
        "club_notifications",
      )
      .delete()
      .eq(
        "id",
        notification.id,
      );

    redirectToNewNotification(
      "error",
      `No fue posible crear los destinatarios: ${recipientsError.message}`,
    );
  }

  const deliveryRows = [];

for (
  const recipient of
    savedRecipients ?? []
) {
  if (
    deliveryChannels.includes(
      "email",
    ) &&
    recipient.recipient_email
  ) {
    deliveryRows.push({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      notification_id:
        notification.id,

      recipient_id:
        recipient.id,

      channel:
        "email",

      status:
        "pending",

      destination:
        recipient.recipient_email,

      metadata: {},
    });
  }

  if (
    deliveryChannels.includes(
      "whatsapp",
    ) &&
    recipient.recipient_phone
  ) {
    deliveryRows.push({
      organization_id:
        context.organizationId,

      club_id:
        context.clubId,

      notification_id:
        notification.id,

      recipient_id:
        recipient.id,

      channel:
        "whatsapp",

      status:
        "pending",

      destination:
        recipient.recipient_phone,

      metadata: {},
    });
  }
}

if (
  deliveryRows.length === 0
) {
  await supabase
    .from(
      "club_notifications",
    )
    .delete()
    .eq(
      "id",
      notification.id,
    );

  redirectToNewNotification(
    "error",
    "No fue posible generar ninguna entrega para los canales seleccionados.",
  );
}

const {
  error:
    deliveriesError,
} = await supabase
  .from(
    "notification_deliveries",
  )
  .insert(
    deliveryRows,
  );

if (
  deliveriesError
) {
  await supabase
    .from(
      "club_notifications",
    )
    .delete()
    .eq(
      "id",
      notification.id,
    );

  redirectToNewNotification(
    "error",
    `No fue posible preparar las entregas: ${deliveriesError.message}`,
  );
}

  revalidatePath(
    "/panel/notificaciones",
  );

  revalidatePath(
    "/panel",
    "layout",
  );

  redirect(
    `/panel/notificaciones?success=${encodeURIComponent(
      `Notificación publicada para ${recipients.length} ${
  recipients.length === 1
    ? "persona"
    : "personas"
}. ${deliveryRows.length} ${
  deliveryRows.length === 1
    ? "entrega preparada"
    : "entregas preparadas"
}.`
    )}`,
  );
}