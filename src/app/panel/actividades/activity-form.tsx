"use client";

import { useActionState, useState } from "react";

import type { ActivityFormState } from "@/app/panel/actividades/actions";

type ScheduleValue = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  locationName: string;
};

export type ActivityInitialValues = {
  name: string;
  shortDescription: string;
  description: string;
  category: string;
  professor: string;
  level: string;
  ageFrom: string;
  ageTo: string;
  ageMaximumIsFree: boolean;
  price: string;
  priceDescription: string;
  contactWhatsapp: string;
  schedules: ScheduleValue[];
};

type ActivityFormProps = {
  action: (
    state: ActivityFormState,
    formData: FormData,
  ) => Promise<ActivityFormState>;
  submitLabel: string;
  initialValues?: ActivityInitialValues;
};

const dayOptions = [
  { value: 1, label: "Lunes" },
  { value: 2, label: "Martes" },
  { value: 3, label: "Miércoles" },
  { value: 4, label: "Jueves" },
  { value: 5, label: "Viernes" },
  { value: 6, label: "Sábado" },
  { value: 7, label: "Domingo" },
];

const levelOptions = [
  { value: "", label: "Sin especificar" },
  { value: "basico", label: "Básico" },
  { value: "intermedio", label: "Intermedio" },
  { value: "avanzado", label: "Avanzado" },
  { value: "recreativo", label: "Recreativo" },
  { value: "competitivo", label: "Competitivo" },
  { value: "todos", label: "Todos los niveles" },
];

const defaultValues: ActivityInitialValues = {
  name: "",
  shortDescription: "",
  description: "",
  category: "",
  professor: "",
  level: "",
  ageFrom: "",
  ageTo: "",
  ageMaximumIsFree: false,
  price: "",
  priceDescription: "",
  contactWhatsapp: "",
  schedules: [],
};

const inputClassName =
  "mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

function createDefaultSchedule(dayOfWeek: number): ScheduleValue {
  return {
    dayOfWeek,
    startTime: "18:00",
    endTime: "19:00",
    locationName: "",
  };
}

