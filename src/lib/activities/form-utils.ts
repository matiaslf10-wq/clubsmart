export const activityLevels = [
  "basico",
  "intermedio",
  "avanzado",
  "recreativo",
  "competitivo",
] as const;

export type ActivityLevel =
  (typeof activityLevels)[number];

export type ScheduleInput = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locationName: string;
};

export function readText(
  formData: FormData,
  field: string,
) {
  const value = formData.get(field);

  return typeof value === "string"
    ? value.trim()
    : "";
}

export function readOptionalNumber(
  formData: FormData,
  field: string,
) {
  const value = readText(formData, field);

  if (!value) {
    return null;
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : null;
}

export function createSlug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function readSchedules(
  formData: FormData,
): ScheduleInput[] {
  const rawValue = readText(
    formData,
    "schedules_json",
  );

  if (!rawValue) {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(rawValue);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed
      .map((item): ScheduleInput | null => {
        if (
          typeof item !== "object" ||
          item === null
        ) {
          return null;
        }

        const record = item as Record<
          string,
          unknown
        >;

        const dayOfWeek = Number(
          record.dayOfWeek,
        );

        const startTime =
          typeof record.startTime === "string"
            ? record.startTime.trim()
            : "";

        const endTime =
          typeof record.endTime === "string"
            ? record.endTime.trim()
            : "";

        const locationName =
          typeof record.locationName === "string"
            ? record.locationName.trim()
            : "";

        if (
          !Number.isInteger(dayOfWeek) ||
          dayOfWeek < 1 ||
          dayOfWeek > 7 ||
          !startTime ||
          !endTime
        ) {
          return null;
        }

        return {
          dayOfWeek,
          startTime,
          endTime,
          locationName,
        };
      })
      .filter(
        (
          schedule,
        ): schedule is ScheduleInput =>
          schedule !== null,
      );
  } catch {
    return [];
  }
}

export function validateSchedules(
  schedules: ScheduleInput[],
) {
  if (schedules.length === 0) {
    return "Agregá al menos un día y horario.";
  }

  for (const schedule of schedules) {
    if (schedule.endTime <= schedule.startTime) {
      return "La hora de finalización debe ser posterior a la hora de inicio.";
    }
  }

  return null;
}