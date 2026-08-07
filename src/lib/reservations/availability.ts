export type AvailabilityRow = {
  day_of_week: number;
  start_time: string;
  end_time: string;
  ends_next_day: boolean;
};

export type ExistingReservation = {
  reservation_date: string;
  reservation_end_date: string;
  start_time: string;
  end_time: string;
  status: string;
};

export type ReservationSlot = {
  key: string;

  start_date: string;
  end_date: string;

  start_time: string;
  end_time: string;

  label: string;
};

const MINUTES_PER_DAY = 1440;

export function timeToMinutes(
  value: string,
) {
  const match =
    /^(\d{2}):(\d{2})/.exec(
      value,
    );

  if (!match) {
    return null;
  }

  const hours =
    Number(match[1]);

  const minutes =
    Number(match[2]);

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

function parseDate(
  value: string,
) {
  const match =
    /^(\d{4})-(\d{2})-(\d{2})$/.exec(
      value,
    );

  if (!match) {
    throw new Error(
      "La fecha no tiene un formato válido.",
    );
  }

  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

function dateToDayNumber(
  value: string,
) {
  const {
    year,
    month,
    day,
  } = parseDate(value);

  return Math.floor(
    Date.UTC(
      year,
      month - 1,
      day,
    ) /
      86_400_000,
  );
}

export function addDays(
  value: string,
  days: number,
) {
  const {
    year,
    month,
    day,
  } = parseDate(value);

  const date = new Date(
    Date.UTC(
      year,
      month - 1,
      day + days,
    ),
  );

  return [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0"),
    String(
      date.getUTCDate(),
    ).padStart(2, "0"),
  ].join("-");
}

function getDayOfWeek(
  value: string,
) {
  const {
    year,
    month,
    day,
  } = parseDate(value);

  const jsDay =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day,
        12,
      ),
    ).getUTCDay();

  /*
   * JavaScript:
   * domingo = 0
   *
   * ClubSmart:
   * lunes = 1
   * domingo = 7
   */
  return jsDay === 0
    ? 7
    : jsDay;
}

function absoluteMinutes(
  date: string,
  time: string,
) {
  const minutes =
    timeToMinutes(time);

  if (minutes === null) {
    throw new Error(
      "La hora no tiene un formato válido.",
    );
  }

  return (
    dateToDayNumber(date) *
      MINUTES_PER_DAY +
    minutes
  );
}

function absoluteToDateTime(
  value: number,
) {
  const dayNumber =
    Math.floor(
      value / MINUTES_PER_DAY,
    );

  const minutes =
    value -
    dayNumber *
      MINUTES_PER_DAY;

  const date = new Date(
    dayNumber *
      86_400_000,
  );

  const dateValue = [
    date.getUTCFullYear(),
    String(
      date.getUTCMonth() + 1,
    ).padStart(2, "0"),
    String(
      date.getUTCDate(),
    ).padStart(2, "0"),
  ].join("-");

  const hours =
    Math.floor(minutes / 60);

  const minute =
    minutes % 60;

  const timeValue =
    `${String(hours).padStart(
      2,
      "0",
    )}:${String(minute).padStart(
      2,
      "0",
    )}`;

  return {
    date: dateValue,
    time: timeValue,
  };
}

function intervalsOverlap(
  firstStart: number,
  firstEnd: number,
  secondStart: number,
  secondEnd: number,
) {
  return (
    firstStart < secondEnd &&
    secondStart < firstEnd
  );
}

function getReservationInterval(
  reservation: ExistingReservation,
) {
  return {
    start: absoluteMinutes(
      reservation.reservation_date,
      reservation.start_time,
    ),

    end: absoluteMinutes(
      reservation.reservation_end_date,
      reservation.end_time,
    ),
  };
}