export function ActivityForm({
  action,
  submitLabel,
  initialValues = defaultValues,
}: ActivityFormProps) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
  });

  const [schedules, setSchedules] = useState<ScheduleValue[]>(
    initialValues.schedules,
  );

  const [ageMaximumIsFree, setAgeMaximumIsFree] = useState(
    initialValues.ageMaximumIsFree,
  );

  function isDaySelected(dayOfWeek: number) {
    return schedules.some(
      (schedule) => schedule.dayOfWeek === dayOfWeek,
    );
  }

  function toggleDay(dayOfWeek: number, selected: boolean) {
    setSchedules((current) => {
      if (selected) {
        if (
          current.some(
            (schedule) => schedule.dayOfWeek === dayOfWeek,
          )
        ) {
          return current;
        }

        return [...current, createDefaultSchedule(dayOfWeek)].sort(
          (first, second) =>
            first.dayOfWeek - second.dayOfWeek,
        );
      }

      return current.filter(
        (schedule) => schedule.dayOfWeek !== dayOfWeek,
      );
    });
  }

  function updateSchedule(
    dayOfWeek: number,
    field: "startTime" | "endTime" | "locationName",
    value: string,
  ) {
    setSchedules((current) =>
      current.map((schedule) =>
        schedule.dayOfWeek === dayOfWeek
          ? {
              ...schedule,
              [field]: value,
            }
          : schedule,
      ),
    );
  }

  return (
    <form action={formAction} className="space-y-8">
      <input
        type="hidden"
        name="schedules_json"
        value={JSON.stringify(schedules)}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Información principal
        </h2>

        <div className="mt-6 grid gap-6">
          <div>
            <label
              htmlFor="name"
              className="text-sm font-medium text-slate-700"
            >
              Nombre de la actividad *
            </label>

            <input
              id="name"
              name="name"
              required
              minLength={2}
              defaultValue={initialValues.name}
              className={inputClassName}
              placeholder="Ej.: Fútbol infantil"
            />
          </div>

          <div>
            <label
              htmlFor="professor"
              className="text-sm font-medium text-slate-700"
            >
              Profesor o responsable *
            </label>

            <input
              id="professor"
              name="professor"
              required
              defaultValue={initialValues.professor}
              className={inputClassName}
              placeholder="Ej.: Martín Pérez"
            />
          </div>

          <div>
            <label
              htmlFor="short_description"
              className="text-sm font-medium text-slate-700"
            >
              Descripción breve
            </label>

            <input
              id="short_description"
              name="short_description"
              defaultValue={initialValues.shortDescription}
              className={inputClassName}
              placeholder="Breve explicación para la tarjeta pública"
            />
          </div>

          <div>
            <label
              htmlFor="description"
              className="text-sm font-medium text-slate-700"
            >
              Descripción completa
            </label>

            <textarea
              id="description"
              name="description"
              rows={5}
              defaultValue={initialValues.description}
              className={inputClassName}
              placeholder="Objetivos, modalidad, requisitos y otra información relevante"
            />
          </div>

          <div>
            <label
              htmlFor="category"
              className="text-sm font-medium text-slate-700"
            >
              Categoría
            </label>

            <input
              id="category"
              name="category"
              defaultValue={initialValues.category}
              className={inputClassName}
              placeholder="Deporte, Cultura, Bienestar..."
            />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Nivel y edades
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div>
            <label
              htmlFor="level"
              className="text-sm font-medium text-slate-700"
            >
              Nivel
            </label>

            <select
              id="level"
              name="level"
              defaultValue={initialValues.level}
              className={inputClassName}
            >
              {levelOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                >
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label
              htmlFor="age_from"
              className="text-sm font-medium text-slate-700"
            >
              Edad mínima
            </label>

            <input
              id="age_from"
              name="age_from"
              type="number"
              min={0}
              defaultValue={initialValues.ageFrom}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="age_to"
              className="text-sm font-medium text-slate-700"
            >
              Edad máxima
            </label>

            <input
              id="age_to"
              name="age_to"
              type="number"
              min={0}
              disabled={ageMaximumIsFree}
              defaultValue={initialValues.ageTo}
              className={`${inputClassName} disabled:bg-slate-100 disabled:text-slate-400`}
            />

            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                name="age_maximum_is_free"
                checked={ageMaximumIsFree}
                onChange={(event) =>
                  setAgeMaximumIsFree(event.target.checked)
                }
              />

              Edad máxima libre
            </label>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Días y horarios
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Seleccioná los días en los que se realiza la actividad.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          {dayOptions.map((day) => {
            const selected = isDaySelected(day.value);

            return (
              <label
                key={day.value}
                className={`flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium transition ${
                  selected
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                <input
                  type="checkbox"
                  checked={selected}
                  onChange={(event) =>
                    toggleDay(day.value, event.target.checked)
                  }
                />

                {day.label}
              </label>
            );
          })}
        </div>

        {schedules.length === 0 ? (
          <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Seleccioná al menos un día.
          </div>
        ) : (
          <div className="mt-6 space-y-5">
            {schedules.map((schedule) => {
              const day = dayOptions.find(
                (option) =>
                  option.value === schedule.dayOfWeek,
              );

              return (
                <div
                  key={schedule.dayOfWeek}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-5"
                >
                  <h3 className="font-semibold text-slate-900">
                    {day?.label}
                  </h3>

                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    <div>
                      <label className="text-sm font-medium">
                        Desde
                      </label>

                      <input
                        type="time"
                        value={schedule.startTime}
                        required
                        onChange={(event) =>
                          updateSchedule(
                            schedule.dayOfWeek,
                            "startTime",
                            event.target.value,
                          )
                        }
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Hasta
                      </label>

                      <input
                        type="time"
                        value={schedule.endTime}
                        required
                        onChange={(event) =>
                          updateSchedule(
                            schedule.dayOfWeek,
                            "endTime",
                            event.target.value,
                          )
                        }
                        className={inputClassName}
                      />
                    </div>

                    <div>
                      <label className="text-sm font-medium">
                        Espacio o salón
                      </label>

                      <input
                        value={schedule.locationName}
                        onChange={(event) =>
                          updateSchedule(
                            schedule.dayOfWeek,
                            "locationName",
                            event.target.value,
                          )
                        }
                        className={inputClassName}
                        placeholder="Cancha principal"
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm">
        <h2 className="text-xl font-semibold">
          Precio y contacto
        </h2>

        <div className="mt-6 grid gap-6 md:grid-cols-2">
          <div>
            <label
              htmlFor="price"
              className="text-sm font-medium"
            >
              Precio
            </label>

            <input
              id="price"
              name="price"
              type="number"
              min={0}
              step="0.01"
              defaultValue={initialValues.price}
              className={inputClassName}
            />
          </div>

          <div>
            <label
              htmlFor="price_description"
              className="text-sm font-medium"
            >
              Modalidad
            </label>

            <input
              id="price_description"
              name="price_description"
              defaultValue={initialValues.priceDescription}
              className={inputClassName}
              placeholder="Mensual, por clase..."
            />
          </div>

          <div className="md:col-span-2">
            <label
              htmlFor="contact_whatsapp"
              className="text-sm font-medium"
            >
              WhatsApp de contacto
            </label>

            <input
              id="contact_whatsapp"
              name="contact_whatsapp"
              inputMode="tel"
              defaultValue={initialValues.contactWhatsapp}
              className={inputClassName}
              placeholder="5491123456789"
            />
          </div>
        </div>
      </section>

      {state.error ? (
        <div
          role="alert"
          className="rounded-xl border border-red-200 bg-red-50 p-5 text-red-800"
        >
          {state.error}
        </div>
      ) : null}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending || schedules.length === 0}
          className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Guardando..." : submitLabel}
        </button>
      </div>
    </form>
  );
}