export function generateReservationSlots({
  selectedDate,
  durationMinutes,
  intervalMinutes,
  availability,
  reservations,
}: {
  selectedDate: string;

  durationMinutes: number;
  intervalMinutes: number;

  availability: AvailabilityRow[];

  reservations: ExistingReservation[];
}) {
  const selectedDay =
    getDayOfWeek(
      selectedDate,
    );

  const previousDate =
    addDays(
      selectedDate,
      -1,
    );

  const previousDay =
    getDayOfWeek(
      previousDate,
    );

  const selectedDateStart =
    absoluteMinutes(
      selectedDate,
      "00:00",
    );

  const selectedDateEnd =
    selectedDateStart +
    MINUTES_PER_DAY;

  const reservationIntervals =
    reservations
      .filter((reservation) =>
        [
          "pending",
          "confirmed",
        ].includes(
          reservation.status,
        ),
      )
      .map(
        getReservationInterval,
      );

  const windows: Array<{
    start: number;
    end: number;
  }> = [];

  /*
   * Disponibilidad que comienza
   * en la fecha seleccionada.
   */
  for (
    const row of availability
  ) {
    if (
      row.day_of_week !==
      selectedDay
    ) {
      continue;
    }

    const start =
      absoluteMinutes(
        selectedDate,
        row.start_time,
      );

    let end =
      absoluteMinutes(
        selectedDate,
        row.end_time,
      );

    if (row.ends_next_day) {
      end += MINUTES_PER_DAY;
    }

    windows.push({
      start,
      end,
    });
  }

  /*
   * También consideramos la parte
   * posterior a medianoche de la
   * disponibilidad del día anterior.
   *
   * Ejemplo:
   * viernes 23:00–02:00
   *
   * al consultar sábado también
   * aparecerán 00:00, 00:30, 01:00...
   */
  for (
    const row of availability
  ) {
    if (
      row.day_of_week !==
        previousDay ||
      !row.ends_next_day
    ) {
      continue;
    }

    const start =
      absoluteMinutes(
        previousDate,
        row.start_time,
      );

    const end =
      absoluteMinutes(
        previousDate,
        row.end_time,
      ) +
      MINUTES_PER_DAY;

    windows.push({
      start,
      end,
    });
  }

  const slots =
    new Map<
      string,
      ReservationSlot
    >();

  for (
    const window of windows
  ) {
    let candidateStart =
      window.start;

    /*
     * Avanzamos hasta llegar al
     * día seleccionado.
     */
    while (
      candidateStart <
      selectedDateStart
    ) {
      candidateStart +=
        intervalMinutes;
    }

    while (
      candidateStart <
        selectedDateEnd &&
      candidateStart +
        durationMinutes <=
        window.end
    ) {
      const candidateEnd =
        candidateStart +
        durationMinutes;

      const hasConflict =
        reservationIntervals.some(
          (reservation) =>
            intervalsOverlap(
              candidateStart,
              candidateEnd,
              reservation.start,
              reservation.end,
            ),
        );

      if (!hasConflict) {
        const start =
          absoluteToDateTime(
            candidateStart,
          );

        const end =
          absoluteToDateTime(
            candidateEnd,
          );

        const nextDay =
          start.date !==
          end.date;

        const label =
          `${start.time}–${end.time}` +
          (nextDay
            ? " · termina al día siguiente"
            : "");

        const key =
          [
            start.date,
            start.time,
            end.date,
            end.time,
          ].join("|");

        slots.set(key, {
          key,

          start_date:
            start.date,

          end_date:
            end.date,

          start_time:
            start.time,

          end_time:
            end.time,

          label,
        });
      }

      candidateStart +=
        intervalMinutes;
    }
  }

  return Array.from(
    slots.values(),
  ).sort((first, second) =>
    `${first.start_date}-${first.start_time}`.localeCompare(
      `${second.start_date}-${second.start_time}`,
    ),
  );
}

export function parseReservationSlot(
  value: string,
) {
  const parts =
    value.split("|");

  if (
    parts.length !== 4
  ) {
    return null;
  }

  const [
    startDate,
    startTime,
    endDate,
    endTime,
  ] = parts;

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(
      startDate,
    ) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(
      endDate,
    ) ||
    timeToMinutes(
      startTime,
    ) === null ||
    timeToMinutes(
      endTime,
    ) === null
  ) {
    return null;
  }

  return {
    startDate,
    startTime,
    endDate,
    endTime,
  };
}